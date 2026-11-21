import { prisma } from "@/libs/prisma";
import { previewMonthlyWorkFromDatabase } from "@/modules/attendance/monthly-work-db";

const periodId = process.argv.find((x) => x.startsWith("--period="))?.slice(9);
const prefix = process.argv.find((x) => x.startsWith("--prefix="))?.slice(9) ?? "dev.staff.";

async function main() {
  const period = periodId
    ? await prisma.attendanceMonthlyPeriod.findUnique({ where: { id: periodId } })
    : await prisma.attendanceMonthlyPeriod.findFirst({ orderBy: { startsAt: "desc" } });
  if (!period) throw new Error("No monthly period found");
  const users = await prisma.user.findMany({
    where: { username: { startsWith: prefix } },
    select: { id: true, username: true },
    orderBy: { username: "asc" },
  });
  if (!users.length) throw new Error(`No test users with prefix ${prefix}`);
  const fields = ["requiredMinutes", "workedMinutes", "holidayWorkMinutes", "approvedLeaveMinutes", "overtimeMinutes", "uncoveredMinutes", "unresolvedCount"] as const;
  let mismatches = 0;
  const results = [];
  for (const user of users) {
    const preview = await previewMonthlyWorkFromDatabase(period.id, user.id);
    const saved = await prisma.monthlyWorkSummary.findUnique({
      where: { periodId_employeeUserId: { periodId: period.id, employeeUserId: user.id } },
    });
    const differences = fields.flatMap((field) => {
      const expected = preview.totals[field];
      const actual = saved?.[field] ?? null;
      return actual === expected ? [] : [{ field, recalculated: expected, saved: actual }];
    });
    mismatches += differences.length;
    results.push({ username: user.username, issues: preview.totals.issues, totals: preview.totals, saved: saved ? { calculationVersion: saved.calculationVersion, calculatedAt: saved.calculatedAt } : null, differences });
  }
  console.log(JSON.stringify({ mode: "READ_ONLY", period: { id: period.id, year: period.jalaliYear, month: period.jalaliMonth, status: period.status }, userCount: users.length, mismatches, results }, null, 2));
  console.log("NOTE: Differences may mean summaries were calculated before a code/data change. This is NOT an independent oracle.");
  process.exitCode = mismatches ? 2 : 0;
}
main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
