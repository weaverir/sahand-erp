/**
 * PostgreSQL integration checks for leave approval persistence and ledger invariants.
 * ONLY runs on a database literally named sahand_erp_test.
 * Creates disposable fixtures; does not exercise HTTP authentication or route handlers.
 * Run: node --env-file=.env.test --import tsx tests/leave-approval-postgres.integration.ts
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();
const marker = `hr-approval-it-${randomUUID()}`;
let employeeId: string | undefined;
let reviewerId: string | undefined;
let unitId: string | undefined;
let assignmentId: string | undefined;
const requestIds: string[] = [];

async function balance(userId: string): Promise<number> {
  const aggregate = await prisma.leaveLedgerEntry.aggregate({
    where: { employeeUserId: userId, leaveTypeKey: 'annual-paid' },
    _sum: { minutes: true },
  });
  return aggregate._sum.minutes ?? 0;
}

async function approveStep(requestId: string, stepOrder: number, reviewerUserId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "LeaveRequest" WHERE id = ${requestId} FOR UPDATE`;
    const leave = await tx.leaveRequest.findUnique({
      where: { id: requestId },
      include: { approvalSteps: { orderBy: { stepOrder: 'asc' } } },
    });
    if (!leave || !['PENDING', 'PARTIALLY_APPROVED'].includes(leave.status)) throw Error('INVALID_STATE');
    const first = leave.approvalSteps.find((step) => step.decision === null);
    if (!first || first.stepOrder !== stepOrder) throw Error('OUT_OF_ORDER');
    await tx.leaveApprovalStep.update({
      where: { id: first.id },
      data: { decision: 'APPROVED', reviewerUserId, decidedAt: new Date() },
    });
    const final = leave.approvalSteps.every((step) => step.id === first.id || step.decision === 'APPROVED');
    await tx.leaveRequest.update({
      where: { id: requestId },
      data: { status: final ? 'APPROVED' : 'PARTIALLY_APPROVED',
        approvedMinutes: final ? leave.requestedMinutes : null,
        decidedAt: final ? new Date() : null },
    });
    if (final) {
      await tx.leaveLedgerEntry.create({ data: {
        employeeUserId: leave.employeeUserId, leaveTypeKey: leave.leaveTypeKey,
        jalaliYear: 1405, jalaliMonth: 8, entryType: 'APPROVED_USAGE',
        minutes: -leave.requestedMinutes, idempotencyKey: `usage:${requestId}`,
        leaveRequestId: requestId, createdByUserId: reviewerUserId,
      } });
    }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function main(): Promise<void> {
  const db = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  assert.equal(db[0]?.name, 'sahand_erp_test', 'REFUSING WRITES: database must be sahand_erp_test');
  try {
    employeeId = (await prisma.user.create({ data: {
      username: `${marker}-employee`, fullName: 'Integration Fixture Employee',
      passwordHash: 'DISABLED_TEST_ACCOUNT', isActive: false,
    }, select: { id: true } })).id;
    reviewerId = (await prisma.user.create({ data: {
      username: `${marker}-reviewer`, fullName: 'Integration Fixture Reviewer',
      passwordHash: 'DISABLED_TEST_ACCOUNT', isActive: false,
    }, select: { id: true } })).id;
    unitId = (await prisma.organizationUnit.create({
      data: { code: marker, name: 'Integration Test Unit' }, select: { id: true },
    })).id;
    assignmentId = (await prisma.employeeAssignment.create({
      data: { userId: employeeId, organizationUnitId: unitId, startDate: new Date('2026-01-01T00:00:00Z') },
      select: { id: true },
    })).id;
    await prisma.leaveLedgerEntry.create({ data: {
      employeeUserId: employeeId, leaveTypeKey: 'annual-paid', jalaliYear: 1405, jalaliMonth: 8,
      entryType: 'MANUAL_ADJUSTMENT', minutes: 1180,
      idempotencyKey: `opening:${marker}`, createdByUserId: reviewerId,
    } });
    const leave = await prisma.leaveRequest.create({ data: {
      employeeUserId: employeeId, employeeAssignmentId: assignmentId,
      leaveTypeKey: 'annual-paid', startAt: new Date('2026-11-01T06:00:00Z'),
      endAt: new Date('2026-11-01T10:00:00Z'), requestedMinutes: 240,
      status: 'PENDING', submittedAt: new Date(),
      approvalSteps: { create: [
        { stepOrder: 1, requiredRole: 'HR_MANAGER' },
        { stepOrder: 2, requiredRole: 'CEO_OR_DEPUTY' },
      ] },
    }, select: { id: true } });
    requestIds.push(leave.id);
    assert.equal(await balance(employeeId), 1180);

    await assert.rejects(approveStep(leave.id, 2, reviewerId), /OUT_OF_ORDER/);
    assert.equal((await prisma.leaveApprovalStep.count({ where: { leaveRequestId: leave.id, decision: 'APPROVED' } })), 0);
    console.log('PASS: out-of-order approval rejected without writes');

    await approveStep(leave.id, 1, reviewerId);
    assert.equal((await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } })).status, 'PARTIALLY_APPROVED');
    assert.equal(await balance(employeeId), 1180);
    console.log('PASS: intermediate approval does not debit balance');

    await approveStep(leave.id, 2, reviewerId);
    const completed = await prisma.leaveRequest.findUniqueOrThrow({ where: { id: leave.id } });
    assert.equal(completed.status, 'APPROVED');
    assert.equal(completed.approvedMinutes, 240);
    assert.equal(await balance(employeeId), 940);
    console.log('PASS: final approval creates exactly one debit');

    await assert.rejects(approveStep(leave.id, 2, reviewerId), /INVALID_STATE/);
    assert.equal(await balance(employeeId), 940);
    assert.equal(await prisma.leaveLedgerEntry.count({ where: { leaveRequestId: leave.id, entryType: 'APPROVED_USAGE' } }), 1);
    console.log('PASS: repeated approval cannot debit twice');

    await assert.rejects(prisma.leaveLedgerEntry.create({ data: {
      employeeUserId: employeeId, leaveTypeKey: 'annual-paid', jalaliYear: 1405, jalaliMonth: 8,
      entryType: 'APPROVED_USAGE', minutes: -240, idempotencyKey: `usage:${leave.id}`,
      leaveRequestId: leave.id, createdByUserId: reviewerId,
    } }), (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002');
    assert.equal(await balance(employeeId), 940);
    console.log('PASS: database unique key rejects duplicate usage');
    console.log('All leave approval PostgreSQL persistence assertions passed.');
  } finally {
    // Delete only fixtures created by this test, in FK-safe order.
    if (employeeId) await prisma.leaveLedgerEntry.deleteMany({ where: { employeeUserId: employeeId } });
    if (requestIds.length) {
      await prisma.leaveApprovalStep.deleteMany({ where: { leaveRequestId: { in: requestIds } } });
      await prisma.leaveRequest.deleteMany({ where: { id: { in: requestIds } } });
    }
    if (assignmentId) await prisma.employeeAssignment.deleteMany({ where: { id: assignmentId } });
    if (unitId) await prisma.organizationUnit.deleteMany({ where: { id: unitId } });
    if (employeeId) await prisma.user.deleteMany({ where: { id: employeeId } });
    if (reviewerId) await prisma.user.deleteMany({ where: { id: reviewerId } });
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
