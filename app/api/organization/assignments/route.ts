
import { NextRequest } from "next/server";

import {
  EmployeeAssignmentType,
  EmployeeAssignmentStatus,
  UserAccessLevel,
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

class AssignmentError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "AssignmentError";
  }
}

type AssignmentInput = {
  userId: string;
  organizationUnitId: string;
  positionId: string | null;
  responsibilityTitle: string | null;
  locationId: string | null;
  managerAssignmentId: string | null;
  assignmentType: EmployeeAssignmentType;
  startDate: Date;
  endDate: Date | null;
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
      throw new AssignmentError(
        `${field} الزامی است.`
      );
    }

    return null;
  }

  if (typeof value !== "string") {
    throw new AssignmentError(
      `${field} معتبر نیست.`
    );
  }

  const result = value.trim();

  if (!result && required) {
    throw new AssignmentError(
      `${field} الزامی است.`
    );
  }

  return result || null;
}

function readDate(
  value: unknown,
  field: string,
  required = true
): Date | null {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      throw new AssignmentError(
        `${field} الزامی است.`
      );
    }

    return null;
  }

  if (typeof value !== "string") {
    throw new AssignmentError(
      `${field} معتبر نیست.`
    );
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new AssignmentError(
      `${field} معتبر نیست.`
    );
  }

  return date;
}

function getIpAddress(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")
      ?.split(",")[0]
      ?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

function getErrorResponse(error: unknown) {
  if (
    error instanceof AssignmentError ||
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
      "این اطلاعات قبلاً ثبت شده است.",
      409
    );
  }

  console.error(
    "[ORGANIZATION_ASSIGNMENT_ERROR]",
    error
  );

  return errorResponse(
    "خطای داخلی در پردازش انتصاب کارکنان.",
    500
  );
}

// ==========================================
// PARSE INPUT
// ==========================================

function parseAssignmentInput(
  body: Record<string, unknown>
): AssignmentInput {
  const userId = readString(
    body.userId,
    "کارمند"
  )!;

  const organizationUnitId = readString(
    body.organizationUnitId,
    "واحد سازمانی"
  )!;

  const positionId = readString(
    body.positionId,
    "سمت",
    false
  );

  const responsibilityTitle = readString(
    body.responsibilityTitle,
    "عنوان مسئولیت",
    false
  );

  // باید دقیقاً یکی از دو روش انتخاب شود.
  if (
    Boolean(positionId) ===
    Boolean(responsibilityTitle)
  ) {
    throw new AssignmentError(
      "یک سمت رسمی یا یک عنوان مسئولیت سفارشی انتخاب کنید."
    );
  }

  if (
    responsibilityTitle &&
    (
      responsibilityTitle.length < 2 ||
      responsibilityTitle.length > 120
    )
  ) {
    throw new AssignmentError(
      "عنوان مسئولیت باید بین ۲ تا ۱۲۰ کاراکتر باشد."
    );
  }

  const locationId = readString(
    body.locationId,
    "محل خدمت",
    false
  );

  const managerAssignmentId = readString(
    body.managerAssignmentId,
    "مدیر مستقیم",
    false
  );

  const allowedTypes = Object.values(
    EmployeeAssignmentType
  ) as string[];

  const assignmentType =
    body.assignmentType === undefined
      ? EmployeeAssignmentType.PRIMARY
      : body.assignmentType;

  if (
    typeof assignmentType !== "string" ||
    !allowedTypes.includes(assignmentType)
  ) {
    throw new AssignmentError(
      "نوع انتصاب معتبر نیست."
    );
  }

  const isPrimary =
    assignmentType ===
    EmployeeAssignmentType.PRIMARY;

  if (
    body.isPrimary !== undefined &&
    body.isPrimary !== isPrimary
  ) {
    throw new AssignmentError(
      "نوع انتصاب و وضعیت مسئولیت اصلی با هم مطابقت ندارند."
    );
  }

  const startDate = readDate(
    body.startDate,
    "تاریخ شروع"
  )!;

  const endDate = readDate(
    body.endDate,
    "تاریخ پایان",
    false
  );

  if (
    endDate &&
    endDate < startDate
  ) {
    throw new AssignmentError(
      "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
    );
  }

  const notes = readString(
    body.notes,
    "توضیحات",
    false
  );

  if (notes && notes.length > 2000) {
    throw new AssignmentError(
      "توضیحات نمی‌تواند بیشتر از ۲۰۰۰ کاراکتر باشد."
    );
  }

  return {
    userId,
    organizationUnitId,
    positionId,
    responsibilityTitle,
    locationId,
    managerAssignmentId,
    assignmentType:
      assignmentType as EmployeeAssignmentType,
    startDate,
    endDate,
    notes,
  };
}

