
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

    const position = await prisma.organizationPosition.findUnique({
      where: { id },
      include: {
        _count: {
          select: { assignments: true },
        },
        assignments: {
          where: { status: "ACTIVE" },
          select: {
            id: true,
            userId: true,
            organizationUnitId: true,
            status: true,
            isPrimary: true,
          },
        },
      },
    });

    if (!position) {
      return errorResponse("سمت سازمانی پیدا نشد.", 404);
    }

    return successResponse({ position });
  } catch (error) {
    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "دسترسی مجاز نیست.",
        status
      );
    }

    console.error("[POSITION_GET]", error);
    return errorResponse("خطا در دریافت سمت سازمانی.", 500);
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
      "organization.positions.manage"
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
      "code",
      "title",
      "description",
      "level",
      "isManagerial",
      "isActive",
    ];

    if (Object.keys(body).some(key => !allowed.includes(key))) {
      return errorResponse("فیلد غیرمجاز ارسال شده است.", 400);
    }

    if (
      body.code !== undefined &&
      (
        typeof body.code !== "string" ||
        body.code.trim().length < 2 ||
        body.code.trim().length > 50 ||
        !/^[a-zA-Z0-9_-]+$/.test(body.code.trim())
      )
    ) {
      return errorResponse("کد سمت معتبر نیست.", 400);
    }

    if (
      body.title !== undefined &&
      (
        typeof body.title !== "string" ||
        body.title.trim().length < 2 ||
        body.title.trim().length > 150
      )
    ) {
      return errorResponse("عنوان سمت معتبر نیست.", 400);
    }

    if (
      body.description !== undefined &&
      body.description !== null &&
      typeof body.description !== "string"
    ) {
      return errorResponse("توضیحات معتبر نیست.", 400);
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
      return errorResponse("سطح سمت معتبر نیست.", 400);
    }

    if (
      body.isManagerial !== undefined &&
      typeof body.isManagerial !== "boolean"
    ) {
      return errorResponse("مقدار مدیریتی بودن معتبر نیست.", 400);
    }

    if (
      body.isActive !== undefined &&
      typeof body.isActive !== "boolean"
    ) {
      return errorResponse("وضعیت سمت معتبر نیست.", 400);
    }

    if (Object.keys(body).length === 0) {
      return errorResponse("اطلاعاتی برای ویرایش ارسال نشده است.", 400);
    }

    const result = await prisma.$transaction(async tx => {
      const existing = await tx.organizationPosition.findUnique({
        where: { id },
      });

      if (!existing) throw new Error("POSITION_NOT_FOUND");

      if (body.isActive === false) {
        const activeCount = await tx.employeeAssignment.count({
          where: {
            positionId: id,
            status: "ACTIVE",
          },
        });

        if (activeCount > 0) {
          throw new Error("POSITION_IN_USE");
        }
      }

      const updated = await tx.organizationPosition.update({
        where: { id },
        data: {
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
      });

      await tx.organizationAuditLog.create({
        data: {
          actorUserId: authorization.user.id,
          entityType: "OrganizationPosition",
          entityId: id,
          action: "ORGANIZATION_POSITION_UPDATED",
          ipAddress: getIp(request),
          beforeData: existing,
          afterData: updated,
        },
      });

      return updated;
    });

    return successResponse({
      position: result,
      message: "سمت سازمانی به‌روزرسانی شد.",
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "POSITION_NOT_FOUND") {
        return errorResponse("سمت پیدا نشد.", 404);
      }
      if (error.message === "POSITION_IN_USE") {
        return errorResponse(
          "این سمت دارای انتصاب فعال است.",
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
      return errorResponse("کد سمت تکراری است.", 409);
    }

    const status = getStatus(error);
    if (status !== 500) {
      return errorResponse(
        error instanceof Error ? error.message : "درخواست نامعتبر است.",
        status
      );
    }

    console.error("[POSITION_PATCH]", error);
    return errorResponse("خطا در ویرایش سمت.", 500);
  }
}
