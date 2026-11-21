import test from 'node:test';
import assert from 'node:assert/strict';
import { findRecurringShiftConflict, type RecurringAssignment } from '../modules/shifts/recurring-shift-conflict';
const make = (id: string, startMinute: number, endMinute: number, dayOfWeek = 0, validFrom = '2027-03-20', validTo: string | null = null): RecurringAssignment => ({id,validFrom,validTo,days:[{dayOfWeek,isWorkingDay:true,startMinute,endMinute}]});
test('overlapping templates assigned to one employee conflict', () => {
  const night = make('night',22*60,8*60,0);
  const morning = make('morning',7*60,15*60,1);
  assert.equal(findRecurringShiftConflict(night,morning)?.overlapMinutes,60);
});
test('nonoverlapping adjacent shifts are allowed', () => {
  assert.equal(findRecurringShiftConflict(make('a',7*60,15*60),make('b',15*60,23*60)),null);
});
test('nonoverlapping date validity is allowed', () => {
  assert.equal(findRecurringShiftConflict(make('a',7*60,15*60,0,'2027-03-20','2027-03-20'),make('b',7*60,15*60,0,'2027-03-27')),null);
});
test('same weekday but nonoverlapping hours are allowed', () => {
  assert.equal(findRecurringShiftConflict(make('a',7*60,15*60),make('b',16*60,23*60)),null);
});
test('same day identical hours conflict', () => {
  assert.equal(findRecurringShiftConflict(make('a',7*60,15*60),make('b',7*60,15*60))?.overlapMinutes,480);
});
test('night overlap across a validity boundary is detected', () => {
  const a=make('a',22*60,8*60,0,'2027-03-20','2027-03-20');
  const b=make('b',7*60,15*60,1,'2027-03-21','2027-03-21');
  assert.equal(findRecurringShiftConflict(a,b)?.overlapMinutes,60);
});
test('nonworking day never causes conflict', () => {
  const b=make('b',7*60,15*60); b.days[0].isWorkingDay=false;
  assert.equal(findRecurringShiftConflict(make('a',7*60,15*60),b),null);
});
