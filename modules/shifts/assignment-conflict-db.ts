import type { Prisma, ShiftAssignmentTarget } from "@/generated/prisma/client";
import { findRecurringShiftConflict, type RecurringAssignment } from "./recurring-shift-conflict";
import { findRecurringVsWeeklyConflict } from "./recurring-vs-weekly";

type Candidate = {
  shiftId: string;
  targetType: ShiftAssignmentTarget;
  organizationUnitId: string | null;
  employeeAssignmentId: string | null;
  validFrom: Date;
  validTo: Date | null;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);

/** A transaction-scoped lock serializes writers using this guard. */
export async function lockShiftAssignments(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(742019, 61001)`;
}

export async function findShiftAssignmentConflict(
  tx: Prisma.TransactionClient,
  candidate: Candidate,
  excludeId?: string,
  onlyUserId?: string,
): Promise<{ assignmentId: string; employeeUserId: string; workDate: string; overlapMinutes: number } | null> {
  const employees = await tx.employeeAssignment.findMany({
    where: { status: "ACTIVE", user: { isActive: true }, ...(onlyUserId ? { userId: onlyUserId } : {}) },
    select: { id: true, userId: true, organizationUnitId: true, startDate: true, endDate: true },
  });
  const targetUsers = (target: Pick<Candidate, "targetType" | "employeeAssignmentId" | "organizationUnitId">) =>
    new Set(employees.filter(e =>
      target.targetType === "COMPANY" ||
      (target.targetType === "UNIT" && e.organizationUnitId === target.organizationUnitId) ||
      (target.targetType === "EMPLOYEE" && e.id === target.employeeAssignmentId)
    ).map(e => e.userId));
  const candidateUsers = targetUsers(candidate);
  if (!candidateUsers.size) return null;

  const candidateShift = await tx.workShift.findUnique({
    where: { id: candidate.shiftId }, include: { days: true },
  });
  if (!candidateShift) throw new Error("Shift not found");
  const makeRecurring = (id: string, from: Date, to: Date | null, days: typeof candidateShift.days): RecurringAssignment => ({
    id, validFrom: iso(from), validTo: to ? iso(to) : null,
    days: days.map(d => ({ dayOfWeek: d.dayOfWeek, isWorkingDay: d.isWorkingDay,
      startMinute: d.startMinute, endMinute: d.endMinute, dayType: d.dayType })),
  });
  const proposed = makeRecurring("PROPOSED", candidate.validFrom, candidate.validTo, candidateShift.days);
  // Include adjacent origin dates in both directions for overnight shifts.
  // The exact policy below still rejects false positives.
  const dayMs = 86_400_000;
  const earliestEnd = new Date(candidate.validFrom.getTime() - dayMs);
  const latestStart = candidate.validTo
    ? new Date(candidate.validTo.getTime() + dayMs)
    : null;
  const existing = await tx.shiftAssignment.findMany({
    where: {
      isActive: true,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(latestStart ? { validFrom: { lte: latestStart } } : {}),
      OR: [{ validTo: null }, { validTo: { gte: earliestEnd } }],
    },
    include: { shift: { include: { days: true } } },
  });
  for (const assignment of existing) {
    const otherUsers = targetUsers(assignment);
    const sharedUser = [...candidateUsers].find(userId => otherUsers.has(userId));
    if (!sharedUser) continue;
    const other = makeRecurring(assignment.id, assignment.validFrom, assignment.validTo, assignment.shift.days);
    const conflict = findRecurringShiftConflict(proposed, other);
    if (conflict) return {
      assignmentId: assignment.id, employeeUserId: sharedUser,
      workDate: conflict.workDate, overlapMinutes: conflict.overlapMinutes,
    };
  }
  // Approved weekly schedules are absolute-time assignments and must also be
  // checked before creating or updating a recurring assignment.
  const weeklySegments = await tx.employeeShiftScheduleSegment.findMany({
    where: {
      schedule: { status: "APPROVED", employeeUserId: { in: [...candidateUsers] } },
    },
    select: {
      id: true, startsAt: true, endsAt: true,
      schedule: { select: { employeeUserId: true } },
    },
  });
  for (const segment of weeklySegments) {
    const conflict = findRecurringVsWeeklyConflict(proposed, segment);
    if (conflict) return {
      assignmentId: `WEEKLY:${segment.id}`,
      employeeUserId: segment.schedule.employeeUserId,
      workDate: conflict.workDate,
      overlapMinutes: conflict.overlapMinutes,
    };
  }
  return null;
}
