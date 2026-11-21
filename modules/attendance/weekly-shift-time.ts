/** Converts a Tehran-local shift interval to server-validated ISO instants.
 * Supports shifts ending on the following calendar day.
 * Iran currently uses UTC+03:30 without DST.
 */
export function buildTehranShiftInterval(workDate: string, from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) throw new Error('تاریخ کاری نامعتبر است.');
  const base = new Date(`${workDate}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 10) !== workDate) throw new Error('تاریخ کاری نامعتبر است.');
  const parse = (time: string) => {
    if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('ساعت باید به شکل HH:mm باشد.');
    const [h, m] = time.split(':').map(Number);
    if (h > 23 || m > 59) throw new Error('ساعت معتبر نیست.');
    return h * 60 + m;
  };
  const start = parse(from);
  const end = parse(to);
  if (start === end) throw new Error('شروع و پایان شیفت نمی‌توانند برابر باشند.');
  const duration = (end - start + 1440) % 1440;
  const startUtc = base.getTime() + (start - 210) * 60000;
  return {
    startsAt: new Date(startUtc).toISOString(),
    endsAt: new Date(startUtc + duration * 60000).toISOString(),
    requiredMinutes: duration,
    crossesMidnight: end < start,
  };
}
