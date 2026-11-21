import assert from "node:assert/strict";
import test from "node:test";
import { reconcileMonthlyLeaveCredit, jalaliMonthBounds } from "../modules/attendance/leave-monthly-credit";
import type { PrismaClient } from "../generated/prisma/client";

const year = 1405;
const month = 9;
const employeeUserId = "employee-test";
const leaveTypeKey = "annual";
const baseKey = `monthly:${employeeUserId}:${leaveTypeKey}:${year}-09`;
const bounds = jalaliMonthBounds(year, month);
const date = (day: number) => new Date(bounds.startDayUtc + (day - 1) * 86400000);
type LedgerRow = { idempotencyKey: string; entryType: "MONTHLY_CREDIT" | "MANUAL_ADJUSTMENT"; minutes: number };
function harness(hireDate: Date, terminationDate: Date | null, initialMinutes = 1180) {
  const rows: LedgerRow[] = [{ idempotencyKey: baseKey, entryType: "MONTHLY_CREDIT", minutes: initialMinutes }];
  let creates = 0;
  const tx = {
    employeeProfile: { findUnique: async () => ({ hireDate, terminationDate }) },
    leaveLedgerEntry: {
      findMany: async () => rows.map((row) => ({ ...row })),
      create: async ({ data }: { data: LedgerRow }) => {
        if (rows.some((r) => r.idempotencyKey === data.idempotencyKey)) throw new Error("duplicate key");
        rows.push({ idempotencyKey: data.idempotencyKey, entryType: data.entryType, minutes: data.minutes });
        creates++;
        return data;
      },
    },
  };
  const prisma = { $transaction: async (callback: (client: any) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  return { prisma, rows, getCreates: () => creates, setTermination: (value: Date | null) => { tx.employeeProfile.findUnique = async () => ({ hireDate, terminationDate: value }); } };
}
const input = { employeeUserId, leaveTypeKey, jalaliYear: year, jalaliMonth: month, createdByUserId: "hr-manager", reason: "employment date correction" };

test("full month requires no adjustment", async () => {
  const h = harness(date(1), null);
  const result = await reconcileMonthlyLeaveCredit(h.prisma, input);
  assert.equal(result.adjustmentMinutes, 0);
  assert.equal(result.adjusted, false);
  assert.equal(h.getCreates(), 0);
});

test("mid-month termination posts a negative correction and retry is idempotent", async () => {
  const h = harness(date(1), date(15));
  const result = await reconcileMonthlyLeaveCredit(h.prisma, input);
  assert.equal(result.expectedMinutes, 590);
  assert.equal(result.adjustmentMinutes, -590);
  assert.equal(h.rows.reduce((sum, r) => sum + r.minutes, 0), 590);
  const again = await reconcileMonthlyLeaveCredit(h.prisma, input);
  assert.equal(again.adjusted, false);
  assert.equal(h.getCreates(), 1);
});

test("later extension posts compensating positive adjustment without rewriting history", async () => {
  const h = harness(date(1), date(15));
  await reconcileMonthlyLeaveCredit(h.prisma, input);
  h.setTermination(date(20));
  const result = await reconcileMonthlyLeaveCredit(h.prisma, input);
  assert.equal(result.expectedMinutes, Math.round(1180 * 20 / 30));
  assert.equal(h.rows.reduce((sum, r) => sum + r.minutes, 0), result.expectedMinutes);
  assert.equal(h.rows.length, 3);
  assert.equal(h.rows[0].minutes, 1180);
});

test("invalid actor or missing reason fails before writing", async () => {
  const h = harness(date(1), date(15));
  await assert.rejects(reconcileMonthlyLeaveCredit(h.prisma, { ...input, createdByUserId: "" }));
  await assert.rejects(reconcileMonthlyLeaveCredit(h.prisma, { ...input, reason: " " }));
  assert.equal(h.getCreates(), 0);
});
