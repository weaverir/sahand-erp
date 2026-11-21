
import { PrismaClient } from "../generated/prisma/client";

const TEST_DATABASE = "sahand_erp_test";

async function main(): Promise<void> {
  const connectionUrl = process.env.DATABASE_URL;

  if (!connectionUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const url = new URL(connectionUrl);
  const currentDatabase = decodeURIComponent(
    url.pathname.replace(/^\//, ""),
  );

  if (currentDatabase !== "sahand_erp") {
    throw new Error(
      `Refusing to create test database from ${currentDatabase}`,
    );
  }

  const prisma = new PrismaClient();

  try {
    const permissions = await prisma.$queryRaw<
      Array<{
        username: string;
        can_create_db: boolean;
      }>
    >`
      SELECT
        current_user AS username,
        rolcreatedb AS can_create_db
      FROM pg_roles
      WHERE rolname = current_user
    `;

    console.log("Database permissions:", permissions);

    if (!permissions[0]?.can_create_db) {
      throw new Error(
        "Current PostgreSQL user cannot create databases",
      );
    }

    const existing = await prisma.$queryRaw<
      Array<{ datname: string }>
    >`
      SELECT datname
      FROM pg_database
      WHERE datname = 'sahand_erp_test'
    `;

    if (existing.length > 0) {
      console.log("Test database already exists.");
      return;
    }

    await prisma.$executeRawUnsafe(
      `CREATE DATABASE "${TEST_DATABASE}"`,
    );

    console.log("Test database created successfully.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
