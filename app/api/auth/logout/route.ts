
import { NextRequest, NextResponse } from "next/server";

import {
  logoutSession,
} from "@/modules/auth/auth.service";

import {
  AUTH_COOKIE_NAMES,
  clearAuthCookies,
} from "@/modules/auth/auth.cookies";



export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(
    AUTH_COOKIE_NAMES.refresh
  )?.value;

  const accessToken = request.cookies.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  await logoutSession(refreshToken, "refresh");
  await logoutSession(accessToken, "access");

  const response = NextResponse.json({
    success: true,
    message: "با موفقیت از حساب خارج شدید.",
  });

  clearAuthCookies(response);

  return response;
}
