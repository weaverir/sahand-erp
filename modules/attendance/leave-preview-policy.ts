/** A preview is informational; it never reserves or deducts leave. */
export function summarizeLeavePreview(balanceMinutes: number | null, requestedMinutes: number) {
  if (!Number.isSafeInteger(requestedMinutes) || requestedMinutes <= 0) throw new Error('مدت مرخصی نامعتبر است.');
  if (balanceMinutes !== null && !Number.isSafeInteger(balanceMinutes)) throw new Error('مانده مرخصی نامعتبر است.');
  return {
    requestedMinutes,
    balanceMinutes,
    remainingMinutes: balanceMinutes === null ? null : balanceMinutes - requestedMinutes,
    initialized: balanceMinutes !== null,
  };
}
