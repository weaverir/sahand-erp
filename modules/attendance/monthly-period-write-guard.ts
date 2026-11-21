import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  assertMonthlyPeriodWritable,
  overlapsMonthlyPeriod,
} from "./monthly-period-lock-policy";

/**
 * Call inside the SAME transaction as the protected write.
 * Locks existing overlapping monthly period rows until commit, so a close
 * transaction using the same row locks cannot overtake this write.
 *
 * This does not create missing periods and is not a substitute for protecting
 * all other write paths before enabling period closing.
 */
export async function assertAttendanceIntervalWritable(
  tx: Prisma.TransactionClient,
  startsAt: Date,
  endsAt: Date,
): Promise<void> {
  if (!Number.isFinite(startsAt.getTime()) ||
      !Number.isFinite(endsAt.getTime()) ||
      startsAt >= endsAt) {
    throw new Error("Invalid attendance interval");
  }

  const periods = await tx.$queryRaw<
    Array<{ id: string; status: string; startsAt: Date; endsAt: Date }>
  >`
    SELECT "id", "status", "startsAt", "endsAt"
    FROM "AttendanceMonthlyPeriod"
    WHERE "startsAt" < ${endsAt}
      AND "endsAt" > ${startsAt}
    ORDER BY "startsAt", "id"
    FOR UPDATE
  `;

  for (const period of periods) {
    if (overlapsMonthlyPeriod(startsAt, endsAt, period.startsAt, period.endsAt)) {
      assertMonthlyPeriodWritable(period.status as Parameters<typeof assertMonthlyPeriodWritable>[0]);
    }
  }
}
