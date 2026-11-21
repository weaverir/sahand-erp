import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";

/** HR-only, paginated attendance correction inbox. Read-only. */
export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(request, "attendance.attendance.update");

    const url = new URL(request.url);
    const status = url.searchParams.get("status") ?? "PENDING";
    if (!["PENDING", "APPROVED", "REJECTED", "CANCELLED", "ALL"].includes(status)) {
      return NextResponse.json({ error: "وضعیت درخواست نامعتبر است." }, { status: 400 });
    }
    const rawPage = url.searchParams.get("page") ?? "1";
    if (!/^[1-9]\d{0,4}$/.test(rawPage)) {
      return NextResponse.json({ error: "شماره صفحه نامعتبر است." }, { status: 400 });
    }
    const page = Number(rawPage);
    const pageSize = 20;
    const where = status === "ALL" ? {} : { status: status as "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" };
    const [total, requests] = await prisma.$transaction([
      prisma.attendanceAdjustment.count({ where }),
      prisma.attendanceAdjustment.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          attendanceRecordId: true,
          attendanceEventId: true,
          proposedEventType: true,
          proposedOccurredAt: true,
          reason: true,
          status: true,
          requestedByUserId: true,
          reviewedByUserId: true,
          reviewerComment: true,
          reviewedAt: true,
          createdAt: true,
          attendanceRecord: {
            select: {
              id: true,
              employeeAssignmentId: true,
              workDate: true,
              timeZone: true,
              status: true,
              approvedAt: true,
              workedMinutes: true,
              events: {
                select: { id: true, eventType: true, occurredAt: true, source: true },
                orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      }),
    ]);
    return NextResponse.json({ requests, pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } });
  } catch (error) {
    console.error("attendance/hr/corrections GET", error);
    return NextResponse.json({ error: "دریافت درخواست‌های اصلاح امکان‌پذیر نیست." }, { status: 500 });
  }
}
