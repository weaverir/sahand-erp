import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEmployeeShiftCompatibility, assertTransferShiftResolved, OrganizationShiftConflictError } from '../modules/shifts/organization-shift-guard';

// Pure in-memory transaction double: no DB connection and no production writes.
const date = (s: string) => new Date(`${s}T00:00:00.000Z`);
const day = (startMinute: number, endMinute: number, dayOfWeek = 0) => ({ dayOfWeek, segmentOrder: 0, dayType: 'NORMAL', isWorkingDay: true, startMinute, endMinute });
type Member = { id: string; userId: string; organizationUnitId: string; status: string; startDate: Date; endDate: Date | null };
type Assignment = { id: string; shiftId: string; targetType: string; organizationUnitId: string | null; employeeAssignmentId: string | null; validFrom: Date; validTo: Date | null; isActive: boolean };
function fixture(members: Member[], assignments: Assignment[], shifts: Record<string, any>) {
  const tx = {
    employeeAssignment: { findMany: async ({where}: any) => members.filter(m => m.status === where.status && (!where.userId || m.userId === where.userId)) },
    shiftAssignment: {
      findMany: async ({where, include}: any) => assignments.filter(a => a.isActive && (!where.id?.not || a.id !== where.id.not) && (!where.validFrom?.lte || a.validFrom <= where.validFrom.lte) && (!a.validTo || a.validTo >= where.OR[1].validTo.gte)).map(a => include?.shift ? { ...a, shift: shifts[a.shiftId] } : a),
      findFirst: async ({where}: any) => assignments.find(a => a.isActive && a.targetType === where.targetType && a.employeeAssignmentId === where.employeeAssignmentId && (!a.validTo || a.validTo >= where.OR[1].validTo.gte)) ?? null,
    },
    workShift: { findUnique: async ({where}: any) => shifts[where.id] ?? null },
    employeeShiftScheduleSegment: { findMany: async () => [] },
  };
  return tx as any;
}
const member = (id: string, unit: string, userId='u1'): Member => ({id,userId,organizationUnitId:unit,status:'ACTIVE',startDate:date('2026-11-01'),endDate:null});
const assignment = (id:string, shiftId:string, targetType:string, unit:string|null=null, emp:string|null=null, to:string|null=null): Assignment => ({id,shiftId,targetType,organizationUnitId:unit,employeeAssignmentId:emp,validFrom:date('2026-11-01'),validTo:to?date(to):null,isActive:true});
const shifts = {night:{days:[day(1320,480)]},morning:{days:[day(420,900,1)]},adjacent:{days:[day(480,960,1)]}};

test('new membership creates unit/personal overlap: rejected', async () => {
  const tx=fixture([member('m1','old'),member('m2','new')],[assignment('a1','night','EMPLOYEE',null,'m1'),assignment('a2','morning','UNIT','new')],shifts);
  await assert.rejects(assertEmployeeShiftCompatibility(tx,'u1'),OrganizationShiftConflictError);
});
test('new membership with adjacent shift: allowed', async () => {
  const tx=fixture([member('m1','old'),member('m2','new')],[assignment('a1','night','EMPLOYEE',null,'m1'),assignment('a2','adjacent','UNIT','new')],shifts);
  await assert.doesNotReject(assertEmployeeShiftCompatibility(tx,'u1'));
});
test('second employee does not inherit other employee personal shift', async () => {
  const tx=fixture([member('m1','old','u2'),member('m2','new','u1')],[assignment('a1','night','EMPLOYEE',null,'m1'),assignment('a2','morning','UNIT','new')],shifts);
  await assert.doesNotReject(assertEmployeeShiftCompatibility(tx,'u1'));
});
test('transfer with unresolved personal shift is rejected', async () => {
  const tx=fixture([member('m1','old')],[assignment('a1','night','EMPLOYEE',null,'m1')],shifts);
  await assert.rejects(assertTransferShiftResolved(tx,'m1',date('2026-11-15')),OrganizationShiftConflictError);
});
test('transfer with expired personal shift is allowed', async () => {
  const tx=fixture([member('m1','old')],[assignment('a1','night','EMPLOYEE',null,'m1','2026-11-10')],shifts);
  await assert.doesNotReject(assertTransferShiftResolved(tx,'m1',date('2026-11-15')));
});
test('transfer with no personal shift is allowed', async () => {
  const tx=fixture([member('m1','old')],[assignment('a1','morning','UNIT','old')],shifts);
  await assert.doesNotReject(assertTransferShiftResolved(tx,'m1',date('2026-11-15')));
});
