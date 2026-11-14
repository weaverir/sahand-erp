
import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  refreshUserSession,
} from "@/modules/auth/auth.service";

import {
  AUTH_COOKIE_NAMES,
  clearAuthCookies,
  setAuthCookies,
} from "@/modules/auth/auth.cookies";

import { getAuthConfig } from "@/modules/auth/auth.config";



export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(
    AUTH_COOKIE_NAMES.refresh
  )?.value;

  if (!refreshToken) {
    const response = NextResponse.json(
      { success: false, message: "نشست معتبر نیست." },
      { status: 401 }
    );

    clearAuthCookies(response);
    return response;
  }

  try {
    const tokens = await refreshUserSession(refreshToken);
    const config = getAuthConfig();

    const response = NextResponse.json({
      success: true,
      message: "نشست با موفقیت تمدید شد.",
    });

    setAuthCookies(response, {
      ...tokens,
      accessTokenMaxAge: config.accessTokenMaxAge,
      refreshTokenMaxAge: config.refreshTokenMaxAge,
    });

    return response;
  } catch (error) {
    const response = NextResponse.json(
      {
        success: false,
        message:
          error instanceof AuthError
            ? error.message
            : "تمدید نشست انجام نشد.",
      },
      { status: 401 }
    );

    clearAuthCookies(response);
    return response;
  }
}
