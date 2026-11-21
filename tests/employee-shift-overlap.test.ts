import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { findEmployeeShiftConflicts, shiftOverlapMinutes } from '../modules/shifts/employee-shift-overlap';
const i = (a: string,b: string) => ({startsAt:new Date(a),endsAt:new Date(b)});
const night=i('2027-04-07T18:30:00Z','2027-04-08T04:30:00Z'); // Tehran 22-08
const morning=i('2027-04-08T03:30:00Z','2027-04-08T11:30:00Z'); // Tehran 07-15
test('same employee cannot have 22-08 and 07-15',()=>assert.equal(findEmployeeShiftConflicts([morning],[night])[0].overlapMinutes,60));
test('different employees can use overlapping shift definitions',()=>assert.equal(findEmployeeShiftConflicts([morning],[]).length,0));
test('adjacent shifts are allowed',()=>assert.equal(shiftOverlapMinutes(night,i('2027-04-08T04:30:00Z','2027-04-08T12:30:00Z')),0));
test('overnight conflict across week boundary',()=>assert.equal(findEmployeeShiftConflicts([i('2027-04-10T03:30:00Z','2027-04-10T11:30:00Z')],[i('2027-04-09T18:30:00Z','2027-04-10T04:30:00Z')]).length,1));
test('two proposed segments cannot overlap',()=>assert.equal(findEmployeeShiftConflicts([night,morning],[]).length,1));
test('invalid interval rejected',()=>assert.throws(()=>findEmployeeShiftConflicts([i('2027-04-08T04:30:00Z','2027-04-08T03:30:00Z')],[])));
