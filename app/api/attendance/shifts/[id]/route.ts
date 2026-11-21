import { runShiftWrite } from "@/modules/shifts/shift-write-transaction";

import { NextRequest } from "next/server";

import {
  Prisma,
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
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

// ==========================================
// TYPES
// ==========================================

type Context = {
  params: Promise<{
    id: string;
  }>;
};

class WorkShiftError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "WorkShiftError";
  }
}

type WorkShiftDayInput = {
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

function readString(
  value: unknown,
  field: string,
  required = true
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      throw new WorkShiftError(
        `${field} الزامی است.`
      );
    }

    return null;
  }

  if (typeof value !== "string") {
    throw new WorkShiftError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (!result && required) {
    throw new WorkShiftError(
      `${field} الزامی است.`
    );
  }

  return result || null;
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
    throw new WorkShiftError(
      `${field} باید عدد صحیح بین ${min} و ${max} باشد.`
    );
  }

  return value;
}

function getIpAddress(
  request: NextRequest
): string | null {
  return (
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function parseDays(
  value: unknown
): WorkShiftDayInput[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > 100
  ) {
    throw new WorkShiftError(
      "برنامه هفتگی شیفت معتبر نیست."
    );
  }

  const days: WorkShiftDayInput[] = [];
  const uniqueSegments = new Set<string>();

  for (const item of value) {
    if (!isObject(item)) {
      throw new WorkShiftError(
        "اطلاعات روز کاری معتبر نیست."
      );
    }

    const dayOfWeek = readInteger(
      item.dayOfWeek,
      "روز هفته",
      0,
      6
    );

    const segmentOrder = readInteger(
      item.segmentOrder ?? 1,
      "ترتیب بازه کاری",
      1,
      100
    );

    const dayType =
      item.dayType ?? WorkShiftDayType.NORMAL;

    if (
      dayType !== WorkShiftDayType.NORMAL &&
      dayType !== WorkShiftDayType.HOLIDAY
    ) {
      throw new WorkShiftError(
        "نوع روز کاری معتبر نیست."
      );
    }

    if (typeof item.isWorkingDay !== "boolean") {
      throw new WorkShiftError(
        "وضعیت روز کاری معتبر نیست."
      );
    }

    const requiredMinutes = readInteger(
      item.requiredMinutes ??
        (item.isWorkingDay ? 480 : 0),
      "دقایق کاری",
      0,
      1440
    );

    let startMinute: number | null = null;
    let endMinute: number | null = null;

    if (item.isWorkingDay) {
      startMinute = readInteger(
        item.startMinute,
        "ساعت شروع",
        0,
        1439
      );

      endMinute = readInteger(
        item.endMinute,
        "ساعت پایان",
        0,
        1439
      );

      if (startMinute === endMinute) {
        throw new WorkShiftError(
          "ساعت شروع و پایان نمی‌توانند یکسان باشند."
        );
      }

      if (requiredMinutes <= 0) {
        throw new WorkShiftError(
          "مدت کارکرد باید بیشتر از صفر باشد."
        );
      }
    } else {
      if (
        item.startMinute != null ||
        item.endMinute != null
      ) {
        throw new WorkShiftError(
          "روز غیرکاری نباید ساعت شروع یا پایان داشته باشد."
        );
      }
    }

    const uniqueKey =
      `${dayOfWeek}-${dayType}-${segmentOrder}`;

    if (uniqueSegments.has(uniqueKey)) {
      throw new WorkShiftError(
        "ترتیب بازه‌های یک روز نباید تکراری باشد."
      );
    }

    uniqueSegments.add(uniqueKey);

    days.push({
      dayOfWeek,
      segmentOrder,
      dayType,
      isWorkingDay: item.isWorkingDay,
      startMinute,
      endMinute,
      requiredMinutes,
    });
  }

  return days;
}

// ==========================================
// ERROR HANDLER
// ==========================================

function handleError(error: unknown) {
  if (error instanceof WorkShiftError) {
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
      "اطلاعات تکراری است.",
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

  if (
    isObject(error) &&
    error.code === "P2025"
  ) {
    return errorResponse(
      "شیفت موردنظر پیدا نشد.",
      404
    );
  }

  console.error(
    "[WORK_SHIFT_DETAIL_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در مدیریت شیفت کاری.",
    500
  );
}

// ==========================================
// GET - WORK SHIFT DETAILS
// ==========================================

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.shift.view"
    );

    const { id: shiftId } = await context.params;

    if (!shiftId?.trim()) {
      throw new WorkShiftError(
        "شناسه شیفت معتبر نیست."
      );
    }

    const shift = await prisma.workShift.findUnique({
      where: {
        id: shiftId,
      },

      include: {
        days: {
          orderBy: [
            { dayOfWeek: "asc" },
            { segmentOrder: "asc" },
          ],
        },

        assignments: {
          where: {
            isActive: true,
          },

          include: {
            organizationUnit: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },

            employeeAssignment: {
              select: {
                id: true,
                user: {
                  select: {
                    id: true,
                    fullName: true,
                    username: true,
                  },
                },
                organizationUnit: {
                  select: {
                    id: true,
                    name: true,
                  },
                },
              },
            },
          },

          orderBy: {
            validFrom: "desc",
          },
        },

        _count: {
          select: {
            assignments: true,
          },
        },
      },
    });

    if (!shift) {
      throw new WorkShiftError(
        "شیفت موردنظر پیدا نشد.",
        404
      );
    }

    const latestVersion =
      await prisma.workShift.findFirst({
        where: {
          code: shift.code,
        },

        orderBy: {
          version: "desc",
        },

        select: {
          id: true,
          version: true,
        },
      });

    return successResponse({
      shift,

      versionInfo: {
        currentVersion: shift.version,
        latestVersion:
          latestVersion?.version ?? shift.version,
        isLatestVersion:
          latestVersion?.id === shift.id,
      },

      statistics: {
        totalAssignments:
          shift._count.assignments,

        activeAssignments:
          shift.assignments.length,
      },
    });

  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    return handleError(error);
  }
}

