
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

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getStatusCode(error: unknown): number {
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

const allowedFields = [
  "code", "name", "locationType", "description",
  "country", "province", "city", "address", "phone",
  "status",
];

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    await authorizeRequest(request, "organization.chart.view");

    const { id } = await context.params;

    const location = await prisma.organizationLocation.findUnique({
      where: { id },
      include: {
        units: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
          orderBy: { name: "asc" },
        },
        _count: {
          select: {
            units: true,
            assignments: true,
          },
        },
      },
    });

    if (!location) {
      return errorResponse("محل سازمانی پیدا نشد.", 404);
    }

    return successResponse({ location });
  } catch (error) {
    const status = getStatusCode(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "دسترسی مجاز نیست.",
        status
      );
    }

    console.error("[ORGANIZATION_LOCATION_GET]", error);
    return errorResponse("خطا در دریافت محل سازمانی.", 500);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.locations.manage"
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

    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
      return errorResponse("فیلد غیرمجاز در درخواست وجود دارد.", 400);
    }

    if (Object.keys(body).length === 0) {
      return errorResponse("اطلاعاتی برای ویرایش ارسال نشده است.", 400);
    }

    for (const field of ["code", "name", "locationType"]) {
      if (body[field] === undefined) continue;

      if (
        typeof body[field] !== "string" ||
        (body[field] as string).trim().length < 2 ||
        (body[field] as string).trim().length > 150
      ) {
        return errorResponse(`فیلد ${field} معتبر نیست.`, 400);
      }
    }

    const optionalFields = [
      "description", "country", "province",
      "city", "address", "phone",
    ];

    for (const field of optionalFields) {
      if (
        body[field] !== undefined &&
        body[field] !== null &&
        typeof body[field] !== "string"
      ) {
        return errorResponse(`مقدار ${field} معتبر نیست.`, 400);
      }
    }

    if (
      body.status !== undefined &&
      body.status !== "ACTIVE" &&
      body.status !== "INACTIVE"
    ) {
      return errorResponse("وضعیت محل معتبر نیست.", 400);
    }

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.organizationLocation.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("LOCATION_NOT_FOUND");
      }

      if (body.status === "INACTIVE") {
        const now = new Date();

        const [activeUnits, activeAssignments] = await Promise.all([
          tx.organizationUnit.count({
            where: {
              locationId: id,
              status: "ACTIVE",
            },
          }),
          tx.employeeAssignment.count({
            where: {
              locationId: id,
              status: "ACTIVE",
              OR: [
                { endDate: null },
                { endDate: { gt: now } },
              ],
            },
          }),
        ]);

        if (activeUnits > 0 || activeAssignments > 0) {
          throw new Error("LOCATION_IN_USE");
        }
      }

      const data = {
        ...(body.code !== undefined
          ? { code: (body.code as string).trim().toUpperCase() }
          : {}),
        ...(body.name !== undefined
          ? { name: (body.name as string).trim() }
          : {}),
        ...(body.locationType !== undefined
          ? { locationType: (body.locationType as string).trim() }
          : {}),
        ...Object.fromEntries(
          optionalFields
            .filter(field => body[field] !== undefined)
            .map(field => [
              field,
              typeof body[field] === "string"
                ? (body[field] as string).trim() || null
                : null,
            ])
        ),
        ...(body.status !== undefined
          ? { status: body.status as "ACTIVE" | "INACTIVE" }
          : {}),
      };

      const updated = await tx.organizationLocation.update({
        where: { id },
        data,
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationLocation",
          entityId: id,
          action: body.status === "INACTIVE"
            ? "ORGANIZATION_LOCATION_DEACTIVATED"
            : body.status === "ACTIVE"
              ? "ORGANIZATION_LOCATION_ACTIVATED"
              : "ORGANIZATION_LOCATION_UPDATED",
          ipAddress: getIp(request),
          beforeData: existing,
          afterData: updated,
        },
      });

      return updated;
    });

    return successResponse({
      location: result,
      message: "محل سازمانی با موفقیت به‌روزرسانی شد.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "LOCATION_NOT_FOUND") {
        return errorResponse("محل سازمانی پیدا نشد.", 404);
      }

      if (error.message === "LOCATION_IN_USE") {
        return errorResponse(
          "این محل دارای واحد یا انتصاب فعال است.",
          409
        );
      }
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return errorResponse("کد محل قبلاً ثبت شده است.", 409);
    }

    const status = getStatusCode(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ORGANIZATION_LOCATION_PATCH]", error);
    return errorResponse("خطا در ویرایش محل سازمانی.", 500);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.locations.manage"
    );

    const { id } = await context.params;

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.organizationLocation.findUnique({
        where: { id },
      });

      if (!existing) {
        throw new Error("LOCATION_NOT_FOUND");
      }

      if (existing.status === "INACTIVE") {
        throw new Error("LOCATION_ALREADY_INACTIVE");
      }

      const now = new Date();

      const [activeUnits, activeAssignments] = await Promise.all([
        tx.organizationUnit.count({
          where: {
            locationId: id,
            status: "ACTIVE",
          },
        }),
        tx.employeeAssignment.count({
          where: {
            locationId: id,
            status: "ACTIVE",
            OR: [
              { endDate: null },
              { endDate: { gt: now } },
            ],
          },
        }),
      ]);

      if (activeUnits > 0 || activeAssignments > 0) {
        throw new Error("LOCATION_IN_USE");
      }

      const updated = await tx.organizationLocation.update({
        where: { id },
        data: { status: "INACTIVE" },
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationLocation",
          entityId: id,
          action: "ORGANIZATION_LOCATION_DEACTIVATED",
          ipAddress: getIp(request),
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
      location: result,
      message: "محل سازمانی غیرفعال شد.",
    });
  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        LOCATION_NOT_FOUND: "محل سازمانی پیدا نشد.",
        LOCATION_ALREADY_INACTIVE: "محل قبلاً غیرفعال شده است.",
        LOCATION_IN_USE:
          "این محل دارای واحد یا انتصاب فعال است و قابل غیرفعال‌سازی نیست.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "LOCATION_NOT_FOUND" ? 404 : 409
        );
      }
    }

    const status = getStatusCode(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ORGANIZATION_LOCATION_DELETE]", error);
    return errorResponse("خطا در غیرفعال‌سازی محل.", 500);
  }
}
