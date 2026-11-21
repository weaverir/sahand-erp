
import "dotenv/config";

import { prisma } from "../libs/prisma";

const usernames = ["hr.test", "ceo.test"];

const moduleKeys = [
  "dashboard",
  "hr",
  "organization",
  "items",
];

interface GrantEntry {
  source: string;
  role: string | null;
  assignmentId: string | null;
  permission: string;
  allowed: boolean;
  scope: string;
  expiresAt: Date | null;
}

async function main() {
  const now = new Date();

  for (const username of usernames) {
    console.log("\n====================================");
    console.log(`USER: ${username}`);
    console.log("====================================");

    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        accessLevel: true,
        isSystem: true,

        roles: {
          select: {
            isActive: true,
            expiresAt: true,
            role: {
              select: {
                key: true,
                isActive: true,
                isSystem: true,
                permissions: {
                  select: {
                    isAllowed: true,
                    scope: true,
                    permission: {
                      select: { key: true },
                    },
                  },
                },
              },
            },
          },
        },

        employeeAssignments: {
          select: {
            id: true,
            status: true,
            isPrimary: true,
            startDate: true,
            endDate: true,

            roles: {
              select: {
                isActive: true,
                expiresAt: true,
                role: {
                  select: {
                    key: true,
                    isActive: true,
                    isSystem: true,
                    permissions: {
                      select: {
                        isAllowed: true,
                        scope: true,
                        permission: {
                          select: { key: true },
                        },
                      },
                    },
                  },
                },
              },
            },

            permissions: {
              select: {
                isActive: true,
                expiresAt: true,
                isAllowed: true,
                scope: true,
                permission: {
                  select: { key: true },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      console.log("USER NOT FOUND");
      continue;
    }

    console.log("\nPROFILE:");
    console.table({
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      isActive: user.isActive,
      accessLevel: user.accessLevel,
      isSystem: user.isSystem,
    });

    const grants: GrantEntry[] = [];

    // Global user roles
    for (const userRole of user.roles) {
      for (const rp of userRole.role.permissions) {
        grants.push({
          source: "GLOBAL_ROLE",
          role: userRole.role.key,
          assignmentId: null,
          permission: rp.permission.key,
          allowed: rp.isAllowed,
          scope: rp.scope,
          expiresAt: userRole.expiresAt,
        });
      }
    }

    // Organization assignment roles and direct permissions
    for (const assignment of user.employeeAssignments) {
      for (const assignmentRole of assignment.roles) {
        for (const rp of assignmentRole.role.permissions) {
          grants.push({
            source: "ASSIGNMENT_ROLE",
            role: assignmentRole.role.key,
            assignmentId: assignment.id,
            permission: rp.permission.key,
            allowed: rp.isAllowed,
            scope: rp.scope,
            expiresAt: assignmentRole.expiresAt,
          });
        }
      }

      for (const permission of assignment.permissions) {
        grants.push({
          source: "ASSIGNMENT_DIRECT",
          role: null,
          assignmentId: assignment.id,
          permission: permission.permission.key,
          allowed: permission.isAllowed,
          scope: permission.scope,
          expiresAt: permission.expiresAt,
        });
      }
    }

    console.log("\nGLOBAL ROLES:");

    console.log(
      JSON.stringify(
        user.roles.map((r) => ({
          role: r.role.key,
          userRoleActive: r.isActive,
          roleActive: r.role.isActive,
          expiresAt: r.expiresAt,
          validNow:
            r.isActive &&
            r.role.isActive &&
            (!r.expiresAt || r.expiresAt > now),
          isSystemRole: r.role.isSystem,
        })),
        null,
        2
      )
    );

    console.log("\nALL ORGANIZATION ASSIGNMENTS:");

    console.log(
      JSON.stringify(
        user.employeeAssignments.map((a) => ({
          id: a.id,
          status: a.status,
          isPrimary: a.isPrimary,
          startDate: a.startDate,
          endDate: a.endDate,
          validByDate:
            a.startDate <= now &&
            (!a.endDate || a.endDate > now),
          roles: a.roles.map((r) => ({
            role: r.role.key,
            assignmentRoleActive: r.isActive,
            roleActive: r.role.isActive,
            expiresAt: r.expiresAt,
          })),
          directPermissions: a.permissions.map((p) => ({
            key: p.permission.key,
            active: p.isActive,
            allowed: p.isAllowed,
            expiresAt: p.expiresAt,
          })),
        })),
        null,
        2
      )
    );

    console.log("\nALL RAW PERMISSION GRANTS:");

    console.log(
      JSON.stringify(grants, null, 2)
    );

    const allPermissions =
      await prisma.permission.findMany({
        where: {
          module: {
            key: { in: moduleKeys },
          },
        },
        select: {
          key: true,
          module: {
            select: { key: true },
          },
        },
        orderBy: { key: "asc" },
      });

    console.log("\nMODULE PERMISSION ANALYSIS:");

    for (const moduleKey of moduleKeys) {
      const permissions = allPermissions.filter(
        (p) => p.module.key === moduleKey
      );

      console.log(`\n========== ${moduleKey} ==========`);

      for (const permission of permissions) {
        const matching = grants.filter(
          (g) => g.permission === permission.key
        );

        console.log({
          permission: permission.key,
          grants: matching.map((g) => ({
            source: g.source,
            role: g.role,
            assignmentId: g.assignmentId,
            allowed: g.allowed,
            scope: g.scope,
            expiresAt: g.expiresAt,
          })),
          hasAnyGrant: matching.some((g) => g.allowed),
          hasExplicitDeny: matching.some((g) => !g.allowed),
          hasNoGrant: matching.length === 0,
        });
      }
    }

    console.log("\nDIAGNOSTIC SUMMARY:");

    console.table({
      globalRoles: user.roles.length,
      assignments: user.employeeAssignments.length,
      primaryAssignments: user.employeeAssignments.filter(
        (a) => a.isPrimary
      ).length,
      totalRawGrants: grants.length,
      positiveGrants: grants.filter(
        (g) => g.allowed
      ).length,
      explicitDenials: grants.filter(
        (g) => !g.allowed
      ).length,
      systemAdmin: user.isSystem,
    });
  }
}

main()
  .catch((error) => {
    console.error("DIAGNOSTIC ERROR:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
