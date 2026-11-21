import assert from "node:assert/strict";
import { test } from "node:test";
import {
  calculateDailyWork,
  monthlyLeaveBalance,
  mayCloseMonthlyPeriod,
  jalaliMonthKey,
  type MinuteInterval,
} from "../modules/attendance/monthly-work-policy";

// All timestamps are explicit Tehran offsets. The calendar date is only a
// fixture: production Jalali conversion and period persistence are separate.
const at = (day: number, hh: number, mm = 0): string =>
  `2026-11-${String(day).padStart(2, "0")}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+03:30`;
const interval = (day: number, startHour: number, endHour: number): MinuteInterval => ({
  startAt: at(day, startHour), endAt: at(day, endHour),
});
const minutes = (hours: number) => hours * 60;

test("office: 07-15 shift, 07-10 and 13-15 attendance, 10-13 approved leave => no absence", () => {
  assert.deepEqual(calculateDailyWork({
    required: [interval(19, 7, 15)],
    attendance: [interval(19, 7, 10), interval(19, 13, 15)],
    approvedLeave: [interval(19, 10, 13)],
  }), { requiredMinutes: 480, workedMinutes: 300, leaveCoveredMinutes: 180, coveredMinutes: 480, uncoveredMinutes: 0 });
});

test("office: full-day approved leave without punches does not count as absence", () => {
  assert.deepEqual(calculateDailyWork({
    required: [interval(19, 7, 15)], attendance: [], approvedLeave: [interval(19, 7, 15)],
  }), { requiredMinutes: 480, workedMinutes: 0, leaveCoveredMinutes: 480, coveredMinutes: 480, uncoveredMinutes: 0 });
});

test("office: no punch and no approved leave => entire scheduled shift uncovered", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [], approvedLeave: []});
  assert.equal(r.uncoveredMinutes, 480);
  assert.equal(r.workedMinutes, 0);
});

test("office: employee arrives 30 minutes late without leave => 30 minutes uncovered", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [{startAt: at(19, 7, 30), endAt: at(19, 15)}], approvedLeave: []});
  assert.equal(r.workedMinutes, 450);
  assert.equal(r.uncoveredMinutes, 30);
});

test("office: 30-minute late arrival covered by approved hourly leave => no uncovered time", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [{startAt: at(19, 7, 30), endAt: at(19, 15)}], approvedLeave: [{startAt: at(19, 7), endAt: at(19, 7, 30)}]});
  assert.equal(r.workedMinutes, 450);
  assert.equal(r.leaveCoveredMinutes, 30);
  assert.equal(r.uncoveredMinutes, 0);
});

test("office: physical presence takes precedence over overlapping approved leave", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [interval(19, 7, 12)], approvedLeave: [interval(19, 10, 15)]});
  assert.equal(r.workedMinutes, 300);
  assert.equal(r.leaveCoveredMinutes, 180);
  assert.equal(r.coveredMinutes, 480);
});

test("office: two overlapping approved leave intervals are counted only once", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [], approvedLeave: [interval(19, 9, 12), interval(19, 11, 14)]});
  assert.equal(r.leaveCoveredMinutes, 300);
  assert.equal(r.uncoveredMinutes, 180);
});

test("office: duplicate and overlapping attendance punches cannot inflate worked minutes", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [interval(19, 7, 12), interval(19, 7, 12), interval(19, 11, 15)], approvedLeave: []});
  assert.equal(r.workedMinutes, 480);
  assert.equal(r.coveredMinutes, 480);
});

test("office: leave outside the scheduled shift does not cover or increase required hours", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 15)], attendance: [interval(19, 7, 12)], approvedLeave: [interval(19, 15, 18)]});
  assert.equal(r.leaveCoveredMinutes, 0);
  assert.equal(r.uncoveredMinutes, 180);
});

test("production: split shift with a non-working break only counts required segments", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 11), interval(19, 12, 16)], attendance: [interval(19, 7, 16)], approvedLeave: []});
  assert.equal(r.requiredMinutes, 480);
  assert.equal(r.workedMinutes, 480);
  assert.equal(r.uncoveredMinutes, 0);
});

