import { assertEmployeeShiftCompatibility, OrganizationShiftConflictError, assertTransferShiftResolved } from "@/modules/shifts/organization-shift-guard";
import { runShiftWrite } from "@/modules/shifts/shift-write-transaction";

import { NextRequest } from "next/server";
import { prisma } from "@/libs/prisma";
import { Prisma } from "@/generated/prisma/client";
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

export async function POST(
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
      "startDate",
      "notes",
    ];

    if (Object.keys(body).some(key => !allowed.includes(key))) {
      return errorResponse("فیلد غیرمجاز ارسال شده است.", 400);
    }

    if (
      typeof body.organizationUnitId !== "string" ||
      typeof body.positionId !== "string"
    ) {
      return errorResponse(
        "واحد و سمت جدید الزامی هستند.",
        400
      );
    }

    const startDate =
      body.startDate === undefined
        ? new Date()
        : typeof body.startDate === "string" &&
          !Number.isNaN(Date.parse(body.startDate))
          ? new Date(body.startDate)
          : null;

    if (!startDate) {
      return errorResponse("تاریخ شروع معتبر نیست.", 400);
    }

    const assignmentType =
      body.assignmentType === undefined
        ? "PRIMARY"
        : body.assignmentType;

    if (
      !["PRIMARY", "SECONDARY", "TEMPORARY", "PROJECT"].includes(
        assignmentType as string
      )
    ) {
      return errorResponse("نوع انتصاب معتبر نیست.", 400);
    }

    if (
      body.locationId !== undefined &&
      body.locationId !== null &&
      typeof body.locationId !== "string"
    ) {
      return errorResponse("محل جدید معتبر نیست.", 400);
    }

    if (
      body.managerAssignmentId !== undefined &&
      body.managerAssignmentId !== null &&
      typeof body.managerAssignmentId !== "string"
    ) {
      return errorResponse("مسئول بالادستی معتبر نیست.", 400);
    }

    if (
      body.notes !== undefined &&
      body.notes !== null &&
      typeof body.notes !== "string"
    ) {
      return errorResponse("یادداشت معتبر نیست.", 400);
    }

    const result = await runShiftWrite(async tx => {
      const previous = await tx.employeeAssignment.findUnique({
        where: { id },
      });

      if (!previous) throw new Error("ASSIGNMENT_NOT_FOUND");

      if (previous.status !== "ACTIVE") {
        throw new Error("ASSIGNMENT_NOT_ACTIVE");
      }

      if (startDate < previous.startDate) {
        throw new Error("INVALID_TRANSFER_DATE");
      }

      const [unit, position, location] = await Promise.all([
        tx.organizationUnit.findUnique({
          where: { id: body.organizationUnitId as string },
        }),
        tx.organizationPosition.findUnique({
          where: { id: body.positionId as string },
        }),
        body.locationId
          ? tx.organizationLocation.findUnique({
              where: { id: body.locationId as string },
            })
          : Promise.resolve(null),
      ]);

      if (!unit || unit.status !== "ACTIVE") {
        throw new Error("INVALID_UNIT");
      }

      if (!position || !position.isActive) {
        throw new Error("INVALID_POSITION");
      }

      if (body.locationId && (!location || location.status !== "ACTIVE")) {
        throw new Error("INVALID_LOCATION");
      }

      const managerAssignmentId =
        body.managerAssignmentId === undefined
          ? null
          : body.managerAssignmentId as string | null;

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

      if (assignmentType === "PRIMARY") {
        await tx.employeeAssignment.updateMany({
          where: {
            userId: previous.userId,
            status: "ACTIVE",
            isPrimary: true,
          },
          data: {
            isPrimary: false,
            assignmentType: "SECONDARY",
          },
        });
      }

      await assertTransferShiftResolved(tx, id, startDate);

      const endedPrevious = await tx.employeeAssignment.update({
        where: { id },
        data: {
          status: "ENDED",
          endDate: startDate,
          isPrimary: false,
        },
      });

      const created = await tx.employeeAssignment.create({
        data: {
          userId: previous.userId,
          organizationUnitId: body.organizationUnitId as string,
          positionId: body.positionId as string,
          locationId: body.locationId as string | null | undefined,
          managerAssignmentId,
          assignmentType: assignmentType as
            "PRIMARY" | "SECONDARY" | "TEMPORARY" | "PROJECT",
          isPrimary: assignmentType === "PRIMARY",
          startDate,
          notes: body.notes as string | null | undefined,
          status: "ACTIVE",
        },
      });

      await assertEmployeeShiftCompatibility(tx, created.userId);

      await tx.organizationAssignmentHistory.createMany({
        data: [
          {
            assignmentId: id,
            action: "ASSIGNMENT_TRANSFERRED_OUT",
            previousData: previous,
            newData: endedPrevious,
            changedByUserId: authorization.user.id,
          },
          {
  assignmentId: created.id,
  action: "ASSIGNMENT_TRANSFERRED_IN",
  previousData: Prisma.DbNull,
  newData: created,
  changedByUserId: authorization.user.id,
},
        ],
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "EmployeeAssignment",
          entityId: id,
          action: "EMPLOYEE_ASSIGNMENT_TRANSFERRED",
          ipAddress: getIp(request),
          beforeData: previous,
          afterData: {
            endedAssignment: endedPrevious,
            newAssignment: created,
          },
        },
      });

      return {
        previous: endedPrevious,
        current: created,
      };
    });

    return successResponse({
      ...result,
      message: "انتقال سازمانی با موفقیت انجام شد.",
    });
  } catch (error) {
    if (error instanceof OrganizationShiftConflictError) return errorResponse(error.message, 409);
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return errorResponse("اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.", 409);
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        ASSIGNMENT_NOT_FOUND: "انتصاب قبلی پیدا نشد.",
        ASSIGNMENT_NOT_ACTIVE: "انتصاب قبلی فعال نیست.",
        INVALID_TRANSFER_DATE:
          "تاریخ انتقال نمی‌تواند قبل از شروع انتصاب قبلی باشد.",
        INVALID_UNIT: "واحد جدید معتبر یا فعال نیست.",
        INVALID_POSITION: "سمت جدید معتبر یا فعال نیست.",
        INVALID_LOCATION: "محل جدید معتبر یا فعال نیست.",
        INVALID_MANAGER: "مسئول بالادستی معتبر نیست.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "ASSIGNMENT_NOT_FOUND" ? 404 : 400
        );
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2034"
    ) {
      return errorResponse(
        "اطلاعات هم‌زمان تغییر کرده است. دوباره تلاش کنید.",
        409
      );
    }

    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ASSIGNMENT_TRANSFER]", error);
    return errorResponse("خطا در انتقال انتصاب.", 500);
  }
}
