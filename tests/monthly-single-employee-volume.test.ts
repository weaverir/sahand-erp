import assert from "node:assert/strict";
import test from "node:test";
import { performance } from "node:perf_hooks";
import { calculateDailyWork, type MinuteInterval } from "../modules/attendance/monthly-work-policy";
import { aggregateMonthlyWork, type MonthlyWorkDay } from "../modules/attendance/monthly-work-aggregation";

// One employee, 31 consecutive business dates. Deliberately extreme, not a realistic punch volume.
const ORIGIN = Date.parse("2026-10-01T00:00:00.000Z");
const DAY = 1440;
const stamp = (minute: number) => new Date(ORIGIN + minute * 60000).toISOString();
const span = (start: number, end: number): MinuteInterval => ({ startAt: stamp(start), endAt: stamp(end) });
function random(seed: number) {
  let s = seed >>> 0;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
}
function independentOracle(required: MinuteInterval[], attendance: MinuteInterval[], approvedLeave: MinuteInterval[]) {
  // Independent minute-by-minute reference, including overlap and duplicate suppression.
  const points = [required, attendance, approvedLeave].flat();
  const low = Math.min(...points.map(x => Date.parse(x.startAt)));
  const high = Math.max(...points.map(x => Date.parse(x.endAt)));
  const length = (high - low) / 60000;
  assert.ok(length < 10000, "Oracle horizon unexpectedly large");
  const bits = [new Uint8Array(length), new Uint8Array(length), new Uint8Array(length)];
  for (const [kind, items] of [required, attendance, approvedLeave].entries()) {
    for (const item of items) {
      const from = (Date.parse(item.startAt) - low) / 60000;
      const to = (Date.parse(item.endAt) - low) / 60000;
      bits[kind].fill(1, from, to);
    }
  }
  let requiredMinutes = 0, workedMinutes = 0, leaveCoveredMinutes = 0;
  for (let i = 0; i < length; i++) {
    if (!bits[0][i]) continue;
    requiredMinutes++;
    if (bits[1][i]) workedMinutes++;
    else if (bits[2][i]) leaveCoveredMinutes++;
  }
  return { requiredMinutes, workedMinutes, leaveCoveredMinutes,
    coveredMinutes: workedMinutes + leaveCoveredMinutes,
    uncoveredMinutes: requiredMinutes - workedMinutes - leaveCoveredMinutes };
}
function makeMonth(seed: number, intervalsPerDay: number): MonthlyWorkDay[] {
  const rnd = random(seed);
  return Array.from({ length: 31 }, (_, day) => {
    const start = day * DAY;
    // Four required intervals: split shifts, breaks, and an overnight tail.
    const required = [span(start + 420, start + 660), span(start + 690, start + 930),
      span(start + 1080, start + 1200), span(start + 1380, start + 1500)];
    const attendance: MinuteInterval[] = [];
    const approvedLeave: MinuteInterval[] = [];
    for (let i = 0; i < intervalsPerDay; i++) {
      const offset = Math.floor(rnd() * 1700) - 100;
      const duration = 1 + Math.floor(rnd() * 300);
      const item = span(start + offset, start + offset + duration);
      (i % 3 === 0 ? approvedLeave : attendance).push(item);
      if (i % 17 === 0) (i % 3 === 0 ? approvedLeave : attendance).push({ ...item });
    }
    return { workDate: new Date(ORIGIN + day * 86400000).toISOString().slice(0, 10),
      required, attendance, approvedLeave };
  });
}

test("one employee: 31 dense days match independent minute oracle and monthly totals", () => {
  const days = makeMonth(0x5A4A4D, 350);
  const begin = performance.now();
  const expected = { requiredMinutes: 0, workedMinutes: 0, approvedLeaveMinutes: 0, uncoveredMinutes: 0 };
  for (const day of days) {
    const oracle = independentOracle(day.required, day.attendance, day.approvedLeave);
    assert.deepEqual(calculateDailyWork(day), oracle, `Mismatch on ${day.workDate}`);
    expected.requiredMinutes += oracle.requiredMinutes;
    expected.workedMinutes += oracle.workedMinutes;
    expected.approvedLeaveMinutes += oracle.leaveCoveredMinutes;
    expected.uncoveredMinutes += oracle.uncoveredMinutes;
  }
  const actual = aggregateMonthlyWork(days);
  for (const [key, value] of Object.entries(expected)) {
    assert.equal(actual[key as keyof typeof expected], value, key);
  }
  assert.equal(actual.unresolvedCount, 0);
  console.log(JSON.stringify({ scenario: "single-employee-dense-month", days: days.length,
    inputIntervals: days.reduce((sum, d) => sum + d.required.length + d.attendance.length + d.approvedLeave.length, 0),
    elapsedMs: Math.round(performance.now() - begin), totals: expected }));
});

test("same employee: shuffled and duplicated intervals never change the monthly result", () => {
  const days = makeMonth(0xBADC0DE, 200);
  const baseline = aggregateMonthlyWork(days);
  const altered = days.map(d => ({ ...d,
    required: [...d.required].reverse(),
    attendance: [...d.attendance].reverse().concat(d.attendance.slice(0, 10)),
    approvedLeave: [...d.approvedLeave].reverse().concat(d.approvedLeave.slice(0, 10)),
  })).reverse();
  assert.deepEqual(aggregateMonthlyWork(altered), baseline);
});

test("same employee: 30 different dense months, independently verified", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const days = makeMonth(seed * 123457, 80);
    const monthly = aggregateMonthlyWork(days);
    const expected = days.map(d => independentOracle(d.required, d.attendance, d.approvedLeave));
    assert.equal(monthly.requiredMinutes, expected.reduce((s, d) => s + d.requiredMinutes, 0), `seed=${seed}`);
    assert.equal(monthly.workedMinutes, expected.reduce((s, d) => s + d.workedMinutes, 0), `seed=${seed}`);
    assert.equal(monthly.approvedLeaveMinutes, expected.reduce((s, d) => s + d.leaveCoveredMinutes, 0), `seed=${seed}`);
    assert.equal(monthly.uncoveredMinutes, expected.reduce((s, d) => s + d.uncoveredMinutes, 0), `seed=${seed}`);
  }
});
