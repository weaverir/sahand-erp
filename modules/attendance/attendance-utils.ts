import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createChallengeNonce() {
  return randomBytes(32).toString("base64url");
}
export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function safeHexEqual(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}
export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip") || null;
}
export function getWorkDate(now: Date) {
  const timeZone = process.env.ATTENDANCE_TIME_ZONE || "Asia/Tehran";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const value = (type: string) => parts.find(p => p.type === type)?.value;
  const year = Number(value("year")), month = Number(value("month")), day = Number(value("day"));
  if (!year || !month || !day) throw new Error("Unable to calculate attendance date.");
  return new Date(Date.UTC(year, month - 1, day));
}
export function getSaturdayBasedDayOfWeek(workDate: Date) {
  return (workDate.getUTCDay() + 1) % 7;
}
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = 6371000, rad = (v: number) => v * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return r * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function getApiError(error: unknown) {
  const statusCode = typeof error === "object" && error !== null && "statusCode" in error &&
    typeof (error as {statusCode?: unknown}).statusCode === "number"
      ? (error as {statusCode: number}).statusCode : 500;
  const message = error instanceof Error && statusCode < 500
    ? error.message
    : error instanceof Error && statusCode === 503
      ? error.message
      : "خطا در پردازش درخواست حضور و غیاب.";
  return { statusCode, message };
}
