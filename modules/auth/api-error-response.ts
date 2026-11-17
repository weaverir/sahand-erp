
import "server-only";

import { NextResponse } from "next/server";

import { AuthError } from "./auth.service";

import { RequestOriginError } from "./auth.middleware";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

export function authExceptionResponse(
  error: unknown,
  fallbackMessage = "خطای داخلی سرور."
) {
  if (error instanceof AuthError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: error.statusCode,
      }
    );
  }

  if (
    error instanceof PermissionDeniedError ||
    error instanceof RequestOriginError
  ) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      {
        status: 403,
      }
    );
  }

  console.error("API error:", error);

  return NextResponse.json(
    {
      success: false,
      error: fallbackMessage,
    },
    {
      status: 500,
    }
  );
}
