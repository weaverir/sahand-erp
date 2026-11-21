import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeLeavePreview } from '../modules/attendance/leave-preview-policy';

test('preview subtracts duration without mutating the balance', () => {
  const balance = 600;
  assert.deepEqual(summarizeLeavePreview(balance, 120), { requestedMinutes: 120, balanceMinutes: 600, remainingMinutes: 480, initialized: true });
  assert.equal(balance, 600);
});
test('negative remaining balance is supported', () => assert.equal(summarizeLeavePreview(60, 120).remainingMinutes, -60));
test('uninitialized balance is not falsely reported as zero', () => assert.deepEqual(summarizeLeavePreview(null, 60), { requestedMinutes: 60, balanceMinutes: null, remainingMinutes: null, initialized: false }));
test('zero or invalid durations are rejected', () => {
  for (const n of [0, -1, 1.5, Number.NaN]) assert.throws(() => summarizeLeavePreview(120, n));
});
