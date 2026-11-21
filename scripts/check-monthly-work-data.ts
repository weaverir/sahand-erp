import { prisma } from "../libs/prisma";

async function main() {
  const [periods, schedules, records, leaves, summaries] = await Promise.all([
    prisma.attendanceMonthlyPeriod.findMany({
      orderBy: [{ jalaliYear: "desc" }, { jalaliMonth: "desc" }],
      take: 6,
      select: { id: true, jalaliYear: true, jalaliMonth: true, status: true, startsAt: true, endsAt: true,
        _count: { select: { summaries: true } } },
    }),
    prisma.employeeShiftSchedule.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.leaveRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.monthlyWorkSummary.count(),
  ]);

  const summary = {
    periods: periods.map(({ id: _id, ...p }) => ({ ...p, startsAt: p.startsAt.toISOString(), endsAt: p.endsAt.toISOString() })),
    weeklySchedulesByStatus: schedules.map((x) => ({ status: x.status, count: x._count._all })),
    attendanceRecordsByStatus: records.map((x) => ({ status: x.status, count: x._count._all })),
    leaveRequestsByStatus: leaves.map((x) => ({ status: x.status, count: x._count._all })),
    savedMonthlySummaries: summaries,
  };
  console.log(JSON.stringify(summary, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => { await prisma.$disconnect(); });
