/**
 * Sahand ERP — HR attendance correction deadline.
 * Dates are civil work dates stored as UTC midnight (@db.Date).
 * The correction window ends on the final Persian-calendar
 * day of the following Persian month, using Asia/Tehran local time.
 * No database or third-party date library is required.
 */

const TEHRAN_TIME_ZONE = "Asia/Tehran";
const DAY_MS = 86_400_000;

const persianDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

const tehranDateFormatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
  timeZone: TEHRAN_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export interface CivilDate {
  year: number;
  month: number;
  day: number;
}

export interface HrAttendanceEditWindow {
  allowed: boolean;
  reason: "ALLOWED" | "WINDOW_EXPIRED" | "FUTURE_WORK_DATE" | "PAYROLL_CLOSED";
  workDatePersian: CivilDate;
  lastEditableDatePersian: CivilDate;
  todayTehran: CivilDate;
}

function extractDate(formatter: Intl.DateTimeFormat, date: Date): CivilDate {
  const parts = formatter.formatToParts(date);
  const numberPart = (type: "year" | "month" | "day") => {
    const value = Number(parts.find((part) => part.type === type)?.value);
    if (!Number.isInteger(value)) throw new Error(`Invalid ${type} in calendar date`);
    return value;
  };
  return { year: numberPart("year"), month: numberPart("month"), day: numberPart("day") };
}

function compareDates(a: CivilDate, b: CivilDate): number {
  return a.year - b.year || a.month - b.month || a.day - b.day;
}

function parseWorkDate(workDate: Date | string): Date {
  if (typeof workDate === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    throw new Error("workDate must be YYYY-MM-DD or a Date");
  }
  const date = typeof workDate === "string" ? new Date(`${workDate}T00:00:00.000Z`) : workDate;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) throw new Error("Invalid workDate");
  if (date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) {
    throw new Error("workDate must be a date-only value (UTC midnight)");
  }
  if (typeof workDate === "string" && date.toISOString().slice(0, 10) !== workDate) {
    throw new Error("Invalid Gregorian workDate");
  }
  return date;
}

function nextPersianMonth(date: CivilDate): Pick<CivilDate, "year" | "month"> {
  return date.month === 12 ? { year: date.year + 1, month: 1 } : { year: date.year, month: date.month + 1 };
}

/**
 * Returns the Persian date of the final editable day (inclusive).
 * For example, 10 Azar -> 30 Dey, and 31 Shahrivar -> 30 Mehr.
 */
export function getLastHrEditablePersianDate(workDate: Date | string): CivilDate {
  const base = parseWorkDate(workDate);
  const original = extractDate(persianDateFormatter, base);
  const target = nextPersianMonth(original);

  // The next Persian month begins 29–31 days after the first day of this month.
  // Searching 65 Gregorian days covers all supported month transitions, including leap years.
  let firstTargetDay: Date | null = null;
  for (let offset = 1; offset <= 65; offset++) {
    const candidate = new Date(base.getTime() + offset * DAY_MS);
    const p = extractDate(persianDateFormatter, candidate);
    if (p.year === target.year && p.month === target.month) {
      firstTargetDay = candidate;
      break;
    }
  }
  if (!firstTargetDay) throw new Error("Could not determine next Persian month");

  let lastDay = 0;
  for (let offset = 0; offset < 32; offset++) {
    const p = extractDate(persianDateFormatter, new Date(firstTargetDay.getTime() + offset * DAY_MS));
    if (p.year !== target.year || p.month !== target.month) break;
    lastDay = p.day;
  }
  if (lastDay === 0) throw new Error("Could not determine Persian month length");
  return { ...target, day: lastDay };
}

/**
 * Checks the civil day in Tehran, not a 24-hour duration.
 * payrollClosed must be supplied from the payroll workflow by the caller.
 */
export function evaluateHrAttendanceEditWindow(input: {
  workDate: Date | string;
  now?: Date;
  payrollClosed?: boolean;
}): HrAttendanceEditWindow {
  const workDate = parseWorkDate(input.workDate);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error("Invalid now");

  const workDatePersian = extractDate(persianDateFormatter, workDate);
  const lastEditableDatePersian = getLastHrEditablePersianDate(workDate);
  const todayGregorian = extractDate(tehranDateFormatter, now);
  // Interpret Tehran's civil Gregorian date as a date-only value for Persian conversion.
  const todayAsUtcDate = new Date(Date.UTC(todayGregorian.year, todayGregorian.month - 1, todayGregorian.day));
  const todayTehran = extractDate(persianDateFormatter, todayAsUtcDate);

  let reason: HrAttendanceEditWindow["reason"] = "ALLOWED";
  if (input.payrollClosed) reason = "PAYROLL_CLOSED";
  else if (compareDates(todayTehran, workDatePersian) < 0) reason = "FUTURE_WORK_DATE";
  else if (compareDates(todayTehran, lastEditableDatePersian) > 0) reason = "WINDOW_EXPIRED";

  return { allowed: reason === "ALLOWED", reason, workDatePersian, lastEditableDatePersian, todayTehran };
}
