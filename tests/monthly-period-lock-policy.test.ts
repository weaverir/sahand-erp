import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ClosedMonthlyPeriodError,
  assertMonthlyPeriodWritable,
  overlapsMonthlyPeriod,
  periodContainsInstant,
} from "../modules/attendance/monthly-period-lock-policy";
import { getJalaliMonthBounds } from "../modules/attendance/jalali-monthly-period";

test("closed period rejects writes with 409", () => {
  assert.throws(() => assertMonthlyPeriodWritable("CLOSED"), (e: unknown) =>
    e instanceof ClosedMonthlyPeriodError && e.statusCode === 409);
});

test("all other current states preserve previous write behavior", () => {
  for (const state of [null, "OPEN", "CALCULATING", "PENDING_REVIEW", "REOPENED"] as const)
    assert.doesNotThrow(() => assertMonthlyPeriodWritable(state));
});

test("adjacent intervals do not overlap", () => {
  const a = new Date("2026-11-01T00:00:00Z");
  const b = new Date("2026-11-02T00:00:00Z");
  const c = new Date("2026-11-03T00:00:00Z");
  assert.equal(overlapsMonthlyPeriod(a, b, b, c), false);
  assert.equal(overlapsMonthlyPeriod(a, c, b, c), true);
});

test("Jalali month boundaries are half-open", () => {
  const { startsAt, endsAt } = getJalaliMonthBounds(1405, 8);
  assert.equal(periodContainsInstant(1405, 8, startsAt), true);
  assert.equal(periodContainsInstant(1405, 8, new Date(endsAt.getTime() - 1)), true);
  assert.equal(periodContainsInstant(1405, 8, endsAt), false);
});

test("invalid date ranges are rejected", () => {
  const d = new Date("2026-11-01T00:00:00Z");
  assert.throws(() => overlapsMonthlyPeriod(d, d, d, new Date(d.getTime() + 1000)));
});
