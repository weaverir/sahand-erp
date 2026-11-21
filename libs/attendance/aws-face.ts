import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  RekognitionClient, CreateFaceLivenessSessionCommand,
  GetFaceLivenessSessionResultsCommand, CompareFacesCommand,
} from "@aws-sdk/client-rekognition";

export const region = process.env.ATTENDANCE_AWS_REGION || "eu-west-1";
export const rekognition = new RekognitionClient({ region });

type TokenPayload = { sid: string; cid: string; uid: string; exp: number };
function key() {
  const secret = process.env.ATTENDANCE_SESSION_SIGNING_KEY;
  if (!secret || secret.length < 32) throw new Error("ATTENDANCE_SESSION_SIGNING_KEY is missing or weak");
  return secret;
}
function sign(data: string) {
  return createHmac("sha256", key()).update(data).digest("base64url");
}
export function issueSessionToken(payload: TokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}
export function readSessionToken(token: string): TokenPayload {
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra || encoded.length > 2000) throw new Error("Invalid session token");
  const expected = Buffer.from(sign(encoded));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) throw new Error("Invalid signature");
  const payload: unknown = JSON.parse(Buffer.from(encoded, "base64url").toString());
  if (!payload || typeof payload !== "object") throw new Error("Invalid token payload");
  const p = payload as Partial<TokenPayload>;
  if (typeof p.sid !== "string" || typeof p.cid !== "string" || typeof p.uid !== "string" ||
      typeof p.exp !== "number" || p.exp <= Date.now()) throw new Error("Expired or invalid token");
  return p as TokenPayload;
}
export async function startLivenessSession() {
  const result = await rekognition.send(new CreateFaceLivenessSessionCommand({
    Settings: { AuditImagesLimit: 0 },
  }));
  if (!result.SessionId) throw new Error("AWS did not create a session");
  return result.SessionId;
}
export async function checkFaceAgainstReference(sessionId: string, reference: Buffer) {
  const result = await rekognition.send(new GetFaceLivenessSessionResultsCommand({ SessionId: sessionId }));
  const liveness = result.Confidence ?? 0;
  const minLiveness = Number(process.env.ATTENDANCE_LIVENESS_THRESHOLD || "90");
  const minSimilarity = Number(process.env.ATTENDANCE_FACE_THRESHOLD || "95");
  if (![minLiveness, minSimilarity].every(x => Number.isFinite(x) && x >= 0 && x <= 100)) throw new Error("Invalid thresholds");
  if (result.Status !== "SUCCEEDED" || liveness < minLiveness || !result.ReferenceImage?.Bytes) {
    return { verified: false, livenessPassed: false, similarityScore: 0, livenessScore: liveness };
  }
  const match = await rekognition.send(new CompareFacesCommand({
    SourceImage: { Bytes: reference }, TargetImage: { Bytes: result.ReferenceImage.Bytes },
    SimilarityThreshold: minSimilarity,
  }));
  const similarity = Math.max(0, ...((match.FaceMatches ?? []).map(x => x.Similarity ?? 0)));
  return { verified: similarity >= minSimilarity, livenessPassed: true,
    similarityScore: similarity / 100, livenessScore: liveness };
}
