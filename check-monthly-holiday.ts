import { prisma } from "./libs/prisma";

async function main() {
  const rows = await prisma.monthlyWorkSummary.findMany({
    where: {
      periodId: "cmwnlnmzj0000fs340e2u2njn",
    },
    select: {
      employee: {
        select: { username: true },
      },
      workedMinutes: true,
      holidayWorkMinutes: true,
      overtimeMinutes: true,
      unresolvedCount: true,
      calculationVersion: true,
    },
    orderBy: {
      employee: { username: "asc" },
    },
  });

  console.table(
    rows.map((r) => ({
      username: r.employee.username,
      worked: r.workedMinutes,
      holiday: r.holidayWorkMinutes,
      overtime: r.overtimeMinutes,
      unresolved: r.unresolvedCount,
      version: r.calculationVersion,
    }))
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
