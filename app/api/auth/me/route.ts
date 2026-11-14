
import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  getAuthenticatedUser,
} from "@/modules/auth/auth.service";

import {
  AUTH_COOKIE_NAMES,
} from "@/modules/auth/auth.cookies";



export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get(
      AUTH_COOKIE_NAMES.access
    )?.value;

    if (!accessToken) {
      throw new AuthError();
    }

    const user = await getAuthenticatedUser(accessToken);

    return NextResponse.json({
      success: true,
      user,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "احراز هویت لازم است.",
      },
      { status: 401 }
    );
  }
}
