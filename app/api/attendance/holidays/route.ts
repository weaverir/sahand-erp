
import { NextRequest } from "next/server";

import {
  HolidayType,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  authorizeGlobalRequest,
  assertSameOriginRequest,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

// ==========================================
// TYPES
// ==========================================

class HolidayCalendarError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "HolidayCalendarError";
  }
}

type HolidayDayInput = {
  date: Date;
  jalaliDate: string;
  title: string;
  holidayType: HolidayType;
  isHoliday: boolean;
  isWorkingDayOverride: boolean | null;
};

// ==========================================
// HELPERS
// ==========================================

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function parseYear(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1300 ||
    value > 1600
  ) {
    throw new HolidayCalendarError(
      "سال شمسی معتبر نیست."
    );
  }

  return value;
}

function parseString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new HolidayCalendarError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (!result) {
    throw new HolidayCalendarError(
      `${field} الزامی است.`
    );
  }

  if (result.length > maxLength) {
    throw new HolidayCalendarError(
      `${field} بیش از حد مجاز طولانی است.`
    );
  }

  return result;
}

function parseHolidayDays(
  value: unknown
): HolidayDayInput[] {
  if (value === undefined) {
    return [];
  }

  if (
    !Array.isArray(value) ||
    value.length > 400
  ) {
    throw new HolidayCalendarError(
      "فهرست تعطیلات معتبر نیست."
    );
  }

  const days: HolidayDayInput[] = [];
  const usedDates = new Set<string>();

  const allowedTypes = Object.values(HolidayType);

  for (const item of value) {
    if (!isObject(item)) {
      throw new HolidayCalendarError(
        "اطلاعات روز تعطیل معتبر نیست."
      );
    }

    const dateString = parseString(
      item.date,
      "تاریخ میلادی",
      10
    );

    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      throw new HolidayCalendarError(
        "تاریخ میلادی باید با فرمت YYYY-MM-DD باشد."
      );
    }

    const date = new Date(
      `${dateString}T00:00:00.000Z`
    );

    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== dateString
    ) {
      throw new HolidayCalendarError(
        "تاریخ میلادی معتبر نیست."
      );
    }

    if (usedDates.has(dateString)) {
      throw new HolidayCalendarError(
        "برای یک تاریخ نمی‌توان بیش از یک رکورد در یک تقویم ثبت کرد."
      );
    }

    usedDates.add(dateString);

    const jalaliDate = parseString(
      item.jalaliDate,
      "تاریخ شمسی",
      10
    );

    if (!/^\d{4}\/\d{2}\/\d{2}$/.test(jalaliDate)) {
      throw new HolidayCalendarError(
        "تاریخ شمسی باید با فرمت YYYY/MM/DD باشد."
      );
    }

    const title = parseString(
      item.title,
      "عنوان مناسبت",
      200
    );

    if (
      typeof item.holidayType !== "string" ||
      !allowedTypes.includes(
        item.holidayType as HolidayType
      )
    ) {
      throw new HolidayCalendarError(
        "نوع تعطیلی معتبر نیست."
      );
    }

    if (typeof item.isHoliday !== "boolean") {
      throw new HolidayCalendarError(
        "وضعیت تعطیلی معتبر نیست."
      );
    }

    const override = item.isWorkingDayOverride;

    if (
      override !== null &&
      typeof override !== "boolean"
    ) {
      throw new HolidayCalendarError(
        "وضعیت استثنای روز کاری معتبر نیست."
      );
    }

    days.push({
      date,
      jalaliDate,
      title,
      holidayType: item.holidayType as HolidayType,
      isHoliday: item.isHoliday,
      isWorkingDayOverride: override,
    });
  }

  return days;
}

function getErrorResponse(error: unknown) {
  if (error instanceof HolidayCalendarError) {
    return errorResponse(
      error.message,
      error.statusCode
    );
  }

  if (error instanceof AuthError) {
    return errorResponse(
      "احراز هویت ناموفق است.",
      401
    );
  }

  if (error instanceof PermissionDeniedError) {
    return errorResponse(
      "شما مجوز انجام این عملیات را ندارید.",
      403
    );
  }

  if (
    isObject(error) &&
    error.code === "P2002"
  ) {
    return errorResponse(
      "برای این سال یا تاریخ قبلاً اطلاعات ثبت شده است.",
      409
    );
  }

  if (
    isObject(error) &&
    error.code === "P2034"
  ) {
    return errorResponse(
      "اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.",
      409
    );
  }

  console.error(
    "[HOLIDAY_CALENDAR_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در مدیریت تقویم تعطیلات.",
    500
  );
}

// ==========================================
// GET - LIST HOLIDAY CALENDARS
// ==========================================

export async function GET(
  request: NextRequest
) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.attendance.view"
    );

    const params =
      request.nextUrl.searchParams;

    const yearParam = params.get("year");
    const activeParam = params.get("active");

    const where: Prisma.HolidayCalendarWhereInput = {};

    if (yearParam !== null) {
      const year = Number(yearParam);

      where.jalaliYear = parseYear(year);
    }

    if (activeParam === "true") {
      where.isActive = true;
    } else if (activeParam === "false") {
      where.isActive = false;
    }

    const calendars =
      await prisma.holidayCalendar.findMany({
        where,

        include: {
          days: {
            orderBy: {
              date: "asc",
            },
          },

          _count: {
            select: {
              days: true,
            },
          },
        },

        orderBy: {
          jalaliYear: "desc",
        },

        take: 100,
      });

    return successResponse({
      calendars,
      count: calendars.length,
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// POST - CREATE HOLIDAY CALENDAR
// ==========================================

export async function POST(
  request: NextRequest
) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.attendance.create"
      );

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new HolidayCalendarError(
        "ساختار اطلاعات ارسالی معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new HolidayCalendarError(
        "اطلاعات تقویم معتبر نیست."
      );
    }

    const jalaliYear = parseYear(
      body.jalaliYear
    );

    const name = parseString(
      body.name,
      "نام تقویم",
      150
    );

    const isActive =
      body.isActive === undefined
        ? true
        : body.isActive;

    if (typeof isActive !== "boolean") {
      throw new HolidayCalendarError(
        "وضعیت فعال بودن تقویم معتبر نیست."
      );
    }

    const days = parseHolidayDays(
      body.days
    );

    // Ensure every registered date belongs
    // to the selected Jalali year.

    for (const day of days) {
      const dayYear = Number(
        day.jalaliDate.slice(0, 4)
      );

      if (dayYear !== jalaliYear) {
        throw new HolidayCalendarError(
          "سال تاریخ مناسبت با سال تقویم مطابقت ندارد."
        );
      }
    }

    const calendar = await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.holidayCalendar.create({
            data: {
              jalaliYear,
              name,
              isActive,

              days: {
                create: days,
              },
            },

            include: {
              days: {
                orderBy: {
                  date: "asc",
                },
              },

              _count: {
                select: {
                  days: true,
                },
              },
            },
          });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "HolidayCalendar",
            entityId: created.id,
            action: "HOLIDAY_CALENDAR_CREATED",

            afterData: {
              jalaliYear: created.jalaliYear,
              name: created.name,
              isActive: created.isActive,
              daysCount: created.days.length,
            },

            ipAddress:
              request.headers
                .get("x-forwarded-for")
                ?.split(",")[0]
                ?.trim() ||
              request.headers.get("x-real-ip") ||
              null,
          },
        });

        return created;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return successResponse(
      {
        calendar,
        message:
          "تقویم تعطیلات با موفقیت ایجاد شد.",
      },
      201
    );

  } catch (error) {
    return getErrorResponse(error);
  }
}
