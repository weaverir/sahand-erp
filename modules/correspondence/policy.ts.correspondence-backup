/** Pure business rules for hierarchical correspondence; no DB writes. */
export type LetterPriority = "NORMAL" | "URGENT";
export type LetterDecision = "APPROVE_AND_FORWARD" | "REJECT" | "CLOSE_AT_TOP";

export interface ReportingAssignment {
  id: string;
  userId: string;
  managerAssignmentId: string | null;
  active: boolean;
}

export class CorrespondencePolicyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = "CorrespondencePolicyError";
  }
}

/** The direct supervisor must be active. A missing supervisor means top of hierarchy. */
export function getDirectManager(
  senderAssignmentId: string,
  assignments: readonly ReportingAssignment[],
): ReportingAssignment | null {
  const byId = new Map(assignments.map((assignment) => [assignment.id, assignment]));
  const sender = byId.get(senderAssignmentId);
  if (!sender?.active) throw new CorrespondencePolicyError("SENDER_INACTIVE", "مسئولیت فرستنده فعال نیست.");
  if (!sender.managerAssignmentId) return null;
  const manager = byId.get(sender.managerAssignmentId);
  if (!manager?.active) throw new CorrespondencePolicyError("MANAGER_UNAVAILABLE", "مدیر مستقیم فعال نیست.");
  if (manager.id === sender.id) throw new CorrespondencePolicyError("CYCLE", "چرخه در ساختار سازمانی وجود دارد.");
  return manager;
}

/** Detect cycles in the complete reporting chain before sending a letter. */
export function getReportingChain(
  senderAssignmentId: string,
  assignments: readonly ReportingAssignment[],
): ReportingAssignment[] {
  const chain: ReportingAssignment[] = [];
  const visited = new Set<string>([senderAssignmentId]);
  let currentId = senderAssignmentId;
  while (true) {
    const manager = getDirectManager(currentId, assignments);
    if (!manager) return chain;
    if (visited.has(manager.id)) throw new CorrespondencePolicyError("CYCLE", "چرخه در ساختار سازمانی وجود دارد.");
    visited.add(manager.id);
    chain.push(manager);
    currentId = manager.id;
  }
}

/** Use the sender's Tehran/Persian month, not the server's local calendar month. */
export function persianMonthKey(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date");
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
    timeZone: "Asia/Tehran", year: "numeric", month: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Invalid Persian month");
  return `${year}-${month.padStart(2, "0")}`;
}

export function assertUrgentLetterQuota(input: {
  priority: LetterPriority;
  urgentSentInPersianMonth: number;
}): void {
  if (!Number.isSafeInteger(input.urgentSentInPersianMonth) || input.urgentSentInPersianMonth < 0) {
    throw new CorrespondencePolicyError("INVALID_COUNT", "تعداد نامه‌ها نامعتبر است.");
  }
  if (input.priority === "URGENT" && input.urgentSentInPersianMonth >= 2) {
    throw new CorrespondencePolicyError("URGENT_QUOTA_EXCEEDED", "سهمیه دو نامه فوری این ماه تکمیل شده است.");
  }
}

/** Only the current assigned reviewer may make the next decision. */
export function validateLetterDecision(input: {
  actorAssignmentId: string;
  currentReviewerAssignmentId: string;
  decision: LetterDecision;
  nextManagerAssignmentId: string | null;
}): void {
  if (input.actorAssignmentId !== input.currentReviewerAssignmentId) {
    throw new CorrespondencePolicyError("NOT_CURRENT_REVIEWER", "این نامه در کارتابل شما نیست.");
  }
  if (input.decision === "APPROVE_AND_FORWARD" && !input.nextManagerAssignmentId) {
    throw new CorrespondencePolicyError("TOP_REACHED", "نامه به بالاترین مسئولیت رسیده است.");
  }
  if (input.decision === "CLOSE_AT_TOP" && input.nextManagerAssignmentId) {
    throw new CorrespondencePolicyError("NOT_TOP", "هنوز مسئولیت بالاتری وجود دارد.");
  }
}
