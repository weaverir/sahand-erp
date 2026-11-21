/** Pure HR attendance review rules. No database or framework dependencies. */
export type AttendanceReviewStatus =
  | "OPEN" | "COMPLETED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";
export type AdjustmentReviewStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export interface AttendanceReviewRecord {
  id: string;
  status: AttendanceReviewStatus;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  requiredMinutes: number;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  firstCheckInAt: Date | null;
  lastCheckOutAt: Date | null;
  requiresReview: boolean;
  adjustments: readonly { status: AdjustmentReviewStatus }[];
}

export type AttendanceReviewDecision =
  | { allowed: true; nextStatus: "APPROVED" | "PENDING_REVIEW" | "REJECTED"; approvedOvertimeMinutes: number; deficitMinutes: number }
  | { allowed: false; code: string; message: string };

function deny(code: string, message: string): AttendanceReviewDecision {
  return { allowed: false, code, message };
}
function validMinutes(n: number): boolean {
  return Number.isSafeInteger(n) && n >= 0 && n <= 1440;
}

/**
 * Pure policy only: caller MUST enforce HR authorization, ownership/scope, audit logging,
 * and atomic database writes. APPROVED records must never be overwritten.
 *
 * approvedOvertimeMinutes is a proposed output, NOT persisted by this module.
 * Existing AttendanceRecord has overtimeMinutes but no distinct approved-overtime field.
 */
export function decideAttendanceReview(input: {
  record: AttendanceReviewRecord;
  action: "APPROVE" | "SEND_TO_REVIEW" | "REJECT";
  approvedOvertimeMinutes?: number;
  reason?: string;
}): AttendanceReviewDecision {
  const { record, action } = input;
  if (record.status === "APPROVED" || record.approvedAt !== null || record.approvedByUserId !== null) {
    return deny("ALREADY_APPROVED", "رکورد قبلاً تأیید شده و قفل است.");
  }
  if (![record.requiredMinutes, record.workedMinutes, record.overtimeMinutes,
    record.lateMinutes, record.earlyLeaveMinutes].every(validMinutes)) {
    return deny("INVALID_MINUTES", "مقادیر زمانی رکورد معتبر نیست.");
  }
  if (record.adjustments.some((a) => a.status === "PENDING")) {
    return deny("PENDING_ADJUSTMENT", "ابتدا باید درخواست‌های اصلاح تردد تعیین تکلیف شوند.");
  }
  const deficitMinutes = Math.max(0, record.requiredMinutes - record.workedMinutes);
  if (action === "SEND_TO_REVIEW") {
    if (record.status === "REJECTED") return deny("INVALID_STATE", "رکورد ردشده باید از مسیر اصلاح مجاز بازگشایی شود.");
    return { allowed: true, nextStatus: "PENDING_REVIEW", approvedOvertimeMinutes: 0, deficitMinutes };
  }
  if (action === "REJECT") {
    if (record.status === "REJECTED") return deny("INVALID_STATE", "رکورد قبلاً رد شده است.");
    if (!input.reason?.trim() || input.reason.trim().length < 5) {
      return deny("REASON_REQUIRED", "برای رد رکورد، توضیح حداقل پنج‌حرفی لازم است.");
    }
    return { allowed: true, nextStatus: "REJECTED", approvedOvertimeMinutes: 0, deficitMinutes };
  }
  if (record.status !== "COMPLETED" && record.status !== "PENDING_REVIEW") {
    return deny("NOT_READY", "رکورد برای تأیید نهایی آماده نیست.");
  }
  if (!record.firstCheckInAt || !record.lastCheckOutAt ||
      record.lastCheckOutAt.getTime() <= record.firstCheckInAt.getTime()) {
    return deny("INCOMPLETE_ATTENDANCE", "ورود و خروج کامل و معتبر ثبت نشده است.");
  }
  if (record.requiresReview) {
    return deny("REQUIRES_REVIEW", "ابهام‌های محاسباتی باید قبل از تأیید رفع شوند.");
  }
  const approvedOvertimeMinutes = input.approvedOvertimeMinutes ?? 0;
  if (!validMinutes(approvedOvertimeMinutes) || approvedOvertimeMinutes > record.overtimeMinutes) {
    return deny("INVALID_OVERTIME", "اضافه‌کاری تأییدی باید بین صفر و اضافه‌کاری پیشنهادی باشد.");
  }
  return { allowed: true, nextStatus: "APPROVED", approvedOvertimeMinutes, deficitMinutes };
}
