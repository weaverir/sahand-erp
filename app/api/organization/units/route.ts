
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

import {
  OrganizationUnitStatus,
} from "@/generated/prisma/client";

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function isForeignKeyError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2003"
  );
}

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(
      request,
      "organization.chart.view"
    );

    const { searchParams } = request.nextUrl;

    const parentId = searchParams.get("parentId");
    const status = searchParams.get("status");

    if (
      status &&
      !Object.values(OrganizationUnitStatus).includes(
        status as OrganizationUnitStatus
      )
    ) {
      return errorResponse("وضعیت واحد سازمانی معتبر نیست.", 400);
    }

    const units = await prisma.organizationUnit.findMany({
      where: {
        ...(parentId === "root"
          ? { parentId: null }
          : parentId
            ? { parentId }
            : {}),
        ...(status
          ? { status: status as OrganizationUnitStatus }
          : {}),
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
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
        _count: {
          select: {
            children: true,
            assignments: true,
          },
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    return successResponse({
      units,
      count: units.length,
    });
  } catch (error) {
    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "دسترسی به واحدهای سازمانی امکان‌پذیر نیست.",
        statusCode
      );
    }

    console.error("[ORGANIZATION_UNITS_GET_ERROR]", error);

    return errorResponse(
      "خطا در دریافت واحدهای سازمانی.",
      500
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.units.manage"
    );

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return errorResponse("اطلاعات ارسالی معتبر نیست.", 400);
    }

    const data = body as Record<string, unknown>;

    const allowedFields = new Set([
      "code",
      "name",
      "description",
      "parentId",
      "locationId",
      "status",
      "sortOrder",
    ]);

    for (const key of Object.keys(data)) {
      if (!allowedFields.has(key)) {
        return errorResponse(
          `فیلد غیرمجاز: ${key}`,
          400
        );
      }
    }

    const code =
      typeof data.code === "string"
        ? data.code.trim().toUpperCase()
        : "";

    const name =
      typeof data.name === "string"
        ? data.name.trim()
        : "";

    const description =
      typeof data.description === "string"
        ? data.description.trim() || null
        : null;

    const parentId =
      typeof data.parentId === "string" &&
      data.parentId.trim()
        ? data.parentId.trim()
        : null;

    const locationId =
      typeof data.locationId === "string" &&
      data.locationId.trim()
        ? data.locationId.trim()
        : null;

    const status =
      data.status === undefined
        ? OrganizationUnitStatus.ACTIVE
        : data.status;

    const sortOrder =
      data.sortOrder === undefined
        ? 0
        : data.sortOrder;

    if (
      code.length < 2 ||
      code.length > 50 ||
      !/^[A-Z0-9_-]+$/.test(code)
    ) {
      return errorResponse(
        "کد واحد باید بین ۲ تا ۵۰ کاراکتر و شامل حروف انگلیسی، عدد، خط تیره یا زیرخط باشد.",
        400
      );
    }

    if (name.length < 2 || name.length > 150) {
      return errorResponse(
        "نام واحد باید بین ۲ تا ۱۵۰ کاراکتر باشد.",
        400
      );
    }

    if (
      description !== null &&
      description.length > 1000
    ) {
      return errorResponse(
        "توضیحات نمی‌تواند بیشتر از ۱۰۰۰ کاراکتر باشد.",
        400
      );
    }

    if (
      !Object.values(OrganizationUnitStatus).includes(
        status as OrganizationUnitStatus
      )
    ) {
      return errorResponse(
        "وضعیت واحد سازمانی معتبر نیست.",
        400
      );
    }

    if (
      typeof sortOrder !== "number" ||
      !Number.isSafeInteger(sortOrder) ||
      sortOrder < 0
    ) {
      return errorResponse(
        "ترتیب نمایش باید یک عدد صحیح نامنفی باشد.",
        400
      );
    }

    if (parentId) {
      const parent = await prisma.organizationUnit.findFirst({
        where: {
          id: parentId,
          status: OrganizationUnitStatus.ACTIVE,
        },
        select: { id: true },
      });

      if (!parent) {
        return errorResponse(
          "واحد والد پیدا نشد یا غیرفعال است.",
          404
        );
      }
    }

    if (locationId) {
      const location =
        await prisma.organizationLocation.findFirst({
          where: {
            id: locationId,
            status: "ACTIVE",
          },
          select: { id: true },
        });

      if (!location) {
        return errorResponse(
          "محل فعالیت پیدا نشد یا غیرفعال است.",
          404
        );
      }
    }

    const unit = await prisma.organizationUnit.create({
      data: {
        code,
        name,
        description,
        parentId,
        locationId,
        status: status as OrganizationUnitStatus,
        sortOrder,
      },
      include: {
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
        location: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    await prisma.organizationAuditLog.create({
      data: {
        actorUserId: authorization.user.id,
        entityType: "OrganizationUnit",
        entityId: unit.id,
        action: "ORGANIZATION_UNIT_CREATED",
        afterData: {
          code: unit.code,
          name: unit.name,
          parentId: unit.parentId,
          locationId: unit.locationId,
        },
      },
    });

    return successResponse(
      {
        unit,
        message: "واحد سازمانی با موفقیت ایجاد شد.",
      },
      201
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return errorResponse(
        "کد این واحد قبلاً ثبت شده است.",
        409
      );
    }

    if (isForeignKeyError(error)) {
      return errorResponse(
        "ارتباط با اطلاعات مرجع معتبر نیست.",
        400
      );
    }

    const statusCode =
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "درخواست معتبر نیست.",
        statusCode
      );
    }

    console.error("[ORGANIZATION_UNITS_POST_ERROR]", error);

    return errorResponse(
      "خطا در ایجاد واحد سازمانی.",
      500
    );
  }
}
