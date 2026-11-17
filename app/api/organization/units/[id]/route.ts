
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

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UnitInput = {
  code?: string;
  name?: string;
  description?: string | null;
  locationId?: string | null;
  sortOrder?: number;
  status?: "ACTIVE" | "INACTIVE";
};

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getErrorCode(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

function getStatusCode(error: unknown): number {
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

function getRequestIp(request: NextRequest) {
  return (
    request.headers.get("x-real-ip") ||
    request.headers
      .get("x-forwarded-for")
      ?.split(",")[0]
      .trim() ||
    undefined
  );
}

function validateInput(
  body: Record<string, unknown>
): {
  success: boolean;
  data?: UnitInput;
  message?: string;
} {
  const allowedFields = new Set([
    "code",
    "name",
    "description",
    "locationId",
    "sortOrder",
    "status",
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return {
        success: false,
        message: `فیلد غیرمجاز: ${key}`,
      };
    }
  }

  if (body.code !== undefined) {
    if (
      typeof body.code !== "string" ||
      body.code.trim().length < 2 ||
      body.code.trim().length > 50 ||
      !/^[a-zA-Z0-9_-]+$/.test(body.code.trim())
    ) {
      return {
        success: false,
        message: "کد واحد معتبر نیست.",
      };
    }
  }

  if (body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      body.name.trim().length < 2 ||
      body.name.trim().length > 150
    ) {
      return {
        success: false,
        message: "نام واحد باید بین ۲ تا ۱۵۰ کاراکتر باشد.",
      };
    }
  }

  if (
    body.description !== undefined &&
    body.description !== null &&
    (
      typeof body.description !== "string" ||
      body.description.length > 1000
    )
  ) {
    return {
      success: false,
      message: "توضیحات واحد معتبر نیست.",
    };
  }

  if (
    body.locationId !== undefined &&
    body.locationId !== null &&
    (
      typeof body.locationId !== "string" ||
      !body.locationId.trim()
    )
  ) {
    return {
      success: false,
      message: "شناسه محل سازمانی معتبر نیست.",
    };
  }

  if (
    body.sortOrder !== undefined &&
    (
      typeof body.sortOrder !== "number" ||
      !Number.isSafeInteger(body.sortOrder) ||
      body.sortOrder < 0 ||
      body.sortOrder > 100000
    )
  ) {
    return {
      success: false,
      message: "ترتیب نمایش واحد معتبر نیست.",
    };
  }

  if (
    body.status !== undefined &&
    body.status !== "ACTIVE" &&
    body.status !== "INACTIVE"
  ) {
    return {
      success: false,
      message: "وضعیت واحد معتبر نیست.",
    };
  }

  return {
    success: true,
    data: {
      ...(body.code !== undefined
        ? { code: (body.code as string).trim().toUpperCase() }
        : {}),
      ...(body.name !== undefined
        ? { name: (body.name as string).trim() }
        : {}),
      ...(body.description !== undefined
        ? {
            description:
              typeof body.description === "string"
                ? body.description.trim() || null
                : null,
          }
        : {}),
      ...(body.locationId !== undefined
        ? {
            locationId:
              typeof body.locationId === "string"
                ? body.locationId.trim()
                : null,
          }
        : {}),
      ...(body.sortOrder !== undefined
        ? { sortOrder: body.sortOrder as number }
        : {}),
      ...(body.status !== undefined
        ? { status: body.status as "ACTIVE" | "INACTIVE" }
        : {}),
    },
  };
}

async function getUnit(id: string) {
  return prisma.organizationUnit.findUnique({
    where: { id },
    include: {
      parent: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      children: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
        orderBy: {
          sortOrder: "asc",
        },
      },
      location: {
        select: {
          id: true,
          code: true,
          name: true,
          status: true,
        },
      },
      _count: {
        select: {
          assignments: true,
          children: true,
        },
      },
    },
  });
}

// =====================================================
// GET: دریافت جزئیات واحد سازمانی
// =====================================================

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await authorizeRequest(
      request,
      "organization.chart.view"
    );

    const { id } = await context.params;

    if (!id?.trim()) {
      return errorResponse("شناسه واحد معتبر نیست.", 400);
    }

    const unit = await getUnit(id);

    if (!unit) {
      return errorResponse("واحد موردنظر پیدا نشد.", 404);
    }

    return successResponse({ unit });

  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "دریافت اطلاعات واحد امکان‌پذیر نیست.",
        statusCode
      );
    }

    console.error("[ORGANIZATION_UNIT_GET_ERROR]", error);

    return errorResponse(
      "خطا در دریافت اطلاعات واحد سازمانی.",
      500
    );
  }
}

