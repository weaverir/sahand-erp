/**
 * Sahand ERP — read-only PostgreSQL integration diagnostics.
 * No INSERT/UPDATE/DELETE. No employee names or IDs are printed.
 * Run: node --env-file=.env --import tsx scripts/check-monthly-work-integration.ts
 */
import { PrismaClient } from "../generated/prisma/client";

const prisma = new PrismaClient();

type Diagnostic = { check: string; passed: boolean; detail: string };

async function main(): Promise<void> {
  const checks: Diagnostic[] = [];
  const add = (check: string, passed: boolean, detail: string) =>
    checks.push({ check, passed, detail });

  // Run actual Prisma queries against the configured PostgreSQL database.
  const [periods, schedules, records, leaves, summaries] = await Promise.all([
    prisma.attendanceMonthlyPeriod.findMany({
      select: { id: true, startsAt: true, endsAt: true, status: true },
      orderBy: { startsAt: "desc" },
      take: 6,
    }),
    prisma.employeeShiftSchedule.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.attendanceRecord.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.leaveRequest.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.monthlyWorkSummary.count(),
  ]);
  add("Monthly period query", true, `${periods.length} recent period(s)`);
  add("Monthly period boundaries", periods.every(p => p.startsAt < p.endsAt), "All returned periods have valid UTC boundaries");
  add("Weekly schedule query", true, JSON.stringify(schedules.map(s => ({ status: s.status, count: s._count._all }))));
  add("Attendance status query", true, JSON.stringify(records.map(r => ({ status: r.status, count: r._count._all }))));
  add("Leave status query", true, JSON.stringify(leaves.map(l => ({ status: l.status, count: l._count._all }))));
  add("Monthly summary query", true, `${summaries} saved summary row(s)`);

  // Verify the actual relation chain used by the monthly-work preview:
  // AttendanceRecord -> EmployeeAssignment -> User, including punch events.
  const sample = await prisma.attendanceRecord.findMany({
    take: 20,
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      workDate: true,
      employeeAssignment: { select: { userId: true } },
      events: {
        select: { eventType: true, occurredAt: true },
        orderBy: { occurredAt: "asc" },
      },
      adjustments: { select: { status: true } },
    },
  });
  add("Attendance relation and events query", true, `${sample.length} record(s) fetched`);
  add("Valid attendance event timestamps", sample.every(r => r.events.every(e => Number.isFinite(e.occurredAt.getTime()))), "No invalid timestamps in sample");
  add("Pending correction count", true, String(sample.reduce((n, r) => n + r.adjustments.filter(a => a.status === "PENDING").length, 0)));
  add("Unpaired punch candidates", true, String(sample.filter(r => {
    const ins = r.events.filter(e => e.eventType === "CHECK_IN").length;
    const outs = r.events.filter(e => e.eventType === "CHECK_OUT" || e.eventType === "AUTO_CHECK_OUT").length;
    return ins !== outs;
  }).length));

  const approvedSchedule = await prisma.employeeShiftSchedule.findFirst({
    where: { status: "APPROVED" },
    select: { segments: { select: { workDate: true, startsAt: true, endsAt: true, requiredMinutes: true } } },
  });
  add("Approved schedule segment query", true, approvedSchedule ? `${approvedSchedule.segments.length} segment(s) in sample schedule` : "No approved schedule yet (not a query failure)");
  add("Approved segment boundaries", !approvedSchedule || approvedSchedule.segments.every(s => s.startsAt < s.endsAt && s.requiredMinutes >= 0), "Sample segments valid or absent");

  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: { status: "APPROVED" },
    select: { startAt: true, endAt: true, approvalSteps: { select: { decision: true, requiredRole: true } } },
  });
  add("Approved leave relation query", true, approvedLeave ? `${approvedLeave.approvalSteps.length} approval step(s) in sample leave` : "No approved leave yet (not a query failure)");
  add("Approved leave boundaries", !approvedLeave || approvedLeave.startAt < approvedLeave.endAt, "Sample leave valid or absent");

  const failed = checks.filter(c => !c.passed);
  console.log(JSON.stringify({ mode: "READ_ONLY", checks, failedCount: failed.length,
    nextStep: periods.length && approvedSchedule && sample.length
      ? "Ready to test preview calculation against a selected period and test employee"
      : "A controlled test fixture is required before end-to-end monthly calculation" }, null, 2));
  if (failed.length) process.exitCode = 1;
}

main().catch(error => {
  console.error("INTEGRATION_CHECK_FAILED:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
