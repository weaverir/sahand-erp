import assert from "node:assert/strict";
import test from "node:test";
import { defaultDayIsWorking, defaultShiftInterval } from "../modules/attendance/default-shift-policy";

test("Saturday default shift is 07:00–15:00 Tehran", () => {
  assert.deepEqual(defaultShiftInterval({ workDate: "2026-11-14" }), {
    startAt: "2026-11-14T03:30:00.000Z", endAt: "2026-11-14T11:30:00.000Z",
  });
});
test("Friday is a day off", () => assert.equal(defaultShiftInterval({ workDate: "2026-11-13" }), null));
test("Official holiday is a day off", () => assert.equal(defaultShiftInterval({ workDate: "2026-11-14", isHoliday: true }), null));
test("Explicit working override takes precedence", () => assert.ok(defaultShiftInterval({ workDate: "2026-11-13", isHoliday: true, isWorkingDayOverride: true })));
test("Explicit nonworking override takes precedence", () => assert.equal(defaultShiftInterval({ workDate: "2026-11-14", isWorkingDayOverride: false }), null));
test("Invalid dates are rejected", () => assert.throws(() => defaultDayIsWorking({ workDate: "2026-02-30" })));
