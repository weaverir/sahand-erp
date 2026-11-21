import assert from "node:assert/strict";
import test from "node:test";
import { aggregateMonthlyWork } from "../modules/attendance/monthly-work-aggregation";

const interval = (start: string, end: string) => ({
  startAt: `2026-11-22T${start}:00+03:30`,
  endAt: `2026-11-22T${end}:00+03:30`,
});

test("office: 5h work and 3h approved leave covers an 8h shift", () => {
  const result = aggregateMonthlyWork([{
    workDate: "2026-11-22",
    required: [interval("07:00", "15:00")],
    attendance: [interval("07:00", "10:00"), interval("13:00", "15:00")],
    approvedLeave: [interval("10:00", "13:00")],
  }]);
  assert.deepEqual([result.requiredMinutes, result.workedMinutes,
    result.approvedLeaveMinutes, result.uncoveredMinutes, result.unresolvedCount],
    [480, 300, 180, 0, 0]);
});

test("missing approved schedule is an unresolved issue, not automatically a day off", () => {
  const result = aggregateMonthlyWork([{
    workDate: "2026-11-22", required: [], attendance: [], approvedLeave: [],
    unresolvedReasons: ["MISSING_APPROVED_SCHEDULE"],
  }]);
  assert.equal(result.unresolvedCount, 1);
});

test("same day cannot be aggregated twice across organizational assignments", () => {
  const day = { workDate: "2026-11-22", required: [], attendance: [], approvedLeave: [] };
  assert.throws(() => aggregateMonthlyWork([day, day]), /Duplicate workDate/);
});

test("unresolved punch prevents a clean monthly summary", () => {
  const result = aggregateMonthlyWork([{
    workDate: "2026-11-22", required: [], attendance: [], approvedLeave: [],
    unresolvedReasons: ["OPEN_PUNCH", "PENDING_ATTENDANCE_ADJUSTMENT"],
  }]);
  assert.equal(result.unresolvedCount, 2);
});

test("empty month has no invented working hours", () => {
  const result = aggregateMonthlyWork([]);
  assert.equal(result.requiredMinutes, 0);
  assert.equal(result.unresolvedCount, 0);
});
