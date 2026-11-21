import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";

const headers = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

/** Read-only view of persisted monthly calculations. Never creates or finalizes payroll data. */
export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(request, "attendance.attendance.view");
  } catch {
    return fail("مجوز مشاهده گزارش حضور و غیاب را ندارید.", 403);
  }

  const params = request.nextUrl.searchParams;
  const rawYear = params.get("year") ?? "";
  const rawMonth = params.get("month") ?? "";
  const rawPage = params.get("page") ?? "1";
  if (!/^14\d{2}$/.test(rawYear) || !/^(?:[1-9]|1[0-2])$/.test(rawMonth) || !/^[1-9]\d{0,3}$/.test(rawPage)) {
    return fail("سال، ماه یا شماره صفحه نامعتبر است.", 400);
  }
  const year = Number(rawYear);
  const month = Number(rawMonth);
  const page = Number(rawPage);
  const pageSize = 20;

  try {
    const period = await prisma.attendanceMonthlyPeriod.findUnique({
      where: { jalaliYear_jalaliMonth: { jalaliYear: year, jalaliMonth: month } },
      select: { id: true, status: true, revision: true, calculatedAt: true, closedAt: true },
    });
    if (!period) {
      return NextResponse.json({ period: null, rows: [], pagination: { page, pageSize, total: 0, pages: 0 }, note: "برای این ماه هنوز دوره محاسباتی ثبت نشده است." }, { headers });
    }
    const where = { periodId: period.id };
    const [total, summaries] = await prisma.$transaction([
      prisma.monthlyWorkSummary.count({ where }),
      prisma.monthlyWorkSummary.findMany({
        where,
        orderBy: [{ employee: { fullName: "asc" } }, { employeeUserId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          employeeUserId: true,
          employee: { select: { fullName: true, employeeProfile: { select: { personnelCode: true, employmentStatus: true } } } },
          requiredMinutes: true, workedMinutes: true, holidayWorkMinutes: true, approvedLeaveMinutes: true,
          overtimeMinutes: true, uncoveredMinutes: true, unresolvedCount: true,
          calculationVersion: true, calculatedAt: true,
        },
      }),
    ]);
    return NextResponse.json({
      period: { status: period.status, revision: period.revision, calculatedAt: period.calculatedAt, closedAt: period.closedAt },
      rows: summaries.map(({ employee, ...summary }) => ({
        ...summary, fullName: employee.fullName,
        personnelCode: employee.employeeProfile?.personnelCode ?? null,
        employmentStatus: employee.employeeProfile?.employmentStatus ?? null,
      })),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      note: period.status === "CLOSED" ? "دوره بسته شده است؛ مقادیر ثبت‌شده را با نسخه دوره کنترل کنید." : "دوره هنوز بسته نشده است؛ ارقام صرفاً گزارش محاسبات ذخیره‌شده هستند و نهایی نیستند.",
    }, { headers });
  } catch (error) {
    console.error("attendance/hr/monthly GET", error);
    return fail("دریافت گزارش ماهانه امکان‌پذیر نشد.", 500);
  }
}
