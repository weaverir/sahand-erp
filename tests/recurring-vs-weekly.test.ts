import { test } from "node:test";
import { strict as assert } from "node:assert";
import { findRecurringVsWeeklyConflict } from "../modules/shifts/recurring-vs-weekly";
import type { RecurringAssignment } from "../modules/shifts/recurring-shift-conflict";

const assignment = (dayOfWeek: number, startMinute: number, endMinute: number, from = "2027-04-01", to: string | null = null): RecurringAssignment => ({
  id: "night", validFrom: from, validTo: to,
  days: [{ dayOfWeek, startMinute, endMinute, isWorkingDay: true }],
});
const span = (a: string, b: string) => ({ startsAt: new Date(a), endsAt: new Date(b) });
// 2027-04-03 is Saturday (0); 2027-04-04 is Sunday (1).
test("night template conflicts with next-day weekly morning", () => {
  const result = findRecurringVsWeeklyConflict(assignment(0, 22 * 60, 8 * 60), span("2027-04-04T03:30:00Z", "2027-04-04T11:30:00Z"));
  assert.equal(result?.overlapMinutes, 60);
});
test("adjacent weekly morning after night is allowed", () => {
  assert.equal(findRecurringVsWeeklyConflict(assignment(0, 22 * 60, 8 * 60), span("2027-04-04T04:30:00Z", "2027-04-04T11:30:00Z")), null);
});
test("expired recurring origin day does not apply", () => {
  assert.equal(findRecurringVsWeeklyConflict(assignment(0, 22 * 60, 8 * 60, "2027-04-01", "2027-04-02"), span("2027-04-04T03:30:00Z", "2027-04-04T11:30:00Z")), null);
});
test("night shift on last validity date still extends into next morning", () => {
  assert.equal(findRecurringVsWeeklyConflict(assignment(0, 22 * 60, 8 * 60, "2027-04-03", "2027-04-03"), span("2027-04-04T03:30:00Z", "2027-04-04T11:30:00Z"))?.overlapMinutes, 60);
});
test("different weekday is allowed", () => {
  assert.equal(findRecurringVsWeeklyConflict(assignment(2, 22 * 60, 8 * 60), span("2027-04-04T03:30:00Z", "2027-04-04T11:30:00Z")), null);
});
