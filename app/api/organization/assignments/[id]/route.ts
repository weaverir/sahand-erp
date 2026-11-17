
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
  ) return error.statusCode;

  return 500;
}

function getIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    undefined
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    await authorizeRequest(request, "organization.chart.view");

    const { id } = await context.params;

    const assignment = await prisma.employeeAssignment.findUnique({
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
          },
        },
        roles: {
          include: { role: true },
        },
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!assignment) {
      return errorResponse("انتصاب پیدا نشد.", 404);
    }

    return successResponse({ assignment });
  } catch (error) {
    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "دسترسی مجاز نیست.",
        status
      );
    }

    console.error("[ASSIGNMENT_GET]", error);
    return errorResponse("خطا در دریافت انتصاب.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.assignments.manage"
    );

    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("اطلاعات ارسالی معتبر نیست.", 400);
    }

    if (!isObject(body)) {
      return errorResponse("ساختار اطلاعات معتبر نیست.", 400);
    }

    const allowed = [
      "organizationUnitId",
      "positionId",
      "locationId",
      "managerAssignmentId",
      "assignmentType",
      "isPrimary",
      "startDate",
      "endDate",
      "notes",
      "status",
    ];

    if (Object.keys(body).some(key => !allowed.includes(key))) {
      return errorResponse("فیلد غیرمجاز ارسال شده است.", 400);
    }

    if (
      body.isPrimary !== undefined &&
      typeof body.isPrimary !== "boolean"
    ) {
      return errorResponse("مقدار انتصاب اصلی معتبر نیست.", 400);
    }

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== "string"
    ) {
      return errorResponse("یادداشت معتبر نیست.", 400);
    }

    const dateFields = ["startDate", "endDate"];

    for (const field of dateFields) {
      if (body[field] === undefined || body[field] === null) continue;

      if (
        typeof body[field] !== "string" ||
        Number.isNaN(Date.parse(body[field] as string))
      ) {
        return errorResponse(`تاریخ ${field} معتبر نیست.`, 400);
      }
    }

    if (
      body.status !== undefined &&
      !["ACTIVE", "ENDED", "SUSPENDED"].includes(body.status as string)
    ) {
      return errorResponse("وضعیت انتصاب معتبر نیست.", 400);
    }

    if (
      body.assignmentType !== undefined &&
      !["PRIMARY", "SECONDARY", "TEMPORARY", "PROJECT"].includes(
        body.assignmentType as string
      )
    ) {
      return errorResponse("نوع انتصاب معتبر نیست.", 400);
    }

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.employeeAssignment.findUnique({
        where: { id },
      });

      if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");

      const organizationUnitId =
        body.organizationUnitId !== undefined
          ? body.organizationUnitId as string
          : existing.organizationUnitId;

      const positionId =
        body.positionId !== undefined
          ? body.positionId as string
          : existing.positionId;

      const locationId =
        body.locationId !== undefined
          ? body.locationId as string | null
          : existing.locationId;

      if (
        body.organizationUnitId !== undefined &&
        typeof body.organizationUnitId !== "string"
      ) {
        throw new Error("INVALID_UNIT");
      }

      if (
        body.positionId !== undefined &&
        typeof body.positionId !== "string"
      ) {
        throw new Error("INVALID_POSITION");
      }

      if (body.locationId !== undefined &&
          body.locationId !== null &&
          typeof body.locationId !== "string") {
        throw new Error("INVALID_LOCATION");
      }

      const [unit, position, location] = await Promise.all([
        tx.organizationUnit.findUnique({
          where: { id: organizationUnitId },
        }),
        tx.organizationPosition.findUnique({
          where: { id: positionId },
        }),
        locationId
          ? tx.organizationLocation.findUnique({
              where: { id: locationId },
            })
          : Promise.resolve(null),
      ]);

      if (!unit || unit.status !== "ACTIVE") {
        throw new Error("INVALID_UNIT");
      }

      if (!position || !position.isActive) {
        throw new Error("INVALID_POSITION");
      }

      if (locationId && (!location || location.status !== "ACTIVE")) {
        throw new Error("INVALID_LOCATION");
      }

      const managerAssignmentId =
        body.managerAssignmentId !== undefined
          ? body.managerAssignmentId as string | null
          : existing.managerAssignmentId;

      if (managerAssignmentId) {
        if (managerAssignmentId === id) {
          throw new Error("INVALID_MANAGER");
        }

        const manager = await tx.employeeAssignment.findUnique({
          where: { id: managerAssignmentId },
        });

        if (!manager || manager.status !== "ACTIVE") {
          throw new Error("INVALID_MANAGER");
        }
      }

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

      const makePrimary =
        body.isPrimary === true ||
        body.assignmentType === "PRIMARY";

      if (
        existing.status === "ACTIVE" &&
        makePrimary
      ) {
        await tx.employeeAssignment.updateMany({
          where: {
            userId: existing.userId,
            id: { not: id },
            status: "ACTIVE",
            isPrimary: true,
          },
          data: {
            isPrimary: false,
            assignmentType: "SECONDARY",
          },
        });
      }

      const updated = await tx.employeeAssignment.update({
        where: { id },
        data: {
          ...(body.organizationUnitId !== undefined
            ? { organizationUnitId }
            : {}),
          ...(body.positionId !== undefined
            ? { positionId }
            : {}),
          ...(body.locationId !== undefined
            ? { locationId }
            : {}),
          ...(body.managerAssignmentId !== undefined
            ? { managerAssignmentId }
            : {}),
          ...(body.assignmentType !== undefined
            ? { assignmentType: body.assignmentType as
                "PRIMARY" | "SECONDARY" | "TEMPORARY" | "PROJECT" }
            : {}),
          ...(body.isPrimary !== undefined
            ? { isPrimary: body.isPrimary as boolean }
            : {}),
          ...(body.startDate !== undefined
            ? { startDate }
            : {}),
          ...(body.endDate !== undefined
            ? { endDate }
            : {}),
          ...(body.notes !== undefined
            ? { notes: body.notes as string | null }
            : {}),
          ...(body.status !== undefined
            ? { status: body.status as
                "ACTIVE" | "ENDED" | "SUSPENDED" }
            : {}),
        },
      });

      await tx.organizationAssignmentHistory.create({
        data: {
          assignmentId: id,
          action: "ASSIGNMENT_UPDATED",
          previousData: {
            organizationUnitId: existing.organizationUnitId,
            positionId: existing.positionId,
            locationId: existing.locationId,
            managerAssignmentId: existing.managerAssignmentId,
            status: existing.status,
            isPrimary: existing.isPrimary,
          },
          newData: {
            organizationUnitId: updated.organizationUnitId,
            positionId: updated.positionId,
            locationId: updated.locationId,
            managerAssignmentId: updated.managerAssignmentId,
            status: updated.status,
            isPrimary: updated.isPrimary,
          },
          changedByUserId: authorization.user.id,
        },
      });

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

      return updated;
    });

    return successResponse({
      assignment: result,
      message: "انتصاب با موفقیت به‌روزرسانی شد.",
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        ASSIGNMENT_NOT_FOUND: "انتصاب پیدا نشد.",
        INVALID_UNIT: "واحد سازمانی معتبر یا فعال نیست.",
        INVALID_POSITION: "سمت سازمانی معتبر یا فعال نیست.",
        INVALID_LOCATION: "محل سازمانی معتبر یا فعال نیست.",
        INVALID_MANAGER: "مسئول بالادستی معتبر نیست.",
        INVALID_DATE_RANGE: "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "ASSIGNMENT_NOT_FOUND" ? 404 : 400
        );
      }
    }

    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ASSIGNMENT_PATCH]", error);
    return errorResponse("خطا در ویرایش انتصاب.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.assignments.manage"
    );

    const { id } = await context.params;

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.employeeAssignment.findUnique({
        where: { id },
      });

      if (!existing) throw new Error("ASSIGNMENT_NOT_FOUND");

      if (existing.status === "ENDED") {
        throw new Error("ASSIGNMENT_ALREADY_ENDED");
      }

      const updated = await tx.employeeAssignment.update({
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
          changedByUserId: authorization.user.id,
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
    });

    return successResponse({
      assignment: result,
      message: "انتصاب با موفقیت پایان یافت.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "ASSIGNMENT_NOT_FOUND") {
        return errorResponse("انتصاب پیدا نشد.", 404);
      }
      if (error.message === "ASSIGNMENT_ALREADY_ENDED") {
        return errorResponse("این انتصاب قبلاً پایان یافته است.", 409);
      }
    }

    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ASSIGNMENT_DELETE]", error);
    return errorResponse("خطا در پایان انتصاب.", 500);
  }
}