// ==========================================
// PATCH - UPDATE WORK SHIFT
// ==========================================

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.shift.update"
      );

    const { id: shiftId } = await context.params;

    if (!shiftId?.trim()) {
      throw new WorkShiftError(
        "شناسه شیفت معتبر نیست."
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new WorkShiftError(
        "ساختار اطلاعات ارسالی معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new WorkShiftError(
        "اطلاعات ارسالی معتبر نیست."
      );
    }

    const result = await runShiftWrite(
      async (tx) => {
        const existing =
          await tx.workShift.findUnique({
            where: {
              id: shiftId,
            },

            include: {
              days: true,
              _count: {
                select: {
                  assignments: true,
                },
              },
            },
          });

        if (!existing) {
          throw new WorkShiftError(
            "شیفت موردنظر پیدا نشد.",
            404
          );
        }

        if (!existing.isActive) {
          throw new WorkShiftError(
            "شیفت غیرفعال قابل ویرایش نیست."
          );
        }

        const latestVersion =
          await tx.workShift.findFirst({
            where: {
              code: existing.code,
            },

            orderBy: {
              version: "desc",
            },

            select: {
              id: true,
            },
          });

        if (latestVersion?.id !== existing.id) {
          throw new WorkShiftError(
            "فقط آخرین نسخه فعال شیفت قابل ویرایش است."
          );
        }

        const data: Prisma.WorkShiftUpdateInput = {};

        if ("name" in body) {
          const name = readString(
            body.name,
            "نام شیفت"
          )!;

          if (name.length > 150) {
            throw new WorkShiftError(
              "نام شیفت نباید بیشتر از ۱۵۰ کاراکتر باشد."
            );
          }

          data.name = name;
        }

        if ("description" in body) {
          const description = readString(
            body.description,
            "توضیحات",
            false
          );

          if (
            description &&
            description.length > 2000
          ) {
            throw new WorkShiftError(
              "توضیحات نباید بیشتر از ۲۰۰۰ کاراکتر باشد."
            );
          }

          data.description = description;
        }

        if ("isDefault" in body) {
          if (typeof body.isDefault !== "boolean") {
            throw new WorkShiftError(
              "وضعیت شیفت پیش‌فرض معتبر نیست."
            );
          }

          data.isDefault = body.isDefault;
        }

        let parsedDays:
          WorkShiftDayInput[] | undefined;

        if ("days" in body) {
          if (existing._count.assignments > 0) {
            throw new WorkShiftError(
              "این شیفت دارای سوابق انتصاب است. برای تغییر ساعات کاری باید نسخه جدیدی از شیفت ایجاد شود.",
              409
            );
          }

          parsedDays = parseDays(body.days);
        }

        const isBecomingDefault =
          body.isDefault === true;

        if (isBecomingDefault) {
          await tx.workShift.updateMany({
            where: {
              isActive: true,
              isDefault: true,
              id: {
                not: shiftId,
              },
            },

            data: {
              isDefault: false,
            },
          });
        }

        if (parsedDays) {
          await tx.workShiftDay.deleteMany({
            where: {
              shiftId,
            },
          });

          await tx.workShiftDay.createMany({
            data: parsedDays.map((day) => ({
              ...day,
              shiftId,
            })),
          });
        }

        const updated =
          await tx.workShift.update({
            where: {
              id: shiftId,
            },

            data,

            include: {
              days: {
                orderBy: [
                  { dayOfWeek: "asc" },
                  { segmentOrder: "asc" },
                ],
              },
            },
          });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "WorkShift",
            entityId: updated.id,
            action: "WORK_SHIFT_UPDATED",

            beforeData: {
              name: existing.name,
              description: existing.description,
              isDefault: existing.isDefault,
              days: existing.days.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                segmentOrder: day.segmentOrder,
                dayType: day.dayType,
                isWorkingDay: day.isWorkingDay,
                startMinute: day.startMinute,
                endMinute: day.endMinute,
                requiredMinutes: day.requiredMinutes,
              })),
            } satisfies Prisma.InputJsonObject,

            afterData: {
              name: updated.name,
              description: updated.description,
              isDefault: updated.isDefault,
              days: updated.days.map((day) => ({
                dayOfWeek: day.dayOfWeek,
                segmentOrder: day.segmentOrder,
                dayType: day.dayType,
                isWorkingDay: day.isWorkingDay,
                startMinute: day.startMinute,
                endMinute: day.endMinute,
                requiredMinutes: day.requiredMinutes,
              })),
            } satisfies Prisma.InputJsonObject,

            ipAddress: getIpAddress(request),
          },
        });

        return updated;
      }
    );

    return successResponse({
      shift: result,
      message: "اطلاعات شیفت با موفقیت ویرایش شد.",
    });

  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    return handleError(error);
  }
}

