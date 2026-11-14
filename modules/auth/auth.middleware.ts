
import "server-only";

import { NextRequest } from "next/server";

import {
  AuthError,
  getAuthenticatedUser,
} from "./auth.service";

import { AUTH_COOKIE_NAMES } from "./auth.cookies";

import {
  checkPermission,
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

export async function authenticateRequest(
  request: NextRequest
) {
  const accessToken = request.cookies.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  if (!accessToken) {
    throw new AuthError("ابتدا وارد حساب کاربری شوید.");
  }

  return getAuthenticatedUser(accessToken);
}

export async function authorizeRequest(
  request: NextRequest,
  permissionKey: string
) {
  const user = await authenticateRequest(request);

  const permission = await checkPermission({
    userId: user.id,
    permission: permissionKey,
  });

  if (!permission.allowed) {
    throw new PermissionDeniedError();
  }

  return {
    user,
    permission,
  };
}
