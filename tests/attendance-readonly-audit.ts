/** Read-only attendance integrity audit. Run from project root. */
import { prisma } from "../libs/prisma";
import { calculateAttendance, type AttendancePunch } from "../modules/attendance/attendance-calculator";

async function main() {
  const days = Number(process.env.ATTENDANCE_AUDIT_DAYS ?? "30");
  if (!Number.isInteger(days) || days < 1 || days > 366) {
    throw new Error("ATTENDANCE_AUDIT_DAYS must be between 1 and 366");
  }
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const records = await prisma.attendanceRecord.findMany({
    where: { workDate: { gte: since } },
    select: {
      id: true, workDate: true, status: true, approvedAt: true,
      approvedByUserId: true, requiredMinutes: true,
      workedMinutes: true, breakMinutes: true, overtimeMinutes: true,
      scheduledStartAt: true, scheduledEndAt: true,
      employeeAssignment: { select: { userId: true } },
      events: {
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: { eventType: true, occurredAt: true },
      },
    },
  });
  const dayCounts = new Map<string, number>();
  const issues = {
    duplicateEmployeeDays: 0,
    approvedButOpen: 0,
    approvedWithoutApprovalTimestamp: 0,
    calculationsDiffer: 0,
    incompleteRecords: 0,
    overnightCheckouts: 0,
    recordsWithoutEvents: 0,
  };
  for (const r of records) {
    const key = `${r.employeeAssignment.userId}:${r.workDate.toISOString().slice(0, 10)}`;
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
    if (r.approvedAt && r.status === "OPEN") issues.approvedButOpen++;
    if (r.status === "APPROVED" && (!r.approvedAt || !r.approvedByUserId)) {
      issues.approvedWithoutApprovalTimestamp++;
    }
    if (!r.events.length) {
      issues.recordsWithoutEvents++;
      continue;
    }
    const punches: AttendancePunch[] = r.events.map(e => ({
      type: e.eventType, occurredAt: e.occurredAt,
    }));
    const result = calculateAttendance({
      punches, requiredMinutes: r.requiredMinutes,
      scheduledStartAt: r.scheduledStartAt,
      scheduledEndAt: r.scheduledEndAt,
    });
    if (!result.isComplete) issues.incompleteRecords++;
    if (result.workedMinutes !== r.workedMinutes ||
        result.breakMinutes !== r.breakMinutes ||
        result.overtimeMinutes !== r.overtimeMinutes) {
      issues.calculationsDiffer++;
    }
    if (result.lastCheckOutAt && result.firstCheckInAt &&
        result.lastCheckOutAt.toISOString().slice(0, 10) !==
        result.firstCheckInAt.toISOString().slice(0, 10)) {
      issues.overnightCheckouts++;
    }
  }
  issues.duplicateEmployeeDays = [...dayCounts.values()].filter(n => n > 1).length;
  console.log(JSON.stringify({
    mode: "READ_ONLY", periodDays: days, recordCount: records.length,
    issues,
    note: "Counts are diagnostic, not proof of API security or correct business approvals. UTC dates used for overnight diagnostic.",
  }, null, 2));
}
main().catch(error => {
  console.error("Attendance audit failed:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
