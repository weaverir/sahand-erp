
import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  getAuthenticatedUser,
} from "@/modules/auth/auth.service";

import {
  AUTH_COOKIE_NAMES,
} from "@/modules/auth/auth.cookies";

import {
  getUserPermissions,
} from "@/modules/permissions/access-control";



export async function GET(request: NextRequest) {
  try {
    // مرحله اول: بررسی کوکی ورود
    const token = request.cookies.get(
      AUTH_COOKIE_NAMES.access
    )?.value;

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          message: "نشست کاربری پیدا نشد. لطفاً دوباره وارد شوید.",
        },
        { status: 401 }
      );
    }

    // مرحله دوم: اعتبارسنجی کاربر
    let user;

    try {
      user = await getAuthenticatedUser(token);
    } catch (error) {
      if (error instanceof AuthError) {
        return NextResponse.json(
          {
            success: false,
            message: "نشست کاربری معتبر نیست. دوباره وارد شوید.",
          },
          { status: error.statusCode }
        );
      }

      console.error(
        "[AUTH_PERMISSIONS_AUTH_ERROR]",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message: "خطا در بررسی هویت کاربر.",
        },
        { status: 500 }
      );
    }

    // مرحله سوم: دریافت مجوزهای کاربر
    const permissions = await getUserPermissions(user.id);

    // مرحله چهارم: ارسال مجوزها
    return NextResponse.json(
      {
        success: true,
        data: {
          permissions,
        },
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
          "Pragma": "no-cache",
        },
      }
    );

  } catch (error) {
    console.error(
      "[AUTH_PERMISSIONS_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "خطا در دریافت مجوزهای کاربر.",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
