
import "dotenv/config";

import { prisma } from "@/libs/prisma";

const definitions = [
  {
    key: "hr.recruitment.initial.review.hr",
    name: "بررسی اولیه استخدام - منابع انسانی",
    resource: "recruitment.initial",
    action: "review.hr",
    description: "مشاهده و بررسی مرحله اول پرونده استخدامی توسط منابع انسانی.",
  },
  {
    key: "hr.recruitment.initial.review.executive",
    name: "بررسی اولیه استخدام - مدیریت",
    resource: "recruitment.initial",
    action: "review.executive",
    description: "مشاهده و بررسی مرحله اول پرونده استخدامی توسط مدیرعامل یا قائم‌مقام.",
  },
  {
    key: "hr.recruitment.documents.review.hr",
    name: "بررسی مدارک استخدام - منابع انسانی",
    resource: "recruitment.documents",
    action: "review.hr",
    description: "مشاهده و بررسی مدارک تکمیلی توسط منابع انسانی.",
  },
  {
    key: "hr.recruitment.documents.review.executive",
    name: "بررسی مدارک استخدام - مدیریت",
    resource: "recruitment.documents",
    action: "review.executive",
    description: "مشاهده و بررسی مدارک تکمیلی توسط مدیرعامل یا قائم‌مقام.",
  },
];

async function main() {
  const hrModule = await prisma.module.upsert({
    where: {
      key: "hr",
    },
    update: {
      name: "منابع انسانی",
      isActive: true,
    },
    create: {
      key: "hr",
      name: "منابع انسانی",
      description: "ماژول منابع انسانی و استخدام",
      sortOrder: 50,
    },
  });

  for (const item of definitions) {
    await prisma.permission.upsert({
      where: {
        key: item.key,
      },
      update: {
        name: item.name,
        description: item.description,
        moduleId: hrModule.id,
        resource: item.resource,
        action: item.action,
      },
      create: {
        key: item.key,
        name: item.name,
        description: item.description,
        moduleId: hrModule.id,
        resource: item.resource,
        action: item.action,
      },
    });
  }

  console.log("Recruitment permissions created successfully.");

  for (const item of definitions) {
    console.log(`- ${item.key}`);
  }
}

main()
  .catch((error) => {
    console.error("Permission setup failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
