import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { assertSameOriginRequest, authorizeGlobalRequest } from "@/modules/auth/auth.middleware";
import { Prisma } from "@/generated/prisma/client";

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: NextRequest) {
  let actorId: string;
  try {
    assertSameOriginRequest(request);
    const authorization = await authorizeGlobalRequest(request, "attendance.attendance.update");
    actorId = authorization.user.id;
    const actor = await prisma.user.findUnique({
      where: { id: actorId },
      select: { roles: { where: { isActive: true, role: { isActive: true, key: "hr_manager" } }, select: { id: true } } },
    });
    if (!actor?.roles.length) return reply({ error: "ثبت مانده افتتاحیه فقط برای مدیر منابع انسانی مجاز است." }, 403);
  } catch {
    return reply({ error: "درخواست یا مجوز ثبت مانده معتبر نیست." }, 403);
  }
  let input: Record<string, unknown>;
  try {
    const raw: unknown = await request.json();
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return reply({ error: "اطلاعات ورودی معتبر نیست." }, 400);
    input = raw as Record<string, unknown>;
  } catch { return reply({ error: "JSON نامعتبر است." }, 400); }
  const employeeUserId = input.employeeUserId;
  const leaveTypeKey = input.leaveTypeKey;
  const openingMinutes = input.openingMinutes;
  const startJalaliYear = input.startJalaliYear;
  const startJalaliMonth = input.startJalaliMonth;
  const note = input.note;
  if (typeof employeeUserId !== "string" || !employeeUserId.trim() || employeeUserId.length > 128 ||
      typeof leaveTypeKey !== "string" || !/^[a-zA-Z0-9_-]{1,60}$/.test(leaveTypeKey) ||
      typeof openingMinutes !== "number" || !Number.isSafeInteger(openingMinutes) || Math.abs(openingMinutes) > 600000 ||
      typeof startJalaliYear !== "number" || !Number.isInteger(startJalaliYear) || startJalaliYear < 1300 || startJalaliYear > 1600 ||
      typeof startJalaliMonth !== "number" || !Number.isInteger(startJalaliMonth) || startJalaliMonth < 1 || startJalaliMonth > 12 ||
      typeof note !== "string" || !note.trim() || note.length > 1000) {
    return reply({ error: "فیلدهای مانده افتتاحیه معتبر نیستند." }, 400);
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const profile = await tx.employeeProfile.findUnique({ where: { userId: employeeUserId }, select: { userId: true } });
      if (!profile) throw new Error("EMPLOYEE_NOT_FOUND");
      const [existingOpening, anyLedger] = await Promise.all([
        tx.leaveOpeningBalance.findUnique({ where: { employeeUserId_leaveTypeKey: { employeeUserId, leaveTypeKey } }, select: { id: true } }),
        tx.leaveLedgerEntry.findFirst({ where: { employeeUserId, leaveTypeKey }, select: { id: true } }),
      ]);
      if (existingOpening || anyLedger) throw new Error("EXISTING_LEDGER");
      const ledger = await tx.leaveLedgerEntry.create({ data: {
        employeeUserId, leaveTypeKey, jalaliYear: startJalaliYear, jalaliMonth: startJalaliMonth,
        entryType: "MANUAL_ADJUSTMENT", minutes: openingMinutes,
        idempotencyKey: `opening:${employeeUserId}:${leaveTypeKey}`,
        createdByUserId: actorId, note: `مانده افتتاحیه؛ شروع محاسبات از ${startJalaliYear}/${startJalaliMonth}. ${note.trim()}`,
      } });
      return tx.leaveOpeningBalance.create({ data: {
        employeeUserId, leaveTypeKey, startJalaliYear, startJalaliMonth,
        openingMinutes, ledgerEntryId: ledger.id, createdByUserId: actorId,
      }, select: { id: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    return reply({ ok: true, id: result.id }, 201);
  } catch (error) {
    if (error instanceof Error && error.message === "EMPLOYEE_NOT_FOUND") return reply({ error: "پرونده پرسنلی یافت نشد." }, 404);
    if (error instanceof Error && error.message === "EXISTING_LEDGER") return reply({ error: "برای این کارمند و نوع مرخصی تراکنش قبلی وجود دارد؛ مانده افتتاحیه قابل ثبت نیست." }, 409);
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2002" || error.code === "P2034")) return reply({ error: "ثبت هم‌زمان یا تکراری شناسایی شد. گزارش را به‌روزرسانی کنید." }, 409);
    console.error("leave opening POST", error);
    return reply({ error: "ثبت مانده افتتاحیه انجام نشد." }, 500);
  }
}
