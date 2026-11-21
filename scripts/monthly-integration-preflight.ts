import { prisma } from "../libs/prisma";

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { startsWith: "dev.staff." } },
    select: { id: true, username: true, employeeAssignments: { select: { id: true, status: true } } },
    orderBy: { username: "asc" },
  });
  const periods = await prisma.attendanceMonthlyPeriod.findMany({
    select: { id: true, jalaliYear: true, jalaliMonth: true, status: true, startsAt: true, endsAt: true },
    orderBy: [{ jalaliYear: "desc" }, { jalaliMonth: "desc" }], take: 12,
  });
  const [records, events, schedules, segments, holidays, summaries, leaves] = await Promise.all([
    prisma.attendanceRecord.count(), prisma.attendanceEvent.count(),
    prisma.employeeShiftSchedule.count(), prisma.employeeShiftScheduleSegment.count(),
    prisma.holidayCalendarDay.count(), prisma.monthlyWorkSummary.count(),
    prisma.leaveRequest.count(),
  ]);
  const output = {
    mode: "READ_ONLY", database: "current DATABASE_URL (not printed)",
    users: users.map(u => ({ username: u.username, userId: u.id, assignmentIds: u.employeeAssignments.map(a => a.id), assignmentStatuses: u.employeeAssignments.map(a => a.status) })),
    periods, counts: { records, events, schedules, segments, holidays, summaries, leaves },
    warnings: [
      ...(users.length < 10 ? ["Fewer than 10 dev.staff users found"] : []),
      ...users.filter(u => u.employeeAssignments.length === 0).map(u => `${u.username} has no employee assignment`),
      ...periods.filter(p => p.status !== "OPEN").map(p => `Period ${p.jalaliYear}/${p.jalaliMonth} is ${p.status}; do not seed into it`),
    ],
  };
  console.log(JSON.stringify(output, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
