/** Pure attendance correction workflow. No DB writes or framework dependencies. */
export type CorrectionEventType = "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" | "AUTO_CHECK_OUT";
export type CorrectionStatus = "PENDING" | "APPROVED" | "REJECTED";
export type CorrectionActor = "EMPLOYEE" | "HR";

export interface CorrectionEvent {
  id: string;
  eventType: CorrectionEventType;
  occurredAt: Date;
}
export interface CorrectionRequest {
  id: string;
  attendanceRecordId: string;
  attendanceEventId: string | null;
  proposedEventType: CorrectionEventType | null;
  proposedOccurredAt: Date | null;
  reason: string;
  status: CorrectionStatus;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  reviewerComment: string | null;
}
export type CorrectionDecision =
  | { allowed: true }
  | { allowed: false; code: string; message: string };

const reject = (code: string, message: string): CorrectionDecision => ({ allowed: false, code, message });
const validDate = (value: Date | null | undefined): value is Date => value instanceof Date && Number.isFinite(value.getTime());

export function validateCorrectionRequest(input: {
  actor: CorrectionActor;
  requesterUserId: string;
  recordOwnerUserId: string;
  recordId: string;
  attendanceEventId?: string | null;
  proposedEventType?: CorrectionEventType | null;
  proposedOccurredAt?: Date | null;
  reason: string;
  events: readonly CorrectionEvent[];
  existingRequests: readonly Pick<CorrectionRequest, "status" | "attendanceEventId">[];
}): CorrectionDecision {
  if (input.actor !== "EMPLOYEE" && input.actor !== "HR") return reject("ACTOR_INVALID", "نقش درخواست‌کننده نامعتبر است.");
  if (input.actor === "EMPLOYEE" && input.requesterUserId !== input.recordOwnerUserId)
    return reject("NOT_OWNER", "کارمند فقط می‌تواند برای رکورد خودش درخواست ثبت کند.");
  if (!input.recordId || !input.requesterUserId || !input.recordOwnerUserId)
    return reject("INVALID_ID", "شناسه‌های درخواست معتبر نیستند.");
  if (typeof input.reason !== "string" || input.reason.trim().length < 10 || input.reason.length > 2000)
    return reject("REASON_REQUIRED", "دلیل اصلاح باید بین ۱۰ تا ۲۰۰۰ نویسه باشد.");
  const eventId = input.attendanceEventId ?? null;
  if (eventId && !input.events.some((event) => event.id === eventId))
    return reject("EVENT_NOT_FOUND", "رویداد انتخاب‌شده متعلق به این رکورد نیست.");
  if (input.proposedOccurredAt != null && !validDate(input.proposedOccurredAt))
    return reject("INVALID_TIME", "زمان پیشنهادی معتبر نیست.");
  if (input.proposedEventType != null && !["CHECK_IN", "CHECK_OUT", "BREAK_START", "BREAK_END", "AUTO_CHECK_OUT"].includes(input.proposedEventType))
    return reject("INVALID_EVENT_TYPE", "نوع رویداد پیشنهادی معتبر نیست.");
  if (input.existingRequests.some((r) => r.status === "PENDING" && r.attendanceEventId === eventId))
    return reject("DUPLICATE_PENDING", "برای این رویداد یک درخواست باز وجود دارد.");
  return { allowed: true };
}

export function validateCorrectionReview(input: {
  actor: CorrectionActor;
  reviewerUserId: string;
  request: CorrectionRequest;
  decision: "APPROVED" | "REJECTED";
  comment: string;
  editWindowAllowed: boolean;
  payrollClosed: boolean;
}): CorrectionDecision {
  if (input.actor !== "HR") return reject("HR_REQUIRED", "بررسی اصلاح فقط توسط منابع انسانی مجاز است.");
  if (!input.reviewerUserId) return reject("REVIEWER_REQUIRED", "شناسه بررسی‌کننده لازم است.");
  if (input.request.status !== "PENDING") return reject("ALREADY_REVIEWED", "درخواست قبلاً تعیین تکلیف شده است.");
  if (input.reviewerUserId === input.request.requestedByUserId)
    return reject("SELF_REVIEW", "تأیید درخواست توسط درخواست‌کننده مجاز نیست.");
  if (input.payrollClosed) return reject("PAYROLL_CLOSED", "دوره بسته شده و اصلاح مستقیم مجاز نیست.");
  if (!input.editWindowAllowed) return reject("WINDOW_EXPIRED", "مهلت اصلاح تقویم شمسی پایان یافته است.");
  if (typeof input.comment !== "string" || input.comment.trim().length < 5 || input.comment.length > 2000)
    return reject("COMMENT_REQUIRED", "توضیح بررسی‌کننده باید بین ۵ تا ۲۰۰۰ نویسه باشد.");
  if (input.decision === "APPROVED" && !input.request.proposedEventType && !validDate(input.request.proposedOccurredAt))
    return reject("NO_PROPOSED_CHANGE", "برای تأیید باید تغییر مشخصی پیشنهاد شده باشد.");
  return { allowed: true };
}

/** Produce a virtual event stream for recalculation; original events are never mutated. */
export function applyApprovedCorrections(input: {
  events: readonly CorrectionEvent[];
  adjustments: readonly CorrectionRequest[];
}): CorrectionEvent[] {
  const result = input.events.map((event) => ({ ...event, occurredAt: new Date(event.occurredAt.getTime()) }));
  const approved = input.adjustments
    .filter((request) => request.status === "APPROVED")
    .sort((a, b) => (a.reviewedAt?.getTime() ?? 0) - (b.reviewedAt?.getTime() ?? 0) || a.id.localeCompare(b.id));
  for (const request of approved) {
    if (request.attendanceEventId) {
      const event = result.find((item) => item.id === request.attendanceEventId);
      if (!event) throw new Error(`Approved adjustment ${request.id} references an unknown event`);
      if (request.proposedEventType) event.eventType = request.proposedEventType;
      if (request.proposedOccurredAt) {
        if (!validDate(request.proposedOccurredAt)) throw new Error("Invalid approved event timestamp");
        event.occurredAt = new Date(request.proposedOccurredAt.getTime());
      }
    } else {
      if (!request.proposedEventType || !validDate(request.proposedOccurredAt))
        throw new Error(`Approved adjustment ${request.id} lacks a complete new event`);
      result.push({ id: `adjustment:${request.id}`, eventType: request.proposedEventType, occurredAt: new Date(request.proposedOccurredAt.getTime()) });
    }
  }
  return result.sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.id.localeCompare(b.id));
}

/** Approval must be cleared in the persistence transaction after recalculation. */
export function approvalResetAfterCorrection(previous: { approvedAt: Date | null; approvedByUserId: string | null }) {
  return {
    needsReapproval: previous.approvedAt !== null || previous.approvedByUserId !== null,
    approvedAt: null,
    approvedByUserId: null,
  } as const;
}
