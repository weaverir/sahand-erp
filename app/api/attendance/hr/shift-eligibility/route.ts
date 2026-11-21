import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";
import { findRecurringShiftConflict, type RecurringAssignment } from "@/modules/shifts/recurring-shift-conflict";
import { findRecurringVsWeeklyConflict } from "@/modules/shifts/recurring-vs-weekly";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const dateKey = (date: Date) => date.toISOString().slice(0, 10);

export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(request, "attendance.shift.view");
  } catch {
    return NextResponse.json({ error: "دسترسی ندارید." }, { status: 403 });
  }
  const shiftId = request.nextUrl.searchParams.get("shiftId") ?? "";
  const validFrom = request.nextUrl.searchParams.get("validFrom") ?? "";
  if (!shiftId || shiftId.length > 100 || !datePattern.test(validFrom) ||
      Number.isNaN(Date.parse(`${validFrom}T00:00:00.000Z`)) ||
      dateKey(new Date(`${validFrom}T00:00:00.000Z`)) !== validFrom) {
    return NextResponse.json({ error: "شیفت یا تاریخ شروع معتبر نیست." }, { status: 400 });
  }
  const [shift, employees, assignments, weeklySegments] = await Promise.all([
    prisma.workShift.findUnique({ where: { id: shiftId }, include: { days: true } }),
    prisma.employeeAssignment.findMany({
      where: { status: "ACTIVE", user: { isActive: true } },
      select: { id: true, userId: true, organizationUnitId: true },
    }),
    prisma.shiftAssignment.findMany({
      where: { isActive: true, OR: [{ validTo: null }, { validTo: { gte: new Date(`${validFrom}T00:00:00.000Z`) } }] },
      include: { shift: { include: { days: true } } },
    }),
    prisma.employeeShiftScheduleSegment.findMany({
      where: { schedule: { status: "APPROVED" } },
      select: { startsAt: true, endsAt: true, schedule: { select: { employeeUserId: true } } },
    }),
  ]);
  if (!shift || !shift.isActive) return NextResponse.json({ error: "شیفت فعال یافت نشد." }, { status: 404 });
  const recurring = (id: string, from: string, to: string | null, days: typeof shift.days): RecurringAssignment => ({
    id, validFrom: from, validTo: to,
    days: days.map(d => ({ dayOfWeek: d.dayOfWeek, isWorkingDay: d.isWorkingDay,
      startMinute: d.startMinute, endMinute: d.endMinute, dayType: d.dayType })),
  });
  const candidate = recurring("candidate", validFrom, null, shift.days);
  const unavailable: Record<string, { shiftName: string; workDate: string; overlapMinutes: number }> = {};
  try {
    for (const assignment of assignments) {
      const other = recurring(assignment.id, dateKey(assignment.validFrom),
        assignment.validTo ? dateKey(assignment.validTo) : null, assignment.shift.days);
      const conflict = findRecurringShiftConflict(candidate, other);
      if (!conflict) continue;
      for (const employee of employees) {
        if (unavailable[employee.id]) continue;
        const affected = assignment.targetType === "COMPANY" ||
          (assignment.targetType === "UNIT" && assignment.organizationUnitId === employee.organizationUnitId) ||
          (assignment.targetType === "EMPLOYEE" && assignment.employeeAssignmentId === employee.id);
        if (affected) unavailable[employee.id] = {
          shiftName: assignment.shift.name, workDate: conflict.workDate,
          overlapMinutes: conflict.overlapMinutes,
        };
      }
    }
    // Weekly schedules are stored by user ID, not employee assignment ID.
    // Check them too, including overnight occurrences from the previous date.
    for (const segment of weeklySegments) {
      const conflict = findRecurringVsWeeklyConflict(candidate, segment);
      if (!conflict) continue;
      for (const employee of employees) {
        if (employee.userId !== segment.schedule.employeeUserId || unavailable[employee.id]) continue;
        unavailable[employee.id] = {
          shiftName: "برنامه هفتگی تأییدشده",
          workDate: conflict.workDate,
          overlapMinutes: conflict.overlapMinutes,
        };
      }
    }
  } catch {
    return NextResponse.json({ error: "بررسی زمان‌بندی شیفت‌ها ناموفق بود." }, { status: 422 });
  }
  return NextResponse.json({ unavailable }, { headers: { "Cache-Control": "no-store" } });
}
