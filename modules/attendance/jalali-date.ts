/** Pure date-only helpers. All Gregorian dates are UTC YYYY-MM-DD. */
const persian = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});

function parts(date: Date): [number, number, number] {
  const values = persian.formatToParts(date);
  const get = (type: string) => Number(values.find((part) => part.type === type)?.value);
  return [get("year"), get("month"), get("day")];
}

function gregorianDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function gregorianToJalali(value: string): string | null {
  const date = gregorianDate(value);
  if (!date) return null;
  const [y, m, d] = parts(date);
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

export function jalaliToGregorian(value: string): string | null {
  const normalized = value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .trim().replace(/-/g, "/");
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 1200 || year > 1600 || month < 1 || month > 12 || day < 1 || day > 31) return null;
  // The Persian new year falls around March 20; search only the candidate year.
  const start = Date.UTC(year + 621, 2, 15);
  for (let offset = 0; offset < 375; offset++) {
    const candidate = new Date(start + offset * 86_400_000);
    const [y, m, d] = parts(candidate);
    if (y === year && m === month && d === day) return candidate.toISOString().slice(0, 10);
  }
  return null;
}

export function currentJalaliMonthRange(today = new Date()): { from: string; to: string } {
  const [year, month] = parts(today);
  const from = `${year}/${String(month).padStart(2, "0")}/01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextStart = jalaliToGregorian(`${nextYear}/${String(nextMonth).padStart(2, "0")}/01`);
  const first = jalaliToGregorian(from);
  if (!first || !nextStart) throw new Error("Cannot determine current Jalali month");
  const last = new Date(Date.parse(`${nextStart}T00:00:00.000Z`) - 86_400_000).toISOString().slice(0, 10);
  return { from: first, to: last };
}
