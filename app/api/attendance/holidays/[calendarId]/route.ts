
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

type RouteContext = {
  params: Promise<{
    calendarId: string;
  }>;
};

class HolidayError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "HolidayError";
  }
}

type HolidayInput = {
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

function parseString(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new HolidayError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (!result) {
    throw new HolidayError(
      `${field} الزامی است.`
    );
  }

  if (result.length > maxLength) {
    throw new HolidayError(
      `${field} بیش از حد مجاز طولانی است.`
    );
  }

  return result;
}

function parseHolidayInput(
  value: unknown,
  jalaliYear: number
): HolidayInput {
  if (!isObject(value)) {
    throw new HolidayError(
      "اطلاعات روز تعطیل معتبر نیست."
    );
  }

  const dateString = parseString(
    value.date,
    "تاریخ میلادی",
    10
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    throw new HolidayError(
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
    throw new HolidayError(
      "تاریخ میلادی معتبر نیست."
    );
  }

  const jalaliDate = parseString(
    value.jalaliDate,
    "تاریخ شمسی",
    10
  );

  if (!/^\d{4}\/\d{2}\/\d{2}$/.test(jalaliDate)) {
    throw new HolidayError(
      "تاریخ شمسی باید با فرمت YYYY/MM/DD باشد."
    );
  }

  const parsedYear = Number(
    jalaliDate.slice(0, 4)
  );

  if (parsedYear !== jalaliYear) {
    throw new HolidayError(
      "سال تاریخ مناسبت با سال تقویم مطابقت ندارد."
    );
  }

  const title = parseString(
    value.title,
    "عنوان مناسبت",
    200
  );

  const allowedTypes = Object.values(HolidayType);

  if (
    typeof value.holidayType !== "string" ||
    !allowedTypes.includes(
      value.holidayType as HolidayType
    )
  ) {
    throw new HolidayError(
      "نوع تعطیلی معتبر نیست."
    );
  }

  if (typeof value.isHoliday !== "boolean") {
    throw new HolidayError(
      "وضعیت تعطیلی معتبر نیست."
    );
  }

  const override = value.isWorkingDayOverride;

  if (
    override !== null &&
    typeof override !== "boolean"
  ) {
    throw new HolidayError(
      "وضعیت استثنای روز کاری معتبر نیست."
    );
  }

  return {
    date,
    jalaliDate,
    title,
    holidayType: value.holidayType as HolidayType,
    isHoliday: value.isHoliday,
    isWorkingDayOverride: override,
  };
}

function getErrorResponse(error: unknown) {
  if (error instanceof HolidayError) {
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
      "برای این تاریخ قبلاً مناسبت ثبت شده است.",
      409
    );
  }

  if (
    isObject(error) &&
    error.code === "P2025"
  ) {
    return errorResponse(
      "اطلاعات موردنظر پیدا نشد.",
      404
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
    "[HOLIDAY_API_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در مدیریت تقویم تعطیلات.",
    500
  );
}

function getClientIp(request: NextRequest) {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

// ==========================================
// GET - GET SINGLE CALENDAR
// ==========================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.attendance.view"
    );

    const { calendarId } = await context.params;

    if (!calendarId?.trim()) {
      throw new HolidayError(
        "شناسه تقویم معتبر نیست."
      );
    }

    const calendar =
      await prisma.holidayCalendar.findUnique({
        where: {
          id: calendarId,
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

    if (!calendar) {
      throw new HolidayError(
        "تقویم موردنظر پیدا نشد.",
        404
      );
    }

    return successResponse({
      calendar,
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// PATCH - UPDATE CALENDAR
// ==========================================

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.attendance.update"
      );

    const { calendarId } = await context.params;

    if (!calendarId?.trim()) {
      throw new HolidayError(
        "شناسه تقویم معتبر نیست."
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new HolidayError(
        "ساختار اطلاعات ارسالی معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new HolidayError(
        "اطلاعات ارسالی معتبر نیست."
      );
    }

    const existing =
      await prisma.holidayCalendar.findUnique({
        where: {
          id: calendarId,
        },

        include: {
          days: true,
        },
      });

    if (!existing) {
      throw new HolidayError(
        "تقویم موردنظر پیدا نشد.",
        404
      );
    }

    const updateData: Prisma.HolidayCalendarUpdateInput = {};

    if (body.name !== undefined) {
      updateData.name = parseString(
        body.name,
        "نام تقویم",
        150
      );
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== "boolean") {
        throw new HolidayError(
          "وضعیت فعال بودن تقویم معتبر نیست."
        );
      }

      updateData.isActive = body.isActive;
    }

    let parsedDays: HolidayInput[] | undefined;

    if (body.days !== undefined) {
      if (
        !Array.isArray(body.days) ||
        body.days.length > 400
      ) {
        throw new HolidayError(
          "فهرست تعطیلات معتبر نیست."
        );
      }

      parsedDays = body.days.map((item) =>
        parseHolidayInput(
          item,
          existing.jalaliYear
        )
      );

      const uniqueDates = new Set(
        parsedDays.map((item) =>
          item.date.toISOString().slice(0, 10)
        )
      );

      if (uniqueDates.size !== parsedDays.length) {
        throw new HolidayError(
          "تاریخ تکراری در فهرست تعطیلات وجود دارد."
        );
      }
    }

    const updated = await prisma.$transaction(
      async (tx) => {
        if (parsedDays !== undefined) {
          for (const day of parsedDays) {
            const existingDay =
              await tx.holidayCalendarDay.findUnique({
                where: {
                  calendarId_date: {
                    calendarId,
                    date: day.date,
                  },
                },
              });

            if (existingDay) {
              await tx.holidayCalendarDay.update({
                where: {
                  id: existingDay.id,
                },

                data: {
                  jalaliDate: day.jalaliDate,
                  title: day.title,
                  holidayType: day.holidayType,
                  isHoliday: day.isHoliday,
                  isWorkingDayOverride:
                    day.isWorkingDayOverride,
                },
              });
            } else {
              await tx.holidayCalendarDay.create({
                data: {
                  calendarId,
                  ...day,
                },
              });
            }
          }
        }

        const result =
          await tx.holidayCalendar.update({
            where: {
              id: calendarId,
            },

            data: updateData,

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
            entityId: calendarId,
            action: "HOLIDAY_CALENDAR_UPDATED",

            beforeData: {
              name: existing.name,
              isActive: existing.isActive,
              daysCount: existing.days.length,
            },

            afterData: {
              name: result.name,
              isActive: result.isActive,
              daysCount: result.days.length,
            },

            ipAddress: getClientIp(request),
          },
        });

        return result;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return successResponse({
      calendar: updated,
      message:
        "تقویم تعطیلات با موفقیت ویرایش شد.",
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// DELETE - SOFT DEACTIVATE CALENDAR
// ==========================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.attendance.update"
      );

    const { calendarId } = await context.params;

    if (!calendarId?.trim()) {
      throw new HolidayError(
        "شناسه تقویم معتبر نیست."
      );
    }

    const existing =
      await prisma.holidayCalendar.findUnique({
        where: {
          id: calendarId,
        },

        include: {
          _count: {
            select: {
              days: true,
            },
          },
        },
      });

    if (!existing) {
      throw new HolidayError(
        "تقویم موردنظر پیدا نشد.",
        404
      );
    }

    if (!existing.isActive) {
      return successResponse({
        message:
          "این تقویم قبلاً غیرفعال شده است.",
      });
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.holidayCalendar.update({
          where: {
            id: calendarId,
          },

          data: {
            isActive: false,
          },
        });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "HolidayCalendar",
            entityId: calendarId,
            action: "HOLIDAY_CALENDAR_DEACTIVATED",

            beforeData: {
              name: existing.name,
              isActive: true,
            },

            afterData: {
              name: existing.name,
              isActive: false,
            },

            ipAddress: getClientIp(request),
          },
        });
      }
    );

    return successResponse({
      message:
        "تقویم با موفقیت غیرفعال شد. اطلاعات و سوابق آن حفظ شده‌اند.",
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}
