import { assertEmployeeShiftCompatibility, OrganizationShiftConflictError } from "@/modules/shifts/organization-shift-guard";
import { runShiftWrite } from "@/modules/shifts/shift-write-transaction";

import { NextRequest } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  assertSameOriginRequest,
  authorizeRequest,
} from "@/modules/auth/auth.middleware";

type Context = {
  params: Promise<{ id: string }>;
};

function getStatus(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")
      ?.split(",")[0]
      .trim() ||
    undefined
  );
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ==========================================
// GET - GET ASSIGNMENT
// ==========================================

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    await authorizeRequest(
      request,
      "organization.chart.view"
    );

    const { id } = await context.params;

    const assignment =
      await prisma.employeeAssignment.findUnique({
        where: { id },

        include: {
          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
            },
          },

          organizationUnit: true,

          position: true,

          location: true,

          managerAssignment: {
            select: {
              id: true,

              user: {
                select: {
                  fullName: true,
                },
              },

              position: {
                select: {
                  title: true,
                },
              },

              responsibilityTitle: true,
            },
          },

          roles: {
            include: {
              role: true,
            },
          },

          permissions: {
            include: {
              permission: true,
            },
          },
        },
      });

    if (!assignment) {
      return errorResponse(
        "انتصاب پیدا نشد.",
        404
      );
    }

    return successResponse({
      assignment,
    });

  } catch (error) {
    if (error instanceof OrganizationShiftConflictError) return errorResponse(error.message, 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    const status = getStatus(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "دسترسی مجاز نیست.",
        status
      );
    }

    console.error("[ASSIGNMENT_GET]", error);

    return errorResponse(
      "خطا در دریافت انتصاب.",
      500
    );
  }
}

