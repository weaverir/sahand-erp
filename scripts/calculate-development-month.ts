/**
 * Development-only, explicitly authorized monthly calculation runner.
 * Does not generate attendance, approve records, or close periods.
 * Usage:
 * node --env-file=.env --import tsx scripts/calculate-development-month.ts --year=1404 --month=11 --actor=hr.test --confirm-development
 */
import { prisma } from "../libs/prisma";
import { ensureMonthlyPeriod } from "../modules/attendance/jalali-monthly-period";
import { saveEmployeeMonthlyCalculation } from "../modules/attendance/monthly-work-save";

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  const year = Number(arg("year"));
  const month = Number(arg("month"));
  const username = arg("actor");
  if (!Number.isInteger(year) || year < 1402 || year > 1600 || !Number.isInteger(month) || month < 1 || month > 12 || !username) {
    throw new Error("Usage: --year=1404 --month=11 --actor=HR_USERNAME [--confirm-development]");
  }
  const databaseUrl = process.env.DATABASE_URL ?? "";
  const databaseName = (() => { try { return new URL(databaseUrl).pathname.slice(1); } catch { return ""; } })();
  if (!databaseName || !/^(sahand_erp|sahand_erp_test)$/.test(databaseName)) {
    throw new Error("Refusing to run: expected an explicitly recognized Sahand development database");
  }
  if (process.env.NODE_ENV === "production") throw new Error("Not allowed in production");

  const actor = await prisma.user.findUnique({
    where: { username },
    select: { id: true, isActive: true, roles: { where: { isActive: true }, select: { expiresAt: true, role: { select: { key: true, isActive: true } } } } },
  });
  const allowed = Boolean(actor?.isActive && actor.roles.some((r) =>
    r.role.isActive && ["hr_manager", "ceo", "ceo_deputy"].includes(r.role.key) && (!r.expiresAt || r.expiresAt > new Date())
  ));
  if (!allowed || !actor) throw new Error("Actor must be an active HR manager, CEO or deputy with an active role");

  const bounds = await import("../modules/attendance/jalali-monthly-period").then((m) => m.getJalaliMonthBounds(year, month));
  const employees = await prisma.user.findMany({
    where: { username: { startsWith: "dev.staff." }, employeeProfile: { isNot: null }, employeeAssignments: { some: {} } },
    select: { id: true, username: true }, orderBy: { username: "asc" },
  });
  const existing = await prisma.attendanceMonthlyPeriod.findUnique({
    where: { jalaliYear_jalaliMonth: { jalaliYear: year, jalaliMonth: month } },
    select: { status: true, _count: { select: { summaries: true } } },
  });
  const plan = { databaseName, year, month, startsAt: bounds.startsAt, endsAt: bounds.endsAt,
    actor: username, employees: employees.map((e) => e.username), existingPeriod: existing };
  console.log(JSON.stringify(plan, null, 2));
  if (process.argv.includes("--confirm-development") === false) {
    console.log("DRY RUN: no writes. Add --confirm-development to calculate and save.");
    return;
  }
  if (existing && !["OPEN", "REOPENED"].includes(existing.status)) throw new Error("Period is not open; refusing to modify it");
  if (employees.length === 0) throw new Error("No development employees with personnel files and assignments found");

  const period = await ensureMonthlyPeriod(prisma, year, month);
  if (!["OPEN", "REOPENED"].includes(period.status)) throw new Error("Period cannot be calculated");
  const results: Array<{ username: string; unresolvedCount?: number; error?: string }> = [];
  for (const employee of employees) {
    try {
      const saved = await saveEmployeeMonthlyCalculation({
        periodId: period.id,
        employeeUserId: employee.id,
        actorUserId: actor.id,
        authorizeCalculation: async (id) => {
          if (id !== actor.id) throw new Error("Actor mismatch");
          const fresh = await prisma.user.findUnique({ where: { id }, select: {
            isActive: true, roles: { where: { isActive: true }, select: { expiresAt: true, role: { select: { key: true, isActive: true } } } },
          } });
          if (!fresh?.isActive || !fresh.roles.some((r) => r.role.isActive && ["hr_manager", "ceo", "ceo_deputy"].includes(r.role.key) && (!r.expiresAt || r.expiresAt > new Date()))) throw new Error("Authorization revoked");
        },
      });
      results.push({ username: employee.username, unresolvedCount: saved.summary.unresolvedCount });
    } catch (error) {
      results.push({ username: employee.username, error: error instanceof Error ? error.message : String(error) });
    }
  }
  console.log(JSON.stringify({ periodId: period.id, results }, null, 2));
  if (results.some((r) => r.error)) process.exitCode = 1;
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
