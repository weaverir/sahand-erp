import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { authorizeGlobalRequest } from "@/modules/auth/auth.middleware";

const headers = { "Cache-Control": "no-store" };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

/** Read-only ledger report. Never generates entitlement or posts leave usage. */
export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(request, "attendance.attendance.view");
  } catch {
    return fail("مجوز مشاهده اطلاعات مرخصی را ندارید.", 403);
  }

  const params = request.nextUrl.searchParams;
  const rawPage = params.get("page") ?? "1";
  const search = (params.get("search") ?? "").trim();
  const leaveTypeKey = (params.get("leaveTypeKey") ?? "").trim();
  if (!/^[1-9]\d{0,3}$/.test(rawPage) || search.length > 100 || leaveTypeKey.length > 100) {
    return fail("پارامترهای گزارش نامعتبر است.", 400);
  }
  const page = Number(rawPage);
  const pageSize = 20;

  try {
    const where = {
      ...(search ? {
        OR: [
          { user: { fullName: { contains: search, mode: "insensitive" as const } } },
          { personnelCode: { contains: search, mode: "insensitive" as const } },
        ],
      } : {}),
    };
    const [total, profiles, availableTypes] = await prisma.$transaction([
      prisma.employeeProfile.count({ where }),
      prisma.employeeProfile.findMany({
        where,
        orderBy: [{ user: { fullName: "asc" } }, { userId: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          userId: true,
          personnelCode: true,
          employmentStatus: true,
          user: { select: { fullName: true } },
        },
      }),
      prisma.leaveLedgerEntry.findMany({
        distinct: ["leaveTypeKey"],
        select: { leaveTypeKey: true },
        orderBy: { leaveTypeKey: "asc" },
      }),
    ]);

    const ids = profiles.map((profile) => profile.userId);
    const sums = ids.length ? await prisma.leaveLedgerEntry.groupBy({
      by: ["employeeUserId", "leaveTypeKey", "entryType"],
      where: {
        employeeUserId: { in: ids },
        ...(leaveTypeKey ? { leaveTypeKey } : {}),
      },
      _sum: { minutes: true },
    }) : [];

    const balances = new Map<string, {
      leaveTypeKey: string;
      monthlyCreditMinutes: number;
      approvedUsageMinutes: number;
      reversalMinutes: number;
      adjustmentMinutes: number;
      balanceMinutes: number;
    }[]>();
    for (const item of sums) {
      const current = balances.get(item.employeeUserId) ?? [];
      let row = current.find((entry) => entry.leaveTypeKey === item.leaveTypeKey);
      if (!row) {
        row = {
          leaveTypeKey: item.leaveTypeKey,
          monthlyCreditMinutes: 0,
          approvedUsageMinutes: 0,
          reversalMinutes: 0,
          adjustmentMinutes: 0,
          balanceMinutes: 0,
        };
        current.push(row);
        balances.set(item.employeeUserId, current);
      }
      const minutes = item._sum.minutes ?? 0;
      row.balanceMinutes += minutes;
      switch (item.entryType) {
        case "MONTHLY_CREDIT": row.monthlyCreditMinutes += minutes; break;
        case "APPROVED_USAGE": row.approvedUsageMinutes += minutes; break;
        case "USAGE_REVERSAL": row.reversalMinutes += minutes; break;
        case "MANUAL_ADJUSTMENT": row.adjustmentMinutes += minutes; break;
      }
    }

    return NextResponse.json({
      rows: profiles.map((profile) => ({
        employeeUserId: profile.userId,
        fullName: profile.user.fullName,
        personnelCode: profile.personnelCode,
        employmentStatus: profile.employmentStatus,
        balances: (balances.get(profile.userId) ?? []).sort((a, b) => a.leaveTypeKey.localeCompare(b.leaveTypeKey)),
      })),
      leaveTypes: availableTypes.map((entry) => entry.leaveTypeKey),
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
      note: "این گزارش فقط تراکنش‌های ثبت‌شده در دفتر مرخصی را نشان می‌دهد. ماه‌های فاقد اعتبار ثبت‌شده، خودکار محاسبه یا ایجاد نمی‌شوند.",
    }, { headers });
  } catch (error) {
    console.error("attendance/hr/leave/balances GET", error);
    return fail("دریافت مانده مرخصی امکان‌پذیر نشد.", 500);
  }
}
