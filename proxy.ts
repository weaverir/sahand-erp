import { jwtVerify } from "jose";
import {
  NextResponse,
  type NextRequest,
} from "next/server";

import { getAuthConfig } from "@/modules/auth/auth.config";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  if (!token) {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }

  try {
    const config = getAuthConfig();

    const { payload } = await jwtVerify(
      token,
      config.accessSecret,
      {
        issuer: config.issuer,
        audience: config.audience,
        algorithms: ["HS256"],
      }
    );

    if (
      payload.typ !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.sid !== "string"
    ) {
      throw new Error("Invalid token");
    }

    return NextResponse.next();
  } catch {
    return NextResponse.redirect(
      new URL("/", request.url)
    );
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/items/:path*",
  ],
};