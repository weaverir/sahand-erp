import { randomInt } from "node:crypto";
import { prisma } from "../libs/prisma";

const ROLLBACK = "SAHAND_EXPECTED_TEST_ROLLBACK";

async function main(): Promise<void> {
  // This is a database write/rollback integration test, NOT a calculation test.
  // The fixture references an existing user but never updates that user.
  const employee = await prisma.user.findFirst({
    where: { employeeAssignments: { some: {} } },
    select: { id: true },
  });
  if (!employee) {
    console.log(JSON.stringify({ passed: false, reason: "No user with an employee assignment exists; no data changed" }, null, 2));
    return;
  }

  const year = randomInt(100000, 2000000000);
  const month = 1;
  let periodId: string | undefined;
  let summaryId: string | undefined;
  let verifiedInside = false;

  try {
    await prisma.$transaction(async (tx) => {
      const period = await tx.attendanceMonthlyPeriod.create({
        data: {
          jalaliYear: year,
          jalaliMonth: month,
          startsAt: new Date("2026-01-01T00:00:00.000Z"),
          endsAt: new Date("2026-02-01T00:00:00.000Z"),
          status: "OPEN",
        },
        select: { id: true },
      });
      periodId = period.id;
      const summary = await tx.monthlyWorkSummary.create({
        data: {
          periodId: period.id,
          employeeUserId: employee.id,
          requiredMinutes: 480,
          workedMinutes: 300,
          approvedLeaveMinutes: 180,
          uncoveredMinutes: 0,
          overtimeMinutes: 0,
          unresolvedCount: 0,
        },
        select: { id: true },
      });
      summaryId = summary.id;
      const check = await tx.monthlyWorkSummary.findUnique({
        where: { id: summary.id },
        select: { requiredMinutes: true, workedMinutes: true, approvedLeaveMinutes: true },
      });
      verifiedInside = check?.requiredMinutes === 480 && check.workedMinutes === 300 && check.approvedLeaveMinutes === 180;
      if (!verifiedInside) throw new Error("Transaction fixture verification failed");
      // Throwing from an interactive transaction forces PostgreSQL rollback.
      throw new Error(ROLLBACK);
    });
    throw new Error("Transaction unexpectedly committed");
  } catch (error) {
    if (!(error instanceof Error) || error.message !== ROLLBACK) throw error;
  }

  if (!periodId || !summaryId || !verifiedInside) throw new Error("Fixture was not verified");
  const [periodAfter, summaryAfter] = await Promise.all([
    prisma.attendanceMonthlyPeriod.findUnique({ where: { id: periodId }, select: { id: true } }),
    prisma.monthlyWorkSummary.findUnique({ where: { id: summaryId }, select: { id: true } }),
  ]);
  if (periodAfter || summaryAfter) throw new Error("Rollback verification FAILED: test data remains");

  console.log(JSON.stringify({
    passed: true,
    test: "Monthly period and summary create/read/rollback",
    verifiedInsideTransaction: true,
    periodRolledBack: true,
    summaryRolledBack: true,
    productionDataChanged: false,
    nextStep: "Build a calculation fixture and test previewMonthlyWorkFromDatabase",
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
