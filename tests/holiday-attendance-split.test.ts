import { test } from "node:test";
import { strict as assert } from "node:assert";
import { splitPresenceByTehranDate } from "../modules/attendance/holiday-attendance-split";
import { uniquePresenceMinutes, classifyDayKind, classifySpecialWork } from "../modules/attendance/holiday-work-policy";
function calculate(intervals: Array<{startAt:string;endAt:string}>, holidays: string[] = []) {
  const split = splitPresenceByTehranDate(intervals);
  let holidayMinutes = 0;
  for (const [date, parts] of split) {
    const kind = classifyDayKind({ workDate: date, isHoliday: holidays.includes(date) });
    holidayMinutes += classifySpecialWork(kind, parts).holidayWorkMinutes;
  }
  return { split, holidayMinutes };
}
test("Thursday 22:00 to Friday 06:00 Tehran: 120 ordinary and 360 holiday minutes", () => {
  // 2026-02-12 is Thursday in Tehran (UTC+03:30).
  const input = [{startAt:"2026-02-12T18:30:00.000Z",endAt:"2026-02-13T02:30:00.000Z"}];
  const {split,holidayMinutes}=calculate(input);
  assert.equal(uniquePresenceMinutes(split.get("2026-02-12") ?? []),120);
  assert.equal(uniquePresenceMinutes(split.get("2026-02-13") ?? []),360);
  assert.equal(holidayMinutes,360);
});
test("Friday official holiday counts once", () => {
  const input=[{startAt:"2026-02-13T04:30:00.000Z",endAt:"2026-02-13T09:30:00.000Z"}];
  assert.equal(calculate(input,["2026-02-13"]).holidayMinutes,300);
});
test("Non-Friday official holiday is counted", () => {
  const input=[{startAt:"2026-02-14T05:30:00.000Z",endAt:"2026-02-14T07:30:00.000Z"}];
  assert.equal(calculate(input,["2026-02-14"]).holidayMinutes,120);
});
test("Overlapping intervals are counted once", () => {
  const input=[
    {startAt:"2026-02-13T04:30:00.000Z",endAt:"2026-02-13T07:30:00.000Z"},
    {startAt:"2026-02-13T06:30:00.000Z",endAt:"2026-02-13T09:30:00.000Z"},
  ];
  assert.equal(calculate(input).holidayMinutes,300);
});
test("Crossing month end does not lose calendar-day classification", () => {
  const input=[{startAt:"2026-02-19T19:30:00.000Z",endAt:"2026-02-19T22:30:00.000Z"}];
  const {split}=calculate(input);
  assert.equal(uniquePresenceMinutes(split.get("2026-02-19") ?? []),60);
  assert.equal(uniquePresenceMinutes(split.get("2026-02-20") ?? []),120);
});
