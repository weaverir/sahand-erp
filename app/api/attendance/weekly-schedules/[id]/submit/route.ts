
import { NextRequest } from "next/server";

import {
  DataScope,
  EmployeeShiftScheduleStatus as Status,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";
import { successResponse, errorResponse } from "@/libs/api-response";

import {
  assertSameOriginRequest,
  authorizeRequest,
} from "@/modules/auth/auth.middleware";

type Context = {
  params: Promise<{ id: string }>;
};

class SubmitError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

function respondError(error: unknown) {
  if (error instanceof SubmitError) {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number") {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034") {
    return errorResponse(
      "درخواست هم‌زمان دیگری ثبت شده است. دوباره تلاش کنید.",
      409
    );
  }

  console.error("[WEEKLY_SCHEDULE_SUBMIT]", error);
  return errorResponse("خطا در ارسال برنامه برای بررسی.", 500);
}

export async function POST(request: NextRequest, context: Context) {
  try {
    assertSameOriginRequest(request);

    const auth = await authorizeRequest(
      request,
      "attendance.shift.update"
    );

    if (!auth.permission.scopes.includes(DataScope.ALL)) {
      throw new SubmitError(
        "برای ارسال برنامه مجوز سراسری لازم است.",
        403
      );
    }

    const { id } = await context.params;

    if (!id) {
      throw new SubmitError("شناسه برنامه الزامی است.");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "EmployeeShiftSchedule"
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new SubmitError("برنامه پیدا نشد.", 404);
        }

        const current = await tx.employeeShiftSchedule.findUnique({
          where: { id },
          include: {
            segments: true,
          },
        });

        if (!current) {
          throw new SubmitError("برنامه پیدا نشد.", 404);
        }

        if (current.createdByUserId !== auth.user.id) {
          throw new SubmitError(
            "فقط ایجادکننده برنامه می‌تواند آن را ارسال کند.",
            403
          );
        }

        if (current.status !== Status.DRAFT) {
          throw new SubmitError(
            "فقط برنامه پیش‌نویس قابل ارسال است.",
            409
          );
        }

        const latest = await tx.employeeShiftSchedule.findFirst({
          where: {
            employeeUserId: current.employeeUserId,
            weekStartDate: current.weekStartDate,
          },
          orderBy: { version: "desc" },
          select: { id: true },
        });

        if (latest?.id !== id) {
          throw new SubmitError(
            "این برنامه آخرین نسخه نیست.",
            409
          );
        }

        if (current.segments.length === 0) {
          throw new SubmitError(
            "برنامه بدون بازه کاری قابل ارسال نیست."
          );
        }

        const updated = await tx.employeeShiftSchedule.update({
          where: { id },
          data: {
            status: Status.SUBMITTED,
            submittedByUserId: auth.user.id,
            submittedAt: new Date(),
          },
          include: {
            segments: {
              orderBy: [
                { workDate: "asc" },
                { segmentOrder: "asc" },
              ],
            },
          },
        });

        await tx.employeeShiftScheduleRevision.create({
          data: {
            scheduleId: id,
            actorUserId: auth.user.id,
            action: "SUBMITTED",
            beforeData: {
              status: current.status,
            },
            afterData: {
              status: updated.status,
              submittedByUserId: auth.user.id,
              submittedAt: updated.submittedAt?.toISOString(),
              segmentCount: updated.segments.length,
            },
          },
        });

        return updated;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        timeout: 10000,
      }
    );

    return successResponse({
      schedule: result,
      message: "برنامه برای بررسی منابع انسانی ارسال شد.",
    });
  } catch (error) {
    return respondError(error);
  }
}
