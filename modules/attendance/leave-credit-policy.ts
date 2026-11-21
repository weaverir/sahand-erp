/** Pure Jalali monthly leave entitlement calculations. No database writes. */
export const FULL_MONTH_LEAVE_CREDIT_MINUTES = 1180;

export interface ProratedLeaveCreditInput {
  /** Calendar days in the Jalali month: 29, 30, or 31. */
  daysInMonth: 29 | 30 | 31;
  /** Inclusive calendar day of employment start in this month, if applicable. */
  employedFromDay?: number;
  /** Inclusive calendar day of employment end in this month, if applicable. */
  employedThroughDay?: number;
}

export interface ProratedLeaveCreditResult {
  eligibleDays: number;
  daysInMonth: number;
  /** Exact numerator for entitlement in minute-days; no rounding yet. */
  exactNumerator: number;
  exactDenominator: number;
  /** Rounded to nearest whole minute; exactly half a minute rounds up. */
  creditedMinutes: number;
}

function integerInRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}`);
  }
}

/**
 * Prorates the monthly allowance by inclusive calendar days of employment.
 * Missing start/end means employment covers that edge of the month.
 * Callers must first determine the actual Jalali month length and translate
 * verified employment dates into local Jalali day numbers.
 *
 * A start later than an end means no eligible days in this month.
 */
export function calculateProratedLeaveCredit(
  input: ProratedLeaveCreditInput,
): ProratedLeaveCreditResult {
  const { daysInMonth } = input;
  if (![29, 30, 31].includes(daysInMonth)) {
    throw new Error("daysInMonth must be 29, 30, or 31");
  }
  const from = input.employedFromDay ?? 1;
  const through = input.employedThroughDay ?? daysInMonth;
  integerInRange(from, 1, daysInMonth, "employedFromDay");
  integerInRange(through, 1, daysInMonth, "employedThroughDay");
  const eligibleDays = Math.max(0, through - from + 1);
  const exactNumerator = FULL_MONTH_LEAVE_CREDIT_MINUTES * eligibleDays;
  const creditedMinutes = Math.floor((2 * exactNumerator + daysInMonth) / (2 * daysInMonth));
  return {
    eligibleDays,
    daysInMonth,
    exactNumerator,
    exactDenominator: daysInMonth,
    creditedMinutes,
  };
}

/**
 * Signed balance: positive = unused leave; negative = leave taken in advance.
 * Ledger usage entries must be negative and credits positive.
 */
export function calculateSignedLeaveBalance(entries: readonly number[]): number {
  let balance = 0;
  for (const minutes of entries) {
    if (!Number.isSafeInteger(minutes)) throw new Error("Ledger minutes must be safe integers");
    balance += minutes;
    if (!Number.isSafeInteger(balance)) throw new Error("Leave balance overflow");
  }
  return balance;
}
