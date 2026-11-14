
import "server-only";

import { NextResponse } from "next/server";

const ACCESS_COOKIE = "sahand_access";
const REFRESH_COOKIE = "sahand_refresh";

const secure = process.env.NODE_ENV === "production";

export function setAuthCookies(
  response: NextResponse,
  tokens: {
    accessToken: string;
    refreshToken: string;
    accessTokenMaxAge: number;
    refreshTokenMaxAge: number;
  }
) {
  response.cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: tokens.accessTokenMaxAge,
  });

  response.cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: tokens.refreshTokenMaxAge,
  });

  return response;
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/api/auth",
    maxAge: 0,
  });

  return response;
}

export const AUTH_COOKIE_NAMES = {
  access: ACCESS_COOKIE,
  refresh: REFRESH_COOKIE,
};
