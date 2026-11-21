import assert from 'node:assert/strict';
import test from 'node:test';
import { currentJalaliMonth, ensureMonthlyPeriod, getJalaliMonthBounds } from '../modules/attendance/jalali-monthly-period';

test('1405-09 starts at Tehran midnight and finishes at start of 1405-10', () => {
  const a = getJalaliMonthBounds(1405, 9);
  const b = getJalaliMonthBounds(1405, 10);
  assert.equal(a.endsAt.toISOString(), b.startsAt.toISOString());
  assert.equal(a.startsAt.toISOString().slice(11), '20:30:00.000Z');
});

test('Esfand ends exactly at the following Farvardin', () => {
  const esfand = getJalaliMonthBounds(1405, 12);
  const farvardin = getJalaliMonthBounds(1406, 1);
  assert.equal(esfand.endsAt.toISOString(), farvardin.startsAt.toISOString());
});

test('the instant before month start belongs to the preceding month', () => {
  const start = getJalaliMonthBounds(1405, 9).startsAt;
  assert.deepEqual(currentJalaliMonth(new Date(start.getTime() - 1)), { year: 1405, month: 8 });
  assert.deepEqual(currentJalaliMonth(start), { year: 1405, month: 9 });
});

test('invalid month is rejected before database access', () => {
  assert.throws(() => getJalaliMonthBounds(1405, 13));
});

test('upsert creates a period without changing a previously closed one', async () => {
  let period: { id: string; status: string; startsAt: Date; endsAt: Date } | undefined;
  let calls = 0;
  const db = { attendanceMonthlyPeriod: { upsert: async (args: {
    create: { startsAt: Date; endsAt: Date };
    update: Record<string, never>;
  }) => {
    calls++;
    assert.deepEqual(args.update, {});
    period ??= { id: 'p1', status: 'OPEN', startsAt: args.create.startsAt, endsAt: args.create.endsAt };
    return period;
  } } };
  await ensureMonthlyPeriod(db, 1405, 9);
  period!.status = 'CLOSED';
  const result = await ensureMonthlyPeriod(db, 1405, 9);
  assert.equal(result.status, 'CLOSED');
  assert.equal(calls, 2);
});
