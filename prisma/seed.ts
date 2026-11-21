
import {
  PrismaClient,
  DataScope,
} from "../generated/prisma/client";

const prisma = new PrismaClient();

const modules = [
  {
    key: "dashboard",
    name: "داشبورد",
    resources: ["dashboard"],
    actions: ["view"],
  },
  {
    key: "items",
    name: "مدیریت کالا",
    resources: ["items"],
    actions: ["view", "create", "update", "delete", "export"],
  },
  {
    key: "warehouse",
    name: "انبارداری",
    resources: [
      "stock",
      "goods_receipt",
      "goods_issue",
      "stock_transfer",
      "warehouse",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "approve",
      "cancel",
      "export",
    ],
  },
  {
    key: "production",
    name: "مدیریت تولید",
    resources: [
      "work_order",
      "production_run",
      "material_consumption",
      "production_output",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "approve",
      "cancel",
      "start",
      "stop",
      "export",
    ],
  },
  {
    key: "sales",
    name: "فروش و سفارشات",
    resources: [
      "customer",
      "quotation",
      "sales_order",
      "delivery",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "approve",
      "cancel",
      "export",
    ],
  },
  {
    key: "quality",
    name: "کنترل کیفیت",
    resources: [
      "inspection",
      "quality_report",
    ],
    actions: [
      "view",
      "create",
      "update",
      "approve",
      "reject",
      "export",
    ],
  },
  {
    key: "users",
    name: "مدیریت کاربران",
    resources: [
      "user",
      "role",
      "permission",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "export",
    ],
  },
  {
    key: "reports",
    name: "گزارش‌ها",
    resources: ["reports"],
    actions: ["view", "export"],
  },
  {
    key: "settings",
    name: "تنظیمات سیستم",
    resources: ["settings"],
    actions: ["view", "update"],
  },
  {
    key: "hr",
    name: "منابع انسانی",
    resources: [
      "personnel",
      "recruitment",
      "attendance",
      "shift",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "approve",
      "export",
    ],
  },
  {
    key: "organization",
    name: "ساختار سازمانی",
    resources: [
      "department",
      "position",
      "assignment",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
    ],
  },
  {
    key: "correspondence",
    name: "مکاتبات",
    resources: ["letter"],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "approve",
      "forward",
      "reply",
    ],
  },
  {
    key: "attendance",
    name: "حضور و غیاب",
    resources: [
      "attendance",
      "shift",
      "shift_assignment",
      "holiday_calendar",
    ],
    actions: [
      "view",
      "create",
      "update",
      "delete",
      "assign",
      "approve",
      "export",
    ],
  },
  {
    key: "accounting",
    name: "حسابداری و حقوق",
    resources: [
      "payroll",
      "payslip",
    ],
    actions: [
      "view",
      "create",
      "update",
      "approve",
      "export",
    ],
  },
];

async function main() {
  console.log("شروع ثبت ماژول‌ها و مجوزها...");

  let permissionCount = 0;

  for (const moduleData of modules) {
    const {
      resources,
      actions,
      ...moduleInfo
    } = moduleData;

    const module = await prisma.module.upsert({
      where: {
        key: moduleInfo.key,
      },
      update: {
        name: moduleInfo.name,
        isActive: true,
      },
      create: moduleInfo,
    });

    console.log(`ماژول ثبت شد: ${module.name}`);

    for (const resource of resources) {
      for (const action of actions) {
        const key =
          `${module.key}.${resource}.${action}`;

        await prisma.permission.upsert({
          where: {
            key,
          },
          update: {
            name: `${module.name} - ${resource} - ${action}`,
            moduleId: module.id,
            resource,
            action,
          },
          create: {
            key,
            name: `${module.name} - ${resource} - ${action}`,
            moduleId: module.id,
            resource,
            action,
          },
        });

        permissionCount++;
      }
    }
  }

  const adminRole = await prisma.role.upsert({
    where: {
      key: "system_admin",
    },
    update: {
      name: "مدیر سیستم",
      isSystem: true,
      isActive: true,
    },
    create: {
      key: "system_admin",
      name: "مدیر سیستم",
      description:
        "دسترسی کامل به تمام بخش‌های سیستم",
      isSystem: true,
    },
  });

  const allPermissions =
    await prisma.permission.findMany({
      select: {
        id: true,
      },
    });

  for (const permission of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: permission.id,
        },
      },
      update: {
        isAllowed: true,
        scope: DataScope.ALL,
      },
      create: {
        roleId: adminRole.id,
        permissionId: permission.id,
        isAllowed: true,
        scope: DataScope.ALL,
      },
    });
  }

  console.log("--------------------------------");
  console.log("ثبت مجوزها با موفقیت انجام شد.");
  console.log(`تعداد ماژول‌ها: ${modules.length}`);
  console.log(
    `تعداد مجوزهای پردازش‌شده: ${permissionCount}`
  );
  console.log(
    `تعداد کل مجوزهای دیتابیس: ${allPermissions.length}`
  );
  console.log(
    "دسترسی کامل مدیر سیستم برقرار شد."
  );
}

main()
  .catch((error) => {
    console.error("خطا در اجرای Seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
