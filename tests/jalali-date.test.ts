import assert from "node:assert/strict";
import test from "node:test";
import { currentJalaliMonthRange, gregorianToJalali, jalaliToGregorian } from "../modules/attendance/jalali-date";

test("known Persian new year", () => {
  assert.equal(gregorianToJalali("2026-03-21"), "1405/01/01");
  assert.equal(jalaliToGregorian("۱۴۰۵/۰۱/۰۱"), "2026-03-21");
});
test("invalid and non-existent dates are rejected", () => {
  assert.equal(jalaliToGregorian("1405/13/01"), null);
  assert.equal(jalaliToGregorian("1405/01/32"), null);
  assert.equal(jalaliToGregorian("1405/12/30"), null);
  assert.equal(gregorianToJalali("2026-02-30"), null);
});
test("round-trip dates across multiple years", () => {
  for (let year = 2023; year <= 2028; year++) {
    for (let month = 1; month <= 12; month++) {
      const date = `${year}-${String(month).padStart(2, "0")}-15`;
      const jalali = gregorianToJalali(date);
      assert.ok(jalali);
      assert.equal(jalaliToGregorian(jalali), date);
    }
  }
});
test("month range spans first through last Jalali day", () => {
  const range = currentJalaliMonthRange(new Date("2026-11-19T12:00:00Z"));
  assert.equal(gregorianToJalali(range.from), "1405/08/01");
  assert.equal(gregorianToJalali(range.to), "1405/08/30");
});
