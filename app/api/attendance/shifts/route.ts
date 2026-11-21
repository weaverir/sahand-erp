import { runShiftWrite } from "@/modules/shifts/shift-write-transaction";

import { NextRequest } from "next/server";

import {
  WorkShiftDayType,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  assertSameOriginRequest,
  authorizeGlobalRequest,
  RequestOriginError,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

// ==========================================
// TYPES
// ==========================================

class ShiftError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ShiftError";
  }
}

type ShiftDayInput = {
  dayOfWeek: number;
  segmentOrder: number;
  dayType: WorkShiftDayType;
  isWorkingDay: boolean;
  startMinute: number | null;
  endMinute: number | null;
  requiredMinutes: number;
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

function readText(
  value: unknown,
  field: string,
  maxLength: number
): string {
  if (typeof value !== "string") {
    throw new ShiftError(`${field} الزامی است.`);
  }

  const result = value.trim();

  if (!result || result.length > maxLength) {
    throw new ShiftError(`${field} معتبر نیست.`);
  }

  return result;
}

function readInteger(
  value: unknown,
  field: string,
  min: number,
  max: number,
  fallback?: number
): number {
  if (value === undefined && fallback !== undefined) {
    return fallback;
  }

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new ShiftError(`${field} معتبر نیست.`);
  }

  return value;
}

function parseDays(value: unknown): ShiftDayInput[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new ShiftError(
      "حداقل یک روز کاری یا تعطیل باید تعریف شود."
    );
  }

  const allowedTypes = Object.values(
    WorkShiftDayType
  ) as string[];

  const days = value.map((item, index) => {
    if (!isObject(item)) {
      throw new ShiftError("ساختار روز شیفت معتبر نیست.");
    }

    const dayOfWeek = readInteger(
      item.dayOfWeek,
      "روز هفته",
      0,
      6
    );

    const segmentOrder = readInteger(
      item.segmentOrder,
      "ترتیب بازه",
      1,
      100,
      1
    );

    const dayType =
      item.dayType === undefined
        ? WorkShiftDayType.NORMAL
        : item.dayType;

    if (
      typeof dayType !== "string" ||
      !allowedTypes.includes(dayType)
    ) {
      throw new ShiftError("نوع روز معتبر نیست.");
    }

    const isWorkingDay =
      item.isWorkingDay === undefined
        ? true
        : item.isWorkingDay;

    if (typeof isWorkingDay !== "boolean") {
      throw new ShiftError("وضعیت روز کاری معتبر نیست.");
    }

    const startMinute =
      item.startMinute === null ||
      item.startMinute === undefined
        ? null
        : readInteger(
            item.startMinute,
            "ساعت شروع",
            0,
            1439
          );

    const endMinute =
      item.endMinute === null ||
      item.endMinute === undefined
        ? null
        : readInteger(
            item.endMinute,
            "ساعت پایان",
            0,
            1439
          );

    if (
      isWorkingDay &&
      (startMinute === null || endMinute === null)
    ) {
      throw new ShiftError(
        "برای روز کاری ساعت شروع و پایان الزامی است."
      );
    }

    const requiredMinutes = readInteger(
      item.requiredMinutes,
      "ساعت موظفی",
      0,
      1440,
      isWorkingDay ? 480 : 0
    );

    if (!isWorkingDay && requiredMinutes !== 0) {
      throw new ShiftError(
        "روز غیرکاری نباید ساعت موظفی داشته باشد."
      );
    }

    return {
      dayOfWeek,
      segmentOrder,
      dayType: dayType as WorkShiftDayType,
      isWorkingDay,
      startMinute,
      endMinute,
      requiredMinutes,
    };
  });

  const uniqueSegments = new Set(
    days.map(
      (day) =>
        `${day.dayOfWeek}-${day.dayType}-${day.segmentOrder}`
    )
  );

  if (uniqueSegments.size !== days.length) {
    throw new ShiftError(
      "ترتیب بازه‌های یک روز نباید تکراری باشد."
    );
  }

  return days;
}

function getErrorResponse(error: unknown) {
  if (
    error instanceof ShiftError ||
    error instanceof RequestOriginError ||
    error instanceof AuthError ||
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
      "کد این شیفت قبلاً ثبت شده است.",
      409
    );
  }

  console.error("[WORK_SHIFT_ERROR]", error);

  return errorResponse(
    "خطا در پردازش اطلاعات شیفت.",
    500
  );
}

// ==========================================
// GET - LIST SHIFTS
// ==========================================

export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.shift.view"
    );

    const shifts = await prisma.workShift.findMany({
      include: {
        days: {
          orderBy: [
            { dayOfWeek: "asc" },
            { dayType: "asc" },
            { segmentOrder: "asc" },
          ],
        },

        _count: {
          select: {
            assignments: true,
          },
        },
      },

      orderBy: [
        { isDefault: "desc" },
        { createdAt: "desc" },
      ],
    });

    return successResponse({
      shifts,
      count: shifts.length,
    });

  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    return getErrorResponse(error);
  }
}

// ==========================================
// POST - CREATE SHIFT
// ==========================================

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.shift.create"
      );

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ShiftError(
        "ساختار درخواست معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new ShiftError(
        "اطلاعات شیفت معتبر نیست."
      );
    }

    const code = readText(
      body.code,
      "کد شیفت",
      50
    );

    const name = readText(
      body.name,
      "نام شیفت",
      120
    );

    const description =
      body.description === undefined ||
      body.description === null ||
      body.description === ""
        ? null
        : readText(
            body.description,
            "توضیحات",
            2000
          );

    const isDefault =
      body.isDefault === undefined
        ? false
        : body.isDefault;

    if (typeof isDefault !== "boolean") {
      throw new ShiftError(
        "وضعیت شیفت پیش‌فرض معتبر نیست."
      );
    }

    const days = parseDays(body.days);

    const created = await runShiftWrite(
      async (tx) => {
        // فقط یک شیفت پیش‌فرض فعال باشد.
        if (isDefault) {
          await tx.workShift.updateMany({
            where: {
              isDefault: true,
            },
            data: {
              isDefault: false,
            },
          });
        }

        const shift = await tx.workShift.create({
          data: {
            code,
            name,
            description,
            isDefault,
            isActive: true,
            version: 1,

            days: {
              create: days,
            },
          },

          include: {
            days: {
              orderBy: [
                { dayOfWeek: "asc" },
                { dayType: "asc" },
                { segmentOrder: "asc" },
              ],
            },
          },
        });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "WorkShift",
            entityId: shift.id,
            action: "WORK_SHIFT_CREATED",
            ipAddress:
              request.headers
                .get("x-forwarded-for")
                ?.split(",")[0]
                ?.trim() ??
              request.headers.get("x-real-ip"),
            afterData: {
              code,
              name,
              version: shift.version,
              isDefault,
              daysCount: days.length,
            },
          },
        });

        return shift;
      }
    );

    return successResponse(
      {
        shift: created,
        message: "شیفت کاری با موفقیت ثبت شد.",
      },
      201
    );

  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    return getErrorResponse(error);
  }
}
