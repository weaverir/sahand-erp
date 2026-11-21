import "server-only";
import { localFaceRequest } from "./local-face-client";

export type FaceVerificationResult = {
  verified: boolean; livenessPassed: boolean; similarityScore: number;
  provider: string; verificationId: string;
};
export class FaceProviderUnavailableError extends Error {
  statusCode = 503;
  constructor(message = "سرویس داخلی چهره در دسترس نیست.") { super(message); this.name = "FaceProviderUnavailableError"; }
}
export class FaceVerificationRejectedError extends Error {
  statusCode = 403;
  constructor(message = "تطبیق چهره یا زنده بودن تأیید نشد.") { super(message); this.name = "FaceVerificationRejectedError"; }
}
export async function verifyLiveFace(input: {
  challengeId: string; challengeNonce: string; userId: string;
  action: "CHECK_IN" | "CHECK_OUT"; liveSessionToken: string;
  referenceImage: Buffer; referenceImageMimeType: string;
}): Promise<FaceVerificationResult> {
  let result: FaceVerificationResult;
  try {
    result = await localFaceRequest<FaceVerificationResult>("/v1/verify", {
      challengeId: input.challengeId, challengeNonce: input.challengeNonce,
      subjectId: input.userId, action: input.action,
      liveSessionToken: input.liveSessionToken,
      referenceImageBase64: input.referenceImage.toString("base64"),
      referenceImageMimeType: input.referenceImageMimeType,
    });
  } catch { throw new FaceProviderUnavailableError(); }
  if (!result || result.provider !== "SAHAND_LOCAL" ||
      !Number.isFinite(result.similarityScore) || result.similarityScore < 0 || result.similarityScore > 1 ||
      typeof result.verificationId !== "string") throw new FaceProviderUnavailableError("پاسخ سرویس داخلی نامعتبر است.");
  if (result.verified !== true || result.livenessPassed !== true) throw new FaceVerificationRejectedError();
  return result;
}
