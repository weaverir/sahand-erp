import type { Prisma } from "@/generated/prisma/client";
import { findShiftAssignmentConflict } from "./assignment-conflict-db";

export class OrganizationShiftConflictError extends Error {}

// Call after changing organization membership, inside runShiftWrite.
export async function assertEmployeeShiftCompatibility(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const memberships = await tx.employeeAssignment.findMany({
    where: { userId, status: "ACTIVE", user: { isActive: true } },
    select: { id: true, organizationUnitId: true },
  });
  if (!memberships.length) return;
  const assignments = await tx.shiftAssignment.findMany({
    where: { isActive: true, OR: [
      { targetType: "COMPANY" },
      { targetType: "UNIT", organizationUnitId: { in: memberships.map(m => m.organizationUnitId) } },
      { targetType: "EMPLOYEE", employeeAssignmentId: { in: memberships.map(m => m.id) } },
    ] },
  });
  for (const assignment of assignments) {
    const conflict = await findShiftAssignmentConflict(tx, assignment, assignment.id, userId);
    if (conflict) throw new OrganizationShiftConflictError(`تداخل شیفت در تاریخ ${conflict.workDate} به مدت ${conflict.overlapMinutes} دقیقه. ابتدا تخصیص شیفت را تعیین تکلیف کنید.`);
  }
}

// Transfer creates a new membership ID. Do not silently discard a personal shift.
export async function assertTransferShiftResolved(tx: Prisma.TransactionClient, id: string, startDate: Date): Promise<void> {
  const boundary = new Date(startDate.toISOString().slice(0, 10) + "T00:00:00.000Z");
  boundary.setUTCDate(boundary.getUTCDate() - 1);
  const personal = await tx.shiftAssignment.findFirst({ where: {
    isActive: true, targetType: "EMPLOYEE", employeeAssignmentId: id,
    OR: [{ validTo: null }, { validTo: { gte: boundary } }],
  }, select: { id: true } });
  if (personal) throw new OrganizationShiftConflictError("انتصاب قبلی دارای تخصیص شیفت فردی است. پیش از انتقال، تکلیف تخصیص شیفت را مشخص کنید.");
}
