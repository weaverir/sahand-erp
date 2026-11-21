import { randomUUID } from "node:crypto";
import { prisma } from "../libs/prisma";
import { saveEmployeeMonthlyCalculation } from "../modules/attendance/monthly-work-save";

/* Run ONLY against a dedicated disposable database whose name ends in _test. */
const assert: (ok: unknown, message: string) => asserts ok is true = (ok, message) => {
  if (!ok) throw new Error(message);
};
const permitted = async (_actor: string) => {};
const denied = async (_actor: string): Promise<void> => { throw new Error("TEST_ACCESS_DENIED"); };

async function main() {
  const db = await prisma.$queryRaw<Array<{ name: string }>>`SELECT current_database() AS name`;
  const databaseName = db[0]?.name ?? "";
  if (!databaseName.endsWith("_test") || process.env.SAHAND_ALLOW_DESTRUCTIVE_TESTS !== "YES") {
    throw new Error(`REFUSED: database '${databaseName}' must end with _test and SAHAND_ALLOW_DESTRUCTIVE_TESTS=YES must be set`);
  }
  const assignment = await prisma.employeeAssignment.findFirst({ select: { id: true, userId: true } });
  if (!assignment) throw new Error("Test database needs one employee assignment (seed test data first)");

  const tag = randomUUID();
  const year = 1800 + Math.floor(Math.random() * 100);
  const month = 1;
  const day = new Date("2035-01-01T00:00:00.000Z");
  const week = new Date("2034-12-30T00:00:00.000Z");
  const start = new Date("2035-01-01T03:30:00.000Z");
  const middle = new Date("2035-01-01T08:30:00.000Z");
  const end = new Date("2035-01-01T11:30:00.000Z");
  let periodId: string | undefined;
  let scheduleId: string | undefined;
  let recordId: string | undefined;
  let leaveId: string | undefined;
  let cleaned = false;
  try {
    const period = await prisma.attendanceMonthlyPeriod.create({
      data: { jalaliYear: year, jalaliMonth: month, startsAt: new Date("2034-12-31T20:30:00Z"), endsAt: new Date("2035-01-31T20:30:00Z"), status: "OPEN" },
    });
    periodId = period.id;
    const schedule = await prisma.employeeShiftSchedule.create({
      data: { employeeUserId: assignment.userId, weekStartDate: week, version: 900000 + Math.floor(Math.random() * 100000), status: "APPROVED", createdByUserId: assignment.userId,
        segments: { create: [{ workDate: day, segmentOrder: 1, startsAt: start, endsAt: end, requiredMinutes: 480 }] } },
    });
    scheduleId = schedule.id;
    const record = await prisma.attendanceRecord.create({
      data: { employeeAssignmentId: assignment.id, workDate: day, status: "COMPLETED", requiredMinutes: 480,
        events: { create: [
          { eventType: "CHECK_IN", occurredAt: start, source: `TEST_${tag}` },
          { eventType: "CHECK_OUT", occurredAt: middle, source: `TEST_${tag}` },
        ] } },
    });
    recordId = record.id;
    const leave = await prisma.leaveRequest.create({
      data: { employeeUserId: assignment.userId, employeeAssignmentId: assignment.id, leaveTypeKey: `TEST_${tag}`, startAt: middle, endAt: end, requestedMinutes: 180, approvedMinutes: 180, status: "APPROVED" },
    });
    leaveId = leave.id;

    const input = { periodId, employeeUserId: assignment.userId, actorUserId: assignment.userId, authorizeCalculation: permitted };
    const first = await saveEmployeeMonthlyCalculation(input);
    assert(first.summary.requiredMinutes === 480, "requiredMinutes != 480");
    assert(first.summary.workedMinutes === 300, "workedMinutes != 300");
    assert(first.summary.approvedLeaveMinutes === 180, "approvedLeaveMinutes != 180");
    assert(first.summary.uncoveredMinutes === 0, "uncoveredMinutes != 0");
    assert(first.summary.calculationVersion === 1, "initial version != 1");

    const second = await saveEmployeeMonthlyCalculation(input);
    assert(second.summary.calculationVersion === 2, "recalculation did not increment version");
    assert(await prisma.monthlyWorkSummary.count({ where: { periodId, employeeUserId: assignment.userId } }) === 1, "duplicate summary");

    let deniedError = false;
    try { await saveEmployeeMonthlyCalculation({ ...input, authorizeCalculation: denied }); }
    catch (error) { deniedError = error instanceof Error && error.message === "TEST_ACCESS_DENIED"; }
    assert(deniedError, "authorization did not reject");
    const afterDeny = await prisma.monthlyWorkSummary.findUniqueOrThrow({ where: { periodId_employeeUserId: { periodId, employeeUserId: assignment.userId } } });
    assert(afterDeny.calculationVersion === 2, "denied operation wrote data");

    await prisma.attendanceMonthlyPeriod.update({ where: { id: periodId }, data: { status: "CLOSED" } });
    let closedError = false;
    try { await saveEmployeeMonthlyCalculation(input); } catch { closedError = true; }
    assert(closedError, "CLOSED period accepted recalculation");
    const afterClosed = await prisma.monthlyWorkSummary.findUniqueOrThrow({ where: { periodId_employeeUserId: { periodId, employeeUserId: assignment.userId } } });
    assert(afterClosed.calculationVersion === 2, "CLOSED operation changed version");

    console.log(JSON.stringify({ passed: true, databaseName, checks: ["persist 480/300/180/0", "upsert version 1 to 2", "no duplicate", "unauthorized rejected without write", "CLOSED rejected without write"], unresolvedCount: first.summary.unresolvedCount }, null, 2));
  } finally {
    // Cleanup ONLY records created by this test, on an explicitly opted-in test DB.
    if (periodId) await prisma.monthlyWorkSummary.deleteMany({ where: { periodId } });
    if (leaveId) await prisma.leaveRequest.delete({ where: { id: leaveId } });
    if (recordId) await prisma.attendanceRecord.delete({ where: { id: recordId } });
    if (scheduleId) {
      await prisma.employeeShiftScheduleSegment.deleteMany({ where: { scheduleId } });
      await prisma.employeeShiftSchedule.delete({ where: { id: scheduleId } });
    }
    if (periodId) await prisma.attendanceMonthlyPeriod.delete({ where: { id: periodId } });
    cleaned = true;
    console.log(JSON.stringify({ testFixtureCleanup: cleaned, databaseName }));
  }
}
main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
