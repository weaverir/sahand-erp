
import { NextRequest } from "next/server";

import {
  DataScope,
  EmployeeShiftScheduleStatus,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";
import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  assertSameOriginRequest,
  authorizeRequest,
  RequestOriginError,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";
import { PermissionDeniedError } from "@/modules/permissions/access-control";

class WeeklyScheduleError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "WeeklyScheduleError";
  }
}

type SegmentInput = {
  workDate: Date;
  segmentOrder: number;
  startsAt: Date;
  endsAt: Date;
  requiredMinutes: number;
  workShiftId: string | null;
  notes: string | null;
};

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function readText(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new WeeklyScheduleError(
      `${field} الزامی است.`
    );
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    throw new WeeklyScheduleError(
      `${field} معتبر نیست.`
    );
  }

  return text;
}

function optionalText(
  value: unknown,
  field: string,
  maxLength: number
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  return readText(value, field, maxLength);
}

function readInteger(
  value: unknown,
  field: string,
  min: number,
  max: number
): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new WeeklyScheduleError(
      `${field} معتبر نیست.`
    );
  }

  return value;
}

function readDate(
  value: unknown,
  field: string
): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new WeeklyScheduleError(
      `${field} باید به شکل YYYY-MM-DD باشد.`
    );
  }

  const date = new Date(`${value}T00:00:00.000Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new WeeklyScheduleError(
      `${field} معتبر نیست.`
    );
  }

  return date;
}

function readInstant(
  value: unknown,
  field: string
): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value
    )
  ) {
    throw new WeeklyScheduleError(
      `${field} باید دارای منطقه زمانی باشد.`
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new WeeklyScheduleError(
      `${field} معتبر نیست.`
    );
  }

  return date;
}

function tehranDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}

function parseSegments(
  value: unknown,
  weekStart: Date
): SegmentInput[] {
  if (!Array.isArray(value) || value.length > 28) {
    throw new WeeklyScheduleError(
      "تعداد بازه‌های هفتگی باید بین صفر تا ۲۸ باشد."
    );
  }

  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const segments: SegmentInput[] = value.map(
    (item) => {
      if (!isObject(item)) {
        throw new WeeklyScheduleError(
          "ساختار بازه کاری معتبر نیست."
        );
      }

      const workDate = readDate(
        item.workDate,
        "تاریخ کار"
      );

      if (
        workDate < weekStart ||
        workDate > weekEnd
      ) {
        throw new WeeklyScheduleError(
          "تاریخ هر بازه باید در هفته انتخاب‌شده باشد."
        );
      }

      const startsAt = readInstant(
        item.startsAt,
        "زمان شروع"
      );

      const endsAt = readInstant(
        item.endsAt,
        "زمان پایان"
      );

      if (endsAt <= startsAt) {
        throw new WeeklyScheduleError(
          "پایان بازه باید بعد از شروع آن باشد."
        );
      }

      const durationMinutes =
        (endsAt.getTime() - startsAt.getTime()) /
        60000;

      if (durationMinutes > 1440) {
        throw new WeeklyScheduleError(
          "مدت یک بازه نمی‌تواند بیشتر از ۲۴ ساعت باشد."
        );
      }

      if (
        tehranDate(startsAt) !==
        workDate.toISOString().slice(0, 10)
      ) {
        throw new WeeklyScheduleError(
          "تاریخ شروع بازه با تاریخ کاری تهران مطابقت ندارد."
        );
      }

      const requiredMinutes = readInteger(
        item.requiredMinutes,
        "دقایق موظفی",
        0,
        1440
      );

      if (requiredMinutes > durationMinutes) {
        throw new WeeklyScheduleError(
          "موظفی نمی‌تواند از مدت بازه بیشتر باشد."
        );
      }

      return {
        workDate,
        segmentOrder: readInteger(
          item.segmentOrder,
          "ترتیب بازه",
          1,
          100
        ),
        startsAt,
        endsAt,
        requiredMinutes,
        workShiftId: optionalText(
          item.workShiftId,
          "شناسه الگوی شیفت",
          100
        ),
        notes: optionalText(
          item.notes,
          "توضیحات بازه",
          1000
        ),
      };
    }
  );

  const keys = new Set<string>();

  for (const segment of segments) {
    const key =
      `${segment.workDate.toISOString().slice(0, 10)}` +
      `:${segment.segmentOrder}`;

    if (keys.has(key)) {
      throw new WeeklyScheduleError(
        "ترتیب بازه در یک روز تکراری است."
      );
    }

    keys.add(key);
  }

  const sorted = [...segments].sort(
    (a, b) =>
      a.startsAt.getTime() - b.startsAt.getTime()
  );

  for (let i = 1; i < sorted.length; i++) {
    if (
      sorted[i].startsAt <
      sorted[i - 1].endsAt
    ) {
      throw new WeeklyScheduleError(
        "بازه‌های کاری با یکدیگر تداخل دارند."
      );
    }
  }

  return segments;
}

function handleError(error: unknown) {
  if (
    error instanceof WeeklyScheduleError ||
    error instanceof AuthError ||
    error instanceof RequestOriginError ||
    error instanceof PermissionDeniedError
  ) {
    return errorResponse(
      error.message,
      error.statusCode
    );
  }

  if (
    isObject(error) &&
    error.code === "P2002"
  ) {
    return errorResponse(
      "نسخه برنامه هفتگی قبلاً ثبت شده است.",
      409
    );
  }

  if (
    isObject(error) &&
    error.code === "P2003"
  ) {
    return errorResponse(
      "یکی از شناسه‌های مرتبط معتبر نیست.",
      400
    );
  }

  console.error("[WEEKLY_SCHEDULE_ERROR]", error);

  return errorResponse(
    "خطا در پردازش برنامه هفتگی.",
    500
  );
}

// GET: list weekly schedules
export async function GET(request: NextRequest) {
  try {
    const authorization = await authorizeRequest(
      request,
      "attendance.shift.view"
    );

    const employeeUserId = request.nextUrl.searchParams
      .get("employeeUserId")
      ?.trim();

    const weekStartParam = request.nextUrl.searchParams
      .get("weekStartDate");

    const statusParam = request.nextUrl.searchParams
      .get("status");

    const hasAllScope =
      authorization.permission.scopes.includes(
        DataScope.ALL
      );

    if (
      !hasAllScope &&
      employeeUserId !== authorization.user.id
    ) {
      throw new PermissionDeniedError(
        "مشاهده برنامه دیگر کارکنان به مجوز سراسری نیاز دارد."
      );
    }

    let status: EmployeeShiftScheduleStatus | undefined;

    if (statusParam) {
      if (
        !Object.values(
          EmployeeShiftScheduleStatus
        ).includes(
          statusParam as EmployeeShiftScheduleStatus
        )
      ) {
        throw new WeeklyScheduleError(
          "وضعیت برنامه معتبر نیست."
        );
      }

      status =
        statusParam as EmployeeShiftScheduleStatus;
    }

    const where: Prisma.EmployeeShiftScheduleWhereInput = {
      employeeUserId: hasAllScope
        ? employeeUserId || undefined
        : authorization.user.id,
      weekStartDate: weekStartParam
        ? readDate(weekStartParam, "شروع هفته")
        : undefined,
      status,
    };

    const schedules =
      await prisma.employeeShiftSchedule.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              fullName: true,
              username: true,
            },
          },
          segments: {
            orderBy: [
              { workDate: "asc" },
              { segmentOrder: "asc" },
            ],
          },
        },
        orderBy: [
          { weekStartDate: "desc" },
          { version: "desc" },
        ],
        take: 100,
      });

    return successResponse({
      schedules,
      count: schedules.length,
    });
  } catch (error) {
    return handleError(error);
  }
}

// POST: create a weekly draft
export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "attendance.shift.create"
    );

    // Temporary strict boundary:
    // departmental creation will be added after
    // manager-to-employee scope verification.
    if (
      !authorization.permission.scopes.includes(
        DataScope.ALL
      )
    ) {
      throw new PermissionDeniedError(
        "در این مرحله ایجاد برنامه به مجوز سراسری نیاز دارد."
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new WeeklyScheduleError(
        "ساختار JSON درخواست معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new WeeklyScheduleError(
        "اطلاعات برنامه معتبر نیست."
      );
    }

    const employeeUserId = readText(
      body.employeeUserId,
      "شناسه کارمند",
      100
    );

    const weekStartDate = readDate(
      body.weekStartDate,
      "شروع هفته"
    );

    // Saturday = 6 in JavaScript UTC weekday.
    if (weekStartDate.getUTCDay() !== 6) {
      throw new WeeklyScheduleError(
        "شروع هفته باید روز شنبه باشد."
      );
    }

    const notes = optionalText(
      body.notes,
      "توضیحات برنامه",
      2000
    );

    const segments = parseSegments(
      body.segments,
      weekStartDate
    );

    const employee = await prisma.user.findFirst({
      where: {
        id: employeeUserId,
        isActive: true,
        accessLevel: "ERP",
        employeeProfile: {
          is: {
            employmentStatus: "ACTIVE",
          },
        },
      },
      select: { id: true },
    });

    if (!employee) {
      throw new WeeklyScheduleError(
        "کارمند فعال و دارای پرونده پرسنلی یافت نشد.",
        404
      );
    }

    const templateIds = [
      ...new Set(
        segments
          .map((item) => item.workShiftId)
          .filter((id): id is string => id !== null)
      ),
    ];

    if (templateIds.length > 0) {
      const count = await prisma.workShift.count({
        where: {
          id: { in: templateIds },
          isActive: true,
        },
      });

      if (count !== templateIds.length) {
        throw new WeeklyScheduleError(
          "یکی از الگوهای شیفت معتبر یا فعال نیست."
        );
      }
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Serialize schedule creation for this employee.
        await tx.$queryRaw`
          SELECT id FROM "User"
          WHERE id = ${employeeUserId}
          FOR UPDATE
        `;

        const latest =
          await tx.employeeShiftSchedule.findFirst({
            where: {
              employeeUserId,
              weekStartDate,
            },
            orderBy: {
              version: "desc",
            },
            select: {
              version: true,
              status: true,
            },
          });

        if (
          latest &&
          (
            latest.status ===
              EmployeeShiftScheduleStatus.DRAFT ||
            latest.status ===
              EmployeeShiftScheduleStatus.SUBMITTED
          )
        ) {
          throw new WeeklyScheduleError(
            "برای این کارمند و هفته، پیش‌نویس یا برنامه در انتظار بررسی وجود دارد.",
            409
          );
        }

        const version = (latest?.version ?? 0) + 1;

        const schedule =
          await tx.employeeShiftSchedule.create({
            data: {
              employeeUserId,
              weekStartDate,
              version,
              status:
                EmployeeShiftScheduleStatus.DRAFT,
              createdByUserId: authorization.user.id,
              notes,
              segments: {
                create: segments.map((item) => ({
                  workDate: item.workDate,
                  segmentOrder: item.segmentOrder,
                  startsAt: item.startsAt,
                  endsAt: item.endsAt,
                  requiredMinutes: item.requiredMinutes,
                  workShiftId: item.workShiftId,
                  notes: item.notes,
                })),
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
            scheduleId: schedule.id,
            actorUserId: authorization.user.id,
            action: "CREATED",
            afterData: {
              employeeUserId,
              weekStartDate:
                weekStartDate.toISOString().slice(0, 10),
              version,
              status: "DRAFT",
              segments: segments.map((item) => ({
                workDate:
                  item.workDate.toISOString().slice(0, 10),
                segmentOrder: item.segmentOrder,
                startsAt: item.startsAt.toISOString(),
                endsAt: item.endsAt.toISOString(),
                requiredMinutes: item.requiredMinutes,
                workShiftId: item.workShiftId,
                notes: item.notes,
              })),
            },
          },
        });

        return schedule;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return successResponse(
      {
        schedule: result,
        message:
          "پیش‌نویس برنامه هفتگی ثبت شد و هنوز تأیید نشده است.",
      },
      201
    );
  } catch (error) {
    return handleError(error);
  }
}
