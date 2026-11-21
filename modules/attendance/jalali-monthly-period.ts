/** Tehran civil dates use UTC+03:30 (Iran has not observed DST since 2022).
 * This module supports modern Jalali payroll periods (years 1402 onward).
 * UTC instants are stored in PostgreSQL; month keys use the Persian calendar.
 */
export interface JalaliMonthBounds {
  jalaliYear: number;
  jalaliMonth: number;
  startsAt: Date;
  endsAt: Date;
}

const formatter = new Intl.DateTimeFormat('en-US-u-ca-persian', {
  timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
});

function jalaliParts(date: Date): { year: number; month: number; day: number } {
  const parts = formatter.formatToParts(date);
  const number = (type: string): number => {
    const value = Number(parts.find((p) => p.type === type)?.value);
    if (!Number.isInteger(value)) throw new Error(`Cannot read Persian ${type}`);
    return value;
  };
  return { year: number('year'), month: number('month'), day: number('day') };
}

function utcTehranMidnight(gregorianDate: Date): Date {
  return new Date(gregorianDate.getTime() - 3.5 * 60 * 60 * 1000);
}

function dayAtUtcMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

export function getJalaliMonthBounds(year: number, month: number): JalaliMonthBounds {
  if (!Number.isInteger(year) || year < 1402 || year > 1600 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('Unsupported Jalali payroll month');
  }
  // Persian new year occurs around March 20/21 of Gregorian year + 621.
  const march = dayAtUtcMidnight(year + 621, 3, 1);
  let first: Date | undefined;
  let after: Date | undefined;
  for (let day = 0; day < 390; day++) {
    const candidate = new Date(march.getTime() + day * 86400000);
    // 12:00 UTC is 15:30 Tehran, unambiguously inside the civil day.
    const p = jalaliParts(new Date(candidate.getTime() + 12 * 3600000));
    if (p.year === year && p.month === month && p.day === 1) first = candidate;
    if (first && (p.year > year || (p.year === year && p.month > month))) {
      after = candidate;
      break;
    }
  }
  if (!first || !after) throw new Error('Unable to resolve Jalali month boundaries');
  return { jalaliYear: year, jalaliMonth: month,
    startsAt: utcTehranMidnight(first), endsAt: utcTehranMidnight(after) };
}

export function currentJalaliMonth(at: Date = new Date()): { year: number; month: number } {
  if (!Number.isFinite(at.getTime())) throw new Error('Invalid timestamp');
  const p = jalaliParts(at);
  return { year: p.year, month: p.month };
}

export interface PeriodStore {
  attendanceMonthlyPeriod: {
    upsert(args: {
      where: { jalaliYear_jalaliMonth: { jalaliYear: number; jalaliMonth: number } };
      create: { jalaliYear: number; jalaliMonth: number; startsAt: Date; endsAt: Date };
      update: Record<string, never>;
    }): Promise<{ id: string; status: string; startsAt: Date; endsAt: Date }>;
  };
}

/** Safe to retry. Existing periods (including CLOSED) are never reset or modified. */
export async function ensureMonthlyPeriod<T extends PeriodStore>(db: T, year: number, month: number) {
  const bounds = getJalaliMonthBounds(year, month);
  return db.attendanceMonthlyPeriod.upsert({
    where: { jalaliYear_jalaliMonth: { jalaliYear: year, jalaliMonth: month } },
    create: bounds,
    update: {},
  });
}
