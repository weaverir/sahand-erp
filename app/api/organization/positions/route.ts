
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

type PositionInput = {
  id?: string;
  code?: string;
  title?: string;
  description?: string | null;
  level?: number;
  isManagerial?: boolean;
  isActive?: boolean;
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

function validatePositionInput(
  body: Record<string, unknown>,
  partial = false
): {
  success: boolean;
  data?: PositionInput;
  message?: string;
} {
  const allowedFields = new Set([
    "id",
    "code",
    "title",
    "description",
    "level",
    "isManagerial",
    "isActive",
  ]);

  for (const key of Object.keys(body)) {
    if (!allowedFields.has(key)) {
      return {
        success: false,
        message: `فیلد غیرمجاز: ${key}`,
      };
    }
  }

  if (!partial || body.code !== undefined) {
    if (
      typeof body.code !== "string" ||
      body.code.trim().length < 2 ||
      body.code.trim().length > 50 ||
      !/^[a-zA-Z0-9_-]+$/.test(body.code.trim())
    ) {
      return {
        success: false,
        message: "کد سمت معتبر نیست.",
      };
    }
  }

  if (!partial || body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      body.title.trim().length < 2 ||
      body.title.trim().length > 150
    ) {
      return {
        success: false,
        message: "عنوان سمت باید بین ۲ تا ۱۵۰ کاراکتر باشد.",
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
      message: "توضیحات سمت معتبر نیست.",
    };
  }

  if (
    body.level !== undefined &&
    (
      typeof body.level !== "number" ||
      !Number.isSafeInteger(body.level) ||
      body.level < 1 ||
      body.level > 100
    )
  ) {
    return {
      success: false,
      message: "سطح سمت باید عدد صحیح بین ۱ تا ۱۰۰ باشد.",
    };
  }

  if (
    body.isManagerial !== undefined &&
    typeof body.isManagerial !== "boolean"
  ) {
    return {
      success: false,
      message: "مقدار مدیریتی بودن سمت معتبر نیست.",
    };
  }

  if (
    body.isActive !== undefined &&
    typeof body.isActive !== "boolean"
  ) {
    return {
      success: false,
      message: "وضعیت سمت معتبر نیست.",
    };
  }

  return {
    success: true,
    data: {
      ...(body.id !== undefined
        ? { id: body.id as string }
        : {}),
      ...(body.code !== undefined
        ? { code: (body.code as string).trim().toUpperCase() }
        : {}),
      ...(body.title !== undefined
        ? { title: (body.title as string).trim() }
        : {}),
      ...(body.description !== undefined
        ? {
            description:
              typeof body.description === "string"
                ? body.description.trim() || null
                : null,
          }
        : {}),
      ...(body.level !== undefined
        ? { level: body.level as number }
        : {}),
      ...(body.isManagerial !== undefined
        ? { isManagerial: body.isManagerial as boolean }
        : {}),
      ...(body.isActive !== undefined
        ? { isActive: body.isActive as boolean }
        : {}),
    },
  };
}

// =====================================================
// GET: دریافت فهرست سمت‌ها
// =====================================================

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(
      request,
      "organization.chart.view"
    );

    const params = request.nextUrl.searchParams;

    const search = params.get("search")?.trim();
    const active = params.get("isActive");

    if (
      active !== null &&
      active !== "true" &&
      active !== "false"
    ) {
      return errorResponse(
        "فیلتر وضعیت معتبر نیست.",
        400
      );
    }

    const positions = await prisma.organizationPosition.findMany({
      where: {
        ...(active !== null
          ? { isActive: active === "true" }
          : {}),
        ...(search
          ? {
              OR: [
                {
                  title: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  code: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
                {
                  description: {
                    contains: search,
                    mode: "insensitive",
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        _count: {
          select: {
            assignments: true,
          },
        },
      },
      orderBy: [
        { level: "asc" },
        { title: "asc" },
      ],
    });

    return successResponse({
      positions,
      count: positions.length,
    });
  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "دریافت سمت‌ها امکان‌پذیر نیست.",
        statusCode
      );
    }

    console.error(
      "[ORGANIZATION_POSITIONS_GET_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت سمت‌های سازمانی.",
      500
    );
  }
}

// =====================================================
// POST: ایجاد سمت جدید
// =====================================================

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.positions.manage"
    );

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
      return errorResponse(
        "اطلاعات سمت معتبر نیست.",
        400
      );
    }

    const validation = validatePositionInput(body);

    if (!validation.success || !validation.data) {
      return errorResponse(
        validation.message || "اطلاعات سمت معتبر نیست.",
        400
      );
    }

    const data = validation.data;

    const position = await prisma.$transaction(
      async (tx) => {
        const created = await tx.organizationPosition.create({
          data: {
            code: data.code!,
            title: data.title!,
            description: data.description ?? null,
            level: data.level ?? 1,
            isManagerial: data.isManagerial ?? false,
            isActive: data.isActive ?? true,
          },
        });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: authorization.user.id,
            entityType: "OrganizationPosition",
            entityId: created.id,
            action: "ORGANIZATION_POSITION_CREATED",
            ipAddress: getRequestIp(request),
            afterData: {
              code: created.code,
              title: created.title,
              description: created.description,
              level: created.level,
              isManagerial: created.isManagerial,
              isActive: created.isActive,
            },
          },
        });

        return created;
      }
    );

    return successResponse(
      {
        position,
        message: "سمت سازمانی با موفقیت ایجاد شد.",
      },
      201
    );
  } catch (error) {
    const code = getErrorCode(error);

    if (code === "P2002") {
      return errorResponse(
        "کد این سمت قبلاً ثبت شده است.",
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

    console.error(
      "[ORGANIZATION_POSITIONS_POST_ERROR]",
      error
    );

    return errorResponse(
      "خطا در ایجاد سمت سازمانی.",
      500
    );
  }
}

// =====================================================
// PATCH: ویرایش یا غیرفعال‌سازی سمت
// =====================================================

export async function PATCH(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const authorization = await authorizeRequest(
      request,
      "organization.positions.manage"
    );

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
      return errorResponse(
        "اطلاعات ارسالی معتبر نیست.",
        400
      );
    }

    if (
      typeof body.id !== "string" ||
      !body.id.trim()
    ) {
      return errorResponse(
        "شناسه سمت الزامی است.",
        400
      );
    }

    const validation = validatePositionInput(
      body,
      true
    );

    if (!validation.success || !validation.data) {
      return errorResponse(
        validation.message || "اطلاعات ارسالی معتبر نیست.",
        400
      );
    }

    const data = validation.data;

    const updated = await prisma.$transaction(
      async (tx) => {
        const existing =
          await tx.organizationPosition.findUnique({
            where: { id: data.id },
          });

        if (!existing) {
          throw new Error("POSITION_NOT_FOUND");
        }

        const changes = {
          ...(data.code !== undefined
            ? { code: data.code }
            : {}),
          ...(data.title !== undefined
            ? { title: data.title }
            : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.level !== undefined
            ? { level: data.level }
            : {}),
          ...(data.isManagerial !== undefined
            ? { isManagerial: data.isManagerial }
            : {}),
          ...(data.isActive !== undefined
            ? { isActive: data.isActive }
            : {}),
        };

        const position =
          await tx.organizationPosition.update({
            where: { id: data.id },
            data: changes,
          });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: authorization.user.id,
            entityType: "OrganizationPosition",
            entityId: position.id,
            action:
              data.isActive === false
                ? "ORGANIZATION_POSITION_DEACTIVATED"
                : "ORGANIZATION_POSITION_UPDATED",
            ipAddress: getRequestIp(request),
            beforeData: {
              code: existing.code,
              title: existing.title,
              description: existing.description,
              level: existing.level,
              isManagerial: existing.isManagerial,
              isActive: existing.isActive,
            },
            afterData: {
              code: position.code,
              title: position.title,
              description: position.description,
              level: position.level,
              isManagerial: position.isManagerial,
              isActive: position.isActive,
            },
          },
        });

        return position;
      }
    );

    return successResponse({
      position: updated,
      message: "اطلاعات سمت با موفقیت به‌روزرسانی شد.",
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "POSITION_NOT_FOUND"
    ) {
      return errorResponse(
        "سمت موردنظر پیدا نشد.",
        404
      );
    }

    const code = getErrorCode(error);

    if (code === "P2002") {
      return errorResponse(
        "کد سمت دیگری با این مقدار وجود دارد.",
        409
      );
    }

    if (code === "P2003" || code === "P2025") {
      return errorResponse(
        "امکان ویرایش اطلاعات به دلیل وابستگی‌های موجود وجود ندارد.",
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

    console.error(
      "[ORGANIZATION_POSITIONS_PATCH_ERROR]",
      error
    );

    return errorResponse(
      "خطا در ویرایش سمت سازمانی.",
      500
    );
  }
}
