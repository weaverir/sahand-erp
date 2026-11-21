import assert from "node:assert/strict";
import test from "node:test";
import { isBeforeLeaveCutover } from "../modules/attendance/leave-cutover-policy";

test("legacy months before opening cutover are blocked", () => {
  const opening = { startJalaliYear: 1405, startJalaliMonth: 9 };
  assert.equal(isBeforeLeaveCutover(1405, 8, opening), true);
  assert.equal(isBeforeLeaveCutover(1404, 12, opening), true);
  assert.equal(isBeforeLeaveCutover(1405, 9, opening), false);
  assert.equal(isBeforeLeaveCutover(1405, 10, opening), false);
  assert.equal(isBeforeLeaveCutover(1406, 1, opening), false);
});
test("new employees without opening balance retain normal accrual", () => {
  assert.equal(isBeforeLeaveCutover(1405, 1, null), false);
});
test("invalid cutover periods fail closed", () => {
  assert.throws(() => isBeforeLeaveCutover(1405, 0, null));
  assert.throws(() => isBeforeLeaveCutover(1405, 9, { startJalaliYear: 1405, startJalaliMonth: 13 }));
});
