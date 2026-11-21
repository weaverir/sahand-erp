import { prisma } from "./libs/prisma";

const periodId = "cmwnlnmzj0000fs340e2u2njn";

async function main() {
  const period = await prisma.attendanceMonthlyPeriod.findUniqueOrThrow({
    where: { id: periodId },
    select: { startsAt: true, endsAt: true },
  });

  const users = await prisma.user.findMany({
    where: { username: { startsWith: "dev.staff." } },
    select: {
      id: true,
      username: true,
      employeeAssignments: {
        select: { id: true },
      },
    },
  });

  const assignmentIds = users.flatMap((u) =>
    u.employeeAssignments.map((a) => a.id)
  );

  const records = await prisma.attendanceRecord.findMany({
    where: {
      employeeAssignmentId: { in: assignmentIds },
      workDate: {
        gte: period.startsAt,
        lt: period.endsAt,
      },
    },
    select: {
      employeeAssignmentId: true,
      workDate: true,
      status: true,
      events: {
        select: { eventType: true, occurredAt: true },
      },
    },
  });

  const ownerByAssignment = new Map(
    users.flatMap((u) =>
      u.employeeAssignments.map((a) => [a.id, u.username] as const)
    )
  );

  const results = users.map((u) => {
    const own = records.filter(
      (r) => ownerByAssignment.get(r.employeeAssignmentId) === u.username
    );

    const friday = own.filter(
      (r) => r.workDate.getUTCDay() === 5
    );

    return {
      username: u.username,
      totalRecords: own.length,
      fridayRecords: friday.length,
      fridayWithCheckIn: friday.filter((r) =>
        r.events.some((e) => e.eventType === "CHECK_IN")
      ).length,
      fridayWithCheckOut: friday.filter((r) =>
        r.events.some((e) =>
          e.eventType === "CHECK_OUT" ||
          e.eventType === "AUTO_CHECK_OUT"
        )
      ).length,
    };
  });

  console.table(results);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
