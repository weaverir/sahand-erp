import { NextRequest } from "next/server";
import { prisma } from "@/libs/prisma";
import { assertSameOriginRequest, authenticateRequest } from "@/modules/auth/auth.middleware";
import { localFaceRequest } from "@/libs/attendance/local-face-client";
import { createHash, timingSafeEqual } from "node:crypto";

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const user = await authenticateRequest(request);
    const body = await request.json();
    if (typeof body?.challengeId !== "string" || typeof body?.nonce !== "string")
      return Response.json({ error: "درخواست نامعتبر است." }, { status: 400 });
    const challenge = await prisma.attendanceChallenge.findUnique({ where: { id: body.challengeId } });
    if (!challenge || challenge.userId !== user.id || challenge.status !== "OPEN" ||
        challenge.consumedAt || challenge.expiresAt <= new Date())
      return Response.json({ error: "چالش معتبر نیست." }, { status: 403 });
    const digest = createHash("sha256").update(body.nonce).digest();
    const expected = Buffer.from(challenge.nonceHash, "hex");
    if (expected.length !== digest.length || !timingSafeEqual(expected, digest))
      return Response.json({ error: "چالش معتبر نیست." }, { status: 403 });
    const data = await localFaceRequest<{ sessionToken: string; expiresInSeconds: number }>("/v1/sessions", {
      challengeId: challenge.id, challengeNonce: body.nonce,
      subjectId: user.id, action: challenge.action,
    });
    return Response.json(data, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ error: "ایجاد نشست داخلی ناموفق بود." }, { status: 503 });
  }
}
