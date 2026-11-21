/**
 * Converts a PostgreSQL @db.Date workDate (represented by Prisma as UTC
 * midnight) to the real UTC interval of that Tehran civil day.
 * Iran's current fixed offset is UTC+03:30; supported modern payroll dates
 * begin in 1402, after daylight saving was abolished.
 */
export function getTehranWorkDateBounds(workDate: Date): {
  startsAt: Date;
  endsAt: Date;
} {
  if (!(workDate instanceof Date) || !Number.isFinite(workDate.getTime()) ||
      workDate.getUTCHours() !== 0 || workDate.getUTCMinutes() !== 0 ||
      workDate.getUTCSeconds() !== 0 || workDate.getUTCMilliseconds() !== 0) {
    throw new Error("Expected a valid UTC-midnight @db.Date workDate");
  }
  const offsetMs = 210 * 60_000;
  const startsAt = new Date(workDate.getTime() - offsetMs);
  return { startsAt, endsAt: new Date(startsAt.getTime() + 86_400_000) };
}
