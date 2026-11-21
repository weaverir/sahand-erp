import "server-only";

import { prisma } from "@/libs/prisma";
import { previewMonthlyWorkFromDatabase } from "./monthly-work-db";
import {
  assertMonthlyCalculationAllowed,
  assertMonthlyTotalsValid,
} from "./monthly-work-save-policy";

/**
 * Internal write service, not an API route. The caller MUST supply a trusted
 * server-side permission check. Never pass a client-controlled boolean or
 * treat system_admin as a business approver.
 *
 * Saves one employee's preview atomically. Does not close or approve a month.
 * Calculation and write use the same Prisma transaction snapshot.
 */
export async function saveEmployeeMonthlyCalculation(input: {
  periodId: string;
  employeeUserId: string;
  actorUserId: string;
  authorizeCalculation: (actorUserId: string) => Promise<void>;
}) {
  const { periodId, employeeUserId, actorUserId, authorizeCalculation } = input;
  if (![periodId, employeeUserId, actorUserId].every((id) => typeof id === "string" && id.trim())) {
    throw new Error("Invalid monthly calculation identifiers");
  }
  if (typeof authorizeCalculation !== "function") {
    throw new Error("Trusted authorization callback is required");
  }
  await authorizeCalculation(actorUserId);

  return prisma.$transaction(async (tx) => {
    const period = await tx.attendanceMonthlyPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, status: true, revision: true },
    });
    if (!period) throw new Error("Monthly period not found");
    assertMonthlyCalculationAllowed(period.status);

    // Lock the period row through a conditional update. Concurrent closing or
    // reopening must not silently overwrite a calculation.
    const lock = await tx.attendanceMonthlyPeriod.updateMany({
      where: { id: periodId, status: period.status, revision: period.revision },
      data: { calculatedAt: new Date() },
    });
    if (lock.count !== 1) throw new Error("Monthly period changed during calculation");

    const preview = await previewMonthlyWorkFromDatabase(periodId, employeeUserId, tx);
    assertMonthlyTotalsValid(preview.totals);

    const saved = await tx.monthlyWorkSummary.upsert({
      where: { periodId_employeeUserId: { periodId, employeeUserId } },
      create: {
        periodId,
        employeeUserId,
        requiredMinutes: preview.totals.requiredMinutes,
        workedMinutes: preview.totals.workedMinutes,
        holidayWorkMinutes: preview.totals.holidayWorkMinutes,
        approvedLeaveMinutes: preview.totals.approvedLeaveMinutes,
        overtimeMinutes: preview.totals.overtimeMinutes,
        uncoveredMinutes: preview.totals.uncoveredMinutes,
        unresolvedCount: preview.totals.unresolvedCount,
        calculatedAt: new Date(),
      },
      update: {
        requiredMinutes: preview.totals.requiredMinutes,
        workedMinutes: preview.totals.workedMinutes,
        holidayWorkMinutes: preview.totals.holidayWorkMinutes,
        approvedLeaveMinutes: preview.totals.approvedLeaveMinutes,
        overtimeMinutes: preview.totals.overtimeMinutes,
        uncoveredMinutes: preview.totals.uncoveredMinutes,
        unresolvedCount: preview.totals.unresolvedCount,
        calculationVersion: { increment: 1 },
        calculatedAt: new Date(),
      },
      select: {
        id: true, periodId: true, employeeUserId: true,
        requiredMinutes: true, workedMinutes: true, holidayWorkMinutes: true,
        approvedLeaveMinutes: true, overtimeMinutes: true,
        uncoveredMinutes: true, unresolvedCount: true,
        calculationVersion: true, calculatedAt: true,
      },
    });

    // Deliberately remain OPEN / REOPENED. A separate, fully authorized HR
    // review workflow must verify completeness and transition the whole period.
    return { summary: saved, issues: preview.totals.issues, periodStatus: period.status };
  }, { timeout: 30000 });
}
