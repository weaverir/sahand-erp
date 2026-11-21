import type { PrismaClient } from "../../generated/prisma/client";
import { calculateProratedLeaveCredit } from "./leave-credit-policy";
import { isBeforeLeaveCutover } from "./leave-cutover-policy";

export interface MonthlyCreditInput {
  jalaliYear: number;
  jalaliMonth: number;
  leaveTypeKey: string;
  creditMinutes: number;
  employeeUserIds: string[];
  createdByUserId?: string;
}

export type ProratedMonthlyCreditInput = Omit<MonthlyCreditInput, "creditMinutes">;

export function monthlyCreditKey(userId: string, type: string, year: number, month: number): string {
  if (!userId.trim() || !type.trim()) throw new Error("Employee and leave type are required");
  if (!Number.isSafeInteger(year) || year < 1 || !Number.isSafeInteger(month) || month < 1 || month > 12)
    throw new Error("Invalid Jalali period");
  return `monthly:${userId}:${type}:${year}-${String(month).padStart(2, "0")}`;
}

function validateEmployees(input: ProratedMonthlyCreditInput): void {
  monthlyCreditKey("validation", input.leaveTypeKey, input.jalaliYear, input.jalaliMonth);
  if (!Array.isArray(input.employeeUserIds) ||
      new Set(input.employeeUserIds).size !== input.employeeUserIds.length ||
      input.employeeUserIds.some((id) => typeof id !== "string" || !id.trim())) {
    throw new Error("Invalid or duplicate employee IDs");
  }
  if (input.createdByUserId !== undefined && !input.createdByUserId.trim()) {
    throw new Error("Invalid creator ID");
  }
}

export function validateMonthlyCredit(input: MonthlyCreditInput): void {
  validateEmployees(input);
  if (!Number.isSafeInteger(input.creditMinutes) || input.creditMinutes < 0)
    throw new Error("Credit must be non-negative integer minutes");
}

/** Persian calendar date parts in UTC, suitable for Prisma @db.Date values. */
const persianFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});

