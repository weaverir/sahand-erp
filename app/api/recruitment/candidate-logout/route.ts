
import { NextResponse } from "next/server";
import { clearCandidateCookie } from "@/modules/auth/auth.cookies";

export async function POST() {
  const response = NextResponse.json({
    success: true,
    message: "با موفقیت از پنل متقاضی خارج شدید.",
  });

  clearCandidateCookie(response);

  return response;
}
