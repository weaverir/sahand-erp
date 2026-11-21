export type WorkInterval = { startAt: string; endAt: string };
export type DayKind = "REGULAR" | "FRIDAY" | "OFFICIAL_HOLIDAY";
export function classifyDayKind(input: {workDate: string; isHoliday?: boolean; isWorkingDayOverride?: boolean | null}): DayKind {
  const date = new Date(`${input.workDate}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.workDate) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== input.workDate) throw new Error("Invalid work date");
  if (input.isWorkingDayOverride === true) return "REGULAR";
  if (input.isHoliday) return "OFFICIAL_HOLIDAY";
  return date.getUTCDay() === 5 ? "FRIDAY" : "REGULAR";
}
export function uniquePresenceMinutes(intervals: WorkInterval[]): number {
  const sorted = intervals.map(({startAt,endAt}) => {
    const a=Date.parse(startAt), b=Date.parse(endAt);
    if (!Number.isFinite(a)||!Number.isFinite(b)||b<=a||a%60000!==0||b%60000!==0||!/(Z|[+-]\d\d:\d\d)$/.test(startAt)||!/(Z|[+-]\d\d:\d\d)$/.test(endAt)) throw new Error("Invalid attendance interval");
    return [a,b] as [number,number];
  }).sort((a,b)=>a[0]-b[0]);
  let total=0, end=-Infinity;
  for (const [a,b] of sorted) {total += Math.max(0,b-Math.max(a,end)); end=Math.max(end,b);}
  return total/60000;
}
export function classifySpecialWork(dayKind: DayKind, attendance: WorkInterval[]) {
  const minutes=uniquePresenceMinutes(attendance);
  return { holidayWorkMinutes: dayKind === "REGULAR" ? 0 : minutes };
}
