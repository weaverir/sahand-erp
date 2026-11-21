/** Split actual presence by Asia/Tehran calendar day, independently of attendance record workDate. */
export type PresenceInterval = { startAt: string; endAt: string };
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Tehran", year: "numeric", month: "2-digit", day: "2-digit",
});
function dateKey(ms: number): string {
  const parts = formatter.formatToParts(new Date(ms));
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
/** This module supports minute-aligned attendance, matching the monthly work engine. */
export function splitPresenceByTehranDate(intervals: PresenceInterval[]): Map<string, PresenceInterval[]> {
  const result = new Map<string, PresenceInterval[]>();
  for (const interval of intervals) {
    const start = Date.parse(interval.startAt);
    const end = Date.parse(interval.endAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
        start % 60000 !== 0 || end % 60000 !== 0 ||
        !/(Z|[+-]\d\d:\d\d)$/.test(interval.startAt) ||
        !/(Z|[+-]\d\d:\d\d)$/.test(interval.endAt)) {
      throw new Error("Invalid minute-aligned attendance interval");
    }
    // Find the first instant on the next Tehran calendar day using a bounded binary search.
    let cursor = start;
    while (cursor < end) {
      const key = dateKey(cursor);
      let lo = cursor + 60000;
      let hi = Math.min(end, cursor + 27 * 3600000);
      // A single Tehran calendar day is at most 25 hours; 27 is a safe bound.
      if (dateKey(hi - 1) === key) {
        const values = result.get(key) ?? [];
        values.push({ startAt: new Date(cursor).toISOString(), endAt: new Date(hi).toISOString() });
        result.set(key, values);
        cursor = hi;
        continue;
      }
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 120000) * 60000;
        if (mid <= cursor) { lo = cursor + 60000; continue; }
        if (dateKey(mid) === key) lo = mid + 60000;
        else hi = mid;
      }
      const boundary = lo;
      const values = result.get(key) ?? [];
      values.push({ startAt: new Date(cursor).toISOString(), endAt: new Date(boundary).toISOString() });
      result.set(key, values);
      cursor = boundary;
    }
  }
  return result;
}
