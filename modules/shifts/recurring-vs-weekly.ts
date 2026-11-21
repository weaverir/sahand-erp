import type { RecurringAssignment } from "./recurring-shift-conflict";

/** Compare an approved, absolute-time weekly segment against a recurring shift.
 * Both validity dates and weekdays refer to Tehran-local Gregorian dates.
 * The segment's actual timestamps are authoritative; it may cross midnight.
 */
export function findRecurringVsWeeklyConflict(
  recurring: RecurringAssignment,
  segment: { startsAt: Date; endsAt: Date },
): { workDate: string; overlapMinutes: number } | null {
  const start = segment.startsAt.getTime();
  const end = segment.endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error("Invalid weekly segment interval");
  }
  const dayMs = 86_400_000;
  const offsetMs = 210 * 60_000;
  const dateMs = (s: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Invalid recurring date");
    const n = Date.parse(`${s}T00:00:00.000Z`);
    if (!Number.isFinite(n) || new Date(n).toISOString().slice(0, 10) !== s) throw new Error("Invalid recurring date");
    return n;
  };
  const validFrom = dateMs(recurring.validFrom);
  const validTo = recurring.validTo === null ? Infinity : dateMs(recurring.validTo);
  if (validTo < validFrom) throw new Error("Invalid recurring validity range");

  // Each occurrence lasts at most 24 hours. Inspect origin dates starting
  // the day before the segment's local start, through its local end.
  const firstDay = Math.floor((start + offsetMs) / dayMs) * dayMs - dayMs;
  const lastDay = Math.floor((end + offsetMs) / dayMs) * dayMs;
  for (let day = Math.max(firstDay, validFrom); day <= Math.min(lastDay, validTo); day += dayMs) {
    const weekday = (new Date(day).getUTCDay() + 1) % 7; // Saturday=0
    for (const shiftDay of recurring.days) {
      if (!shiftDay.isWorkingDay || shiftDay.dayOfWeek !== weekday) continue;
      const s = shiftDay.startMinute;
      const e = shiftDay.endMinute;
      if (s === null || e === null || !Number.isInteger(s) || !Number.isInteger(e) ||
          s < 0 || s > 1439 || e < 0 || e > 1439 || s === e) {
        throw new Error("Invalid recurring shift hours");
      }
      const occurrenceStart = day - offsetMs + s * 60_000;
      const occurrenceEnd = day - offsetMs + (e <= s ? e + 1440 : e) * 60_000;
      const overlapMinutes = Math.max(0, Math.min(end, occurrenceEnd) - Math.max(start, occurrenceStart)) / 60_000;
      if (overlapMinutes > 0) {
        return { workDate: new Date(day).toISOString().slice(0, 10), overlapMinutes };
      }
    }
  }
  return null;
}
