import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";

/**
 * Read-only HR attendance overview. This endpoint deliberately does not calculate
 * finalized monthly payroll or leave: those require validated interval sources.
 * Each employee is returned once regardless of the number of organization assignments.
 */
export async function GET(request: NextRequest) {
  try {
    // Permission is checked by the existing server-side access-control system.
    await authorizeGlobalRequest(request, "attendance.attendance.view");
  } catch {
    return NextResponse.json(
      { error: "اجازه مشاهده گزارش حضور و غیاب را ندارید." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const params = request.nextUrl.searchParams;
    const pageText = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(pageText)) {
      return NextResponse.json({ error: "شماره صفحه نامعتبر است." }, { status: 400 });
    }
    const page = Number(pageText);
    const pageSize = 20;
    const today = new Date();
    const defaultTo = today.toISOString().slice(0, 10);
    const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
      .toISOString().slice(0, 10);
    const from = params.get("from") ?? defaultFrom;
    const to = params.get("to") ?? defaultTo;

    function parseDateOnly(value: string): Date | null {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
        ? parsed
        : null;
    }

    const fromDate = parseDateOnly(from);
    const toDate = parseDateOnly(to);
    if (!fromDate || !toDate || fromDate > toDate ||
        (toDate.getTime() - fromDate.getTime()) / 86_400_000 > 366) {
      return NextResponse.json(
        { error: "بازه تاریخ نامعتبر است؛ حداکثر ۳۶۷ روز مجاز است." },
        { status: 400 },
      );
    }

    const search = (params.get("search") ?? "").trim();
    if (search.length > 100) {
      return NextResponse.json({ error: "متن جست‌وجو بیش از حد طولانی است." }, { status: 400 });
    }

    const employeeWhere = {
      ...(search ? {
        OR: [
          { user: { fullName: { contains: search, mode: "insensitive" as const } } },
          { personnelCode: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };

    const [total, employees] = await prisma.$transaction([
      prisma.employeeProfile.count({ where: employeeWhere }),
      prisma.employeeProfile.findMany({
        where: employeeWhere,
        orderBy: [{ user: { fullName: "asc" } }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          userId: true,
          personnelCode: true,
          employmentStatus: true,
          hireDate: true,
          terminationDate: true,
          user: { select: { fullName: true, isActive: true } },
        },
      }),
    ]);

    const userIds = employees.map((employee) => employee.userId);
    const records = userIds.length ? await prisma.attendanceRecord.findMany({
      where: {
        workDate: { gte: fromDate, lte: toDate },
        employeeAssignment: { userId: { in: userIds } },
      },
      select: {
        id: true,
        workDate: true,
        status: true,
        workedMinutes: true,
        requiredMinutes: true,
        firstCheckInAt: true,
        lastCheckOutAt: true,
        employeeAssignment: { select: { userId: true } },
      },
      orderBy: [{ workDate: "asc" }, { id: "asc" }],
    }) : [];

    const byEmployee = new Map<string, Map<string, typeof records>>();
    for (const record of records) {
      const userId = record.employeeAssignment.userId;
      let byDay = byEmployee.get(userId);
      if (!byDay) {
        byDay = new Map();
        byEmployee.set(userId, byDay);
      }
      const day = record.workDate.toISOString().slice(0, 10);
      const items = byDay.get(day) ?? [];
      items.push(record);
      byDay.set(day, items);
    }

    const rows = employees.map((employee) => {
      const days = byEmployee.get(employee.userId) ?? new Map<string, typeof records>();
      let recordedDays = 0;
      let workedMinutes = 0;
      let openRecordDays = 0;
      let ambiguousDays = 0;
      for (const dailyRecords of days.values()) {
        recordedDays++;
        // Multiple assignments may generate multiple records on one day.
        // Never sum them blindly: overlapping intervals could double count work.
        if (dailyRecords.length !== 1) {
          ambiguousDays++;
          continue;
        }
        const record = dailyRecords[0];
        if (record.status === "OPEN" || !record.lastCheckOutAt) {
          openRecordDays++;
          continue;
        }
        workedMinutes += record.workedMinutes;
      }
      return {
        userId: employee.userId,
        fullName: employee.user.fullName,
        personnelCode: employee.personnelCode,
        employmentStatus: employee.employmentStatus,
        accountActive: employee.user.isActive,
        hireDate: employee.hireDate.toISOString().slice(0, 10),
        terminationDate: employee.terminationDate?.toISOString().slice(0, 10) ?? null,
        recordedDays,
        // Provisional sum of unambiguous closed records, NOT approved monthly work.
        provisionalWorkedMinutes: workedMinutes,
        openRecordDays,
        ambiguousDays,
        needsReview: openRecordDays > 0 || ambiguousDays > 0,
      };
    });

    return NextResponse.json(
      {
        from, to, rows,
        pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
        note: "کارکرد نمایش‌داده‌شده موقت است و جایگزین محاسبه نهایی ماهانه نیست.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("attendance/hr/overview GET", error);
    return NextResponse.json(
      { error: "دریافت گزارش حضور و غیاب امکان‌پذیر نشد." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
