
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
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    undefined
  );
}

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
      return errorResponse("اطلاعات ارسالی معتبر نیست.", 400);
    }

    if (
      typeof body !== "object" ||
      body === null ||
      Array.isArray(body)
    ) {
      return errorResponse("ساختار اطلاعات معتبر نیست.", 400);
    }

    const input = body as Record<string, unknown>;

    const allowedFields = ["parentId", "sortOrder"];

    if (Object.keys(input).some(
      (key) => !allowedFields.includes(key)
    )) {
      return errorResponse("فیلد ارسالی غیرمجاز است.", 400);
    }

    const parentId = input.parentId;

    if (
      parentId !== null &&
      (
        typeof parentId !== "string" ||
        !parentId.trim()
      )
    ) {
      return errorResponse("شناسه واحد والد معتبر نیست.", 400);
    }

    if (
      input.sortOrder !== undefined &&
      (
        typeof input.sortOrder !== "number" ||
        !Number.isSafeInteger(input.sortOrder) ||
        input.sortOrder < 0 ||
        input.sortOrder > 100000
      )
    ) {
      return errorResponse("ترتیب نمایش معتبر نیست.", 400);
    }

    const newParentId =
      typeof parentId === "string"
        ? parentId.trim()
        : null;

    if (newParentId === id) {
      return errorResponse(
        "یک واحد نمی‌تواند والد خودش باشد.",
        400
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        const unit = await tx.organizationUnit.findUnique({
          where: { id },
        });

        if (!unit) {
          throw new Error("UNIT_NOT_FOUND");
        }

        if (unit.status !== "ACTIVE") {
          throw new Error("UNIT_INACTIVE");
        }

        let newParent = null;

        if (newParentId) {
          newParent = await tx.organizationUnit.findUnique({
            where: { id: newParentId },
            select: {
              id: true,
              name: true,
              status: true,
            },
          });

          if (!newParent) {
            throw new Error("PARENT_NOT_FOUND");
          }

          if (newParent.status !== "ACTIVE") {
            throw new Error("PARENT_INACTIVE");
          }
        }

        // دریافت ساختار کامل برای جلوگیری از ایجاد چرخه
        const allUnits = await tx.organizationUnit.findMany({
          select: {
            id: true,
            parentId: true,
          },
        });

        const childrenMap = new Map<string, string[]>();

        for (const item of allUnits) {
          if (!item.parentId) continue;

          const children =
            childrenMap.get(item.parentId) || [];

          children.push(item.id);
          childrenMap.set(item.parentId, children);
        }

        // پیدا کردن تمام زیرمجموعه‌های واحد
        const descendants = new Set<string>();
        const queue = [id];

        while (queue.length > 0) {
          const current = queue.shift()!;

          for (
            const child of childrenMap.get(current) || []
          ) {
            if (descendants.has(child)) continue;

            descendants.add(child);
            queue.push(child);
          }
        }

        if (newParentId && descendants.has(newParentId)) {
          throw new Error("CIRCULAR_HIERARCHY");
        }

        const oldParentId = unit.parentId;

        if (
          oldParentId === newParentId &&
          input.sortOrder === undefined
        ) {
          return {
            unit,
            changed: false,
          };
        }

        const updated = await tx.organizationUnit.update({
          where: { id },
          data: {
            parentId: newParentId,
            ...(input.sortOrder !== undefined
              ? { sortOrder: input.sortOrder as number }
              : {}),
          },
        });

        await tx.organizationAuditLog.create({
          data: {
            actorUserId: authorization.user.id,
            entityType: "OrganizationUnit",
            entityId: id,
            action: "ORGANIZATION_UNIT_MOVED",
            ipAddress: getRequestIp(request),
            beforeData: {
              parentId: oldParentId,
              sortOrder: unit.sortOrder,
            },
            afterData: {
              parentId: newParentId,
              sortOrder: updated.sortOrder,
            },
          },
        });

        return {
          unit: updated,
          changed: true,
        };
      },
      {
        isolationLevel: "Serializable",
      }
    );

    return successResponse({
      unit: result.unit,
      changed: result.changed,
      message: result.changed
        ? "واحد سازمانی با موفقیت منتقل شد."
        : "ساختار واحد تغییری نکرد.",
    });

  } catch (error) {
    if (error instanceof Error) {
      const messages: Record<string, string> = {
        UNIT_NOT_FOUND: "واحد موردنظر پیدا نشد.",
        UNIT_INACTIVE: "انتقال واحد غیرفعال امکان‌پذیر نیست.",
        PARENT_NOT_FOUND: "واحد والد پیدا نشد.",
        PARENT_INACTIVE: "واحد والد غیرفعال است.",
        CIRCULAR_HIERARCHY:
          "این انتقال باعث ایجاد چرخه در ساختار سازمانی می‌شود.",
      };

      if (messages[error.message]) {
        return errorResponse(
          messages[error.message],
          error.message === "UNIT_NOT_FOUND" ||
          error.message === "PARENT_NOT_FOUND"
            ? 404
            : 409
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
        "ساختار سازمانی هم‌زمان تغییر کرده است. دوباره تلاش کنید.",
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
      "[ORGANIZATION_UNIT_MOVE_ERROR]",
      error
    );

    return errorResponse(
      "خطا در انتقال واحد سازمانی.",
      500
    );
  }
}
