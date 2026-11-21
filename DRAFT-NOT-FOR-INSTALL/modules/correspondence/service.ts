import "server-only";
import { prisma } from "@/libs/prisma";
import { Prisma, EmployeeAssignmentStatus } from "@/generated/prisma/client";
import { assertUrgentLetterQuota, getReportingChain, persianMonthKey, validateLetterDecision, CorrespondencePolicyError } from "./policy";

export class CorrespondenceError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}

const active = (now: Date) => ({
  status: EmployeeAssignmentStatus.ACTIVE,
  startDate: { lte: now },
  OR: [{ endDate: null }, { endDate: { gte: now } }],
  user: { isActive: true, accessLevel: "ERP" as const },
});

async function chain(tx: Prisma.TransactionClient, assignmentId: string, now: Date) {
  const assignments = await tx.employeeAssignment.findMany({
    where: active(now),
    select: { id: true, userId: true, managerAssignmentId: true },
  });
  const mapped = assignments.map(a => ({ ...a, active: true }));
  return getReportingChain(assignmentId, mapped);
}

export async function createLetter(userId: string, input: { assignmentId: string; subject: string; body: string; priority: "NORMAL" | "URGENT" }) {
  const subject = input.subject.trim();
  const body = input.body.trim();
  if (!subject || subject.length > 200 || !body || body.length > 20000) throw new CorrespondenceError("عنوان یا متن نامه نامعتبر است.");
  if (input.priority !== "NORMAL" && input.priority !== "URGENT") throw new CorrespondenceError("اولویت نامعتبر است.");
  const now = new Date();
  const month = persianMonthKey(now);
  return prisma.$transaction(async tx => {
    const sender = await tx.employeeAssignment.findFirst({ where: { id: input.assignmentId, userId, ...active(now) } });
    if (!sender) throw new CorrespondenceError("مسئولیت فعال فرستنده پیدا نشد.", 403);
    const hierarchy = await chain(tx, sender.id, now);
    if (!hierarchy.length) throw new CorrespondenceError("برای این مسئولیت مدیر مستقیم تعریف نشده است.");
    if (input.priority === "URGENT") {
      await tx.correspondenceMonthlyQuota.upsert({
        where: { userId_persianMonth: { userId, persianMonth: month } },
        create: { userId, persianMonth: month, urgentUsed: 0 }, update: {},
      });
      const changed = await tx.correspondenceMonthlyQuota.updateMany({
        where: { userId, persianMonth: month, urgentUsed: { lt: 2 } },
        data: { urgentUsed: { increment: 1 } },
      });
      if (changed.count !== 1) {
        assertUrgentLetterQuota({ priority: "URGENT", urgentSentInPersianMonth: 2 });
      }
    }
    return tx.correspondenceLetter.create({
      data: { senderUserId: userId, senderAssignmentId: sender.id, subject, body, priority: input.priority, persianMonth: month,
        currentReviewerAssignmentId: hierarchy[0].id,
        actions: { create: { actorUserId: userId, actorAssignmentId: sender.id, action: "SENT", toAssignmentId: hierarchy[0].id } },
      }, include: { actions: true },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function decideLetter(userId: string, letterId: string, input: { assignmentId: string; decision: "APPROVE_AND_FORWARD" | "REJECT" | "CLOSE_AT_TOP"; note?: string }) {
  if (!input.assignmentId || !["APPROVE_AND_FORWARD", "REJECT", "CLOSE_AT_TOP"].includes(input.decision)) throw new CorrespondenceError("درخواست نامعتبر است.");
  const note = (input.note ?? "").trim();
  if (note.length > 5000) throw new CorrespondenceError("توضیح بیش از حد طولانی است.");
  const now = new Date();
  return prisma.$transaction(async tx => {
    const letter = await tx.correspondenceLetter.findUnique({ where: { id: letterId } });
    if (!letter) throw new CorrespondenceError("نامه پیدا نشد.", 404);
    if (letter.status !== "PENDING" || letter.currentReviewerAssignmentId !== input.assignmentId) throw new CorrespondenceError("نامه در کارتابل شما نیست.", 403);
    const reviewer = await tx.employeeAssignment.findFirst({ where: { id: input.assignmentId, userId, ...active(now) } });
    if (!reviewer) throw new CorrespondenceError("مسئولیت بررسی‌کننده معتبر نیست.", 403);
    const hierarchy = await chain(tx, reviewer.id, now);
    const next = hierarchy[0]?.id ?? null;
    validateLetterDecision({ actorAssignmentId: reviewer.id, currentReviewerAssignmentId: letter.currentReviewerAssignmentId, decision: input.decision, nextManagerAssignmentId: next });
    const status = input.decision === "REJECT" ? "REJECTED" : input.decision === "CLOSE_AT_TOP" ? "CLOSED" : "PENDING";
    const updated = await tx.correspondenceLetter.updateMany({
      where: { id: letterId, status: "PENDING", currentReviewerAssignmentId: reviewer.id, version: letter.version },
      data: { status, currentReviewerAssignmentId: status === "PENDING" ? next : null, version: { increment: 1 } },
    });
    if (updated.count !== 1) throw new CorrespondenceError("نامه هم‌زمان تغییر کرده است؛ دوباره تلاش کنید.", 409);
    await tx.correspondenceHistory.create({ data: { letterId, actorUserId: userId, actorAssignmentId: reviewer.id,
      action: input.decision === "REJECT" ? "REJECTED" : input.decision === "CLOSE_AT_TOP" ? "CLOSED" : "FORWARDED",
      fromAssignmentId: reviewer.id, toAssignmentId: status === "PENDING" ? next : null, note: note || null } });
    return tx.correspondenceLetter.findUnique({ where: { id: letterId }, include: { actions: { orderBy: { createdAt: "asc" } } } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function listLetters(userId: string) {
  const now = new Date();
  const assignments = await prisma.employeeAssignment.findMany({ where: { userId, ...active(now) }, select: { id: true } });
  return prisma.correspondenceLetter.findMany({ where: { OR: [
    { senderUserId: userId },
    { currentReviewerAssignmentId: { in: assignments.map(a => a.id) } },
  ] }, orderBy: { createdAt: "desc" }, take: 100, select: {
    id: true, subject: true, priority: true, status: true, senderUserId: true, senderAssignmentId: true,
    currentReviewerAssignmentId: true, createdAt: true, updatedAt: true,
  } });
}
