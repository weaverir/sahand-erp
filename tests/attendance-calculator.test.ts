
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  calculateAttendance,
  type AttendancePunch,
} from "../modules/attendance/attendance-calculator";

const at = (date: string): Date => new Date(date);

function punches(
  ...items: Array<[AttendancePunch["type"], string]>
): AttendancePunch[] {
  return items.map(([type, date]) => ({
    type,
    occurredAt: at(date),
  }));
}

const DAY = "2026-11-18";

test("Full shift: 08:00-16:00", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    scheduledStartAt: `${DAY}T08:00:00+03:30`,
    scheduledEndAt: `${DAY}T16:00:00+03:30`,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T16:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.deficitMinutes, 0);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.lateMinutes, 0);
  assert.equal(result.earlyLeaveMinutes, 0);
  assert.equal(result.isComplete, true);
  assert.equal(result.requiresReview, false);
});

test("Late arrival compensated by late departure", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    scheduledStartAt: `${DAY}T08:00:00+03:30`,
    scheduledEndAt: `${DAY}T16:00:00+03:30`,
    punches: punches(
      ["CHECK_IN", `${DAY}T09:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T17:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.deficitMinutes, 0);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.lateMinutes, 60);
  assert.equal(result.earlyLeaveMinutes, 0);
});

test("Overnight shift: 15:00-00:30", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    scheduledStartAt: `${DAY}T15:00:00+03:30`,
    scheduledEndAt: `${DAY}T23:00:00+03:30`,
    punches: punches(
      ["CHECK_IN", `${DAY}T15:00:00+03:30`],
      ["CHECK_OUT", "2026-11-19T00:30:00+03:30"]
    ),
  });

  assert.equal(result.workedMinutes, 570);
  assert.equal(result.deficitMinutes, 0);
  assert.equal(result.overtimeMinutes, 90);
  assert.equal(result.isComplete, true);
});

test("Two hours of deficit", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    scheduledStartAt: `${DAY}T08:00:00+03:30`,
    scheduledEndAt: `${DAY}T16:00:00+03:30`,
    punches: punches(
      ["CHECK_IN", `${DAY}T09:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T15:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 360);
  assert.equal(result.deficitMinutes, 120);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.lateMinutes, 60);
  assert.equal(result.earlyLeaveMinutes, 60);
});

test("Two working sessions in one day", () => {
  const result = calculateAttendance({
    requiredMinutes: 420,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T11:00:00+03:30`],
      ["CHECK_IN", `${DAY}T12:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T16:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 420);
  assert.equal(result.deficitMinutes, 0);
  assert.equal(result.overtimeMinutes, 0);
  assert.equal(result.isComplete, true);
});

test("Break time is excluded from work", () => {
  const result = calculateAttendance({
    requiredMinutes: 420,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["BREAK_START", `${DAY}T12:00:00+03:30`],
      ["BREAK_END", `${DAY}T13:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T16:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 420);
  assert.equal(result.breakMinutes, 60);
  assert.equal(result.deficitMinutes, 0);
  assert.equal(result.isComplete, true);
});

test("Incomplete attendance is flagged", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`]
    ),
  });

  assert.equal(result.isComplete, false);
  assert.equal(result.requiresReview, true);
  assert.equal(result.overtimeMinutes, 0);
  assert.ok(result.warnings.length > 0);
});

test("Automatic checkout requires review", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["AUTO_CHECK_OUT", `${DAY}T16:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.isComplete, true);
  assert.equal(result.requiresReview, true);
});

test("Working on a day with zero required minutes", () => {
  const result = calculateAttendance({
    requiredMinutes: 0,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T12:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 240);
  assert.equal(result.overtimeMinutes, 240);
  assert.equal(result.deficitMinutes, 0);
});

test("Duplicate check-in requires review", () => {
  const result = calculateAttendance({
    requiredMinutes: 480,
    punches: punches(
      ["CHECK_IN", `${DAY}T08:00:00+03:30`],
      ["CHECK_IN", `${DAY}T09:00:00+03:30`],
      ["CHECK_OUT", `${DAY}T16:00:00+03:30`]
    ),
  });

  assert.equal(result.workedMinutes, 480);
  assert.equal(result.requiresReview, true);
  assert.ok(result.warnings.length > 0);
});

test("Invalid required minutes are rejected", () => {
  assert.throws(() =>
    calculateAttendance({
      requiredMinutes: -1,
      punches: [],
    })
  );

  assert.throws(() =>
    calculateAttendance({
      requiredMinutes: 1500,
      punches: [],
    })
  );
});
