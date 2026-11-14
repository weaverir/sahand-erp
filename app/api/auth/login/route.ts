
import { NextRequest, NextResponse } from "next/server";

import { loginUser, AuthError } from "@/modules/auth/auth.service";
import { validateLoginInput } from "@/modules/auth/auth.validation";
import { setAuthCookies } from "@/modules/auth/auth.cookies";



export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = validateLoginInput(body);

    const result = await loginUser(
      input.identifier,
      input.password,
      {
        ipAddress:
          request.headers.get("x-forwarded-for")
            ?.split(",")[0]
            ?.trim() || undefined,
        userAgent:
          request.headers.get("user-agent") || undefined,
      }
    );

    const response = NextResponse.json({
      success: true,
      message: "ورود با موفقیت انجام شد.",
      user: result.user,
    });

    setAuthCookies(response, result);

    return response;
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, message: "خطای داخلی سرور." },
      { status: 500 }
    );
  }
}
