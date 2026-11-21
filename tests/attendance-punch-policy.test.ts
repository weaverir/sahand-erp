import assert from "node:assert/strict";
import test from "node:test";
import { decideAttendancePunch, type PunchRecordState } from "../modules/attendance/attendance-punch-policy";

const today = new Date("2026-11-18T00:00:00.000Z");
const yesterday = new Date("2026-11-17T00:00:00.000Z");
function record(overrides: Partial<PunchRecordState> = {}): PunchRecordState {
  return { id: "r1", workDate: today, status: "OPEN", approvedAt: null,
    approvedByUserId: null, lastEventType: null, ...overrides };
}
function check(action: "CHECK_IN" | "CHECK_OUT", records: PunchRecordState[]) {
  return decideAttendancePunch({ action, today, records });
}

test("first check-in creates a record", () => {
  assert.deepEqual(check("CHECK_IN", []), { allowed: true, recordId: null, createNew: true });
});
test("second check-in on an open record is rejected", () => {
  assert.equal(check("CHECK_IN", [record({ lastEventType: "CHECK_IN" })]).allowed, false);
});
test("check-out without check-in is rejected", () => {
  assert.deepEqual(check("CHECK_OUT", []), { allowed: false, code: "NO_OPEN_SESSION", message: "برای خروج، ورود باز معتبری یافت نشد." });
});
test("normal check-out selects open record", () => {
  assert.deepEqual(check("CHECK_OUT", [record({ lastEventType: "CHECK_IN" })]), { allowed: true, recordId: "r1", createNew: false });
});
test("overnight checkout selects yesterday's record", () => {
  assert.deepEqual(check("CHECK_OUT", [record({ workDate: yesterday, lastEventType: "CHECK_IN" })]), { allowed: true, recordId: "r1", createNew: false });
});
test("multiple open records across roles are rejected", () => {
  const result = check("CHECK_OUT", [record({ lastEventType: "CHECK_IN" }), record({ id: "r2", lastEventType: "BREAK_END" })]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "MULTIPLE_OPEN");
});
test("duplicate employee-day records are rejected", () => {
  const result = check("CHECK_IN", [record(), record({ id: "r2" })]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "DUPLICATE_DAY");
});
test("approved record cannot be reopened", () => {
  const result = check("CHECK_IN", [record({ status: "COMPLETED", approvedAt: new Date(), lastEventType: "CHECK_OUT" })]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "RECORD_LOCKED");
});
test("approved open record cannot be checked out", () => {
  const result = check("CHECK_OUT", [record({ approvedByUserId: "manager", lastEventType: "CHECK_IN" })]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "RECORD_LOCKED");
});
test("locked status cannot be edited", () => {
  assert.equal(check("CHECK_IN", [record({ status: "APPROVED", lastEventType: "CHECK_OUT" })]).allowed, false);
});
test("checkout during break is rejected", () => {
  const result = check("CHECK_OUT", [record({ lastEventType: "BREAK_START" })]);
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "BREAK_OPEN");
});
test("check-in after a completed session reuses today's record", () => {
  assert.deepEqual(check("CHECK_IN", [record({ status: "COMPLETED", lastEventType: "CHECK_OUT" })]),
    { allowed: true, recordId: "r1", createNew: false });
});
test("auto checkout permits a new check-in", () => {
  assert.equal(check("CHECK_IN", [record({ lastEventType: "AUTO_CHECK_OUT" })]).allowed, true);
});
