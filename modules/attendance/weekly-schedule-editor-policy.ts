export type EditableWeeklySegment = {
  workDate: string;
  segmentOrder: number;
  startsAt: string;
  endsAt: string;
  requiredMinutes: number;
  workShiftId: string | null;
  notes: string | null;
};

export function validateWeeklyDraftSegments(segments: EditableWeeklySegment[], weekStart: string): EditableWeeklySegment[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('تاریخ شروع هفته معتبر نیست.');
  const base = new Date(`${weekStart}T00:00:00.000Z`);
  if (Number.isNaN(base.getTime()) || base.toISOString().slice(0, 10) !== weekStart) throw new Error('تاریخ شروع هفته معتبر نیست.');
  if (segments.length > 28) throw new Error('حداکثر ۲۸ بازه مجاز است.');
  const end = base.getTime() + 6 * 86400000;
  const sorted = [...segments].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const keys = new Set<string>();
  for (const item of sorted) {
    const day = new Date(`${item.workDate}T00:00:00.000Z`);
    if (Number.isNaN(day.getTime()) || day.toISOString().slice(0,10)!==item.workDate || day.getTime()<base.getTime() || day.getTime()>end) throw new Error('روز کاری خارج از هفته است.');
    const start = Date.parse(item.startsAt), finish = Date.parse(item.endsAt);
    const minutes = (finish-start)/60000;
    if (!Number.isFinite(minutes) || minutes<=0 || minutes>1440) throw new Error('مدت بازه معتبر نیست.');
    if (!Number.isInteger(item.requiredMinutes) || item.requiredMinutes<0 || item.requiredMinutes>minutes) throw new Error('دقایق موظفی معتبر نیست.');
    if (!Number.isInteger(item.segmentOrder) || item.segmentOrder<1 || item.segmentOrder>100) throw new Error('ترتیب بازه معتبر نیست.');
    const key = `${item.workDate}:${item.segmentOrder}`;
    if (keys.has(key)) throw new Error('ترتیب بازه در یک روز تکراری است.');
    keys.add(key);
    const localDate = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Tehran',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(start));
    if (localDate!==item.workDate) throw new Error('شروع بازه با روز کاری مطابقت ندارد.');
  }
  for (let i=1;i<sorted.length;i++) if (Date.parse(sorted[i].startsAt)<Date.parse(sorted[i-1].endsAt)) throw new Error('بازه‌های کاری هم‌پوشانی دارند.');
  return sorted;
}
