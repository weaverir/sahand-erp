/** Pure, platform-independent offline attendance queue policy. No biometric data. */
export type OfflinePunchKind = "CHECK_IN" | "CHECK_OUT";
export type OfflinePunchStatus = "PENDING" | "SYNCED" | "REVIEW_REQUIRED";
export interface OfflinePunch {
  id: string;
  deviceId: string;
  employeeId: string;
  kind: OfflinePunchKind;
  occurredAtDevice: string;
  capturedMonotonicMs: number;
  clockOffsetMs: number | null;
  createdAtDevice: string;
  status: OfflinePunchStatus;
  attempts: number;
  serverReceiptId: string | null;
  reviewReason: string | null;
}
export interface NewOfflinePunch {
  id: string;
  deviceId: string;
  employeeId: string;
  kind: OfflinePunchKind;
  occurredAtDevice: string;
  capturedMonotonicMs: number;
  clockOffsetMs?: number | null;
}
export type SyncResponse =
  | { outcome: "ACCEPTED" | "ALREADY_EXISTS"; receiptId: string }
  | { outcome: "REVIEW_REQUIRED"; reason: string }
  | { outcome: "RETRY" };

function validDate(value: string): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) && /(?:Z|[+-]\d\d:\d\d)$/.test(value);
}
function validId(value: string): boolean { return typeof value === "string" && value.trim().length > 0 && value.length <= 128; }
export function createOfflinePunch(input: NewOfflinePunch): OfflinePunch {
  if (![input.id, input.deviceId, input.employeeId].every(validId)) throw new Error("INVALID_IDENTIFIER");
  if (input.kind !== "CHECK_IN" && input.kind !== "CHECK_OUT") throw new Error("INVALID_KIND");
  if (!validDate(input.occurredAtDevice)) throw new Error("INVALID_TIME");
  if (!Number.isFinite(input.capturedMonotonicMs) || input.capturedMonotonicMs < 0) throw new Error("INVALID_MONOTONIC_TIME");
  if (input.clockOffsetMs != null && !Number.isFinite(input.clockOffsetMs)) throw new Error("INVALID_CLOCK_OFFSET");
  return {
    ...input,
    clockOffsetMs: input.clockOffsetMs ?? null,
    createdAtDevice: input.occurredAtDevice,
    status: "PENDING", attempts: 0, serverReceiptId: null, reviewReason: null,
  };
}
export function enqueueOfflinePunch(queue: readonly OfflinePunch[], punch: OfflinePunch): OfflinePunch[] {
  if (queue.some(p => p.id === punch.id)) throw new Error("DUPLICATE_PUNCH_ID");
  return [...queue, punch];
}
/** Deterministic order; never group by calendar day, because shifts can cross midnight. */
export function pendingForSync(queue: readonly OfflinePunch[]): OfflinePunch[] {
  return queue.filter(p => p.status === "PENDING").sort((a,b) =>
    Date.parse(a.occurredAtDevice) - Date.parse(b.occurredAtDevice) ||
    a.capturedMonotonicMs - b.capturedMonotonicMs || a.id.localeCompare(b.id)
  );
}
export function applySyncResponse(queue: readonly OfflinePunch[], id: string, response: SyncResponse): OfflinePunch[] {
  if (!queue.some(p => p.id === id)) throw new Error("PUNCH_NOT_FOUND");
  return queue.map(p => {
    if (p.id !== id || p.status !== "PENDING") return p;
    const attempts = p.attempts + 1;
    if (response.outcome === "RETRY") return { ...p, attempts };
    if (response.outcome === "REVIEW_REQUIRED") return { ...p, attempts, status: "REVIEW_REQUIRED", reviewReason: response.reason };
    if (!validId(response.receiptId)) throw new Error("INVALID_RECEIPT");
    return { ...p, attempts, status: "SYNCED", serverReceiptId: response.receiptId };
  });
}
export function countPending(queue: readonly OfflinePunch[]): number {
  return queue.filter(p => p.status === "PENDING").length;
}