// =====================================================
// PATCH: ویرایش واحد سازمانی
// =====================================================

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.units.manage"
    );

    const { id } = await context.params;

    if (!id?.trim()) {
      return errorResponse("شناسه واحد معتبر نیست.", 400);
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "ساختار اطلاعات ارسالی معتبر نیست.",
        400
      );
    }

    if (!isObject(body)) {
      return errorResponse("اطلاعات واحد معتبر نیست.", 400);
    }

    const validation = validateInput(body);

    if (!validation.success || !validation.data) {
      return errorResponse(
        validation.message || "اطلاعات واحد معتبر نیست.",
        400
      );
    }

    const data = validation.data;

    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.organizationUnit.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("UNIT_NOT_FOUND");
      }

      // غیرفعال‌سازی فقط زمانی مجاز است که
      // زیرواحد فعال یا انتصاب فعال وجود نداشته باشد.

      if (data.status === "INACTIVE") {
        const now = new Date();

        const [activeChildren, activeAssignments] =
          await Promise.all([
            tx.organizationUnit.count({
              where: {
                parentId: id,
                status: "ACTIVE",
              },
            }),

            tx.employeeAssignment.count({
              where: {
                organizationUnitId: id,
                status: "ACTIVE",
                OR: [
                  { endDate: null },
                  { endDate: { gt: now } },
                ],
              },
            }),
          ]);

        if (activeChildren > 0) {
          throw new Error("UNIT_HAS_ACTIVE_CHILDREN");
        }

        if (activeAssignments > 0) {
          throw new Error("UNIT_HAS_ACTIVE_ASSIGNMENTS");
        }
      }

      const changes = {
        ...(data.code !== undefined
          ? { code: data.code }
          : {}),
        ...(data.name !== undefined
          ? { name: data.name }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.locationId !== undefined
          ? { locationId: data.locationId }
          : {}),
        ...(data.sortOrder !== undefined
          ? { sortOrder: data.sortOrder }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status }
          : {}),
      };

      const unit = await tx.organizationUnit.update({
        where: { id },
        data: changes,
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationUnit",
          entityId: unit.id,
          action:
            data.status === "INACTIVE"
              ? "ORGANIZATION_UNIT_DEACTIVATED"
              : "ORGANIZATION_UNIT_UPDATED",
          ipAddress: getRequestIp(request),
          beforeData: {
            code: existing.code,
            name: existing.name,
            description: existing.description,
            locationId: existing.locationId,
            sortOrder: existing.sortOrder,
            status: existing.status,
          },
          afterData: {
            code: unit.code,
            name: unit.name,
            description: unit.description,
            locationId: unit.locationId,
            sortOrder: unit.sortOrder,
            status: unit.status,
          },
        },
      });

      return unit;
    });

    return successResponse({
      unit: updated,
      message: "اطلاعات واحد سازمانی با موفقیت به‌روزرسانی شد.",
    });

  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        UNIT_NOT_FOUND: "واحد موردنظر پیدا نشد.",
        UNIT_HAS_ACTIVE_CHILDREN:
          "ابتدا باید زیرواحدهای فعال را تعیین تکلیف کنید.",
        UNIT_HAS_ACTIVE_ASSIGNMENTS:
          "این واحد دارای انتصاب فعال است و فعلاً قابل غیرفعال‌سازی نیست.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "UNIT_NOT_FOUND" ? 404 : 409
        );
      }
    }

    const code = getErrorCode(error);

    if (code === "P2002") {
      return errorResponse(
        "کد این واحد قبلاً ثبت شده است.",
        409
      );
    }

    if (code === "P2003" || code === "P2025") {
      return errorResponse(
        "اطلاعات وابسته به واحد معتبر نیست.",
        409
      );
    }

    const statusCode = getStatusCode(error);

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "درخواست معتبر نیست.",
        statusCode
      );
    }

    console.error("[ORGANIZATION_UNIT_PATCH_ERROR]", error);

    return errorResponse(
      "خطا در ویرایش واحد سازمانی.",
      500
    );
  }
}

// =====================================================
// DELETE: غیرفعال‌سازی امن واحد سازمانی
// =====================================================

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.units.manage"
    );

    const { id } = await context.params;

    if (!id?.trim()) {
      return errorResponse("شناسه واحد معتبر نیست.", 400);
    }

    const unit = await prisma.$transaction(async (tx) => {
      const existing = await tx.organizationUnit.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("UNIT_NOT_FOUND");
      }

      if (existing.status === "INACTIVE") {
        throw new Error("UNIT_ALREADY_INACTIVE");
      }

      const now = new Date();

      const [activeChildren, activeAssignments] =
        await Promise.all([
          tx.organizationUnit.count({
            where: {
              parentId: id,
              status: "ACTIVE",
            },
          }),

          tx.employeeAssignment.count({
            where: {
              organizationUnitId: id,
              status: "ACTIVE",
              OR: [
                { endDate: null },
                { endDate: { gt: now } },
              ],
            },
          }),
        ]);

      if (activeChildren > 0) {
        throw new Error("UNIT_HAS_ACTIVE_CHILDREN");
      }

      if (activeAssignments > 0) {
        throw new Error("UNIT_HAS_ACTIVE_ASSIGNMENTS");
      }

      const updated = await tx.organizationUnit.update({
        where: { id },
        data: {
          status: "INACTIVE",
        },
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationUnit",
          entityId: updated.id,
          action: "ORGANIZATION_UNIT_DEACTIVATED",
          ipAddress: getRequestIp(request),
          beforeData: {
            code: existing.code,
            name: existing.name,
            status: existing.status,
          },
          afterData: {
            code: updated.code,
            name: updated.name,
            status: updated.status,
          },
        },
      });

      return updated;
    });

    return successResponse({
      unit,
      message: "واحد سازمانی با موفقیت غیرفعال شد.",
    });

  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        UNIT_NOT_FOUND: "واحد موردنظر پیدا نشد.",
        UNIT_ALREADY_INACTIVE: "این واحد قبلاً غیرفعال شده است.",
        UNIT_HAS_ACTIVE_CHILDREN:
          "ابتدا باید زیرواحدهای فعال را تعیین تکلیف کنید.",
        UNIT_HAS_ACTIVE_ASSIGNMENTS:
          "این واحد دارای انتصاب فعال است و قابل غیرفعال‌سازی نیست.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "UNIT_NOT_FOUND" ? 404 : 409
        );
      }
    }

    const statusCode = getStatusCode(error);

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "درخواست معتبر نیست.",
        statusCode
      );
    }

    console.error("[ORGANIZATION_UNIT_DELETE_ERROR]", error);

    return errorResponse(
      "خطا در غیرفعال‌سازی واحد سازمانی.",
      500
    );
  }
}
