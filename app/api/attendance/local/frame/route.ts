import { NextRequest } from "next/server";
import { assertSameOriginRequest, authenticateRequest } from "@/modules/auth/auth.middleware";
import { prisma } from "@/libs/prisma";
import { createHash, timingSafeEqual } from "node:crypto";
import { localFaceRequest } from "@/libs/attendance/local-face-client";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const user = await authenticateRequest(request);
    if (Number(request.headers.get("content-length") ?? 0) > 1_600_000)
      return Response.json({ error: "فریم بزرگ است." }, { status: 413 });
    const body = await request.json();
    if (typeof body?.sessionToken !== "string" || body.sessionToken.length > 200 ||
        typeof body?.frameBase64 !== "string" || body.frameBase64.length > 1_500_000 ||
        typeof body?.challengeId !== "string" || typeof body?.nonce !== "string")
      return Response.json({ error: "فریم نامعتبر است." }, { status: 400 });
    const challenge = await prisma.attendanceChallenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.userId !== user.id || challenge.status !== "OPEN" ||
        challenge.consumedAt || challenge.expiresAt <= new Date())
      return Response.json({ error: "چالش معتبر نیست." }, { status: 403 });
    const digest = createHash("sha256").update(body.nonce).digest();
    const expected = Buffer.from(challenge.nonceHash, "hex");
    if (expected.length !== digest.length || !timingSafeEqual(expected, digest))
      return Response.json({ error: "چالش معتبر نیست." }, { status: 403 });
    const data = await localFaceRequest("/v1/frames", {
      sessionToken: body.sessionToken, challengeId: body.challengeId,
      challengeNonce: body.nonce, subjectId: user.id, frameBase64: body.frameBase64,
    });
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "ارسال فریم ناموفق بود." }, { status: 503 });
  }
}
