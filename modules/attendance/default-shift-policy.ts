/** Default company schedule in Asia/Tehran, used only when no approved week exists. */
export const DEFAULT_SHIFT = Object.freeze({ startHour: 7, endHour: 15, minutes: 480 });

export type DefaultDayInput = {
  workDate: string;
  isHoliday?: boolean;
  isWorkingDayOverride?: boolean | null;
};

export function defaultDayIsWorking(input: DefaultDayInput): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workDate)) throw new Error("Invalid Gregorian work date");
  const date = new Date(`${input.workDate}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== input.workDate) throw new Error("Invalid Gregorian work date");
  if (input.isWorkingDayOverride !== null && input.isWorkingDayOverride !== undefined) return input.isWorkingDayOverride;
  return date.getUTCDay() !== 5 && !input.isHoliday;
}

export function defaultShiftInterval(input: DefaultDayInput): { startAt: string; endAt: string } | null {
  if (!defaultDayIsWorking(input)) return null;
  // Iran has used UTC+03:30 year-round since 2023. This fallback is for
  // contemporary operational dates, not historical dates with DST.
  const start = Date.parse(`${input.workDate}T03:30:00.000Z`);
  return { startAt: new Date(start).toISOString(), endAt: new Date(start + DEFAULT_SHIFT.minutes * 60000).toISOString() };
}