// ==========================================
// GET - LIST ASSIGNMENTS
// ==========================================

export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(
      request,
      "organization.chart.view"
    );

    const assignments =
      await prisma.employeeAssignment.findMany({
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
              parentId: true,
            },
          },

          position: {
            select: {
              id: true,
              code: true,
              title: true,
              level: true,
              isManagerial: true,
            },
          },

          location: {
            select: {
              id: true,
              code: true,
              name: true,
              city: true,
            },
          },

          managerAssignment: {
            select: {
              id: true,
              user: {
                select: {
                  id: true,
                  fullName: true,
                },
              },
              position: {
                select: {
                  title: true,
                },
              },
              responsibilityTitle: true,
              organizationUnit: {
                select: {
                  name: true,
                },
              },
            },
          },
        },

        orderBy: [
          { isPrimary: "desc" },
          { startDate: "desc" },
          { createdAt: "desc" },
        ],
      });

    return successResponse({
      assignments,
      count: assignments.length,
    });

  } catch (error) {
    return getErrorResponse(error);
  }
}

// ==========================================
// POST - CREATE ASSIGNMENT
// ==========================================

export async function POST(request: NextRequest) {
  try {
    // 1. بررسی مبدأ درخواست
    assertSameOriginRequest(request);

    // 2. بررسی مجوز سراسری مدیریت انتصاب‌ها
    const { user: actor } =
      await authorizeGlobalRequest(
        request,
        "organization.assignments.manage"
      );

    // 3. خواندن اطلاعات
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new AssignmentError(
        "ساختار درخواست معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new AssignmentError(
        "اطلاعات انتصاب معتبر نیست."
      );
    }

    const input =
      parseAssignmentInput(body);

    // 4. بررسی کارمند
    const employee = await prisma.user.findFirst({
      where: {
        id: input.userId,
        isActive: true,
        accessLevel: UserAccessLevel.ERP,
      },

      select: {
        id: true,
        username: true,
        fullName: true,
      },
    });

    if (!employee) {
      throw new AssignmentError(
        "کارمند فعال ERP پیدا نشد.",
        404
      );
    }

    // 5. بررسی واحد سازمانی
    const unit =
      await prisma.organizationUnit.findFirst({
        where: {
          id: input.organizationUnitId,
          status: "ACTIVE",
        },

        select: {
          id: true,
          name: true,
        },
      });

    if (!unit) {
      throw new AssignmentError(
        "واحد سازمانی پیدا نشد یا غیرفعال است.",
        404
      );
    }

    // 6. بررسی سمت رسمی
    if (input.positionId) {
      const position =
        await prisma.organizationPosition.findFirst({
          where: {
            id: input.positionId,
            isActive: true,
          },

          select: {
            id: true,
            title: true,
          },
        });

      if (!position) {
        throw new AssignmentError(
          "سمت انتخاب‌شده پیدا نشد یا غیرفعال است.",
          404
        );
      }
    }

    // 7. بررسی محل خدمت
    if (input.locationId) {
      const location =
        await prisma.organizationLocation.findFirst({
          where: {
            id: input.locationId,
            status: "ACTIVE",
          },

          select: {
            id: true,
          },
        });

      if (!location) {
        throw new AssignmentError(
          "محل خدمت انتخاب‌شده پیدا نشد یا غیرفعال است.",
          404
        );
      }
    }

    // 8. بررسی مدیر مستقیم
    if (input.managerAssignmentId) {
      const manager =
        await prisma.employeeAssignment.findFirst({
          where: {
            id: input.managerAssignmentId,
            status: EmployeeAssignmentStatus.ACTIVE,
            OR: [
              { endDate: null },
              { endDate: { gt: new Date() } },
            ],
          },

          select: {
            id: true,
            userId: true,
          },
        });

      if (!manager) {
        throw new AssignmentError(
          "انتصاب مدیر مستقیم معتبر یا فعال نیست.",
          404
        );
      }

      if (manager.userId === employee.id) {
        throw new AssignmentError(
          "یک کارمند نمی‌تواند مدیر مستقیم مسئولیت خودش باشد."
        );
      }
    }

    // 9. جلوگیری از ثبت چند مسئولیت اصلی فعال
    if (
      input.assignmentType ===
      EmployeeAssignmentType.PRIMARY
    ) {
      const existingPrimary =
        await prisma.employeeAssignment.findFirst({
          where: {
            userId: employee.id,
            status: EmployeeAssignmentStatus.ACTIVE,
            isPrimary: true,

            OR: [
              { endDate: null },
              { endDate: { gt: new Date() } },
            ],
          },

          select: {
            id: true,
            responsibilityTitle: true,
            position: {
              select: {
                title: true,
              },
            },
            organizationUnit: {
              select: {
                name: true,
              },
            },
          },
        });

      if (existingPrimary) {
        const currentTitle =
          existingPrimary.position?.title ||
          existingPrimary.responsibilityTitle ||
          "مسئولیت اصلی قبلی";

        throw new AssignmentError(
          `این کارمند قبلاً مسئولیت اصلی «${currentTitle}» در واحد «${existingPrimary.organizationUnit.name}» را دارد. ابتدا مسئولیت قبلی را تعیین تکلیف کنید.`,
          409
        );
      }
    }

    // 10. ثبت انتصاب و تاریخچه در یک تراکنش
    const created = await prisma.$transaction(
      async (tx) => {
        const assignment =
          await tx.employeeAssignment.create({
            data: {
              userId: input.userId,

              organizationUnitId:
                input.organizationUnitId,

              positionId: input.positionId,

              responsibilityTitle:
                input.responsibilityTitle,

              locationId: input.locationId,

              managerAssignmentId:
                input.managerAssignmentId,

              assignmentType:
                input.assignmentType,

              isPrimary:
                input.assignmentType ===
                EmployeeAssignmentType.PRIMARY,

              status:
                EmployeeAssignmentStatus.ACTIVE,

              startDate: input.startDate,

              endDate: input.endDate,

              notes: input.notes,
            },
          });

        // تاریخچه تغییرات انتصاب
        await tx.organizationAssignmentHistory.create({
          data: {
            assignmentId: assignment.id,

            action: "ASSIGNMENT_CREATED",

            changedByUserId: actor.id,

            newData: {
              userId: input.userId,
              organizationUnitId:
                input.organizationUnitId,
              positionId: input.positionId,
              responsibilityTitle:
                input.responsibilityTitle,
              locationId: input.locationId,
              managerAssignmentId:
                input.managerAssignmentId,
              assignmentType:
                input.assignmentType,
              isPrimary:
                assignment.isPrimary,
              startDate:
                input.startDate.toISOString(),
              endDate:
                input.endDate?.toISOString() ?? null,
            },
          },
        });

        // ثبت گزارش حسابرسی
        await tx.organizationAuditLog.create({
          data: {
            actorUserId: actor.id,

            entityType: "EmployeeAssignment",

            entityId: assignment.id,

            action: "EMPLOYEE_ASSIGNMENT_CREATED",

            ipAddress: getIpAddress(request),

            afterData: {
              userId: input.userId,
              employeeName: employee.fullName,
              organizationUnitId:
                input.organizationUnitId,
              organizationUnitName: unit.name,
              positionId: input.positionId,
              responsibilityTitle:
                input.responsibilityTitle,
              assignmentType:
                input.assignmentType,
              isPrimary:
                assignment.isPrimary,
            },
          },
        });

        return tx.employeeAssignment.findUniqueOrThrow({
          where: {
            id: assignment.id,
          },

          include: {
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },

            organizationUnit: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },

            position: {
              select: {
                id: true,
                title: true,
                code: true,
              },
            },

            location: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        });
      }
    );

    return successResponse(
      {
        assignment: created,
        message:
          "انتصاب کارمند با موفقیت ثبت شد.",
      },
      201
    );

  } catch (error) {
    return getErrorResponse(error);
  }
}