// ==========================================
// PATCH - UPDATE ASSIGNMENT
// ==========================================

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const authorization =
      await authorizeRequest(
        request,
        "organization.assignments.manage"
      );

    const { id } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "اطلاعات ارسالی معتبر نیست.",
        400
      );
    }

    if (!isObject(body)) {
      return errorResponse(
        "ساختار اطلاعات معتبر نیست.",
        400
      );
    }

    // فقط فیلدهای مجاز
    const allowed = [
      "organizationUnitId",
      "positionId",
      "responsibilityTitle",
      "locationId",
      "managerAssignmentId",
      "assignmentType",
      "isPrimary",
      "startDate",
      "endDate",
      "notes",
      "status",
    ];

    if (
      Object.keys(body).some(
        (key) => !allowed.includes(key)
      )
    ) {
      return errorResponse(
        "فیلد غیرمجاز ارسال شده است.",
        400
      );
    }

    // اعتبارسنجی مسئولیت اصلی
    if (
      body.isPrimary !== undefined &&
      typeof body.isPrimary !== "boolean"
    ) {
      return errorResponse(
        "مقدار انتصاب اصلی معتبر نیست.",
        400
      );
    }

    // اعتبارسنجی توضیحات
    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== "string"
    ) {
      return errorResponse(
        "یادداشت معتبر نیست.",
        400
      );
    }

    if (
      typeof body.notes === "string" &&
      body.notes.length > 2000
    ) {
      return errorResponse(
        "یادداشت نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد.",
        400
      );
    }

    // اعتبارسنجی تاریخ‌ها
    const dateFields = [
      "startDate",
      "endDate",
    ];

    for (const field of dateFields) {
      const value = body[field];

      if (value === undefined || value === null) {
        continue;
      }

      if (
        typeof value !== "string" ||
        Number.isNaN(Date.parse(value))
      ) {
        return errorResponse(
          `تاریخ ${field} معتبر نیست.`,
          400
        );
      }
    }

    // اعتبارسنجی وضعیت
    if (
      body.status !== undefined &&
      !["ACTIVE", "ENDED", "SUSPENDED"].includes(
        body.status as string
      )
    ) {
      return errorResponse(
        "وضعیت انتصاب معتبر نیست.",
        400
      );
    }

    // اعتبارسنجی نوع انتصاب
    if (
      body.assignmentType !== undefined &&
      ![
        "PRIMARY",
        "SECONDARY",
        "TEMPORARY",
        "PROJECT",
      ].includes(body.assignmentType as string)
    ) {
      return errorResponse(
        "نوع انتصاب معتبر نیست.",
        400
      );
    }

    const result = await runShiftWrite(
      async (tx) => {
        // دریافت انتصاب فعلی
        const existing =
          await tx.employeeAssignment.findUnique({
            where: { id },
          });

        if (!existing) {
          throw new Error("ASSIGNMENT_NOT_FOUND");
        }

        // ==================================
        // دریافت مقادیر نهایی
        // ==================================

        const organizationUnitId =
          body.organizationUnitId !== undefined
            ? body.organizationUnitId as string
            : existing.organizationUnitId;

        const positionId =
          body.positionId !== undefined
            ? body.positionId as string | null
            : existing.positionId;

        const responsibilityTitle =
          body.responsibilityTitle !== undefined
            ? body.responsibilityTitle as string | null
            : existing.responsibilityTitle;

        const locationId =
          body.locationId !== undefined
            ? body.locationId as string | null
            : existing.locationId;

        // ==================================
        // اعتبارسنجی شناسه‌ها
        // ==================================

        if (
          body.organizationUnitId !== undefined &&
          typeof body.organizationUnitId !== "string"
        ) {
          throw new Error("INVALID_UNIT");
        }

        if (
          body.positionId !== undefined &&
          body.positionId !== null &&
          typeof body.positionId !== "string"
        ) {
          throw new Error("INVALID_POSITION");
        }

        if (
          body.responsibilityTitle !== undefined &&
          body.responsibilityTitle !== null &&
          typeof body.responsibilityTitle !== "string"
        ) {
          throw new Error("INVALID_RESPONSIBILITY");
        }

        if (
          body.locationId !== undefined &&
          body.locationId !== null &&
          typeof body.locationId !== "string"
        ) {
          throw new Error("INVALID_LOCATION");
        }

        // ==================================
        // اعتبارسنجی عنوان مسئولیت
        // ==================================

        const normalizedTitle =
          responsibilityTitle?.trim() || null;

        if (
          normalizedTitle &&
          (
            normalizedTitle.length < 2 ||
            normalizedTitle.length > 120
          )
        ) {
          throw new Error("INVALID_RESPONSIBILITY");
        }

        // باید سمت رسمی یا عنوان سفارشی وجود داشته باشد
        if (
          Boolean(positionId) ===
          Boolean(normalizedTitle)
        ) {
          throw new Error("INVALID_ASSIGNMENT_TITLE");
        }

        // ==================================
        // بررسی واحد، سمت و محل خدمت
        // ==================================

        const [unit, position, location] =
          await Promise.all([
            tx.organizationUnit.findUnique({
              where: {
                id: organizationUnitId,
              },
            }),

            positionId
              ? tx.organizationPosition.findUnique({
                  where: {
                    id: positionId,
                  },
                })
              : Promise.resolve(null),

            locationId
              ? tx.organizationLocation.findUnique({
                  where: {
                    id: locationId,
                  },
                })
              : Promise.resolve(null),
          ]);

        if (!unit || unit.status !== "ACTIVE") {
          throw new Error("INVALID_UNIT");
        }

        if (
          positionId &&
          (!position || !position.isActive)
        ) {
          throw new Error("INVALID_POSITION");
        }

        if (
          locationId &&
          (!location || location.status !== "ACTIVE")
        ) {
          throw new Error("INVALID_LOCATION");
        }

        // ==================================
        // بررسی مدیر مستقیم
        // ==================================

        const managerAssignmentId =
          body.managerAssignmentId !== undefined
            ? body.managerAssignmentId as string | null
            : existing.managerAssignmentId;

        if (
          body.managerAssignmentId !== undefined &&
          managerAssignmentId !== null &&
          typeof body.managerAssignmentId !== "string"
        ) {
          throw new Error("INVALID_MANAGER");
        }

        if (managerAssignmentId) {
          if (managerAssignmentId === id) {
            throw new Error("INVALID_MANAGER");
          }

          const manager =
            await tx.employeeAssignment.findUnique({
              where: {
                id: managerAssignmentId,
              },
            });

          if (
            !manager ||
            manager.status !== "ACTIVE" ||
            (
              manager.endDate &&
              manager.endDate <= new Date()
            )
          ) {
            throw new Error("INVALID_MANAGER");
          }
        }

        // ==================================
        // بررسی تاریخ‌ها
        // ==================================

        const startDate =
          body.startDate !== undefined
            ? new Date(body.startDate as string)
            : existing.startDate;

        const endDate =
          body.endDate !== undefined
            ? body.endDate === null
              ? null
              : new Date(body.endDate as string)
            : existing.endDate;

        if (endDate && endDate < startDate) {
          throw new Error("INVALID_DATE_RANGE");
        }

        // ==================================
        // تعیین وضعیت مسئولیت اصلی
        // ==================================

        const assignmentType =
          body.assignmentType !== undefined
            ? body.assignmentType as
                | "PRIMARY"
                | "SECONDARY"
                | "TEMPORARY"
                | "PROJECT"
            : existing.assignmentType;

        
const isPrimary: boolean =
  body.isPrimary !== undefined
    ? (body.isPrimary as boolean)
    : body.assignmentType !== undefined
      ? assignmentType === "PRIMARY"
      : existing.isPrimary;


        if (
          isPrimary &&
          assignmentType !== "PRIMARY"
        ) {
          throw new Error("INVALID_PRIMARY_TYPE");
        }

        if (
          !isPrimary &&
          assignmentType === "PRIMARY"
        ) {
          throw new Error("INVALID_PRIMARY_TYPE");
        }

        // جلوگیری از چند مسئولیت اصلی فعال
        const nextStatus =
          body.status !== undefined
            ? body.status as
                | "ACTIVE"
                | "ENDED"
                | "SUSPENDED"
            : existing.status;

        if (
          nextStatus === "ACTIVE" &&
          isPrimary
        ) {
          const existingPrimary =
            await tx.employeeAssignment.findFirst({
              where: {
                userId: existing.userId,
                id: {
                  not: id,
                },
                status: "ACTIVE",
                isPrimary: true,
                OR: [
                  { endDate: null },
                  { endDate: { gt: new Date() } },
                ],
              },
            });

          if (existingPrimary) {
            throw new Error("PRIMARY_EXISTS");
          }
        }

        // ==================================
        // به‌روزرسانی انتصاب
        // ==================================

        const updated =
          await tx.employeeAssignment.update({
            where: { id },

            
data: {
  ...(body.organizationUnitId !== undefined
    ? {
        organizationUnit: {
          connect: {
            id: organizationUnitId,
          },
        },
      }
    : {}),

  ...(body.positionId !== undefined
    ? positionId
      ? {
          position: {
            connect: {
              id: positionId,
            },
          },
        }
      : {
          position: {
            disconnect: true,
          },
        }
    : {}),

  ...(body.responsibilityTitle !== undefined
    ? {
        responsibilityTitle: normalizedTitle,
      }
    : {}),

  ...(body.locationId !== undefined
    ? locationId
      ? {
          location: {
            connect: {
              id: locationId,
            },
          },
        }
      : {
          location: {
            disconnect: true,
          },
        }
    : {}),

  ...(body.managerAssignmentId !== undefined
    ? managerAssignmentId
      ? {
          managerAssignment: {
            connect: {
              id: managerAssignmentId,
            },
          },
        }
      : {
          managerAssignment: {
            disconnect: true,
          },
        }
    : {}),

  ...(body.assignmentType !== undefined ||
  body.isPrimary !== undefined
    ? {
        assignmentType,
        isPrimary,
      }
    : {}),

  ...(body.startDate !== undefined
    ? { startDate }
    : {}),

  ...(body.endDate !== undefined
    ? { endDate }
    : {}),

  ...(body.notes !== undefined
    ? {
        notes: body.notes as string | null,
      }
    : {}),

  ...(body.status !== undefined
    ? { status: nextStatus }
    : {}),
},

          });

        // ==================================
        // ثبت تاریخچه
        // ==================================

        await tx.organizationAssignmentHistory.create({
          data: {
            assignmentId: id,

            action: "ASSIGNMENT_UPDATED",

            previousData: {
              organizationUnitId:
                existing.organizationUnitId,
              positionId: existing.positionId,
              responsibilityTitle:
                existing.responsibilityTitle,
              locationId: existing.locationId,
              managerAssignmentId:
                existing.managerAssignmentId,
              status: existing.status,
              isPrimary: existing.isPrimary,
              assignmentType:
                existing.assignmentType,
              startDate:
                existing.startDate.toISOString(),
              endDate:
                existing.endDate?.toISOString() ?? null,
            },

            newData: {
              organizationUnitId:
                updated.organizationUnitId,
              positionId: updated.positionId,
              responsibilityTitle:
                updated.responsibilityTitle,
              locationId: updated.locationId,
              managerAssignmentId:
                updated.managerAssignmentId,
              status: updated.status,
              isPrimary: updated.isPrimary,
              assignmentType:
                updated.assignmentType,
              startDate:
                updated.startDate.toISOString(),
              endDate:
                updated.endDate?.toISOString() ?? null,
            },

            changedByUserId:
              authorization.user.id,
          },
        });

        // ==================================
        // ثبت گزارش حسابرسی
        // ==================================

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: authorization.user.id,

            entityType: "EmployeeAssignment",

            entityId: id,

            action: "EMPLOYEE_ASSIGNMENT_UPDATED",

            ipAddress: getIp(request),

            beforeData: existing,

            afterData: updated,
          },
        });

        await assertEmployeeShiftCompatibility(tx, existing.userId);
        return updated;
      }
    );

    return successResponse({
      assignment: result,

      message:
        "انتصاب با موفقیت به‌روزرسانی شد.",
    });

  } catch (error) {
    if (error instanceof OrganizationShiftConflictError) return errorResponse(error.message, 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        ASSIGNMENT_NOT_FOUND:
          "انتصاب پیدا نشد.",

        INVALID_UNIT:
          "واحد سازمانی معتبر یا فعال نیست.",

        INVALID_POSITION:
          "سمت سازمانی معتبر یا فعال نیست.",

        INVALID_RESPONSIBILITY:
          "عنوان مسئولیت سفارشی معتبر نیست.",

        INVALID_ASSIGNMENT_TITLE:
          "باید دقیقاً یک سمت رسمی یا عنوان مسئولیت سفارشی انتخاب شود.",

        INVALID_LOCATION:
          "محل سازمانی معتبر یا فعال نیست.",

        INVALID_MANAGER:
          "مسئول بالادستی معتبر نیست.",

        INVALID_DATE_RANGE:
          "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.",

        INVALID_PRIMARY_TYPE:
          "نوع انتصاب و وضعیت مسئولیت اصلی با هم مطابقت ندارند.",

        PRIMARY_EXISTS:
          "این کارمند قبلاً یک مسئولیت اصلی فعال دارد.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "ASSIGNMENT_NOT_FOUND"
            ? 404
            : 400
        );
      }
    }

    const status = getStatus(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "درخواست معتبر نیست.",
        status
      );
    }

    console.error(
      "[ASSIGNMENT_PATCH]",
      error
    );

    return errorResponse(
      "خطا در ویرایش انتصاب.",
      500
    );
  }
}