// ==========================================
// DELETE - DEACTIVATE WORK SHIFT
// ==========================================

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "attendance.shift.delete"
      );

    const { id: shiftId } = await context.params;

    if (!shiftId?.trim()) {
      throw new WorkShiftError(
        "شناسه شیفت معتبر نیست."
      );
    }

    const result = await runShiftWrite(
      async (tx) => {
        const existing =
          await tx.workShift.findUnique({
            where: {
              id: shiftId,
            },
          });

        if (!existing) {
          throw new WorkShiftError(
            "شیفت موردنظر پیدا نشد.",
            404
          );
        }

        if (!existing.isActive) {
          throw new WorkShiftError(
            "این شیفت قبلاً غیرفعال شده است."
          );
        }

        const updated =
          await tx.workShift.update({
            where: {
              id: shiftId,
            },

            data: {
              isActive: false,
              isDefault: false,
            },
          });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,
            entityType: "WorkShift",
            entityId: shiftId,
            action: "WORK_SHIFT_DEACTIVATED",

            beforeData: {
              isActive: existing.isActive,
              isDefault: existing.isDefault,
            },

            afterData: {
              isActive: false,
              isDefault: false,
            },

            ipAddress: getIpAddress(request),
          },
        });

        return updated;
      }
    );

    return successResponse({
      shift: result,
      message:
        "شیفت با موفقیت غیرفعال شد. سوابق قبلی حفظ شده‌اند.",
    });

  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    return handleError(error);
  }
}
