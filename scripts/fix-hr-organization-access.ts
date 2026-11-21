import "dotenv/config";
import { prisma } from "../libs/prisma";
import { DataScope } from "../generated/prisma/client";

const required = [
  { key: "organization.chart.view", resource: "chart", action: "view", name: "View organization chart" },
  { key: "organization.locations.manage", resource: "locations", action: "manage", name: "Manage organization locations" },
  { key: "organization.units.manage", resource: "units", action: "manage", name: "Manage organization units" },
  { key: "organization.positions.manage", resource: "positions", action: "manage", name: "Manage organization positions" },
  { key: "organization.assignments.manage", resource: "assignments", action: "manage", name: "Manage employee assignments" },
  { key: "organization.access.view", resource: "access", action: "view", name: "View assignment access" },
  { key: "organization.access.manage", resource: "access", action: "manage", name: "Manage assignment access" },
  { key: "organization.audit.view", resource: "audit", action: "view", name: "View organization audit log" },
] as const;

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const module = await tx.module.upsert({
      where: { key: "organization" },
      create: { key: "organization", name: "Organization", isActive: true },
      update: { isActive: true },
    });
    const role = await tx.role.findUnique({ where: { key: "hr_manager" } });
    if (!role) throw new Error("Role hr_manager not found. No changes committed.");
    if (!role.isActive) throw new Error("Role hr_manager is inactive. No changes committed.");

    for (const entry of required) {
      const permission = await tx.permission.upsert({
        where: { key: entry.key },
        create: { ...entry, moduleId: module.id },
        update: {},
      });
      if (permission.moduleId !== module.id) {
        throw new Error(`Permission ${entry.key} belongs to a different module. No changes committed.`);
      }
      await tx.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        create: { roleId: role.id, permissionId: permission.id, isAllowed: true, scope: DataScope.ALL },
        update: { isAllowed: true, scope: DataScope.ALL },
      });
    }

    const user = await tx.user.findUnique({ where: { username: "hr.test" }, select: { id: true, isActive: true, accessLevel: true } });
    if (!user) throw new Error("User hr.test not found. No changes committed.");
    if (!user.isActive || user.accessLevel !== "ERP") {
      throw new Error("User hr.test is inactive or lacks ERP access. No changes committed.");
    }
    await tx.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: role.id } },
      create: { userId: user.id, roleId: role.id, isActive: true },
      update: { isActive: true, expiresAt: null },
    });
    return { username: "hr.test", role: role.key, permissions: required.map((p) => p.key) };
  });
  console.log(JSON.stringify({ success: true, ...result }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
