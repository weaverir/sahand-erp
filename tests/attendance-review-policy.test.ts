import assert from "node:assert/strict";
import test from "node:test";
import { decideAttendanceReview, type AttendanceReviewRecord } from "../modules/attendance/attendance-review-policy";

function record(overrides: Partial<AttendanceReviewRecord> = {}): AttendanceReviewRecord {
  return {
    id: "test-record", status: "COMPLETED", approvedAt: null, approvedByUserId: null,
    requiredMinutes: 480, workedMinutes: 540, overtimeMinutes: 60,
    lateMinutes: 0, earlyLeaveMinutes: 0,
    firstCheckInAt: new Date("2026-11-18T04:30:00Z"),
    lastCheckOutAt: new Date("2026-11-18T13:30:00Z"),
    requiresReview: false, adjustments: [], ...overrides,
  };
}
const approve = (r: AttendanceReviewRecord, overtime = 0) =>
  decideAttendanceReview({ record: r, action: "APPROVE", approvedOvertimeMinutes: overtime });
const code = (result: ReturnType<typeof approve>) => result.allowed ? "ALLOWED" : result.code;

test("completed record can be approved without overtime", () => {
  const result = approve(record());
  assert.equal(result.allowed, true);
  if (result.allowed) { assert.equal(result.nextStatus, "APPROVED"); assert.equal(result.approvedOvertimeMinutes, 0); }
});
test("HR can approve part of proposed overtime", () => {
  const result = approve(record(), 30);
  assert.equal(result.allowed, true);
  if (result.allowed) assert.equal(result.approvedOvertimeMinutes, 30);
});
test("cannot approve more than proposed overtime", () => assert.equal(code(approve(record(), 61)), "INVALID_OVERTIME"));
test("negative overtime is rejected", () => assert.equal(code(approve(record(), -1)), "INVALID_OVERTIME"));
test("fractional overtime is rejected", () => assert.equal(code(approve(record(), 1.5)), "INVALID_OVERTIME"));
test("approved status is locked", () => assert.equal(code(approve(record({ status: "APPROVED" }))), "ALREADY_APPROVED"));
test("approval timestamp locks the record", () => assert.equal(code(approve(record({ approvedAt: new Date() }))), "ALREADY_APPROVED"));
test("approval user locks the record", () => assert.equal(code(approve(record({ approvedByUserId: "hr" }))), "ALREADY_APPROVED"));
test("open record cannot be approved", () => assert.equal(code(approve(record({ status: "OPEN" }))), "NOT_READY"));
test("pending review record can be approved", () => assert.equal(code(approve(record({ status: "PENDING_REVIEW" }))), "ALLOWED"));
test("incomplete exit cannot be approved", () => assert.equal(code(approve(record({ lastCheckOutAt: null }))), "INCOMPLETE_ATTENDANCE"));
test("reversed entry and exit cannot be approved", () => assert.equal(code(approve(record({ lastCheckOutAt: new Date("2026-11-18T03:00:00Z") }))), "INCOMPLETE_ATTENDANCE"));
test("calculation warnings block approval", () => assert.equal(code(approve(record({ requiresReview: true }))), "REQUIRES_REVIEW"));
test("pending adjustment blocks approval", () => assert.equal(code(approve(record({ adjustments: [{ status: "PENDING" }] }))), "PENDING_ADJUSTMENT"));
test("resolved adjustment does not block approval", () => assert.equal(code(approve(record({ adjustments: [{ status: "APPROVED" }] }))), "ALLOWED"));
test("deficit is calculated from required and worked time", () => {
  const result = approve(record({ workedMinutes: 420, overtimeMinutes: 0 }));
  assert.equal(result.allowed, true);
  if (result.allowed) assert.equal(result.deficitMinutes, 60);
});
test("invalid minutes block approval", () => assert.equal(code(approve(record({ workedMinutes: -1 }))), "INVALID_MINUTES"));
test("review can be requested for open record", () => {
  const result = decideAttendanceReview({ record: record({ status: "OPEN" }), action: "SEND_TO_REVIEW" });
  assert.equal(result.allowed, true);
  if (result.allowed) assert.equal(result.nextStatus, "PENDING_REVIEW");
});
test("rejection requires a reason", () => {
  const result = decideAttendanceReview({ record: record(), action: "REJECT", reason: "no" });
  assert.equal(code(result), "REASON_REQUIRED");
});
test("rejection with reason is allowed", () => {
  const result = decideAttendanceReview({ record: record(), action: "REJECT", reason: "نیاز به اصلاح ساعت خروج" });
  assert.equal(result.allowed, true);
  if (result.allowed) assert.equal(result.nextStatus, "REJECTED");
});
test("rejected record cannot be directly approved", () => assert.equal(code(approve(record({ status: "REJECTED" }))), "NOT_READY"));
