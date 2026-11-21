import { NextRequest } from "next/server";
import { prisma } from "@/libs/prisma";
import { errorResponse, successResponse } from "@/libs/api-response";
import { assertSameOriginRequest, authorizeRequest, RequestOriginError } from "@/modules/auth/auth.middleware";
import { AuthError } from "@/modules/auth/auth.service";
import { PermissionDeniedError } from "@/modules/permissions/access-control";
import { createChallengeNonce, getApiError, getRequestIp, isPlainObject, sha256 } from "@/modules/attendance/attendance-utils";

class ChallengeError extends Error {
  constructor(message: string, public statusCode = 400) { super(message); }
}
function handleError(error: unknown) {
  if (error instanceof ChallengeError || error instanceof RequestOriginError ||
      error instanceof AuthError || error instanceof PermissionDeniedError) {
    return errorResponse(error.message, error.statusCode);
  }
  const parsed = getApiError(error);
  console.error("[ATTENDANCE_CHALLENGE]", error);
  return errorResponse(parsed.message, parsed.statusCode);
}

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const auth = await authorizeRequest(request, "attendance.attendance.create");
    if (!auth.assignmentId) throw new ChallengeError("برای این حساب مسئولیت سازمانی فعال تعریف نشده است.", 403);

    const body: unknown = await request.json().catch(() => null);
    if (!isPlainObject(body) || (body.action !== "CHECK_IN" && body.action !== "CHECK_OUT")) {
      throw new ChallengeError("نوع عملیات باید CHECK_IN یا CHECK_OUT باشد.");
    }

    const now = new Date();
    const assignment = await prisma.employeeAssignment.findFirst({
      where: {
        id: auth.assignmentId, userId: auth.user.id, status: "ACTIVE",
        startDate: { lte: now }, OR: [{ endDate: null }, { endDate: { gt: now } }],
      },
      include: { location: true, organizationUnit: { include: { location: true } } },
    });
    if (!assignment) throw new ChallengeError("مسئولیت سازمانی فعال پیدا نشد.", 403);

    const location = assignment.location ?? assignment.organizationUnit.location;
    if (!location || location.status !== "ACTIVE" || !location.geofenceEnabled ||
        location.latitude === null || location.longitude === null) {
      throw new ChallengeError("مختصات یا محدوده حضور محل کار تنظیم نشده است.", 409);
    }

    const faceProfile = await prisma.faceIdentityProfile.findUnique({
      where: { userId: auth.user.id },
      select: { isActive: true, consentAcceptedAt: true },
    });
    if (!faceProfile || !faceProfile.isActive || !faceProfile.consentAcceptedAt) {
      throw new ChallengeError(
        "برای این پرسنل تصویر مرجع و رضایت ثبت‌شده احراز چهره وجود ندارد.",
        409
      );
    }

    const nonce = createChallengeNonce();
    const expiresAt = new Date(now.getTime() + 90_000);
    const challenge = await prisma.attendanceChallenge.create({
      data: {
        userId: auth.user.id,
        employeeAssignmentId: assignment.id,
        action: body.action,
        nonceHash: sha256(nonce),
        expiresAt,
        ipAddress: getRequestIp(request),
        userAgentHash: sha256(request.headers.get("user-agent") ?? ""),
      },
      select: { id: true, action: true, expiresAt: true },
    });

    const response = successResponse({
      challengeId: challenge.id,
      nonce,
      action: challenge.action,
      serverTime: now.toISOString(),
      expiresAt: challenge.expiresAt.toISOString(),
      geofenceRadiusMeters: location.geofenceRadiusMeters,
      message: "چالش ایجاد شد؛ احراز زنده چهره و GPS باید پیش از انقضا تکمیل شوند.",
    }, 201);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  } catch (error) { return handleError(error); }
}
