
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

class ScheduleError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ScheduleError("ساختار درخواست معتبر نیست.");
  }
  return value as Record<string, unknown>;
}

function dateOnly(value: unknown): Date {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ScheduleError("تاریخ کاری معتبر نیست.");
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value) {
    throw new ScheduleError("تاریخ کاری معتبر نیست.");
  }
  return date;
}

function instant(value: unknown): Date {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new ScheduleError("زمان باید دارای منطقه زمانی باشد.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ScheduleError("زمان معتبر نیست.");
  }
  return date;
}

function localDate(value: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function parseSegments(value: unknown, weekStart: Date) {
  if (!Array.isArray(value) || value.length > 28) {
    throw new ScheduleError("حداکثر ۲۸ بازه کاری مجاز است.");
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const segments = value.map((raw) => {
    const item = object(raw);
    const workDate = dateOnly(item.workDate);
    const startsAt = instant(item.startsAt);
    const endsAt = instant(item.endsAt);

    if (workDate < weekStart || workDate > weekEnd) {
      throw new ScheduleError("تاریخ خارج از هفته برنامه است.");
    }

    if (localDate(startsAt) !==
        workDate.toISOString().slice(0, 10)) {
      throw new ScheduleError("تاریخ شروع با روز کاری مطابقت ندارد.");
    }

    const duration = (endsAt.getTime() - startsAt.getTime()) / 60000;

    if (duration <= 0 || duration > 1440) {
      throw new ScheduleError("مدت بازه باید بین صفر و ۲۴ ساعت باشد.");
    }

    const segmentOrder = item.segmentOrder;
    const requiredMinutes = item.requiredMinutes;

    if (typeof segmentOrder !== "number" ||
        !Number.isInteger(segmentOrder) ||
        segmentOrder < 1 || segmentOrder > 100) {
      throw new ScheduleError("ترتیب بازه معتبر نیست.");
    }

    if (typeof requiredMinutes !== "number" ||
        !Number.isInteger(requiredMinutes) ||
        requiredMinutes < 0 ||
        requiredMinutes > duration) {
      throw new ScheduleError("دقایق موظفی معتبر نیست.");
    }

    if (item.workShiftId != null &&
        (typeof item.workShiftId !== "string" ||
         !item.workShiftId.trim())) {
      throw new ScheduleError("شناسه الگوی شیفت معتبر نیست.");
    }

    if (item.notes != null &&
        (typeof item.notes !== "string" ||
         item.notes.length > 1000)) {
      throw new ScheduleError("توضیحات بازه معتبر نیست.");
    }

    return {
      workDate,
      startsAt,
      endsAt,
      segmentOrder,
      requiredMinutes,
      workShiftId: (item.workShiftId as string | null) || null,
      notes: (item.notes as string | null) || null,
    };
  });

  const keys = new Set<string>();
  const sorted = [...segments].sort(
    (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
  );

  for (const segment of sorted) {
    const key = `${segment.workDate.toISOString()}:${segment.segmentOrder}`;
    if (keys.has(key)) {
      throw new ScheduleError("ترتیب بازه در یک روز تکراری است.");
    }
    keys.add(key);
  }

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].startsAt < sorted[i - 1].endsAt) {
      throw new ScheduleError("بازه‌های کاری تداخل دارند.");
    }
  }

  return segments;
}

function respondError(error: unknown) {
  if (error instanceof ScheduleError) {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Error &&
      "statusCode" in error &&
      typeof error.statusCode === "number") {
    return errorResponse(error.message, error.statusCode);
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2003") {
      return errorResponse("شناسه الگوی شیفت معتبر نیست.", 400);
    }
    if (error.code === "P2034") {
      return errorResponse("تداخل هم‌زمان رخ داد؛ دوباره تلاش کنید.", 409);
    }
  }

  console.error("[WEEKLY_SCHEDULE_EDIT]", error);
  return errorResponse("خطا در ویرایش برنامه هفتگی.", 500);
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    assertSameOriginRequest(request);

    const auth = await authorizeRequest(
      request,
      "attendance.shift.update"
    );

    if (!auth.permission.scopes.includes(DataScope.ALL)) {
      throw new ScheduleError("مجوز ویرایش سراسری لازم است.", 403);
    }

    const { id } = await context.params;
    if (!id) {
      throw new ScheduleError("شناسه برنامه الزامی است.");
    }

    let body: Record<string, unknown>;
    try {
      body = object(await request.json());
    } catch {
      throw new ScheduleError("JSON درخواست معتبر نیست.");
    }

    if (!Array.isArray(body.segments)) {
      throw new ScheduleError("فهرست بازه‌های کاری الزامی است.");
    }

    if (body.notes != null &&
        (typeof body.notes !== "string" ||
         body.notes.length > 2000)) {
      throw new ScheduleError("توضیحات برنامه معتبر نیست.");
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "EmployeeShiftSchedule"
          WHERE id = ${id}
          FOR UPDATE
        `;

        if (locked.length === 0) {
          throw new ScheduleError("برنامه پیدا نشد.", 404);
        }

        const current = await tx.employeeShiftSchedule.findUnique({
          where: { id },
          include: { segments: true },
        });

        if (!current) {
          throw new ScheduleError("برنامه پیدا نشد.", 404);
        }

        if (current.status !== Status.DRAFT) {
          throw new ScheduleError(
            "فقط پیش‌نویس قابل ویرایش است.",
            409
          );
        }

        if (current.createdByUserId !== auth.user.id) {
          throw new ScheduleError(
            "فقط ایجادکننده برنامه می‌تواند آن را ویرایش کند.",
            403
          );
        }

        const segments = parseSegments(
          body.segments,
          current.weekStartDate
        );

        const templateIds = [
          ...new Set(
            segments.map((s) => s.workShiftId)
              .filter((v): v is string => v !== null)
          ),
        ];

        if (templateIds.length) {
          const count = await tx.workShift.count({
            where: {
              id: { in: templateIds },
              isActive: true,
            },
          });

          if (count !== templateIds.length) {
            throw new ScheduleError("الگوی شیفت نامعتبر یا غیرفعال است.");
          }
        }

        const beforeData = {
          notes: current.notes,
          segments: current.segments,
        };

        await tx.employeeShiftScheduleSegment.deleteMany({
          where: { scheduleId: id },
        });

        const updated = await tx.employeeShiftSchedule.update({
          where: { id },
          data: {
            notes: body.notes === undefined
              ? current.notes
              : (body.notes as string | null),
            segments: {
              create: segments,
            },
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
            action: "UPDATED",
            beforeData: JSON.parse(JSON.stringify(beforeData)),
            afterData: JSON.parse(JSON.stringify({
              notes: updated.notes,
              segments: updated.segments,
            })),
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
      message: "پیش‌نویس با موفقیت ویرایش شد.",
    });
  } catch (error) {
    return respondError(error);
  }
}
