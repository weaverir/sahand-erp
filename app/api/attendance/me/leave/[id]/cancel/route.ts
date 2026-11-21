import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/prisma';
import { authenticateRequest, assertSameOriginRequest } from '@/modules/auth/auth.middleware';
import { canWithdrawLeave } from '@/modules/attendance/leave-cancellation-policy';

const respond = (body: object, status = 200) =>
  NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let actorUserId: string;
  try {
    assertSameOriginRequest(request);
    actorUserId = (await authenticateRequest(request)).id;
  } catch {
    return respond({ error: 'نشست معتبر نیست.' }, 403);
  }
  const { id } = await context.params;
  if (!id || id.length > 128) return respond({ error: 'شناسه نامعتبر است.' }, 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "LeaveRequest" WHERE id = ${id} FOR UPDATE`;
      const leave = await tx.leaveRequest.findUnique({
        where: { id },
        select: {
          id: true,
          employeeUserId: true,
          status: true,
          approvalSteps: { select: { decision: true } },
        },
      });
      if (!leave) return 'NOT_FOUND';
      if (!canWithdrawLeave({
        status: leave.status,
        employeeUserId: leave.employeeUserId,
        actorUserId,
        approvalDecisions: leave.approvalSteps.map((step) => step.decision),
      })) return 'NOT_ALLOWED';
      await tx.leaveRequest.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      return 'CANCELLED';
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (result === 'NOT_FOUND') return respond({ error: 'درخواست پیدا نشد.' }, 404);
    if (result === 'NOT_ALLOWED') return respond({ error: 'این درخواست دیگر قابل انصراف نیست.' }, 409);
    return respond({ id, status: 'CANCELLED' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return respond({ error: 'درخواست همزمان تغییر کرده است؛ دوباره تلاش کنید.' }, 409);
    }
    console.error('leave cancellation failed', error);
    return respond({ error: 'انصراف از درخواست ناموفق بود.' }, 500);
  }
}
