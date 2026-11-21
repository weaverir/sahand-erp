import test from "node:test";
import assert from "node:assert/strict";
import { classifyDayKind, classifySpecialWork } from "../modules/attendance/holiday-work-policy";
import { aggregateMonthlyWork } from "../modules/attendance/monthly-work-aggregation";
const interval = { startAt: "2026-02-20T04:00:00.000Z", endAt: "2026-02-20T12:00:00.000Z" };

test("Friday is included in unified holiday work", () => {
  const kind = classifyDayKind({ workDate: "2026-02-20" });
  assert.equal(kind, "FRIDAY");
  assert.deepEqual(classifySpecialWork(kind, [interval]), { holidayWorkMinutes: 480 });
});
test("official holiday on Friday counts only once", () => {
  const kind = classifyDayKind({ workDate: "2026-02-20", isHoliday: true });
  assert.equal(kind, "OFFICIAL_HOLIDAY");
  assert.deepEqual(classifySpecialWork(kind, [interval, interval]), { holidayWorkMinutes: 480 });
});
test("ordinary day does not count as holiday work", () => {
  assert.deepEqual(classifySpecialWork("REGULAR", [interval]), { holidayWorkMinutes: 0 });
});
test("working-day override removes holiday classification", () => {
  assert.equal(classifyDayKind({ workDate: "2026-02-20", isHoliday: true, isWorkingDayOverride: true }), "REGULAR");
});
test("attendance on a holiday without scheduled hours counts", () => {
  const result = aggregateMonthlyWork([{ workDate: "2026-02-20", dayKind: "FRIDAY", required: [], attendance: [interval], approvedLeave: [] }]);
  assert.equal(result.holidayWorkMinutes, 480);
  assert.equal(result.requiredMinutes, 0);
  assert.equal(result.uncoveredMinutes, 0);
  assert.equal("fridayWorkMinutes" in result, false);
});
test("approved holiday shift retains worked hours without doubling holiday minutes", () => {
  const result = aggregateMonthlyWork([{ workDate: "2026-02-20", dayKind: "OFFICIAL_HOLIDAY", required: [interval], attendance: [interval], approvedLeave: [] }]);
  assert.equal(result.workedMinutes, 480);
  assert.equal(result.holidayWorkMinutes, 480);
});
