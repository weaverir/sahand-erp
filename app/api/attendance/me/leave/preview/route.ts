import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/libs/prisma';
import { authenticateRequest, assertSameOriginRequest } from '@/modules/auth/auth.middleware';
import { validateLeaveSubmission } from '@/modules/attendance/leave-request-policy';
import { resolveLeaveMinutes } from '@/modules/attendance/leave-schedule-resolver';
import { summarizeLeavePreview } from '@/modules/attendance/leave-preview-policy';

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    assertSameOriginRequest(request);
    userId = (await authenticateRequest(request)).id;
  } catch { return reply({ error: 'نشست یا مبدأ درخواست معتبر نیست.' }, 403); }
  let input: ReturnType<typeof validateLeaveSubmission>;
  try {
    if (Number(request.headers.get('content-length') ?? 0) > 12000) return reply({ error: 'حجم درخواست زیاد است.' }, 413);
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('اطلاعات نامعتبر است.');
    const body = payload as Record<string, unknown>;
    const start = new Date(String(body.startAt));
    const end = new Date(String(body.endAt));
    const validRange = Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > start;
    input = validateLeaveSubmission({ ...body, requestedMinutes: validRange ? 1 : 0 });
  } catch (e) { return reply({ error: e instanceof Error ? e.message : 'اطلاعات نامعتبر است.' }, 400); }

  try {
    const assignment = await prisma.employeeAssignment.findFirst({ where: { userId, status: 'ACTIVE' }, select: { id: true } });
    if (!assignment) return reply({ error: 'مسئولیت سازمانی فعال ندارید.' }, 409);
    const minutes = await resolveLeaveMinutes(userId, input.startAt, input.endAt);
    if (minutes < 1) return reply({ error: 'در این بازه ساعت کاری قابل کسر وجود ندارد.' }, 409);
    const [opening, ledger] = await Promise.all([
      prisma.leaveOpeningBalance.findUnique({ where: { employeeUserId_leaveTypeKey: { employeeUserId: userId, leaveTypeKey: input.leaveTypeKey } }, select: { id: true } }),
      prisma.leaveLedgerEntry.aggregate({ where: { employeeUserId: userId, leaveTypeKey: input.leaveTypeKey }, _sum: { minutes: true }, _count: { _all: true } }),
    ]);
    const balance = opening || ledger._count._all > 0 ? (ledger._sum.minutes ?? 0) : null;
    return reply({ ...summarizeLeavePreview(balance, minutes), leaveTypeKey: input.leaveTypeKey, calculatedAt: new Date().toISOString(), advisory: true });
  } catch (e) { return reply({ error: e instanceof Error ? e.message : 'محاسبه پیش‌نمایش ناموفق بود.' }, 409); }
}
