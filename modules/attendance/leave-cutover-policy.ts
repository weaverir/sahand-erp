/** Pure cutover guard: opening balance includes all legacy history before the first ERP accrual month. */
export function isBeforeLeaveCutover(
  year: number, month: number,
  opening: { startJalaliYear: number; startJalaliMonth: number } | null | undefined,
): boolean {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12)
    throw new Error("Invalid accrual month");
  if (!opening) return false;
  if (!Number.isInteger(opening.startJalaliYear) || !Number.isInteger(opening.startJalaliMonth) ||
      opening.startJalaliMonth < 1 || opening.startJalaliMonth > 12) throw new Error("Invalid opening cutover");
  return year * 12 + month < opening.startJalaliYear * 12 + opening.startJalaliMonth;
}