// ==========================================
// DELETE - END ASSIGNMENT
// ==========================================

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const authorization =
      await authorizeRequest(
        request,
        "organization.assignments.manage"
      );

    const { id } = await context.params;

    const result = await runShiftWrite(
      async (tx) => {
        const existing =
          await tx.employeeAssignment.findUnique({
            where: { id },
          });

        if (!existing) {
          throw new Error("ASSIGNMENT_NOT_FOUND");
        }

        if (existing.status === "ENDED") {
          throw new Error("ASSIGNMENT_ALREADY_ENDED");
        }

        const updated =
          await tx.employeeAssignment.update({
            where: { id },

            data: {
              status: "ENDED",
              endDate: new Date(),
              isPrimary: false,
            },
          });

        await tx.organizationAssignmentHistory.create({
          data: {
            assignmentId: id,

            action: "ASSIGNMENT_ENDED",

            previousData: existing,

            newData: updated,

            changedByUserId:
              authorization.user.id,
          },
        });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: authorization.user.id,

            entityType: "EmployeeAssignment",

            entityId: id,

            action: "EMPLOYEE_ASSIGNMENT_ENDED",

            ipAddress: getIp(request),

            beforeData: existing,

            afterData: updated,
          },
        });

        return updated;
      }
    );

    return successResponse({
      assignment: result,

      message:
        "انتصاب با موفقیت پایان یافت.",
    });

  } catch (error) {
    if (error instanceof OrganizationShiftConflictError) return errorResponse(error.message, 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    if (error instanceof Error) {
      if (
        error.message === "ASSIGNMENT_NOT_FOUND"
      ) {
        return errorResponse(
          "انتصاب پیدا نشد.",
          404
        );
      }

      if (
        error.message === "ASSIGNMENT_ALREADY_ENDED"
      ) {
        return errorResponse(
          "این انتصاب قبلاً پایان یافته است.",
          409
        );
      }
    }

    const status = getStatus(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "درخواست معتبر نیست.",
        status
      );
    }

    console.error(
      "[ASSIGNMENT_DELETE]",
      error
    );

    return errorResponse(
      "خطا در پایان انتصاب.",
      500
    );
  }
}
