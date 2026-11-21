import { NextRequest } from "next/server";

import {
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";
import { runShiftWrite } from "@/modules/shifts/shift-write-transaction";
import { findShiftAssignmentConflict } from "@/modules/shifts/assignment-conflict-db";

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
    id: string;
  }>;
};

class ShiftAssignmentError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ShiftAssignmentError";
  }
}

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
  maxLength = 200
): string {
  if (typeof value !== "string") {
    throw new ShiftAssignmentError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (!result) {
    throw new ShiftAssignmentError(
      `${field} الزامی است.`
    );
  }

  if (result.length > maxLength) {
    throw new ShiftAssignmentError(
      `${field} بیش از حد مجاز طولانی است.`
    );
  }

  return result;
}

function parseOptionalString(
  value: unknown,
  field: string,
  maxLength = 1000
): string | null {
  if (
    value === null ||
    value === ""
  ) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ShiftAssignmentError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (result.length > maxLength) {
    throw new ShiftAssignmentError(
      `${field} بیش از حد مجاز طولانی است.`
    );
  }

  return result || null;
}

function parseDate(
  value: unknown,
  field: string
): Date {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) {
    throw new ShiftAssignmentError(
      `${field} باید با فرمت YYYY-MM-DD باشد.`
    );
  }

  const date = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new ShiftAssignmentError(
      `${field} معتبر نیست.`
    );
  }

  return date;
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

function getErrorResponse(error: unknown) {
  if (error instanceof ShiftAssignmentError) {
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
    error.code === "P2003"
  ) {
    return errorResponse(
      "ارتباط با اطلاعات موردنظر معتبر نیست.",
      400
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
      "تغییر هم‌زمان دیگری انجام شده است. دوباره تلاش کنید.",
      409
    );
  }

  console.error(
    "[SHIFT_ASSIGNMENT_DETAIL_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در مدیریت انتصاب شیفت.",
    500
  );
}

// ==========================================
// INCLUDE
// ==========================================

const assignmentInclude = {
  shift: {
    include: {
      days: {
        orderBy: [
          { dayOfWeek: "asc" as const },
          { segmentOrder: "asc" as const },
        ],
      },
    },
  },

  organizationUnit: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
    },
  },

  employeeAssignment: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          fullName: true,
          isActive: true,
        },
      },

      organizationUnit: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },

      position: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  },
} satisfies Prisma.ShiftAssignmentInclude;

