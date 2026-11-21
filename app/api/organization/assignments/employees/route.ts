
import { NextRequest } from "next/server";

import {
  UserAccessLevel,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  authorizeGlobalRequest,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

// ==========================================
// GET - SEARCH EMPLOYEES
// ==========================================

export async function GET(request: NextRequest) {
  try {
    // بررسی دسترسی سراسری مدیریت انتصاب کارکنان
    await authorizeGlobalRequest(
      request,
      "organization.assignments.manage"
    );

    // دریافت عبارت جست‌وجو
    const query = (
      request.nextUrl.searchParams.get("q") || ""
    ).trim();

    // جلوگیری از جست‌وجوی بسیار کوتاه
    if (query.length < 2) {
      return successResponse({
        employees: [],
        count: 0,
      });
    }

    // محدودیت طول عبارت جست‌وجو
    if (query.length > 100) {
      return errorResponse(
        "عبارت جست‌وجو نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد.",
        400
      );
    }

    // جست‌وجوی کارکنان فعال
    const employees = await prisma.user.findMany({
      where: {
        isActive: true,

        accessLevel: UserAccessLevel.ERP,

        OR: [
          {
            fullName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },

      select: {
        id: true,
        fullName: true,
        username: true,
      },

      orderBy: {
        fullName: "asc",
      },

      take: 20,
    });

    return successResponse({
      employees,
      count: employees.length,
    });

  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof PermissionDeniedError
    ) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    console.error(
      "[ORGANIZATION_EMPLOYEE_SEARCH_ERROR]",
      error
    );

    return errorResponse(
      "خطا در جست‌وجوی کارکنان.",
      500
    );
  }
}
