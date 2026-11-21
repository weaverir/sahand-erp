import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/libs/prisma";
import { lockShiftAssignments } from "./assignment-conflict-db";

export async function runShiftWrite<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await lockShiftAssignments(tx);
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    } catch (error) {
      if (attempt >= 3 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2034") throw error;
      await new Promise(resolve => setTimeout(resolve, attempt * 50));
    }
  }
}
