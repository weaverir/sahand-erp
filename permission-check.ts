import { prisma } from "./libs/prisma";

async function main() {
  const userId = "b28f2c8d-81ab-44ec-8fbb-eda95747aa0e";

  const connection = await prisma.$queryRaw<
    Array<{
      database_name: string;
      schema_name: string;
      server_address: string | null;
      server_port: number | null;
    }>
  >`
    SELECT
      current_database()::text AS database_name,
      current_schema()::text AS schema_name,
      inet_server_addr()::text AS server_address,
      inet_server_port()::integer AS server_port
  `;

  const assignments = await prisma.employeeAssignment.findMany({
    where: { userId },
    select: {
      id: true,
      status: true,
      isPrimary: true,
      startDate: true,
      endDate: true,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const activeAssignments = await prisma.employeeAssignment.findMany({
    where: {
      userId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      startDate: true,
      endDate: true,
    },
  });

  const now = new Date();

  console.log(
    JSON.stringify(
      {
        connection,
        applicationNow: now.toISOString(),
        assignments,
        activeAssignments,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
