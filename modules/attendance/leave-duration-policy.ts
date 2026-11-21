/** Pure calculation of leave minutes from approved work segments.
 * Inputs are instants, not local wall-clock strings; callers must resolve Tehran timezone.
 * Missing approved schedule is an error, never silently a day off.
 */
export interface LeaveWorkDay {
  date: string; // YYYY-MM-DD in Tehran
  scheduleFound: boolean;
  isHoliday: boolean;
  isWorkingDayOverride: boolean | null;
  segments: ReadonlyArray<{ startsAt: Date; endsAt: Date }>;
}

export class LeaveScheduleMissingError extends Error {
  constructor(public readonly date: string) {
    super(`برنامه شیفت تأییدشده برای ${date} وجود ندارد.`);
    this.name = 'LeaveScheduleMissingError';
  }
}

export function calculateScheduledLeaveMinutes(
  startAt: Date,
  endAt: Date,
  days: ReadonlyArray<LeaveWorkDay>,
): number {
  const start = startAt.getTime();
  const end = endAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) {
    throw new Error('بازه مرخصی نامعتبر است.');
  }
  if (end - start > 31 * 86400000) throw new Error('بازه مرخصی بیش از ۳۱ روز است.');
  if (!days.length) throw new Error('روزهای برنامه کاری مشخص نیستند.');
  const seen = new Set<string>();
  const intervals: Array<[number, number]> = [];
  for (const day of days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || seen.has(day.date)) {
      throw new Error('روزهای برنامه کاری تکراری یا نامعتبرند.');
    }
    seen.add(day.date);
    if (!day.scheduleFound) throw new LeaveScheduleMissingError(day.date);
    if (day.isWorkingDayOverride === false || (day.isHoliday && day.isWorkingDayOverride !== true)) continue;
    for (const segment of day.segments) {
      const a = segment.startsAt.getTime();
      const b = segment.endsAt.getTime();
      if (!Number.isFinite(a) || !Number.isFinite(b) || a >= b) throw new Error('بازه شیفت نامعتبر است.');
      const clippedStart = Math.max(a, start);
      const clippedEnd = Math.min(b, end);
      if (clippedStart < clippedEnd) intervals.push([clippedStart, clippedEnd]);
    }
  }
  intervals.sort((a,b) => a[0]-b[0]);
  let total = 0;
  let previousEnd = -Infinity;
  for (const [a,b] of intervals) {
    if (a < previousEnd) throw new Error('هم‌پوشانی در بازه‌های شیفت وجود دارد.');
    total += (b-a)/60000;
    previousEnd = b;
  }
  if (!Number.isSafeInteger(total)) throw new Error('دقت بازه شیفت باید بر حسب دقیقه باشد.');
  return total;
}
