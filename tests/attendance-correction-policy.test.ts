import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCorrectionRequest, validateCorrectionReview, applyApprovedCorrections,
  approvalResetAfterCorrection, type CorrectionRequest,
} from "../modules/attendance/attendance-correction-policy";

const t = (value: string) => new Date(value);
const events = [
  { id: "in", eventType: "CHECK_IN" as const, occurredAt: t("2026-11-17T04:00:00Z") },
  { id: "out", eventType: "CHECK_OUT" as const, occurredAt: t("2026-11-17T12:00:00Z") },
];
const request: CorrectionRequest = {
  id: "req1", attendanceRecordId: "record1", attendanceEventId: "out",
  proposedEventType: null, proposedOccurredAt: t("2026-11-17T13:00:00Z"),
  reason: "ساعت خروج ثبت‌شده اشتباه است", status: "PENDING",
  requestedByUserId: "employee1", reviewedByUserId: null, reviewedAt: null, reviewerComment: null,
};
const requestInput = () => ({ actor: "EMPLOYEE" as const, requesterUserId: "employee1", recordOwnerUserId: "employee1",
  recordId: "record1", attendanceEventId: "out", proposedOccurredAt: t("2026-11-17T13:00:00Z"),
  reason: "ساعت خروج به اشتباه ثبت شده است", events, existingRequests: [] as CorrectionRequest[] });
const reviewInput = () => ({ actor: "HR" as const, reviewerUserId: "hr1", request, decision: "APPROVED" as const,
  comment: "با مدارک تأیید شد", editWindowAllowed: true, payrollClosed: false });

test("employee may request correction to own event", () => assert.equal(validateCorrectionRequest(requestInput()).allowed, true));
test("employee cannot request for another employee", () => assert.equal(validateCorrectionRequest({ ...requestInput(), recordOwnerUserId: "other" }).allowed, false));
test("event must belong to record", () => assert.equal(validateCorrectionRequest({ ...requestInput(), attendanceEventId: "alien" }).allowed, false));
test("reason must be meaningful", () => assert.equal(validateCorrectionRequest({ ...requestInput(), reason: "bad" }).allowed, false));
test("duplicate pending requests blocked", () => assert.equal(validateCorrectionRequest({ ...requestInput(), existingRequests: [request] }).allowed, false));
test("HR may review valid request", () => assert.equal(validateCorrectionReview(reviewInput()).allowed, true));
test("employee cannot review", () => assert.equal(validateCorrectionReview({ ...reviewInput(), actor: "EMPLOYEE" }).allowed, false));
test("self review forbidden", () => assert.equal(validateCorrectionReview({ ...reviewInput(), reviewerUserId: "employee1" }).allowed, false));
test("closed payroll forbids review", () => assert.equal(validateCorrectionReview({ ...reviewInput(), payrollClosed: true }).allowed, false));
test("expired Jalali window forbids review", () => assert.equal(validateCorrectionReview({ ...reviewInput(), editWindowAllowed: false }).allowed, false));
test("review is single use", () => assert.equal(validateCorrectionReview({ ...reviewInput(), request: { ...request, status: "APPROVED" } }).allowed, false));
test("approved correction creates virtual events without modifying raw events", () => {
  const approved: CorrectionRequest = { ...request, status: "APPROVED", reviewedAt: t("2026-11-18T08:00:00Z") };
  const projected = applyApprovedCorrections({ events, adjustments: [approved] });
  assert.equal(projected[1].occurredAt.toISOString(), "2026-11-17T13:00:00.000Z");
  assert.equal(events[1].occurredAt.toISOString(), "2026-11-17T12:00:00.000Z");
});
test("approved missing punch is inserted into projection", () => {
  const added: CorrectionRequest = { ...request, id: "missing", attendanceEventId: null,
    proposedEventType: "CHECK_OUT", status: "APPROVED", reviewedAt: t("2026-11-18T08:00:00Z") };
  const projected = applyApprovedCorrections({ events: [events[0]], adjustments: [added] });
  assert.equal(projected[1].id, "adjustment:missing");
});
test("pending and rejected requests do not alter projections", () => {
  const projected = applyApprovedCorrections({ events, adjustments: [request, { ...request, id: "rejected", status: "REJECTED" }] });
  assert.equal(projected[1].occurredAt.getTime(), events[1].occurredAt.getTime());
});
test("previous approval is cleared after correction", () => {
  assert.deepEqual(approvalResetAfterCorrection({ approvedAt: t("2026-11-18T08:00:00Z"), approvedByUserId: "hr1" }),
    { needsReapproval: true, approvedAt: null, approvedByUserId: null });
});
