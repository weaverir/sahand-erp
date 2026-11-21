import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateProratedLeaveCredit,
  calculateSignedLeaveBalance,
  FULL_MONTH_LEAVE_CREDIT_MINUTES,
} from "../modules/attendance/leave-credit-policy";

test("full month is exactly 1180 minutes for every Jalali month length", () => {
  for (const daysInMonth of [29, 30, 31] as const) {
    const result = calculateProratedLeaveCredit({ daysInMonth });
    assert.equal(result.creditedMinutes, FULL_MONTH_LEAVE_CREDIT_MINUTES);
    assert.equal(result.eligibleDays, daysInMonth);
  }
});

test("inclusive partial employment and same-day employment", () => {
  assert.equal(calculateProratedLeaveCredit({ daysInMonth: 30, employedFromDay: 16 }).creditedMinutes, 590);
  assert.equal(calculateProratedLeaveCredit({ daysInMonth: 30, employedThroughDay: 15 }).creditedMinutes, 590);
  assert.equal(calculateProratedLeaveCredit({ daysInMonth: 30, employedFromDay: 15, employedThroughDay: 15 }).eligibleDays, 1);
  assert.equal(calculateProratedLeaveCredit({ daysInMonth: 30, employedFromDay: 20, employedThroughDay: 10 }).creditedMinutes, 0);
});

test("every employment interval matches independent integer-minute reference", () => {
  for (const daysInMonth of [29, 30, 31] as const) {
    for (let start = 1; start <= daysInMonth; start++) {
      for (let end = 1; end <= daysInMonth; end++) {
        const actual = calculateProratedLeaveCredit({ daysInMonth, employedFromDay: start, employedThroughDay: end });
        const days = Math.max(0, end - start + 1);
        const expected = Math.round((1180 * days) / daysInMonth);
        assert.equal(actual.eligibleDays, days);
        assert.equal(actual.creditedMinutes, expected, `${daysInMonth}-day month: ${start}..${end}`);
      }
    }
  }
});

test("credit is monotonic and always between zero and full entitlement", () => {
  for (const daysInMonth of [29, 30, 31] as const) {
    let previous = -1;
    for (let days = 0; days <= daysInMonth; days++) {
      const actual = calculateProratedLeaveCredit({ daysInMonth, employedFromDay: daysInMonth - days + 1 <= daysInMonth ? daysInMonth - days + 1 : daysInMonth, employedThroughDay: days === 0 ? 1 : daysInMonth });
      if (days > 0) {
        assert.ok(actual.creditedMinutes >= previous);
        assert.ok(actual.creditedMinutes <= 1180);
        previous = actual.creditedMinutes;
      }
    }
  }
});

test("invalid dates and fractions fail closed", () => {
  for (const value of [0, 28, 32, 30.5, NaN, Infinity]) {
    assert.throws(() => calculateProratedLeaveCredit({ daysInMonth: value as 29 }));
  }
  assert.throws(() => calculateProratedLeaveCredit({ daysInMonth: 30, employedFromDay: 0 }));
  assert.throws(() => calculateProratedLeaveCredit({ daysInMonth: 30, employedThroughDay: 31 }));
  assert.throws(() => calculateProratedLeaveCredit({ daysInMonth: 30, employedFromDay: 2.5 }));
});

test("negative balance and settlement direction are preserved", () => {
  assert.equal(calculateSignedLeaveBalance([1180, -1500]), -320);
  assert.equal(calculateSignedLeaveBalance([1180, -300]), 880);
  assert.equal(calculateSignedLeaveBalance([1180, -1180]), 0);
  assert.throws(() => calculateSignedLeaveBalance([Number.MAX_SAFE_INTEGER, 1]));
});

test("ten years of full monthly credits never drift", () => {
  const credits = Array.from({ length: 120 }, () => 1180);
  assert.equal(calculateSignedLeaveBalance(credits), 141600);
  assert.equal(calculateSignedLeaveBalance([...credits, -142000]), -400);
});