test("production: leave during a non-working break does not add payable coverage", () => {
  const r = calculateDailyWork({required: [interval(19, 7, 11), interval(19, 12, 16)], attendance: [interval(19, 7, 11), interval(19, 12, 14)], approvedLeave: [interval(19, 11, 12), interval(19, 14, 16)]});
  assert.equal(r.leaveCoveredMinutes, 120);
  assert.equal(r.coveredMinutes, 480);
});

test("production: night shift 22:00 to next day 06:00 with approved leave 02:00-04:00", () => {
  const r = calculateDailyWork({required: [{startAt: at(19, 22), endAt: at(20, 6)}], attendance: [{startAt: at(19, 22), endAt: at(20, 2)}, {startAt: at(20, 4), endAt: at(20, 6)}], approvedLeave: [{startAt: at(20, 2), endAt: at(20, 4)}]});
  assert.equal(r.requiredMinutes, 480);
  assert.equal(r.workedMinutes, 360);
  assert.equal(r.leaveCoveredMinutes, 120);
  assert.equal(r.uncoveredMinutes, 0);
});

test("holiday: no required shift => no absence even without a punch", () => {
  const r = calculateDailyWork({required: [], attendance: [], approvedLeave: []});
  assert.deepEqual(r, {requiredMinutes: 0, workedMinutes: 0, leaveCoveredMinutes: 0, coveredMinutes: 0, uncoveredMinutes: 0});
});

test("holiday: presence outside required time is not treated as scheduled worked minutes", () => {
  const r = calculateDailyWork({required: [], attendance: [interval(19, 9, 13)], approvedLeave: []});
  assert.equal(r.workedMinutes, 0);
  assert.equal(r.uncoveredMinutes, 0);
  // Holiday overtime is a separate calculation and is not asserted here.
});

test("invalid interval: end before start is rejected, not silently converted to absence", () => {
  assert.throws(() => calculateDailyWork({required: [{startAt: at(19, 15), endAt: at(19, 7)}], attendance: [], approvedLeave: []}));
});

test("invalid interval: timestamp without explicit timezone is rejected", () => {
  assert.throws(() => calculateDailyWork({required: [{startAt: "2026-11-19T07:00:00", endAt: "2026-11-19T15:00:00"}], attendance: [], approvedLeave: []}));
});

test("leave ledger: negative 20h + monthly 16h credit => negative 4h", () => {
  assert.equal(monthlyLeaveBalance(-minutes(20), minutes(16), 0), -minutes(4));
});

test("leave ledger: positive 5h + monthly 16h credit - 3h used => positive 18h", () => {
  assert.equal(monthlyLeaveBalance(minutes(5), minutes(16), minutes(3)), minutes(18));
});

test("leave ledger: negative 6h + monthly 16h credit - 12h used => negative 2h", () => {
  assert.equal(monthlyLeaveBalance(-minutes(6), minutes(16), minutes(12)), -minutes(2));
});

test("leave ledger: negative credit or negative usage is rejected", () => {
  assert.throws(() => monthlyLeaveBalance(0, -1, 0));
  assert.throws(() => monthlyLeaveBalance(0, 0, -1));
});

test("month close: only HR can close a reviewed, fully calculated month with no unresolved items", () => {
  const valid = {status: "PENDING_REVIEW" as const, actorIsHrApprover: true, unresolvedCount: 0, calculationComplete: true};
  assert.equal(mayCloseMonthlyPeriod(valid), true);
  assert.equal(mayCloseMonthlyPeriod({...valid, actorIsHrApprover: false}), false);
  assert.equal(mayCloseMonthlyPeriod({...valid, unresolvedCount: 1}), false);
  assert.equal(mayCloseMonthlyPeriod({...valid, calculationComplete: false}), false);
  assert.equal(mayCloseMonthlyPeriod({...valid, status: "OPEN"}), false);
  assert.equal(mayCloseMonthlyPeriod({...valid, status: "CLOSED"}), false);
});

test("Jalali period: 1405-09 key is valid; months 0 and 13 are rejected", () => {
  assert.equal(jalaliMonthKey(1405, 9), "1405-09");
  assert.throws(() => jalaliMonthKey(1405, 0));
  assert.throws(() => jalaliMonthKey(1405, 13));
});
