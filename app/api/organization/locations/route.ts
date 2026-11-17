
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
];

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(request, "organization.chart.view");

    const locations = await prisma.organizationLocation.findMany({
      include: {
        _count: {
          select: {
            units: true,
            assignments: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    return successResponse({
      locations,
      count: locations.length,
    });
  } catch (error) {
    const status = getStatusCode(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "دسترسی مجاز نیست.",
        status
      );
    }

    console.error("[ORGANIZATION_LOCATIONS_GET]", error);
    return errorResponse("خطا در دریافت محل‌های سازمانی.", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.locations.manage"
    );

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse("ساختار اطلاعات ارسالی معتبر نیست.", 400);
    }

    if (!isObject(body)) {
      return errorResponse("اطلاعات محل معتبر نیست.", 400);
    }

    if (Object.keys(body).some(key => !allowedFields.includes(key))) {
      return errorResponse("فیلد غیرمجاز در درخواست وجود دارد.", 400);
    }

    for (const field of ["code", "name", "locationType"]) {
      const value = body[field];

      if (
        typeof value !== "string" ||
        value.trim().length < 2 ||
        value.trim().length > 150
      ) {
        return errorResponse(`فیلد ${field} معتبر نیست.`, 400);
      }
    }

    const optionalFields = [
      "description", "country", "province",
      "city", "address", "phone",
    ];

    for (const field of optionalFields) {
      const value = body[field];

      if (
        value !== undefined &&
        value !== null &&
        typeof value !== "string"
      ) {
        return errorResponse(`مقدار ${field} معتبر نیست.`, 400);
      }
    }

    const data = {
      code: (body.code as string).trim().toUpperCase(),
      name: (body.name as string).trim(),
      locationType: (body.locationType as string).trim(),
      description: typeof body.description === "string"
        ? body.description.trim() || null : null,
      country: typeof body.country === "string"
        ? body.country.trim() || null : null,
      province: typeof body.province === "string"
        ? body.province.trim() || null : null,
      city: typeof body.city === "string"
        ? body.city.trim() || null : null,
      address: typeof body.address === "string"
        ? body.address.trim() || null : null,
      phone: typeof body.phone === "string"
        ? body.phone.trim() || null : null,
    };

    const location = await prisma.$transaction(async tx => {
      const created = await tx.organizationLocation.create({
        data,
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationLocation",
          entityId: created.id,
          action: "ORGANIZATION_LOCATION_CREATED",
          ipAddress: getIp(request),
          afterData: data,
        },
      });

      return created;
    });

    return successResponse({
      location,
      message: "محل سازمانی با موفقیت ایجاد شد.",
    });
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? error.code : null;

    if (code === "P2002") {
      return errorResponse("کد محل قبلاً ثبت شده است.", 409);
    }

    const status = getStatusCode(error);

    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست معتبر نیست.",
        status
      );
    }

    console.error("[ORGANIZATION_LOCATIONS_POST]", error);
    return errorResponse("خطا در ایجاد محل سازمانی.", 500);
  }
}