function jalaliParts(date: Date): { year: number; month: number; day: number } {
  const parts = persianFormatter.formatToParts(date);
  const number = (type: string): number => {
    const part = parts.find((p) => p.type === type);
    if (!part) throw new Error(`Missing Persian calendar ${type}`);
    const value = Number(part.value);
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid Persian calendar ${type}`);
    return value;
  };
  return { year: number("year"), month: number("month"), day: number("day") };
}

function utcDay(date: Date): number {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) throw new Error("Invalid employment date");
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Finds the exact UTC day boundaries of a Jalali month without assuming Esfand length. */
export function jalaliMonthBounds(year: number, month: number): { startDayUtc: number; endDayUtc: number; daysInMonth: 29 | 30 | 31 } {
  monthlyCreditKey("validation", "validation", year, month);
  // The Persian year starts in March of Gregorian year (Jalali year + 621).
  const firstCandidate = Date.UTC(year + 621, 2, 15);
  let start: number | undefined;
  let end: number | undefined;
  for (let offset = 0; offset < 375; offset++) {
    const day = firstCandidate + offset * 86400000;
    const p = jalaliParts(new Date(day));
    if (p.year === year && p.month === month && p.day === 1) start = day;
    if (start !== undefined && p.year === year && p.month === month && p.day >= 1) end = day;
    if (start !== undefined && end !== undefined && (p.year !== year || p.month !== month)) break;
  }
  if (start === undefined || end === undefined) throw new Error("Could not resolve Jalali month");
  const days = Math.round((end - start) / 86400000) + 1;
  if (days !== 29 && days !== 30 && days !== 31) throw new Error("Invalid Jalali month length");
  return { startDayUtc: start, endDayUtc: end, daysInMonth: days };
}

/** Date-only inclusive employment interval; returns zero for non-overlapping months. */
export function creditForEmploymentDates(
  bounds: ReturnType<typeof jalaliMonthBounds>,
  hireDate: Date,
  terminationDate: Date | null,
): number {
  const hired = utcDay(hireDate);
  const terminated = terminationDate === null ? Number.POSITIVE_INFINITY : utcDay(terminationDate);
  if (terminated < hired) throw new Error("Termination date precedes hire date");
  const first = Math.max(hired, bounds.startDayUtc);
  const last = Math.min(terminated, bounds.endDayUtc);
  if (first > last) return 0;
  const employedFromDay = Math.round((first - bounds.startDayUtc) / 86400000) + 1;
  const employedThroughDay = Math.round((last - bounds.startDayUtc) / 86400000) + 1;
  return calculateProratedLeaveCredit({
    daysInMonth: bounds.daysInMonth, employedFromDay, employedThroughDay,
  }).creditedMinutes;
}

/** Existing explicit-credit API retained for backwards compatibility. */
export async function applyMonthlyLeaveCredits(prisma: PrismaClient, input: MonthlyCreditInput):
  Promise<{ inserted: number; alreadyApplied: number }> {
  validateMonthlyCredit(input);
  return postMonthlyCredits(prisma, input, input.employeeUserIds.map((employeeUserId) => ({
    employeeUserId, minutes: input.creditMinutes,
  })));
}

/**
 * Preferred employment-aware API. Missing profiles fail closed. Zero-credit months
 * are skipped. Previously posted credits are never silently overwritten: changed
 * employment dates require a separate, audited adjustment workflow.
 * Caller must perform trusted authorization before invoking this write service.
 */
export async function applyProratedMonthlyLeaveCredits(prisma: PrismaClient, input: ProratedMonthlyCreditInput):
  Promise<{ inserted: number; alreadyApplied: number; ineligible: number }> {
  validateEmployees(input);
  if (input.employeeUserIds.length === 0) return { inserted: 0, alreadyApplied: 0, ineligible: 0 };
  const bounds = jalaliMonthBounds(input.jalaliYear, input.jalaliMonth);
  const profiles = await prisma.employeeProfile.findMany({
    where: { userId: { in: input.employeeUserIds } },
    select: { userId: true, hireDate: true, terminationDate: true },
  });
  const openings = await prisma.leaveOpeningBalance.findMany({
    where: { employeeUserId: { in: input.employeeUserIds }, leaveTypeKey: input.leaveTypeKey },
    select: { employeeUserId: true, startJalaliYear: true, startJalaliMonth: true },
  });
  const openingById = new Map(openings.map((o) => [o.employeeUserId, o]));
  const byId = new Map(profiles.map((p) => [p.userId, p]));
  const credits = input.employeeUserIds.map((employeeUserId) => {
    const profile = byId.get(employeeUserId);
    if (!profile) throw new Error(`Missing employee profile: ${employeeUserId}`);
    const opening = openingById.get(employeeUserId);
    const beforeCutover = isBeforeLeaveCutover(input.jalaliYear, input.jalaliMonth, opening);
    return { employeeUserId, minutes: beforeCutover ? 0 : creditForEmploymentDates(bounds, profile.hireDate, profile.terminationDate) };
  });
  const eligible = credits.filter((c) => c.minutes > 0);
  const result = await postMonthlyCredits(prisma, input, eligible);
  return { ...result, ineligible: credits.length - eligible.length };
}

async function postMonthlyCredits(
  prisma: PrismaClient,
  input: ProratedMonthlyCreditInput,
  credits: Array<{ employeeUserId: string; minutes: number }>,
): Promise<{ inserted: number; alreadyApplied: number }> {
  if (credits.length === 0) return { inserted: 0, alreadyApplied: 0 };
  const entries = credits.map(({ employeeUserId, minutes }) => ({
    employeeUserId, leaveTypeKey: input.leaveTypeKey,
    jalaliYear: input.jalaliYear, jalaliMonth: input.jalaliMonth,
    entryType: "MONTHLY_CREDIT" as const, minutes,
    idempotencyKey: monthlyCreditKey(employeeUserId, input.leaveTypeKey, input.jalaliYear, input.jalaliMonth),
    createdByUserId: input.createdByUserId,
  }));
  return prisma.$transaction(async (tx) => {
    const openings = await tx.leaveOpeningBalance.findMany({
      where: { employeeUserId: { in: entries.map((e) => e.employeeUserId) }, leaveTypeKey: input.leaveTypeKey },
      select: { employeeUserId: true, startJalaliYear: true, startJalaliMonth: true },
    });
    for (const opening of openings) {
      if (isBeforeLeaveCutover(input.jalaliYear, input.jalaliMonth, opening)) {
        throw new Error(`Monthly credit predates opening cutover: ${opening.employeeUserId}`);
      }
    }
    const existing = await tx.leaveLedgerEntry.findMany({
      where: { idempotencyKey: { in: entries.map((e) => e.idempotencyKey) } },
      select: { idempotencyKey: true, minutes: true, entryType: true, employeeUserId: true, leaveTypeKey: true },
    });
    const byKey = new Map(existing.map((e) => [e.idempotencyKey, e]));
    for (const entry of entries) {
      const old = byKey.get(entry.idempotencyKey);
      if (old && (old.minutes !== entry.minutes || old.entryType !== entry.entryType ||
          old.employeeUserId !== entry.employeeUserId || old.leaveTypeKey !== entry.leaveTypeKey)) {
        throw new Error(`Conflicting monthly credit: ${entry.idempotencyKey}`);
      }
    }
    const result = await tx.leaveLedgerEntry.createMany({ data: entries, skipDuplicates: true });
    return { inserted: result.count, alreadyApplied: entries.length - result.count };
  });
}

export async function getLeaveBalanceMinutes(prisma: PrismaClient, employeeUserId: string,
  leaveTypeKey: string): Promise<number> {
  if (!employeeUserId.trim() || !leaveTypeKey.trim()) throw new Error("Invalid balance query");
  const result = await prisma.leaveLedgerEntry.aggregate({
    where: { employeeUserId, leaveTypeKey }, _sum: { minutes: true },
  });
  return result._sum.minutes ?? 0;
}

/**
 * Reconcile an already-posted monthly credit after an audited employment-date change.
 * This does not create the original monthly credit and never edits prior ledger rows.
 * The caller MUST authorize this business action before calling this function.
 * Run only after the EmployeeProfile dates have been committed.
 */
export async function reconcileMonthlyLeaveCredit(
  prisma: PrismaClient,
  input: {
    employeeUserId: string;
    leaveTypeKey: string;
    jalaliYear: number;
    jalaliMonth: number;
    createdByUserId: string;
    reason: string;
  },
): Promise<{ expectedMinutes: number; postedMinutes: number; adjustmentMinutes: number; adjusted: boolean }> {
  const { employeeUserId, leaveTypeKey, jalaliYear, jalaliMonth, createdByUserId, reason } = input;
  const baseKey = monthlyCreditKey(employeeUserId, leaveTypeKey, jalaliYear, jalaliMonth);
  if (typeof createdByUserId !== "string" || !createdByUserId.trim())
    throw new Error("An adjustment actor is required");
  if (typeof reason !== "string" || !reason.trim())
    throw new Error("An adjustment reason is required");
  const bounds = jalaliMonthBounds(jalaliYear, jalaliMonth);

  return prisma.$transaction(async (tx) => {
    const profile = await tx.employeeProfile.findUnique({
      where: { userId: employeeUserId },
      select: { hireDate: true, terminationDate: true },
    });
    if (!profile) throw new Error(`Missing employee profile: ${employeeUserId}`);
    const expectedMinutes = creditForEmploymentDates(bounds, profile.hireDate, profile.terminationDate);

    const ledger = await tx.leaveLedgerEntry.findMany({
      where: {
        employeeUserId, leaveTypeKey, jalaliYear, jalaliMonth,
        OR: [
          { idempotencyKey: baseKey },
          { idempotencyKey: { startsWith: `adjust:${baseKey}:` } },
        ],
      },
      select: { idempotencyKey: true, entryType: true, minutes: true },
    });
    const original = ledger.find((row) => row.idempotencyKey === baseKey);
    if (!original || original.entryType !== "MONTHLY_CREDIT")
      throw new Error("Original monthly credit is missing; reconciliation cannot create it");
    if (ledger.some((row) => row.idempotencyKey !== baseKey && row.entryType !== "MANUAL_ADJUSTMENT"))
      throw new Error("Unexpected monthly credit adjustment entry type");

    const postedMinutes = ledger.reduce((sum, row) => sum + row.minutes, 0);
    if (!Number.isSafeInteger(postedMinutes)) throw new Error("Invalid posted credit total");
    const adjustmentMinutes = expectedMinutes - postedMinutes;
    if (!Number.isSafeInteger(adjustmentMinutes)) throw new Error("Invalid adjustment amount");
    if (adjustmentMinutes === 0)
      return { expectedMinutes, postedMinutes, adjustmentMinutes: 0, adjusted: false };

    const revisions = ledger.filter((row) => row.idempotencyKey.startsWith(`adjust:${baseKey}:`));
    const revision = revisions.reduce((max, row) => {
      const suffix = row.idempotencyKey.slice(`adjust:${baseKey}:`.length);
      const n = Number(suffix);
      if (!Number.isSafeInteger(n) || n < 1) throw new Error("Invalid adjustment revision");
      return Math.max(max, n);
    }, 0) + 1;

    await tx.leaveLedgerEntry.create({
      data: {
        employeeUserId, leaveTypeKey, jalaliYear, jalaliMonth,
        entryType: "MANUAL_ADJUSTMENT",
        minutes: adjustmentMinutes,
        idempotencyKey: `adjust:${baseKey}:${revision}`,
        createdByUserId,
        note: `Monthly employment proration correction: ${reason.trim()}`,
      },
    });
    return { expectedMinutes, postedMinutes, adjustmentMinutes, adjusted: true };
  }, { isolationLevel: "Serializable", timeout: 30000 });
}
