import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";

const noStore = { "Cache-Control": "no-store" };
function dateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export async function GET(request: NextRequest, context: { params: Promise<{ userId: string }> }) {
  try {
    await authorizeGlobalRequest(request, "attendance.attendance.view");
  } catch {
    return NextResponse.json({ error: "اجازه مشاهده سوابق کارکنان را ندارید." }, { status: 403, headers: noStore });
  }
  try {
    const { userId } = await context.params;
    if (!userId || userId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
      return NextResponse.json({ error: "شناسه کارمند نامعتبر است." }, { status: 400, headers: noStore });
    }
    const search = request.nextUrl.searchParams;
    const from = search.get("from");
    const to = search.get("to");
    if (!from || !to) return NextResponse.json({ error: "بازه تاریخ الزامی است." }, { status: 400, headers: noStore });
    const start = dateOnly(from);
    const end = dateOnly(to);
    if (!start || !end || start > end || end.getTime() - start.getTime() > 366 * 86400000) {
      return NextResponse.json({ error: "بازه تاریخ نامعتبر است (حداکثر ۳۶۷ روز)." }, { status: 400, headers: noStore });
    }
    const rawPage = search.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(rawPage)) {
      return NextResponse.json({ error: "شماره صفحه نامعتبر است." }, { status: 400, headers: noStore });
    }
    const page = Number(rawPage);
    const pageSize = 20;
    const employee = await prisma.employeeProfile.findUnique({
      where: { userId },
      select: { userId: true, personnelCode: true, employmentStatus: true, hireDate: true, terminationDate: true, user: { select: { fullName: true } } },
    });
    if (!employee) return NextResponse.json({ error: "پرونده کارمند یافت نشد." }, { status: 404, headers: noStore });
    const where = { employeeAssignment: { userId }, workDate: { gte: start, lte: end } };
    const [total, records] = await prisma.$transaction([
      prisma.attendanceRecord.count({ where }),
      prisma.attendanceRecord.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, workDate: true, timeZone: true, status: true, employeeAssignmentId: true,
          scheduledStartAt: true, scheduledEndAt: true, requiredMinutes: true,
          firstCheckInAt: true, lastCheckOutAt: true, workedMinutes: true, breakMinutes: true,
          overtimeMinutes: true, lateMinutes: true, earlyLeaveMinutes: true, approvedAt: true,
          events: { orderBy: [{ occurredAt: "asc" }, { id: "asc" }], select: { id: true, eventType: true, occurredAt: true, source: true } },
          adjustments: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], select: { id: true, status: true, reason: true, createdAt: true, reviewedAt: true } },
        },
      }),
    ]);
    return NextResponse.json({
      employee: { userId: employee.userId, fullName: employee.user.fullName, personnelCode: employee.personnelCode, employmentStatus: employee.employmentStatus, hireDate: employee.hireDate.toISOString().slice(0, 10), terminationDate: employee.terminationDate?.toISOString().slice(0, 10) ?? null },
      from, to,
      records: records.map((record) => ({ ...record, workDate: record.workDate.toISOString().slice(0, 10) })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      note: "مقادیر ثبت‌شده لزوماً کارکرد نهایی و تأییدشده حقوق و دستمزد نیستند.",
    }, { headers: noStore });
  } catch (error) {
    console.error("attendance/hr/employees/[userId]/records GET", error);
    return NextResponse.json({ error: "دریافت جزئیات تردد امکان‌پذیر نشد." }, { status: 500, headers: noStore });
  }
}
