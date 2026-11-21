import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateHrAttendanceEditWindow,
  getLastHrEditablePersianDate,
} from "../modules/attendance/attendance-hr-edit-window";

// Gregorian equivalents are date-only values stored by Prisma @db.Date.
test("10 Azar -> 30 Dey", () => {
  assert.deepEqual(getLastHrEditablePersianDate("2024-11-30"), { year: 1403, month: 10, day: 30 });
});

test("31 Shahrivar -> 30 Mehr (shorter following month)", () => {
  assert.deepEqual(getLastHrEditablePersianDate("2024-09-21"), { year: 1403, month: 7, day: 30 });
});

test("end of Esfand -> Farvardin of next Persian year", () => {
  assert.deepEqual(getLastHrEditablePersianDate("2025-03-19"), { year: 1404, month: 1, day: 31 });
});

test("last editable day is included", () => {
  const result = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2025-01-19T12:00:00Z") });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, "ALLOWED");
});

test("the next Tehran calendar day is excluded", () => {
  const result = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2025-01-20T12:00:00Z") });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, "WINDOW_EXPIRED");
});

test("Tehran local midnight, not UTC midnight, defines the boundary", () => {
  const before = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2025-01-19T20:29:59Z") });
  const after = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2025-01-19T20:30:00Z") });
  assert.equal(before.allowed, true);
  assert.equal(after.reason, "WINDOW_EXPIRED");
});

test("payroll closure blocks edits within the time window", () => {
  const result = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2024-12-05T12:00:00Z"), payrollClosed: true });
  assert.equal(result.reason, "PAYROLL_CLOSED");
});

test("future work dates cannot be corrected", () => {
  const result = evaluateHrAttendanceEditWindow({ workDate: "2024-11-30", now: new Date("2024-11-28T12:00:00Z") });
  assert.equal(result.reason, "FUTURE_WORK_DATE");
});

test("rejects malformed work dates", () => {
  assert.throws(() => getLastHrEditablePersianDate("2024-02-31"));
  assert.throws(() => getLastHrEditablePersianDate("2024-12-01T00:00:00Z"));
});
