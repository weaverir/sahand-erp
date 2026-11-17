
import { NextRequest, NextResponse } from "next/server";

import {
  AuthError,
  loginCandidate,
} from "@/modules/auth/auth.service";

import { validateLoginInput } from "@/modules/auth/auth.validation";

import { setCandidateCookie } from "@/modules/auth/auth.cookies";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const input = validateLoginInput(body);

    const result = await loginCandidate(
      input.identifier,
      input.password
    );

    const response = NextResponse.json({
      success: true,
      message: "ورود متقاضی با موفقیت انجام شد.",
      user: result.user,
    });

    setCandidateCookie(
      response,
      result.token,
      result.maxAge
    );

    return response;

  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: error.statusCode,
        }
      );
    }

    if (error instanceof Error) {
      console.error(
        "[CANDIDATE_LOGIN_ERROR]",
        error
      );

      return NextResponse.json(
        {
          success: false,
          message: error.message,
        },
        {
          status: 400,
        }
      );
    }

    console.error(
      "[CANDIDATE_LOGIN_UNKNOWN_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "خطای داخلی سرور.",
      },
      {
        status: 500,
      }
    );
  }
}
