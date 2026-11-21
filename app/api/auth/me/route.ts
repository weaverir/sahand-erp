import { NextRequest, NextResponse } from "next/server";
import { AuthError, getAuthenticatedUser } from "@/modules/auth/auth.service";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.cookies";



export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(AUTH_COOKIE_NAMES.access)?.value;
    if (!token) throw new AuthError();
    const user = await getAuthenticatedUser(token);
    return NextResponse.json({ success: true, data: { id: user.id, username: user.username, fullName: user.fullName, email: user.email } }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ success: false, message: "احراز هویت لازم است." }, { status: 401 });
  }
}
