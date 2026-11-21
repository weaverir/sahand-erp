import assert from "node:assert/strict";
import test from "node:test";
import {
  assertUrgentLetterQuota,
  getReportingChain,
  persianMonthKey,
  validateLetterDecision,
} from "../modules/correspondence-policy";

const assignments = [
  { id: "employee", userId: "u1", managerAssignmentId: "manager", active: true },
  { id: "manager", userId: "u2", managerAssignmentId: "ceo", active: true },
  { id: "ceo", userId: "u3", managerAssignmentId: null, active: true },
];

test("routes a letter through the hierarchy to its top", () => {
  assert.deepEqual(getReportingChain("employee", assignments).map((a) => a.id), ["manager", "ceo"]);
});

test("rejects cyclic reporting relationships", () => {
  assert.throws(() => getReportingChain("employee", assignments.map((a) => a.id === "ceo" ? { ...a, managerAssignmentId: "employee" } : a)), { code: "CYCLE" });
});

test("two urgent letters per Persian month; normal letters remain unlimited", () => {
  assertUrgentLetterQuota({ priority: "URGENT", urgentSentInPersianMonth: 1 });
  assert.throws(() => assertUrgentLetterQuota({ priority: "URGENT", urgentSentInPersianMonth: 2 }), { code: "URGENT_QUOTA_EXCEEDED" });
  assertUrgentLetterQuota({ priority: "NORMAL", urgentSentInPersianMonth: 500 });
});

test("Persian month is calculated in Tehran timezone", () => {
  assert.equal(persianMonthKey(new Date("2025-03-21T12:00:00Z")), "1404-01");
});

test("only current reviewer can forward, and the top closes the letter", () => {
  assert.throws(() => validateLetterDecision({ actorAssignmentId: "employee", currentReviewerAssignmentId: "manager", decision: "APPROVE_AND_FORWARD", nextManagerAssignmentId: "ceo" }), { code: "NOT_CURRENT_REVIEWER" });
  validateLetterDecision({ actorAssignmentId: "manager", currentReviewerAssignmentId: "manager", decision: "APPROVE_AND_FORWARD", nextManagerAssignmentId: "ceo" });
  assert.throws(() => validateLetterDecision({ actorAssignmentId: "ceo", currentReviewerAssignmentId: "ceo", decision: "APPROVE_AND_FORWARD", nextManagerAssignmentId: null }), { code: "TOP_REACHED" });
  validateLetterDecision({ actorAssignmentId: "ceo", currentReviewerAssignmentId: "ceo", decision: "CLOSE_AT_TOP", nextManagerAssignmentId: null });
});
