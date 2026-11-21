import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/libs/prisma";
import { assertSameOriginRequest, authenticateRequest } from "@/modules/auth/auth.middleware";
import { validateCorrectionRequest, type CorrectionEventType } from "@/modules/attendance/attendance-correction-policy";

const eventTypes = new Set(["CHECK_IN", "CHECK_OUT", "BREAK_START", "BREAK_END", "AUTO_CHECK_OUT"]);
function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function optionalDate(value: unknown): Date | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/** Employee reports an attendance problem; no direct modification of raw events. */
export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const actor = await authenticateRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 12_000) {
      return NextResponse.json({ error: "حجم درخواست زیاد است." }, { status: 413 });
    }
    let body: unknown;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: "JSON نامعتبر است." }, { status: 400 });
    }
    if (!isObject(body) || typeof body.recordId !== "string" || body.recordId.length > 128 ||
        !body.recordId.trim() || typeof body.reason !== "string" ||
        (body.attendanceEventId != null && (typeof body.attendanceEventId !== "string" || body.attendanceEventId.length > 128)) ||
        (body.proposedEventType != null && (typeof body.proposedEventType !== "string" || !eventTypes.has(body.proposedEventType)))) {
      return NextResponse.json({ error: "اطلاعات درخواست معتبر نیست." }, { status: 400 });
    }
    const recordId = body.recordId as string;
    const reason = body.reason as string;
    const proposedOccurredAt = optionalDate(body.proposedOccurredAt);
    if (proposedOccurredAt === undefined) {
      return NextResponse.json({ error: "زمان پیشنهادی نامعتبر است." }, { status: 400 });
    }
    const attendanceEventId = (body.attendanceEventId as string | null | undefined) ?? null;
    const proposedEventType = (body.proposedEventType as CorrectionEventType | null | undefined) ?? null;
    const record = await prisma.attendanceRecord.findFirst({
      where: { id: recordId, employeeAssignment: { userId: actor.id } },
      select: {
        id: true, events: { select: { id: true, eventType: true, occurredAt: true } },
        adjustments: { select: { status: true, attendanceEventId: true } },
      },
    });
    if (!record) return NextResponse.json({ error: "رکورد پیدا نشد." }, { status: 404 });
    const decision = validateCorrectionRequest({
      actor: "EMPLOYEE", requesterUserId: actor.id, recordOwnerUserId: actor.id,
      recordId: record.id, attendanceEventId, proposedEventType, proposedOccurredAt,
      reason, events: record.events,
      existingRequests: record.adjustments.map((item) => ({
        attendanceEventId: item.attendanceEventId,
        status: item.status === "PENDING" ? "PENDING" as const : "REJECTED" as const,
      })),
    });
    if (!decision.allowed) return NextResponse.json({ error: decision.message, code: decision.code }, { status: 400 });
    // Transaction-level duplicate check serializes concurrent requests against the same record.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AttendanceRecord" WHERE id = ${record.id} FOR UPDATE`;
      const duplicate = await tx.attendanceAdjustment.findFirst({
        where: { attendanceRecordId: record.id, attendanceEventId, status: "PENDING" },
        select: { id: true },
      });
      if (duplicate) return null;
      return tx.attendanceAdjustment.create({
        data: {
          attendanceRecordId: record.id, attendanceEventId,
          requestedByUserId: actor.id, proposedEventType,
          proposedOccurredAt, reason: reason.trim(), status: "PENDING",
        },
        select: { id: true, status: true, createdAt: true },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
    if (!result) return NextResponse.json({ error: "برای این رویداد درخواست باز وجود دارد." }, { status: 409 });
    return NextResponse.json({ request: result, message: "درخواست برای بررسی منابع انسانی ثبت شد." }, { status: 201 });
  } catch (error) {
    console.error("attendance/me/corrections POST", error);
    return NextResponse.json({ error: "ثبت درخواست انجام نشد." }, { status: 500 });
  }
}
