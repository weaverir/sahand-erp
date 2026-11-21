/** Run only with DATABASE_URL pointing to sahand_erp_test. Creates and removes its own fixture. */
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../generated/prisma/client";
import {
  applyProratedMonthlyLeaveCredits,
  reconcileMonthlyLeaveCredit,
  getLeaveBalanceMinutes,
  jalaliMonthBounds,
  creditForEmploymentDates,
} from "../modules/attendance/leave-monthly-credit";

const prisma = new PrismaClient();
const marker = `leave-it-${randomUUID()}`;
let employeeId: string | undefined;
let candidateId: string | undefined;
let actorId: string | undefined;

function dateOnly(dayUtc: number): Date { return new Date(dayUtc); }

async function main(): Promise<void> {
  const database = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  assert.equal(database[0]?.name, "sahand_erp_test", "Refusing writes outside sahand_erp_test");
  const bounds = jalaliMonthBounds(1405, 9);
  assert.equal(bounds.daysInMonth, 30);

  try {
    const employee = await prisma.user.create({
      data: { username: `${marker}-employee`, fullName: "Leave Integration Test Employee", passwordHash: "DISABLED_TEST_ACCOUNT", isActive: false },
      select: { id: true },
    });
    employeeId = employee.id;
    const actor = await prisma.user.create({
      data: { username: `${marker}-actor`, fullName: "Leave Integration Test Actor", passwordHash: "DISABLED_TEST_ACCOUNT", isActive: false },
      select: { id: true },
    });
    actorId = actor.id;
    const candidate = await prisma.candidateApplication.create({
      data: {
        applicationNumber: `${marker}-application`, userId: employeeId,
        firstName: "Test", lastName: "Employee", fatherName: "Test",
        birthCertificateNumber: marker, nationalId: marker,
        gender: "MALE", maritalStatus: "SINGLE", nationality: "Test",
        birthPlace: "Test", dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
        mobilePhone: marker, address: "Test fixture only",
      },
      select: { id: true },
    });
    candidateId = candidate.id;
    await prisma.employeeProfile.create({
      data: { userId: employeeId, candidateApplicationId: candidateId, hireDate: dateOnly(bounds.startDayUtc) },
    });

    const creditInput = { employeeUserIds: [employeeId], leaveTypeKey: "integration-test-annual-paid", jalaliYear: 1405, jalaliMonth: 9, createdByUserId: actorId };
    const first = await applyProratedMonthlyLeaveCredits(prisma, creditInput);
    assert.deepEqual(first, { inserted: 1, alreadyApplied: 0, ineligible: 0 });
    const repeat = await applyProratedMonthlyLeaveCredits(prisma, creditInput);
    assert.deepEqual(repeat, { inserted: 0, alreadyApplied: 1, ineligible: 0 });
    assert.equal(await getLeaveBalanceMinutes(prisma, employeeId, creditInput.leaveTypeKey), 1180);
    console.log("PASS: full-month credit and idempotent retry");

    await prisma.employeeProfile.update({
      where: { userId: employeeId }, data: { terminationDate: dateOnly(bounds.startDayUtc + 14 * 86400000) },
    });
    const expectedHalf = creditForEmploymentDates(bounds, dateOnly(bounds.startDayUtc), dateOnly(bounds.startDayUtc + 14 * 86400000));
    assert.equal(expectedHalf, 590);
    const correction = await reconcileMonthlyLeaveCredit(prisma, {
      employeeUserId: employeeId, leaveTypeKey: creditInput.leaveTypeKey,
      jalaliYear: 1405, jalaliMonth: 9, createdByUserId: actorId,
      reason: "Integration test: termination on day 15",
    });
    assert.equal(correction.adjustmentMinutes, -590);
    assert.equal(correction.adjusted, true);
    assert.equal(await getLeaveBalanceMinutes(prisma, employeeId, creditInput.leaveTypeKey), 590);
    const unchanged = await reconcileMonthlyLeaveCredit(prisma, {
      employeeUserId: employeeId, leaveTypeKey: creditInput.leaveTypeKey,
      jalaliYear: 1405, jalaliMonth: 9, createdByUserId: actorId,
      reason: "Integration test: repeat",
    });
    assert.equal(unchanged.adjusted, false);
    console.log("PASS: negative adjustment and idempotent reconciliation");

    await prisma.employeeProfile.update({
      where: { userId: employeeId }, data: { terminationDate: null },
    });
    const restored = await reconcileMonthlyLeaveCredit(prisma, {
      employeeUserId: employeeId, leaveTypeKey: creditInput.leaveTypeKey,
      jalaliYear: 1405, jalaliMonth: 9, createdByUserId: actorId,
      reason: "Integration test: termination reversed",
    });
    assert.equal(restored.adjustmentMinutes, 590);
    assert.equal(await getLeaveBalanceMinutes(prisma, employeeId, creditInput.leaveTypeKey), 1180);
    console.log("PASS: compensating positive adjustment");

    const entries = await prisma.leaveLedgerEntry.findMany({
      where: { employeeUserId: employeeId, leaveTypeKey: creditInput.leaveTypeKey },
      select: { entryType: true, minutes: true, idempotencyKey: true },
    });
    assert.equal(entries.length, 3);
    assert.equal(entries.filter((e) => e.entryType === "MONTHLY_CREDIT").length, 1);
    assert.equal(entries.filter((e) => e.entryType === "MANUAL_ADJUSTMENT").length, 2);
    assert.equal(new Set(entries.map((e) => e.idempotencyKey)).size, 3);
    console.log("PASS: immutable ledger history and unique keys");
    console.log("All PostgreSQL sequential integration assertions passed.");
  } finally {
    // Cleanup order respects Restrict relations. Never delete unrelated data.
    if (employeeId) {
      await prisma.leaveLedgerEntry.deleteMany({ where: { employeeUserId: employeeId } });
      await prisma.employeeProfile.deleteMany({ where: { userId: employeeId } });
    }
    if (candidateId) await prisma.candidateApplication.deleteMany({ where: { id: candidateId } });
    if (employeeId) await prisma.user.deleteMany({ where: { id: employeeId } });
    if (actorId) await prisma.user.deleteMany({ where: { id: actorId } });
  }
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
