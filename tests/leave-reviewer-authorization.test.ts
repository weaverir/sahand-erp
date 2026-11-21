import test from 'node:test';
import assert from 'node:assert/strict';
import { canReviewLeaveStep } from '../modules/attendance/leave-request-policy';

const base = {
  roleKeys: new Set<string>(),
  reviewerAssignments: [] as {id:string;organizationUnitId:string;roleKeys:string[]}[],
  employeeManagerAssignmentId: 'manager-1',
  employeeOrganizationUnitId: 'unit-1',
};

test('production manager from another unit cannot approve', () => {
  assert.equal(canReviewLeaveStep({...base,requiredRole:'PRODUCTION_MANAGER',roleKeys:new Set(['production_manager']),reviewerAssignments:[{id:'a',organizationUnitId:'unit-2',roleKeys:['production_manager']}]}),false);
});
test('production manager assigned to same unit can approve', () => {
  assert.equal(canReviewLeaveStep({...base,requiredRole:'PRODUCTION_MANAGER',reviewerAssignments:[{id:'a',organizationUnitId:'unit-1',roleKeys:['production_manager']}]}),true);
});
test('global production role alone cannot bypass unit scoping', () => {
  assert.equal(canReviewLeaveStep({...base,requiredRole:'PRODUCTION_MANAGER',roleKeys:new Set(['production_manager'])}),false);
});
test('only assigned direct supervisor can approve supervisor step', () => {
  assert.equal(canReviewLeaveStep({...base,requiredRole:'SECTION_SUPERVISOR',reviewerAssignments:[{id:'manager-2',organizationUnitId:'unit-1',roleKeys:[]}]}),false);
  assert.equal(canReviewLeaveStep({...base,requiredRole:'SECTION_SUPERVISOR',reviewerAssignments:[{id:'manager-1',organizationUnitId:'unit-1',roleKeys:[]}]}),true);
});
test('HR and CEO/deputy role gates remain distinct', () => {
  assert.equal(canReviewLeaveStep({...base,requiredRole:'HR_MANAGER',roleKeys:new Set(['hr_manager'])}),true);
  assert.equal(canReviewLeaveStep({...base,requiredRole:'CEO_OR_DEPUTY',roleKeys:new Set(['hr_manager'])}),false);
  assert.equal(canReviewLeaveStep({...base,requiredRole:'CEO_OR_DEPUTY',roleKeys:new Set(['ceo_deputy'])}),true);
});
