import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { assertSameOriginRequest, authorizeRequest } from "@/modules/auth/auth.middleware";
import { issueSessionToken, startLivenessSession, region } from "@/libs/attendance/aws-face";
import { sha256 } from "@/modules/attendance/attendance-utils";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
    const { challengeId, nonce } = body as Record<string, unknown>;
    if (typeof challengeId !== "string" || typeof nonce !== "string")
      return NextResponse.json({ error: "شناسه و nonce لازم است." }, { status: 400 });
    const challenge = await prisma.attendanceChallenge.findUnique({ where: { id: challengeId } });
    if (!challenge) return NextResponse.json({ error: "چالش یافت نشد." }, { status: 404 });
    const auth = await authorizeRequest(request, "attendance.attendance.create", challenge.employeeAssignmentId);
    if (challenge.userId !== auth.user.id || challenge.status !== "OPEN" || challenge.expiresAt <= new Date() || challenge.nonceHash !== sha256(nonce))
      return NextResponse.json({ error: "چالش معتبر نیست." }, { status: 403 });
    const sessionId = await startLivenessSession();
    const token = issueSessionToken({ sid: sessionId, cid: challenge.id, uid: auth.user.id, exp: challenge.expiresAt.getTime() });
    return NextResponse.json({ sessionId, liveSessionToken: token, region }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[AWS_LIVENESS_SESSION]", error);
    return NextResponse.json({ error: "ایجاد نشست چهره ناموفق بود یا دسترسی مجاز نیست." }, { status: 503 });
  }
}
