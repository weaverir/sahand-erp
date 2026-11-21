/** Pure policy for comparing recurring shift templates assigned to the SAME employee.
 * Calendar dates are ISO Gregorian dates in the Tehran local calendar.
 * Saturday=0 ... Friday=6. Intervals are half-open, so touching is allowed.
 * No database reads or writes occur here.
 */
export type RecurringShiftDay = {
  dayOfWeek: number;
  isWorkingDay: boolean;
  startMinute: number | null;
  endMinute: number | null;
  dayType?: string;
};
export type RecurringAssignment = {
  id: string;
  validFrom: string;
  validTo: string | null;
  days: RecurringShiftDay[];
};
export type RecurringConflict = {
  firstAssignmentId: string;
  secondAssignmentId: string;
  workDate: string;
  overlapMinutes: number;
};
const DAY = 86_400_000;
const TEHRAN_OFFSET = 210 * 60_000;
function parseDate(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid ISO date');
  const n = Date.parse(`${value}T00:00:00.000Z`);
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== value) throw new Error('Invalid ISO date');
  return n;
}
function validate(a: RecurringAssignment): void {
  const from = parseDate(a.validFrom);
  if (a.validTo !== null && parseDate(a.validTo) < from) throw new Error('Invalid assignment dates');
  for (const d of a.days) {
    if (!Number.isInteger(d.dayOfWeek) || d.dayOfWeek < 0 || d.dayOfWeek > 6) throw new Error('Invalid weekday');
    if (!d.isWorkingDay) continue;
    if (!Number.isInteger(d.startMinute) || !Number.isInteger(d.endMinute) ||
        d.startMinute === null || d.endMinute === null ||
        d.startMinute < 0 || d.startMinute > 1439 || d.endMinute < 0 || d.endMinute > 1439 ||
        d.startMinute === d.endMinute) throw new Error('Invalid working hours');
  }
}
function weekday(day: number): number { return (new Date(day).getUTCDay() + 1) % 7; }
function segments(a: RecurringAssignment, date: number): Array<[number, number]> {
  const dow = weekday(date);
  return a.days.filter(d => d.isWorkingDay && d.dayOfWeek === dow).map(d => {
    const start = date + d.startMinute! * 60_000 - TEHRAN_OFFSET;
    const end = date + (d.endMinute! <= d.startMinute! ? d.endMinute! + 1440 : d.endMinute!) * 60_000 - TEHRAN_OFFSET;
    return [start, end];
  });
}
/**
 * Compare the two recurring assignments over their shared validity dates.
 * A 7-day cycle repeats, so testing one full week plus the preceding day is
 * sufficient even for assignments without an end date. The preceding day
 * catches overnight shifts entering the first shared day.
 * If the assignments are for different employees, do NOT call this function.
 */
export function findRecurringShiftConflict(a: RecurringAssignment, b: RecurringAssignment): RecurringConflict | null {
  validate(a); validate(b);
  const from = Math.max(parseDate(a.validFrom), parseDate(b.validFrom));
  const to = Math.min(a.validTo === null ? Infinity : parseDate(a.validTo), b.validTo === null ? Infinity : parseDate(b.validTo));
  if (from > to + DAY) return null;
  // Include previous origin date for overnight shifts; only active origin days count.
  for (let day = from - DAY; day <= Math.min(to + DAY, from + 8 * DAY); day += DAY) {
    const aActive = day >= parseDate(a.validFrom) && (a.validTo === null || day <= parseDate(a.validTo));
    const bActive = day >= parseDate(b.validFrom) && (b.validTo === null || day <= parseDate(b.validTo));
    const aToday = aActive ? segments(a, day) : [];
    const bToday = bActive ? segments(b, day) : [];
    const bPrevActive = day - DAY >= parseDate(b.validFrom) && (b.validTo === null || day - DAY <= parseDate(b.validTo));
    const aPrevActive = day - DAY >= parseDate(a.validFrom) && (a.validTo === null || day - DAY <= parseDate(a.validTo));
    const aAll = [...aToday, ...(aPrevActive ? segments(a, day - DAY) : [])];
    const bAll = [...bToday, ...(bPrevActive ? segments(b, day - DAY) : [])];
    for (const [as, ae] of aAll) for (const [bs, be] of bAll) {
      const overlapMinutes = Math.max(0, Math.min(ae, be) - Math.max(as, bs)) / 60_000;
      if (overlapMinutes > 0) return {
        firstAssignmentId: a.id, secondAssignmentId: b.id,
        workDate: new Date(day).toISOString().slice(0, 10), overlapMinutes,
      };
    }
  }
  return null;
}
