import { jalaliToGregorian } from './jalali-date';

export type HolidayEditorDay = {
  date: string;
  jalaliDate: string;
  title: string;
  holidayType: 'OFFICIAL' | 'NATIONAL' | 'RELIGIOUS' | 'COMPANY' | 'OTHER';
  isHoliday: boolean;
  isWorkingDayOverride: boolean | null;
};

export function prepareHolidayDay(input: Omit<HolidayEditorDay, 'date'>, year: number): HolidayEditorDay {
  const date = jalaliToGregorian(input.jalaliDate);
  if (!date || !/^\d{4}\/\d{2}\/\d{2}$/.test(input.jalaliDate) || Number(input.jalaliDate.slice(0, 4)) !== year) {
    throw new Error('تاریخ شمسی با سال تقویم مطابقت ندارد.');
  }
  if (!input.title.trim() || input.title.trim().length > 200) throw new Error('عنوان مناسبت معتبر نیست.');
  if (!['OFFICIAL', 'NATIONAL', 'RELIGIOUS', 'COMPANY', 'OTHER'].includes(input.holidayType)) throw new Error('نوع تعطیلی معتبر نیست.');
  if (typeof input.isHoliday !== 'boolean' || (input.isWorkingDayOverride !== null && typeof input.isWorkingDayOverride !== 'boolean')) throw new Error('وضعیت روز معتبر نیست.');
  return { ...input, date, title: input.title.trim() };
}

export function upsertHolidayDay(days: HolidayEditorDay[], day: HolidayEditorDay): HolidayEditorDay[] {
  return [...days.filter(item => item.date !== day.date), day].sort((a, b) => a.date.localeCompare(b.date));
}
