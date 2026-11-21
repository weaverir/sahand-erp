import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTehranShiftInterval } from '../modules/attendance/weekly-shift-time';

test('day shift 07 to 15', () => {
  const s = buildTehranShiftInterval('2026-11-21', '07:00', '15:00');
  assert.equal(s.requiredMinutes, 480);
  assert.equal(s.startsAt, '2026-11-21T03:30:00.000Z');
  assert.equal(s.crossesMidnight, false);
});
test('night shift 22 to 06 next day', () => {
  const s = buildTehranShiftInterval('2026-11-21', '22:00', '06:00');
  assert.equal(s.requiredMinutes, 480);
  assert.equal(s.startsAt, '2026-11-21T18:30:00.000Z');
  assert.equal(s.endsAt, '2026-11-22T02:30:00.000Z');
  assert.equal(s.crossesMidnight, true);
});
test('reject equal hours and invalid dates', () => {
  assert.throws(() => buildTehranShiftInterval('2026-11-21', '08:00', '08:00'));
  assert.throws(() => buildTehranShiftInterval('2026-02-30', '08:00', '09:00'));
  assert.throws(() => buildTehranShiftInterval('2026-11-21', '25:00', '09:00'));
});
