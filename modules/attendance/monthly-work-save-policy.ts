/** Pure guards for monthly calculation persistence. No authorization is implied. */
export type MonthlyPeriodState =
  | "OPEN" | "CALCULATING" | "PENDING_REVIEW" | "CLOSED" | "REOPENED";

export function assertMonthlyCalculationAllowed(status: MonthlyPeriodState): void {
  if (status !== "OPEN" && status !== "REOPENED") {
    throw new Error(`Monthly calculation is blocked in status ${status}`);
  }
}

export interface MonthlyCalculatedTotals {
  requiredMinutes: number;
  workedMinutes: number;
  approvedLeaveMinutes: number;
  overtimeMinutes: number;
  uncoveredMinutes: number;
  unresolvedCount: number;
  issues?: unknown;
}

export function assertMonthlyTotalsValid(totals: MonthlyCalculatedTotals): void {
  const numericFields = [
    "requiredMinutes", "workedMinutes", "approvedLeaveMinutes",
    "overtimeMinutes", "uncoveredMinutes", "unresolvedCount",
  ] as const;
  for (const key of numericFields) {
    const value = totals[key];
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Invalid monthly total: ${key}`);
    }
  }
}

export function assertMonthlyCloseAllowed(
  status: MonthlyPeriodState,
  summaries: Array<{ unresolvedCount: number }>,
  expectedEmployeeCount: number,
): void {
  if (status !== "PENDING_REVIEW") {
    throw new Error("Only a period pending HR review may be closed");
  }
  if (!Number.isSafeInteger(expectedEmployeeCount) || expectedEmployeeCount < 1) {
    throw new Error("Expected employee count must be positive");
  }
  if (summaries.length !== expectedEmployeeCount) {
    throw new Error("Monthly summaries are incomplete");
  }
  if (summaries.some((s) => s.unresolvedCount !== 0)) {
    throw new Error("Unresolved monthly issues prevent closing");
  }
}
