import assert from "node:assert/strict";
import test from "node:test";
import { calculateDailyWork, type MinuteInterval } from "../modules/attendance/monthly-work-policy";
import { aggregateMonthlyWork } from "../modules/attendance/monthly-work-aggregation";
import {
  assertMonthlyCalculationAllowed,
  assertMonthlyCloseAllowed,
  assertMonthlyTotalsValid,
} from "../modules/attendance/monthly-work-save-policy";

const base = Date.parse("2026-11-01T00:00:00.000Z");
const at = (minute: number) => new Date(base + minute * 60_000).toISOString();
const interval = (start: number, end: number): MinuteInterval => ({ startAt: at(start), endAt: at(end) });
const validTotals = () => ({ requiredMinutes: 480, workedMinutes: 300, approvedLeaveMinutes: 180, overtimeMinutes: 0, uncoveredMinutes: 0, unresolvedCount: 0 });

// Independent minute-level oracle. This intentionally does not reuse production interval math.
function oracle(required: MinuteInterval[], attendance: MinuteInterval[], leave: MinuteInterval[]) {
  const toSet = (intervals: MinuteInterval[]) => {
    const result = new Set<number>();
    for (const item of intervals) {
      const start = (Date.parse(item.startAt) - base) / 60_000;
      const end = (Date.parse(item.endAt) - base) / 60_000;
      for (let minute = start; minute < end; minute++) result.add(minute);
    }
    return result;
  };
  const r = toSet(required), a = toSet(attendance), l = toSet(leave);
  let worked = 0, coveredLeave = 0;
  for (const minute of r) {
    if (a.has(minute)) worked++;
    else if (l.has(minute)) coveredLeave++;
  }
  return { requiredMinutes: r.size, workedMinutes: worked, leaveCoveredMinutes: coveredLeave,
    coveredMinutes: worked + coveredLeave, uncoveredMinutes: r.size - worked - coveredLeave };
}

function rng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function randomIntervals(random: () => number, count: number): MinuteInterval[] {
  return Array.from({ length: count }, () => {
    const start = Math.floor(random() * 1440) - 240;
    const length = 1 + Math.floor(random() * 720);
    return interval(start, start + length);
  });
}

test("reference scenario: 8h required, 5h presence, 3h approved leave", () => {
  const actual = calculateDailyWork({ required: [interval(0,480)], attendance: [interval(0,300)], approvedLeave: [interval(300,480)] });
  assert.deepEqual(actual, { requiredMinutes:480, workedMinutes:300, leaveCoveredMinutes:180, coveredMinutes:480, uncoveredMinutes:0 });
});

test("overlapping attendance takes priority over leave; no double counting", () => {
  const input = { required: [interval(0,480)], attendance: [interval(0,360)], approvedLeave: [interval(240,480)] };
  assert.deepEqual(calculateDailyWork(input), oracle(input.required,input.attendance,input.approvedLeave));
});

test("duplicate and overlapping intervals do not inflate totals", () => {
  const input = { required:[interval(0,480),interval(0,480),interval(100,300)], attendance:[interval(0,300),interval(0,300)], approvedLeave:[interval(300,480),interval(300,480)] };
  assert.deepEqual(calculateDailyWork(input), oracle(input.required,input.attendance,input.approvedLeave));
});

test("overnight shifts across UTC dates remain minute-accurate", () => {
  const input = { required:[interval(1320,1800)], attendance:[interval(1320,1620)], approvedLeave:[interval(1620,1800)] };
  assert.deepEqual(calculateDailyWork(input), oracle(input.required,input.attendance,input.approvedLeave));
});

test("multiple shifts, breaks, and leave spanning shift boundaries", () => {
  const input = { required:[interval(0,240),interval(300,540)], attendance:[interval(30,180),interval(360,450)], approvedLeave:[interval(160,400),interval(460,520)] };
  assert.deepEqual(calculateDailyWork(input), oracle(input.required,input.attendance,input.approvedLeave));
});

test("attendance and leave outside required schedule never create required work", () => {
  const input = { required:[interval(100,200)], attendance:[interval(0,400)], approvedLeave:[interval(0,400)] };
  assert.deepEqual(calculateDailyWork(input), oracle(input.required,input.attendance,input.approvedLeave));
});

test("empty schedule with presence and leave has zero required/covered minutes", () => {
  assert.deepEqual(calculateDailyWork({required:[],attendance:[interval(0,300)],approvedLeave:[interval(0,480)]}), oracle([], [interval(0,300)], [interval(0,480)]));
});

