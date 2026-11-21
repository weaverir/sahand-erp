import "dotenv/config";

import { prisma } from "../libs/prisma";
import { DataScope } from "../generated/prisma/client";

const ROLE_KEY = "hr_manager";
const TEST_USERNAME = "hr.test";

// HR owns the HR workspace, attendance/shift administration, and dashboard.
// Executive-only recruitment approvals intentionally remain with CEO/deputy.
const MODULE_KEYS = ["hr", "attendance", "dashboard"] as const;
const EXCLUDED_PERMISSION_KEYS = new Set([
  "hr.recruitment.initial.review.executive",
  "hr.recruitment.documents.review.executive",
]);

async function main() {
  const role = await prisma.role.findUnique({
    where: { key: ROLE_KEY },
    select: { id: true, key: true, isActive: true },
  });

  if (!role) {
    throw new Error(
      "Role hr_manager not found. Run the existing role/permission seed first.",
    );
  }

  if (!role.isActive) {
    await prisma.role.update({
      where: { id: role.id },
      data: { isActive: true },
    });
  }

  const permissions = await prisma.permission.findMany({
    where: {
      module: {
        key: { in: [...MODULE_KEYS] },
        isActive: true,
      },
    },
    select: {
      id: true,
      key: true,
      module: { select: { key: true } },
    },
    orderBy: { key: "asc" },
  });

  const grants = permissions.filter(
    (permission) => !EXCLUDED_PERMISSION_KEYS.has(permission.key),
  );

  const dashboardPermission = grants.find(
    (permission) => permission.key === "dashboard.dashboard.view",
  );

  if (!dashboardPermission) {
    throw new Error(
      "dashboard.dashboard.view is missing. Run prisma/seed.ts before this script.",
    );
  }

  if (!grants.some((permission) => permission.module.key === "hr")) {
    throw new Error(
      "No HR permissions were found. Run prisma/seed.ts and seed-recruitment-permissions.ts first.",
    );
  }

  const hrTestUser = await prisma.user.findUnique({
    where: { username: TEST_USERNAME },
    select: { id: true, username: true, isActive: true },
  });

  if (!hrTestUser) {
    throw new Error("Test account hr.test was not found.");
  }

  if (!hrTestUser.isActive) {
    await prisma.user.update({
      where: { id: hrTestUser.id },
      data: { isActive: true },
    });
  }

  await prisma.$transaction(async (tx) => {
    // Give the complete HR + attendance + dashboard permission bundle
    // to the HR Manager role, so every user holding this role receives it.
    for (const permission of grants) {
      await tx.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        create: {
          roleId: role.id,
          permissionId: permission.id,
          isAllowed: true,
          scope: DataScope.ALL,
        },
        update: {
          isAllowed: true,
          scope: DataScope.ALL,
        },
      });
    }

    // Ensure hr.test is actively assigned to hr_manager.
    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: hrTestUser.id,
          roleId: role.id,
        },
      },
      create: {
        userId: hrTestUser.id,
        roleId: role.id,
        isActive: true,
      },
      update: {
        isActive: true,
        expiresAt: null,
      },
    });
  });

  console.log("HR Manager access updated successfully.");
  console.log(`User: ${TEST_USERNAME}`);
  console.log(`Role: ${ROLE_KEY}`);
  console.log(`Granted permissions: ${grants.length}`);
  console.log("Included modules: hr, attendance, dashboard");
  console.log("Excluded executive-only recruitment approvals.");
  console.log("Existing organization permissions on hr_manager were preserved.");
  console.table(
    grants.map((permission) => ({
      module: permission.module.key,
      permission: permission.key,
    })),
  );
}

main()
  .catch((error) => {
    console.error("Failed to update HR Manager access:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
