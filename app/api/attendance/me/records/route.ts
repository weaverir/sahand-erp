import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authenticateRequest } from "@/modules/auth/auth.middleware";

/** Employee-only attendance history. No assignment IDs accepted from the client. */
export async function GET(request: NextRequest) {
  try {
    const actor = await authenticateRequest(request);
    const rawPage = request.nextUrl.searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(rawPage)) {
      return NextResponse.json({ error: "شماره صفحه نامعتبر است." }, { status: 400 });
    }
    const page = Number(rawPage);
    const where = { employeeAssignment: { userId: actor.id } };
    const [total, records] = await prisma.$transaction([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * 20,
        take: 20,
        select: {
          id: true, workDate: true, timeZone: true, status: true,
          scheduledStartAt: true, scheduledEndAt: true, requiredMinutes: true,
          firstCheckInAt: true, lastCheckOutAt: true, workedMinutes: true,
          breakMinutes: true, overtimeMinutes: true, lateMinutes: true,
          earlyLeaveMinutes: true, approvedAt: true,
          events: {
            orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
            select: { id: true, eventType: true, occurredAt: true, source: true },
          },
          adjustments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true, attendanceEventId: true, proposedEventType: true,
              proposedOccurredAt: true, reason: true, status: true,
              requestedByUserId: true, reviewerComment: true,
              reviewedAt: true, createdAt: true,
            },
          },
        },
      }),
    ]);
    return NextResponse.json({ records, page, pageSize: 20, total, totalPages: Math.ceil(total / 20) },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("attendance/me/records GET", error);
    return NextResponse.json({ error: "دریافت سوابق حضور و غیاب امکان‌پذیر نشد." }, { status: 401 });
  }
}
