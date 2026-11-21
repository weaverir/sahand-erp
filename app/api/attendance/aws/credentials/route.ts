import { NextRequest, NextResponse } from "next/server";
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";
import { assertSameOriginRequest, authorizeRequest } from "@/modules/auth/auth.middleware";
import { prisma } from "@/libs/prisma";
import { readSessionToken, region } from "@/libs/attendance/aws-face";

const sts = new STSClient({ region });
export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || typeof (body as {token?:unknown}).token !== "string")
      return NextResponse.json({ error: "توکن لازم است." }, { status: 400 });
    const payload = readSessionToken((body as {token:string}).token);
    const challenge = await prisma.attendanceChallenge.findUnique({ where: { id: payload.cid } });
    if (!challenge) return NextResponse.json({ error: "چالش نامعتبر است." }, { status: 403 });
    const auth = await authorizeRequest(request, "attendance.attendance.create", challenge.employeeAssignmentId);
    if (challenge.userId !== auth.user.id || payload.uid !== auth.user.id || challenge.status !== "OPEN" || challenge.expiresAt <= new Date())
      return NextResponse.json({ error: "چالش نامعتبر است." }, { status: 403 });
    const roleArn = process.env.ATTENDANCE_LIVENESS_ROLE_ARN;
    if (!roleArn) throw new Error("Missing role ARN");
    const result = await sts.send(new AssumeRoleCommand({
      RoleArn: roleArn, RoleSessionName: `sahand-${payload.cid.slice(0, 24)}`,
      DurationSeconds: 900,
      Policy: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow",
        Action: ["rekognition:StartFaceLivenessSession"], Resource: "*" }] }),
    }));
    const c = result.Credentials;
    if (!c?.AccessKeyId || !c.SecretAccessKey || !c.SessionToken) throw new Error("No STS credentials");
    return NextResponse.json({ accessKeyId: c.AccessKeyId, secretAccessKey: c.SecretAccessKey,
      sessionToken: c.SessionToken, expiration: c.Expiration?.toISOString() },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[AWS_LIVENESS_CREDENTIALS]", error);
    return NextResponse.json({ error: "صدور دسترسی موقت ممکن نیست." }, { status: 503 });
  }
}
