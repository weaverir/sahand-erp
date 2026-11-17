
import "server-only";

import { NextRequest } from "next/server";
import { DataScope } from "@/generated/prisma/client";

import {
  AuthError,
  getAuthenticatedUser,
} from "./auth.service";

import { AUTH_COOKIE_NAMES } from "./auth.cookies";

import {
  checkPermission,
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

export class RequestOriginError extends Error {
  statusCode = 403;

  constructor(
    message = "مبدأ درخواست مجاز نیست."
  ) {
    super(message);
    this.name = "RequestOriginError";
  }
}

/**
 * بررسی مبدأ درخواست‌های تغییردهنده اطلاعات
 */
export function assertSameOriginRequest(
  request: NextRequest
) {
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  const source = origin || referer;

  if (!source) {
    throw new RequestOriginError(
      "مبدأ درخواست مشخص نیست."
    );
  }

  let sourceOrigin: string;

  try {
    sourceOrigin = new URL(source).origin;
  } catch {
    throw new RequestOriginError();
  }

  if (sourceOrigin !== request.nextUrl.origin) {
    throw new RequestOriginError();
  }

  const fetchSite = request.headers.get("sec-fetch-site");

  if (fetchSite === "cross-site") {
    throw new RequestOriginError();
  }
}

/**
 * احراز هویت کاربر
 */
export async function authenticateRequest(
  request: NextRequest
) {
  const accessToken = request.cookies.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  if (!accessToken) {
    throw new AuthError(
      "ابتدا وارد حساب کاربری شوید."
    );
  }

  return getAuthenticatedUser(accessToken);
}

/**
 * بررسی مجوز با در نظر گرفتن مسئولیت فعال سازمانی
 */
export async function authorizeRequest(
  request: NextRequest,
  permissionKey: string,
  assignmentId?: string
) {
  const user = await authenticateRequest(request);

  // دریافت مسئولیت انتخاب‌شده از هدر درخواست
  const headerAssignmentId = request.headers.get(
    "x-organization-assignment-id"
  )?.trim();

  const selectedAssignmentId =
    assignmentId ?? (headerAssignmentId || undefined);

  const permission = await checkPermission({
    userId: user.id,
    permission: permissionKey,
    assignmentId: selectedAssignmentId,
  });

  if (!permission.allowed) {
    throw new PermissionDeniedError();
  }

  return {
    user,
    permission,
    assignmentId: permission.activeAssignmentId,
  };
}

/**
 * بررسی دسترسی سراسری به اطلاعات مرجع
 */
export async function authorizeGlobalRequest(
  request: NextRequest,
  permissionKey: string
) {
  const authorization = await authorizeRequest(
    request,
    permissionKey
  );

  if (
    !authorization.permission.scopes.includes(
      DataScope.ALL
    )
  ) {
    throw new PermissionDeniedError(
      "برای دسترسی به اطلاعات مرجع، مجوز سراسری لازم است."
    );
  }

  return authorization;
}
