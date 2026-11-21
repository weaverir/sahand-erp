import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/libs/prisma";
import { assertSameOriginRequest, authorizeGlobalRequest } from "@/modules/auth/auth.middleware";
import { validateCorrectionReview, applyApprovedCorrections, type CorrectionRequest } from "@/modules/attendance/attendance-correction-policy";
import { evaluateHrAttendanceEditWindow } from "@/modules/attendance/attendance-hr-edit-window";
import { calculateAttendance } from "@/modules/attendance/attendance-calculator";
import { assertAttendanceIntervalWritable } from "@/modules/attendance/monthly-period-write-guard";
import { ClosedMonthlyPeriodError } from "@/modules/attendance/monthly-period-lock-policy";
import { getTehranWorkDateBounds } from "@/modules/attendance/tehran-work-date-bounds";

type Context = { params: Promise<{ id: string }> };
class ReviewFailure extends Error {
  constructor(message: string, readonly statusCode: number) { super(message); }
}
const fail = (message: string, code = 409): never => { throw new ReviewFailure(message, code); };

/** HR decision: serializes concurrent reviews; never edits raw AttendanceEvent rows. */
export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOriginRequest(request);
    const auth = await authorizeGlobalRequest(request, "attendance.attendance.update");
    const reviewerId = auth.user.id;
    const reviewer = await prisma.user.findUnique({
      where: { id: reviewerId },
      select: {
        isActive: true, isSystem: true,
        roles: { where: { isActive: true }, select: { role: { select: { key: true } } } },
        employeeAssignments: {
          where: { status: "ACTIVE" },
          select: { roles: { where: { isActive: true }, select: { role: { select: { key: true } } } } },
        },
      },
    });
    const globalRoles = reviewer?.roles.map((r) => r.role.key) ?? [];
    const assignmentRoles = reviewer?.employeeAssignments.flatMap((a) => a.roles.map((r) => r.role.key)) ?? [];
    if (!reviewer?.isActive || reviewer.isSystem || globalRoles.includes("system_admin") ||
        ![...globalRoles, ...assignmentRoles].includes("hr_manager")) {
      return NextResponse.json({ error: "این اقدام فقط برای مدیر منابع انسانی مجاز است." }, { status: 403 });
    }

    const { id } = await context.params;
    if (!id || id.length > 128) return NextResponse.json({ error: "شناسه نامعتبر است." }, { status: 400 });
    if (Number(request.headers.get("content-length") ?? 0) > 4096) return NextResponse.json({ error: "حجم درخواست زیاد است." }, { status: 413 });
    let body: unknown;
    try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON نامعتبر است." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "بدنه درخواست نامعتبر است." }, { status: 400 });
    const input = body as Record<string, unknown>;
    if ((input.decision !== "APPROVED" && input.decision !== "REJECTED") ||
        typeof input.comment !== "string" || input.comment.trim().length < 5 || input.comment.length > 2000) {
      return NextResponse.json({ error: "تصمیم و توضیح معتبر لازم است." }, { status: 400 });
    }
    const decision = input.decision;
    const comment = input.comment.trim();

    const result = await prisma.$transaction(async (tx) => {
      // Lock the request first, then its parent record; serialize competing decisions.
      await tx.$queryRaw`SELECT id FROM "AttendanceAdjustment" WHERE id = ${id} FOR UPDATE`;
      const adjustment = await tx.attendanceAdjustment.findUnique({ where: { id } });
      if (!adjustment) return fail("درخواست پیدا نشد.", 404);
      await tx.$queryRaw`SELECT id FROM "AttendanceRecord" WHERE id = ${adjustment.attendanceRecordId} FOR UPDATE`;
      const record = await tx.attendanceRecord.findUnique({
        where: { id: adjustment.attendanceRecordId },
        include: { employeeAssignment: { select: { userId: true } }, events: true,
          adjustments: { orderBy: [{ reviewedAt: "asc" }, { id: "asc" }] } },
      });
      if (!record) return fail("رکورد حضور یافت نشد.", 404);
      // Protect the Tehran work-date day. Lock period rows in this transaction
      // before approving/rejecting the adjustment or changing calculated totals.
      const { startsAt: dayStart, endsAt: dayEnd } =
        getTehranWorkDateBounds(record.workDate);
      await assertAttendanceIntervalWritable(tx, dayStart, dayEnd);
      const window = evaluateHrAttendanceEditWindow({ workDate: record.workDate, payrollClosed: false });
      const requestData: CorrectionRequest = {
        id: adjustment.id, attendanceRecordId: adjustment.attendanceRecordId,
        attendanceEventId: adjustment.attendanceEventId,
        proposedEventType: adjustment.proposedEventType,
        proposedOccurredAt: adjustment.proposedOccurredAt,
        reason: adjustment.reason,
        status: adjustment.status === "CANCELLED" ? "REJECTED" : adjustment.status,
        requestedByUserId: adjustment.requestedByUserId,
        reviewedByUserId: adjustment.reviewedByUserId,
        reviewedAt: adjustment.reviewedAt, reviewerComment: adjustment.reviewerComment,
      };
      const verdict = validateCorrectionReview({ actor: "HR", reviewerUserId: reviewerId,
        request: requestData, decision, comment, editWindowAllowed: window.allowed, payrollClosed: false });
      if (!verdict.allowed) return fail(verdict.message);
      if (decision === "REJECTED") {
        return tx.attendanceAdjustment.update({ where: { id }, data: {
          status: "REJECTED", reviewedByUserId: reviewerId, reviewedAt: new Date(), reviewerComment: comment,
        }, select: { id: true, status: true, reviewedAt: true, reviewerComment: true } });
      }
      const approved: CorrectionRequest[] = [...record.adjustments.filter((a) => a.status === "APPROVED"), adjustment].map((a) => ({
        id: a.id, attendanceRecordId: a.attendanceRecordId, attendanceEventId: a.attendanceEventId,
        proposedEventType: a.proposedEventType, proposedOccurredAt: a.proposedOccurredAt,
        reason: a.reason, status: "APPROVED", requestedByUserId: a.requestedByUserId,
        reviewedByUserId: a.id === id ? reviewerId : a.reviewedByUserId,
        reviewedAt: a.id === id ? new Date() : a.reviewedAt, reviewerComment: a.reviewerComment,
      }));
      let effective;
      try {
        effective = applyApprovedCorrections({ events: record.events, adjustments: approved });
      } catch { return fail("تغییر پیشنهادی با تاریخچه رویدادها سازگار نیست."); }
      const calculated = calculateAttendance({
        punches: effective.map((e) => ({ type: e.eventType, occurredAt: e.occurredAt })),
        requiredMinutes: record.requiredMinutes,
        scheduledStartAt: record.scheduledStartAt, scheduledEndAt: record.scheduledEndAt,
      });
      if (calculated.requiresReview || !calculated.isComplete) {
        return fail("پس از اصلاح، توالی ورود و خروج کامل و معتبر نیست. درخواست را رد کنید یا اصلاح دیگری ثبت شود.");
      }
      const reviewedAt = new Date();
      const updated = await tx.attendanceAdjustment.update({ where: { id }, data: {
        status: "APPROVED", reviewedByUserId: reviewerId, reviewedAt, reviewerComment: comment,
      }, select: { id: true, status: true, reviewedAt: true, reviewerComment: true } });
      await tx.attendanceRecord.update({ where: { id: record.id }, data: {
        firstCheckInAt: calculated.firstCheckInAt, lastCheckOutAt: calculated.lastCheckOutAt,
        workedMinutes: calculated.workedMinutes, breakMinutes: calculated.breakMinutes,
        overtimeMinutes: calculated.overtimeMinutes, lateMinutes: calculated.lateMinutes,
        earlyLeaveMinutes: calculated.earlyLeaveMinutes,
        status: "PENDING_REVIEW", approvedAt: null, approvedByUserId: null,
      } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    return NextResponse.json({ request: result, message: "تصمیم منابع انسانی ثبت شد." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof ReviewFailure) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    if (error instanceof ClosedMonthlyPeriodError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("attendance HR correction review", error);
    return NextResponse.json({ error: "ثبت تصمیم امکان‌پذیر نشد." }, { status: 500 });
  }
}
