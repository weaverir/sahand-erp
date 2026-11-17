
import "dotenv/config";

import { prisma } from "../libs/prisma";
import { DataScope } from "../generated/prisma/client";

const MODULE = {
  key: "organization",
  name: "ساختار سازمانی",
  description: "مدیریت چارت سازمانی، واحدها، سمت‌ها و انتصابات",
};

const ROLES = [
  {
    key: "hr_manager",
    name: "مدیر منابع انسانی",
    description: "مدیریت منابع انسانی و ساختار سازمانی",
  },
  {
    key: "ceo",
    name: "مدیرعامل",
    description: "مدیریت عالی سازمان",
  },
  {
    key: "ceo_deputy",
    name: "قائم مقام مدیرعامل",
    description: "مدیریت و نظارت بر امور سازمان",
  },
] as const;

const PERMISSIONS = [
  {
    key: "organization.chart.view",
    resource: "chart",
    action: "view",
    name: "مشاهده چارت سازمانی",
    description: "مشاهده ساختار درختی سازمان",
  },
  {
    key: "organization.locations.manage",
    resource: "locations",
    action: "manage",
    name: "مدیریت شعب و محل‌های فعالیت",
    description: "ایجاد، ویرایش و غیرفعال‌سازی محل‌ها",
  },
  {
    key: "organization.units.manage",
    resource: "units",
    action: "manage",
    name: "مدیریت واحدهای سازمانی",
    description: "ایجاد، ویرایش، جابه‌جایی و غیرفعال‌سازی واحدها",
  },
  {
    key: "organization.positions.manage",
    resource: "positions",
    action: "manage",
    name: "مدیریت سمت‌های سازمانی",
    description: "تعریف و مدیریت سمت‌های سازمانی",
  },
  {
    key: "organization.assignments.manage",
    resource: "assignments",
    action: "manage",
    name: "مدیریت انتصابات کارکنان",
    description: "انتصاب، انتقال و تغییر مدیر مستقیم کارکنان",
  },
] as const;

async function main() {
  console.log("Starting organization permission seed...");

  await prisma.$transaction(async (tx) => {
    // 1. ایجاد ماژول سازمان
    const module = await tx.module.upsert({
      where: {
        key: MODULE.key,
      },
      create: {
        ...MODULE,
        sortOrder: 90,
        isActive: true,
      },
      update: {},
    });

    console.log("Organization module ready.");

    // 2. ایجاد نقش‌های مدیریتی
    const roles = [];

    for (const roleData of ROLES) {
      const role = await tx.role.upsert({
        where: {
          key: roleData.key,
        },
        create: {
          ...roleData,
          isSystem: false,
          isActive: true,
        },
        update: {},
      });

      roles.push(role);

      console.log(`Role ready: ${role.key}`);
    }

    // 3. ایجاد مجوزها
    const permissions = [];

    for (const permissionData of PERMISSIONS) {
      const permission = await tx.permission.upsert({
        where: {
          key: permissionData.key,
        },
        create: {
          ...permissionData,
          moduleId: module.id,
        },
        update: {},
      });

      permissions.push(permission);

      console.log(`Permission ready: ${permission.key}`);
    }

    // 4. اتصال پنج مجوز به سه نقش مدیریتی
    for (const role of roles) {
      for (const permission of permissions) {
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
          update: {},
        });
      }

      console.log(
        `Permissions assigned to: ${role.key}`
      );
    }
  });

  console.log("--------------------------------");
  console.log("Organization seed completed.");
  console.log("3 roles created or verified.");
  console.log("5 permissions created or verified.");
  console.log("15 role permissions verified.");
  console.log("--------------------------------");
}

main()
  .catch((error) => {
    console.error("Organization seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
