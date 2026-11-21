import test from "node:test";
import assert from "node:assert/strict";
import { getTehranWorkDateBounds } from "../modules/attendance/tehran-work-date-bounds";
import { getJalaliMonthBounds } from "../modules/attendance/jalali-monthly-period";
import { overlapsMonthlyPeriod } from "../modules/attendance/monthly-period-lock-policy";

test("Tehran civil day starts at 20:30 UTC on previous date", () => {
  const result = getTehranWorkDateBounds(new Date("2026-11-21T00:00:00.000Z"));
  assert.equal(result.startsAt.toISOString(), "2026-11-20T20:30:00.000Z");
  assert.equal(result.endsAt.toISOString(), "2026-11-21T20:30:00.000Z");
});

test("Jalali first day belongs to new period, not previous", () => {
  const month = getJalaliMonthBounds(1405, 9);
  const dateOnly = new Date(month.startsAt.getTime() + 210 * 60_000);
  const day = getTehranWorkDateBounds(dateOnly);
  assert.equal(day.startsAt.getTime(), month.startsAt.getTime());
  assert.equal(overlapsMonthlyPeriod(day.startsAt, day.endsAt, month.startsAt, month.endsAt), true);
  const previous = getJalaliMonthBounds(1405, 8);
  assert.equal(overlapsMonthlyPeriod(day.startsAt, day.endsAt, previous.startsAt, previous.endsAt), false);
});

test("rejects non-date-only timestamp", () => {
  assert.throws(() => getTehranWorkDateBounds(new Date("2026-11-21T10:00:00Z")));
});