// ==========================================
// GET - GET ASSIGNMENT DETAILS
// ==========================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.shift.view"
    );

    const { id } = await context.params;

    if (!id?.trim()) {
      throw new ShiftAssignmentError(
        "شناسه انتصاب معتبر نیست."
      );
    }

    const assignment =
      await prisma.shiftAssignment.findUnique({
        where: {
          id,
        },

        include: assignmentInclude,
      });

    if (!assignment) {
      throw new ShiftAssignmentError(
        "انتصاب شیفت پیدا نشد.",
        404
      );
    }

    return successResponse({
      assignment,
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// PATCH - UPDATE ASSIGNMENT
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
        "attendance.shift.update"
      );

    const { id } = await context.params;

    if (!id?.trim()) {
      throw new ShiftAssignmentError(
        "شناسه انتصاب معتبر نیست."
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ShiftAssignmentError(
        "ساختار اطلاعات ارسالی معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new ShiftAssignmentError(
        "اطلاعات ارسالی معتبر نیست."
      );
    }

    const updated = await runShiftWrite(
      async (tx) => {
        const existing =
          await tx.shiftAssignment.findUnique({
            where: {
              id,
            },

            include: {
              shift: true,
            },
          });

        if (!existing) {
          throw new ShiftAssignmentError(
            "انتصاب شیفت پیدا نشد.",
            404
          );
        }

        if (!existing.isActive) {
          throw new ShiftAssignmentError(
            "انتصاب غیرفعال قابل ویرایش نیست."
          );
        }

        // ------------------------------
        // Parse update fields
        // ------------------------------

        let shiftId = existing.shiftId;

        if (body.shiftId !== undefined) {
          shiftId = parseString(
            body.shiftId,
            "شناسه شیفت",
            100
          );
        }

        let validFrom = existing.validFrom;

        if (body.validFrom !== undefined) {
          validFrom = parseDate(
            body.validFrom,
            "تاریخ شروع"
          );
        }

        let validTo = existing.validTo;

        if (body.validTo !== undefined) {
          validTo =
            body.validTo === null
              ? null
              : parseDate(
                  body.validTo,
                  "تاریخ پایان"
                );
        }

        let notes = existing.notes;

        if (body.notes !== undefined) {
          notes = parseOptionalString(
            body.notes,
            "توضیحات"
          );
        }

        if (
          validTo &&
          validTo.getTime() < validFrom.getTime()
        ) {
          throw new ShiftAssignmentError(
            "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
          );
        }

        // ------------------------------
        // Check shift
        // ------------------------------

        const shift =
          await tx.workShift.findUnique({
            where: {
              id: shiftId,
            },
          });

        if (!shift) {
          throw new ShiftAssignmentError(
            "شیفت انتخاب‌شده پیدا نشد.",
            404
          );
        }

        if (!shift.isActive) {
          throw new ShiftAssignmentError(
            "امکان اختصاص شیفت غیرفعال وجود ندارد."
          );
        }

        // ------------------------------
        // Check target overlap
        // ------------------------------

        const conflict = await findShiftAssignmentConflict(tx, {
          shiftId,
          targetType: existing.targetType,
          organizationUnitId: existing.organizationUnitId,
          employeeAssignmentId: existing.employeeAssignmentId,
          validFrom,
          validTo,
        }, id);
        if (conflict) {
          throw new ShiftAssignmentError(
            `این کارمند در تاریخ ${conflict.workDate} با تخصیص ${conflict.assignmentId} به مدت ${conflict.overlapMinutes} دقیقه تداخل شیفت دارد.`,
            409
          );
        }

        // ------------------------------
        // Update
        // ------------------------------

        const result =
          await tx.shiftAssignment.update({
            where: {
              id,
            },

            data: {
              shiftId,
              validFrom,
              validTo,
              notes,
            },

            include: assignmentInclude,
          });

        // ------------------------------
        // Audit log
        // ------------------------------

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,

            entityType: "ShiftAssignment",
            entityId: id,

            action: "SHIFT_ASSIGNMENT_UPDATED",

            beforeData: {
              shiftId: existing.shiftId,
              validFrom:
                existing.validFrom.toISOString(),

              validTo:
                existing.validTo?.toISOString() ?? null,

              notes: existing.notes,
            },

            afterData: {
              shiftId: result.shiftId,
              validFrom:
                result.validFrom.toISOString(),

              validTo:
                result.validTo?.toISOString() ?? null,

              notes: result.notes,
            },

            ipAddress: getClientIp(request),
          },
        });

        return result;
      }
    );

    return successResponse({
      assignment: updated,

      message:
        "انتصاب شیفت با موفقیت ویرایش شد.",
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// DELETE - SOFT DEACTIVATE
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
        "attendance.shift.update"
      );

    const { id } = await context.params;

    if (!id?.trim()) {
      throw new ShiftAssignmentError(
        "شناسه انتصاب معتبر نیست."
      );
    }

    const result = await runShiftWrite(
      async (tx) => {
        const existing =
          await tx.shiftAssignment.findUnique({
            where: {
              id,
            },
          });

        if (!existing) {
          throw new ShiftAssignmentError(
            "انتصاب شیفت پیدا نشد.",
            404
          );
        }

        if (!existing.isActive) {
          throw new ShiftAssignmentError(
            "این انتصاب قبلاً غیرفعال شده است."
          );
        }

        const updated =
          await tx.shiftAssignment.update({
            where: {
              id,
            },

            data: {
              isActive: false,
            },
          });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,

            entityType: "ShiftAssignment",
            entityId: id,

            action: "SHIFT_ASSIGNMENT_DEACTIVATED",

            beforeData: {
              shiftId: existing.shiftId,
              targetType: existing.targetType,
              validFrom:
                existing.validFrom.toISOString(),

              validTo:
                existing.validTo?.toISOString() ?? null,

              isActive: true,
            },

            afterData: {
              isActive: false,
            },

            ipAddress: getClientIp(request),
          },
        });

        return updated;
      }
    );

    return successResponse({
      assignment: result,

      message:
        "انتصاب شیفت غیرفعال شد و سوابق آن حفظ گردید.",
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}
