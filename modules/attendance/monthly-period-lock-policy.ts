/** Pure policy for guarding changes that affect persisted monthly payroll inputs.
 * This is deliberately independent of Prisma and authorization. The caller must
 * acquire the matching period row lock in its write transaction BEFORE using it.
 */
import { getJalaliMonthBounds } from "./jalali-monthly-period";
import type { MonthlyPeriodState } from "./monthly-work-save-policy";

export type PeriodLockState = MonthlyPeriodState | null;

export class ClosedMonthlyPeriodError extends Error {
  readonly statusCode = 409;
  constructor() {
    super("دوره حضور و غیاب بسته شده است و تغییر اطلاعات مؤثر بر آن مجاز نیست.");
    this.name = "ClosedMonthlyPeriodError";
  }
}

export function assertMonthlyPeriodWritable(status: PeriodLockState): void {
  if (status === "CLOSED") throw new ClosedMonthlyPeriodError();
}

/** Half-open UTC interval overlap; adjacent intervals are not overlapping. */
export function overlapsMonthlyPeriod(
  changeStart: Date,
  changeEnd: Date,
  periodStart: Date,
  periodEnd: Date,
): boolean {
  const values = [changeStart, changeEnd, periodStart, periodEnd].map((d) => d.getTime());
  if (values.some((n) => !Number.isFinite(n))) throw new Error("Invalid interval date");
  if (values[0] >= values[1] || values[2] >= values[3]) throw new Error("Invalid interval bounds");
  return values[0] < values[3] && values[2] < values[1];
}

/** Used by callers that already know the Jalali year/month of the affected date. */
export function periodContainsInstant(year: number, month: number, at: Date): boolean {
  const { startsAt, endsAt } = getJalaliMonthBounds(year, month);
  const value = at.getTime();
  if (!Number.isFinite(value)) throw new Error("Invalid instant");
  return value >= startsAt.getTime() && value < endsAt.getTime();
}
