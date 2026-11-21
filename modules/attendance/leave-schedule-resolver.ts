import { prisma } from '@/libs/prisma';
import { calculateScheduledLeaveMinutes, type LeaveWorkDay } from './leave-duration-policy';

const DAY = 86400000;
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tehran', year: 'numeric', month: '2-digit', day: '2-digit' });
function tehranDay(date: Date): string {
  const parts = localDate.formatToParts(date);
  const value = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function utcDay(date: string): Date { return new Date(`${date}T00:00:00.000Z`); }
function datesBetween(start: string, end: string): string[] {
  const result: string[] = [];
  for (let t = utcDay(start).getTime(); t <= utcDay(end).getTime(); t += DAY) {
    result.push(new Date(t).toISOString().slice(0, 10));
    if (result.length > 33) throw new Error('بازه مرخصی بیش از حد مجاز است.');
  }
  return result;
}
function weekStart(date: string): string {
  const day = utcDay(date);
  const offset = (day.getUTCDay() + 1) % 7; // Saturday = 0
  return new Date(day.getTime() - offset * DAY).toISOString().slice(0, 10);
}
/** Never trust requestedMinutes supplied by a browser. Only approved weekly schedules count. */
export async function resolveLeaveMinutes(employeeUserId: string, startAt: Date, endAt: Date): Promise<number> {
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) {
    throw new Error('بازه مرخصی نامعتبر است.');
  }
  const dates = datesBetween(tehranDay(startAt), tehranDay(new Date(endAt.getTime() - 1)));
  const weeks = [...new Set(dates.map(weekStart))];
  const [schedules, holidays] = await Promise.all([
    prisma.employeeShiftSchedule.findMany({
      where: { employeeUserId, status: 'APPROVED', weekStartDate: { in: weeks.map(utcDay) } },
      orderBy: [{ version: 'desc' }],
      include: { segments: { orderBy: [{ workDate: 'asc' }, { segmentOrder: 'asc' }] } },
    }),
    prisma.holidayCalendarDay.findMany({
      where: { date: { gte: utcDay(dates[0]), lte: utcDay(dates[dates.length - 1]) }, calendar: { isActive: true } },
      select: { date: true, isHoliday: true, isWorkingDayOverride: true },
    }),
  ]);
  const scheduleByWeek = new Map<string, (typeof schedules)[number]>();
  for (const schedule of schedules) {
    const key = schedule.weekStartDate.toISOString().slice(0, 10);
    if (!scheduleByWeek.has(key)) scheduleByWeek.set(key, schedule);
  }
  const holidayByDate = new Map<string, (typeof holidays)[number]>();
  for (const holiday of holidays) {
    const key = holiday.date.toISOString().slice(0, 10);
    if (holidayByDate.has(key)) throw new Error('برای یک تاریخ چند تنظیم تعطیلات فعال وجود دارد.');
    holidayByDate.set(key, holiday);
  }
  const days: LeaveWorkDay[] = dates.map(date => {
    const schedule = scheduleByWeek.get(weekStart(date));
    const holiday = holidayByDate.get(date);
    return {
      date,
      scheduleFound: Boolean(schedule),
      isHoliday: holiday?.isHoliday ?? false,
      isWorkingDayOverride: holiday?.isWorkingDayOverride ?? null,
      segments: (schedule?.segments ?? []).filter(segment => segment.workDate.toISOString().slice(0, 10) === date)
        .map(segment => ({ startsAt: segment.startsAt, endsAt: segment.endsAt })),
    };
  });
  return calculateScheduledLeaveMinutes(startAt, endAt, days);
}
