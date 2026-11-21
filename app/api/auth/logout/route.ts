import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { logoutSession } from "@/modules/auth/auth.service";
import { assertSameOriginRequest } from "@/modules/auth/auth.middleware";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const cookieStore = await cookies();
    const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.access)?.value;
    const refreshToken = cookieStore.get(AUTH_COOKIE_NAMES.refresh)?.value;

    // Revoke both token types. The service safely ignores missing or expired tokens.
    await Promise.all([
      logoutSession(accessToken, "access"),
      logoutSession(refreshToken, "refresh"),
    ]);

    const response = NextResponse.json({
      success: true,
      message: "با موفقیت از حساب کاربری خارج شدید.",
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      path: "/",
      maxAge: 0,
    };

    response.cookies.set(AUTH_COOKIE_NAMES.access, "", cookieOptions);
    response.cookies.set(AUTH_COOKIE_NAMES.refresh, "", cookieOptions);

    return response;
  } catch (error) {
    console.error("[AUTH_LOGOUT_ERROR]", error);
    return NextResponse.json(
      { success: false, message: "خروج از حساب کاربری انجام نشد." },
      { status: 500 }
    );
  }
}