test("invalid timestamps, reversed, zero, and sub-minute intervals are rejected", () => {
  const invalid: MinuteInterval[] = [
    {startAt:"not-a-date",endAt:at(5)},
    {startAt:"2026-11-01T00:00:00",endAt:at(5)},
    interval(10,10), interval(10,9),
    {startAt:"2026-11-01T00:00:30.000Z",endAt:at(5)},
  ];
  for (const item of invalid) assert.throws(() => calculateDailyWork({required:[item],attendance:[],approvedLeave:[]}));
});

test("5,000 deterministic randomized scenarios match independent minute oracle", () => {
  const random = rng(0x5A4A4D);
  for (let caseNo=0;caseNo<5000;caseNo++) {
    const required = randomIntervals(random,Math.floor(random()*5));
    const attendance = randomIntervals(random,Math.floor(random()*6));
    const approvedLeave = randomIntervals(random,Math.floor(random()*6));
    const expected = oracle(required,attendance,approvedLeave);
    const actual = calculateDailyWork({required,attendance,approvedLeave});
    assert.deepEqual(actual,expected,`Random scenario ${caseNo}, seed 0x5A4A4D`);
    assert.equal(actual.workedMinutes+actual.leaveCoveredMinutes+actual.uncoveredMinutes,actual.requiredMinutes);
  }
});

test("monthly aggregation is order-independent and never duplicates a work date", () => {
  const days = [
    {workDate:"2026-11-01",required:[interval(0,480)],attendance:[interval(0,300)],approvedLeave:[interval(300,480)]},
    {workDate:"2026-11-02",required:[interval(1440,1920)],attendance:[interval(1440,1740)],approvedLeave:[],unresolvedReasons:["Missing leave decision"]},
  ];
  const forward = aggregateMonthlyWork(days), backward = aggregateMonthlyWork([...days].reverse());
  assert.deepEqual(forward, backward);
  assert.throws(()=>aggregateMonthlyWork([days[0],days[0]]),/Duplicate workDate/);
});

test("monthly unresolved reasons are counted without silently dropping them", () => {
  const result = aggregateMonthlyWork([{workDate:"2026-11-01",required:[],attendance:[],approvedLeave:[],unresolvedReasons:["No schedule","Unpaired punch"]}]);
  assert.equal(result.unresolvedCount,2);
  assert.equal(result.issues.length,2);
  assert.throws(()=>aggregateMonthlyWork([{workDate:"2026-11-01",required:[],attendance:[],approvedLeave:[],unresolvedReasons:["   "]}]));
});

test("all disallowed calculation states fail closed", () => {
  for (const state of ["CALCULATING","PENDING_REVIEW","CLOSED"] as const) assert.throws(()=>assertMonthlyCalculationAllowed(state));
  for (const state of ["OPEN","REOPENED"] as const) assert.doesNotThrow(()=>assertMonthlyCalculationAllowed(state));
});

test("all numeric totals reject negative, fractional, NaN, Infinity and unsafe integers", () => {
  for (const field of Object.keys(validTotals()) as Array<keyof ReturnType<typeof validTotals>>) {
    for (const value of [-1,0.5,NaN,Infinity,-Infinity,Number.MAX_SAFE_INTEGER+1]) {
      assert.throws(()=>assertMonthlyTotalsValid({...validTotals(),[field]:value}),`${field}=${value}`);
    }
  }
});

test("HR close requires exact completeness, no issues and pending-review status", () => {
  assert.doesNotThrow(()=>assertMonthlyCloseAllowed("PENDING_REVIEW",[{unresolvedCount:0},{unresolvedCount:0}],2));
  for (const state of ["OPEN","REOPENED","CALCULATING","CLOSED"] as const) assert.throws(()=>assertMonthlyCloseAllowed(state,[{unresolvedCount:0}],1));
  for (const count of [0,-1,1.5,NaN,Infinity]) assert.throws(()=>assertMonthlyCloseAllowed("PENDING_REVIEW",[{unresolvedCount:0}],count));
  assert.throws(()=>assertMonthlyCloseAllowed("PENDING_REVIEW",[{unresolvedCount:0}],2));
  assert.throws(()=>assertMonthlyCloseAllowed("PENDING_REVIEW",[{unresolvedCount:0},{unresolvedCount:0}],1));
  assert.throws(()=>assertMonthlyCloseAllowed("PENDING_REVIEW",[{unresolvedCount:1}],1));
});
