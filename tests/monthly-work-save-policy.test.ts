import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMonthlyCalculationAllowed,
  assertMonthlyTotalsValid,
  assertMonthlyCloseAllowed,
} from "../modules/attendance/monthly-work-save-policy";

test("only open and reopened months can be recalculated", () => {
  assert.doesNotThrow(() => assertMonthlyCalculationAllowed("OPEN"));
  assert.doesNotThrow(() => assertMonthlyCalculationAllowed("REOPENED"));
  for (const status of ["CALCULATING", "PENDING_REVIEW", "CLOSED"] as const) {
    assert.throws(() => assertMonthlyCalculationAllowed(status));
  }
});

test("reject negative or fractional monthly totals", () => {
  const valid = { requiredMinutes: 480, workedMinutes: 300, approvedLeaveMinutes: 180, overtimeMinutes: 0, uncoveredMinutes: 0, unresolvedCount: 0 };
  assert.doesNotThrow(() => assertMonthlyTotalsValid(valid));
  assert.throws(() => assertMonthlyTotalsValid({ ...valid, uncoveredMinutes: -1 }));
  assert.throws(() => assertMonthlyTotalsValid({ ...valid, workedMinutes: 1.5 }));
});

test("HR close requires pending review, complete summaries and zero issues", () => {
  assert.doesNotThrow(() => assertMonthlyCloseAllowed("PENDING_REVIEW", [{ unresolvedCount: 0 }], 1));
  assert.throws(() => assertMonthlyCloseAllowed("OPEN", [{ unresolvedCount: 0 }], 1));
  assert.throws(() => assertMonthlyCloseAllowed("PENDING_REVIEW", [], 1));
  assert.throws(() => assertMonthlyCloseAllowed("PENDING_REVIEW", [{ unresolvedCount: 26 }], 1));
});


test("diagnostic issues do not invalidate valid numeric totals", () => {
  const valid = { requiredMinutes: 480, workedMinutes: 300, approvedLeaveMinutes: 0, overtimeMinutes: 0, uncoveredMinutes: 180, unresolvedCount: 1 };
  assert.doesNotThrow(() => assertMonthlyTotalsValid({ ...valid, issues: ["Missing checkout"] }));
  assert.throws(() => assertMonthlyTotalsValid({ ...valid, issues: [], unresolvedCount: -1 }));
});
