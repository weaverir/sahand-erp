import { prisma } from "../libs/prisma";
import { previewMonthlyWorkFromDatabase } from "../modules/attendance/monthly-work-db";

const ROLLBACK = "SAHAND_MONTHLY_FIXTURE_ROLLBACK";

async function main() {
  const assignment = await prisma.employeeAssignment.findFirst({
    select: { id: true, userId: true },
  });
  if (!assignment) {
    console.log(JSON.stringify({ passed: false, reason: "No existing employee assignment; fixture not started" }, null, 2));
    return;
  }

  // The dates are intentionally far in the future to avoid production records.
  // The whole transaction is rolled back, including all test rows.
  const workDate = new Date("2035-01-01T00:00:00.000Z");
  const weekStartDate = new Date("2034-12-30T00:00:00.000Z"); // Saturday
  const start = new Date("2035-01-01T03:30:00.000Z"); // 07:00 Tehran
  const afterFiveHours = new Date("2035-01-01T08:30:00.000Z");
  const end = new Date("2035-01-01T11:30:00.000Z"); // 15:00 Tehran
  const periodStart = new Date("2034-12-31T20:30:00.000Z");
  const periodEnd = new Date("2035-01-31T20:30:00.000Z");
  let verified = false;

  try {
    await prisma.$transaction(async (tx) => {
      const period = await tx.attendanceMonthlyPeriod.create({
        data: { jalaliYear: 1700, jalaliMonth: 1, startsAt: periodStart, endsAt: periodEnd },
      });
      const schedule = await tx.employeeShiftSchedule.create({
        data: {
          employeeUserId: assignment.userId,
          weekStartDate,
          version: 999999,
          status: "APPROVED",
          createdByUserId: assignment.userId,
          segments: {
            create: [{ workDate, segmentOrder: 1, startsAt: start, endsAt: end, requiredMinutes: 480 }],
          },
        },
      });
      const attendance = await tx.attendanceRecord.create({
        data: {
          employeeAssignmentId: assignment.id,
          workDate,
          status: "COMPLETED",
          requiredMinutes: 480,
          events: {
            create: [
              { eventType: "CHECK_IN", occurredAt: start, source: "TEST_FIXTURE" },
              { eventType: "CHECK_OUT", occurredAt: afterFiveHours, source: "TEST_FIXTURE" },
            ],
          },
        },
      });
      const leave = await tx.leaveRequest.create({
        data: {
          employeeUserId: assignment.userId,
          employeeAssignmentId: assignment.id,
          leaveTypeKey: "TEST_FIXTURE",
          startAt: afterFiveHours,
          endAt: end,
          requestedMinutes: 180,
          approvedMinutes: 180,
          status: "APPROVED",
        },
      });

      const result = await previewMonthlyWorkFromDatabase(period.id, assignment.userId, tx);
      const totals = result.totals;
      verified = totals.requiredMinutes === 480 &&
        totals.workedMinutes === 300 &&
        totals.approvedLeaveMinutes === 180 &&
        totals.uncoveredMinutes === 0;
      console.log(JSON.stringify({
        insideTransaction: true,
        passed: verified,
        expected: { requiredMinutes: 480, workedMinutes: 300, approvedLeaveMinutes: 180, uncoveredMinutes: 0 },
        actual: {
          requiredMinutes: totals.requiredMinutes,
          workedMinutes: totals.workedMinutes,
          approvedLeaveMinutes: totals.approvedLeaveMinutes,
          uncoveredMinutes: totals.uncoveredMinutes,
          unresolvedCount: totals.unresolvedCount,
        },
        fixtureIdsCreated: Boolean(schedule.id && attendance.id && leave.id),
      }, null, 2));
      if (!verified) throw new Error("Fixture calculation mismatch");
      throw new Error(ROLLBACK);
    }, { timeout: 20000 });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }

  const periodCount = await prisma.attendanceMonthlyPeriod.count({ where: { jalaliYear: 1700, jalaliMonth: 1 } });
  const remaining = await prisma.attendanceEvent.count({ where: { source: "TEST_FIXTURE", occurredAt: { gte: start, lte: end } } });
  const passed = verified && periodCount === 0 && remaining === 0;
  console.log(JSON.stringify({ passed, rollbackVerified: periodCount === 0 && remaining === 0 }, null, 2));
  if (!passed) process.exitCode = 1;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
