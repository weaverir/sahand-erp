import { NextRequest } from "next/server";

import {
  Prisma,
  ShiftAssignmentTarget,
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

class ShiftAssignmentError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ShiftAssignmentError";
  }
}

type AssignmentInput = {
  shiftId: string;
  targetType: ShiftAssignmentTarget;
  organizationUnitId: string | null;
  employeeAssignmentId: string | null;
  validFrom: Date;
  validTo: Date | null;
  notes: string | null;
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
    value === undefined ||
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
  field: string,
  optional = false
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (optional) return null;

    throw new ShiftAssignmentError(
      `${field} الزامی است.`
    );
  }

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

function parseAssignment(
  body: Record<string, unknown>
): AssignmentInput {
  const shiftId = parseString(
    body.shiftId,
    "شناسه شیفت",
    100
  );

  const targetType = body.targetType;

  if (
    typeof targetType !== "string" ||
    !Object.values(ShiftAssignmentTarget).includes(
      targetType as ShiftAssignmentTarget
    )
  ) {
    throw new ShiftAssignmentError(
      "نوع اختصاص شیفت معتبر نیست."
    );
  }

  const organizationUnitId =
    parseOptionalString(
      body.organizationUnitId,
      "واحد سازمانی",
      100
    );

  const employeeAssignmentId =
    parseOptionalString(
      body.employeeAssignmentId,
      "پرسنل",
      100
    );

  const validFrom = parseDate(
    body.validFrom,
    "تاریخ شروع"
  )!;

  const validTo = parseDate(
    body.validTo,
    "تاریخ پایان",
    true
  );

  if (
    validTo &&
    validTo.getTime() < validFrom.getTime()
  ) {
    throw new ShiftAssignmentError(
      "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
    );
  }

  if (
    targetType === ShiftAssignmentTarget.COMPANY &&
    (organizationUnitId || employeeAssignmentId)
  ) {
    throw new ShiftAssignmentError(
      "برای اختصاص شیفت به کل شرکت، شناسه واحد و کارمند نباید ارسال شود."
    );
  }

  if (
    targetType === ShiftAssignmentTarget.UNIT &&
    (!organizationUnitId || employeeAssignmentId)
  ) {
    throw new ShiftAssignmentError(
      "برای اختصاص شیفت به واحد، فقط شناسه واحد سازمانی الزامی است."
    );
  }

  if (
    targetType === ShiftAssignmentTarget.EMPLOYEE &&
    (!employeeAssignmentId || organizationUnitId)
  ) {
    throw new ShiftAssignmentError(
      "برای اختصاص شیفت به کارمند، فقط شناسه انتصاب کارمند الزامی است."
    );
  }

  return {
    shiftId,
    targetType: targetType as ShiftAssignmentTarget,
    organizationUnitId,
    employeeAssignmentId,
    validFrom,
    validTo,
    notes: parseOptionalString(
      body.notes,
      "توضیحات"
    ),
  };
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
      "ارتباط با اطلاعات سازمانی معتبر نیست.",
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
      "عملیات هم‌زمان دیگری انجام شده است. دوباره تلاش کنید.",
      409
    );
  }

  console.error(
    "[SHIFT_ASSIGNMENT_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در مدیریت اختصاص شیفت.",
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
// GET - LIST SHIFT ASSIGNMENTS
// ==========================================

export async function GET(
  request: NextRequest
) {
  try {
    await authorizeGlobalRequest(
      request,
      "attendance.shift.view"
    );

    const params =
      request.nextUrl.searchParams;

    const targetTypeParam =
      params.get("targetType");

    const shiftId =
      params.get("shiftId");

    const organizationUnitId =
      params.get("organizationUnitId");

    const employeeAssignmentId =
      params.get("employeeAssignmentId");

    const activeParam =
      params.get("active");

    const page = Number(
      params.get("page") || "1"
    );

    const pageSize = Number(
      params.get("pageSize") || "50"
    );

    if (
      !Number.isInteger(page) ||
      page < 1 ||
      page > 100000
    ) {
      throw new ShiftAssignmentError(
        "شماره صفحه معتبر نیست."
      );
    }

    if (
      !Number.isInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new ShiftAssignmentError(
        "تعداد رکورد در صفحه باید بین ۱ تا ۱۰۰ باشد."
      );
    }

    const where: Prisma.ShiftAssignmentWhereInput = {};

    if (shiftId) {
      where.shiftId = shiftId;
    }

    if (organizationUnitId) {
      where.organizationUnitId =
        organizationUnitId;
    }

    if (employeeAssignmentId) {
      where.employeeAssignmentId =
        employeeAssignmentId;
    }

    if (targetTypeParam) {
      if (
        !Object.values(
          ShiftAssignmentTarget
        ).includes(
          targetTypeParam as ShiftAssignmentTarget
        )
      ) {
        throw new ShiftAssignmentError(
          "نوع اختصاص شیفت معتبر نیست."
        );
      }

      where.targetType =
        targetTypeParam as ShiftAssignmentTarget;
    }

    if (activeParam === "true") {
      where.isActive = true;
    } else if (activeParam === "false") {
      where.isActive = false;
    } else if (
      activeParam !== null &&
      activeParam !== "all"
    ) {
      throw new ShiftAssignmentError(
        "فیلتر وضعیت معتبر نیست."
      );
    }

    const [assignments, total] =
      await prisma.$transaction([
        prisma.shiftAssignment.findMany({
          where,

          include: {
            shift: {
              include: {
                days: {
                  orderBy: [
                    { dayOfWeek: "asc" },
                    { segmentOrder: "asc" },
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
          },

          orderBy: [
            { validFrom: "desc" },
            { createdAt: "desc" },
          ],

          skip: (page - 1) * pageSize,
          take: pageSize,
        }),

        prisma.shiftAssignment.count({
          where,
        }),
      ]);

    return successResponse({
      assignments,

      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(
          total / pageSize
        ),
      },
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// POST - CREATE SHIFT ASSIGNMENT
// ==========================================

export async function POST(
  request: NextRequest
) {
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
      throw new ShiftAssignmentError(
        "ساختار اطلاعات ارسالی معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new ShiftAssignmentError(
        "اطلاعات ارسالی معتبر نیست."
      );
    }

    const input = parseAssignment(body);

    const assignment = await runShiftWrite(
      async (tx) => {
        // ----------------------------------
        // 1. Check shift
        // ----------------------------------

        const shift =
          await tx.workShift.findUnique({
            where: {
              id: input.shiftId,
            },
          });

        if (!shift) {
          throw new ShiftAssignmentError(
            "شیفت موردنظر پیدا نشد.",
            404
          );
        }

        if (!shift.isActive) {
          throw new ShiftAssignmentError(
            "امکان اختصاص شیفت غیرفعال وجود ندارد."
          );
        }

        // ----------------------------------
        // 2. Check organization target
        // ----------------------------------

        if (
          input.targetType ===
          ShiftAssignmentTarget.UNIT
        ) {
          const unit =
            await tx.organizationUnit.findUnique({
              where: {
                id: input.organizationUnitId!,
              },

              select: {
                id: true,
                status: true,
              },
            });

          if (!unit) {
            throw new ShiftAssignmentError(
              "واحد سازمانی موردنظر پیدا نشد.",
              404
            );
          }

          if (unit.status !== "ACTIVE") {
            throw new ShiftAssignmentError(
              "واحد سازمانی غیرفعال است."
            );
          }
        }

        // ----------------------------------
        // 3. Check employee target
        // ----------------------------------

        if (
          input.targetType ===
          ShiftAssignmentTarget.EMPLOYEE
        ) {
          const employee =
            await tx.employeeAssignment.findUnique({
              where: {
                id: input.employeeAssignmentId!,
              },

              include: {
                user: {
                  select: {
                    isActive: true,
                  },
                },
              },
            });

          if (!employee) {
            throw new ShiftAssignmentError(
              "انتصاب کارمند موردنظر پیدا نشد.",
              404
            );
          }

          if (
            employee.status !== "ACTIVE" ||
            !employee.user.isActive
          ) {
            throw new ShiftAssignmentError(
              "کارمند موردنظر فعال نیست."
            );
          }

          if (
            employee.endDate &&
            new Date(employee.endDate) <
              input.validFrom
          ) {
            throw new ShiftAssignmentError(
              "تاریخ شروع شیفت بعد از پایان انتصاب کارمند است."
            );
          }

          if (
            new Date(employee.startDate) >
            (input.validTo ?? input.validFrom)
          ) {
            throw new ShiftAssignmentError(
              "بازه اختصاص شیفت با تاریخ شروع انتصاب کارمند مطابقت ندارد."
            );
          }
        }

        // ----------------------------------
        // 4. Prevent overlapping assignments
        // ----------------------------------

        const conflict = await findShiftAssignmentConflict(tx, input);
        if (conflict) {
          throw new ShiftAssignmentError(
            `این کارمند در تاریخ ${conflict.workDate} با تخصیص ${conflict.assignmentId} به مدت ${conflict.overlapMinutes} دقیقه تداخل شیفت دارد.`,
            409
          );
        }

        // ----------------------------------
        // 5. Create assignment
        // ----------------------------------

        const created =
          await tx.shiftAssignment.create({
            data: {
              shiftId: input.shiftId,
              targetType: input.targetType,

              organizationUnitId:
                input.organizationUnitId,

              employeeAssignmentId:
                input.employeeAssignmentId,

              validFrom: input.validFrom,
              validTo: input.validTo,

              isActive: true,

              assignedById: actor.id,
              notes: input.notes,
            },

            include: {
              shift: {
                include: {
                  days: {
                    orderBy: [
                      { dayOfWeek: "asc" },
                      { segmentOrder: "asc" },
                    ],
                  },
                },
              },

              organizationUnit: {
                select: {
                  id: true,
                  code: true,
                  name: true,
                },
              },

              employeeAssignment: {
                include: {
                  user: {
                    select: {
                      id: true,
                      fullName: true,
                      username: true,
                    },
                  },
                },
              },
            },
          });

        // ----------------------------------
        // 6. Audit log
        // ----------------------------------

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,

            entityType: "ShiftAssignment",
            entityId: created.id,

            action: "SHIFT_ASSIGNED",

            afterData: {
              shiftId: created.shiftId,
              shiftName: created.shift.name,

              targetType: created.targetType,

              organizationUnitId:
                created.organizationUnitId,

              employeeAssignmentId:
                created.employeeAssignmentId,

              validFrom: input.validFrom.toISOString(),

              validTo:
                input.validTo?.toISOString() ?? null,

              isActive: true,
            },

            ipAddress: getClientIp(request),
          },
        });

        return created;
      }
    );

    return successResponse(
      {
        assignment,

        message:
          "شیفت با موفقیت به هدف موردنظر اختصاص داده شد.",
      },
      201
    );

  } catch (error) {
    return getErrorResponse(error);
  }
}
