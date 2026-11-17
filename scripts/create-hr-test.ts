
import "dotenv/config";

import { hash } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

import { prisma } from "../libs/prisma";
import { UserAccessLevel } from "../generated/prisma/client";
async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const username = "hr.test";

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (existing) {
      console.log("حساب hr.test از قبل وجود دارد.");
      return;
    }

    const role = await prisma.role.findUnique({
      where: { key: "hr_manager" },
      select: { id: true },
    });

    if (!role) {
      throw new Error("نقش hr_manager پیدا نشد.");
    }

    const permissions = await prisma.rolePermission.count({
      where: {
        roleId: role.id,
        isAllowed: true,
        permission: {
          key: {
            in: [
              "hr.recruitment.initial.review.hr",
              "hr.recruitment.documents.review.hr",
            ],
          },
        },
      },
    });

    if (permissions !== 2) {
      throw new Error("مجوزهای HR کامل نیستند.");
    }

    const fullName = await rl.question(
      "نام نمایشی حساب HR: "
    );

    const password = await rl.question(
      "رمز عبور جدید (حداقل 12 کاراکتر): "
    );

    if (!fullName.trim() || password.length < 12) {
      throw new Error("نام یا رمز عبور معتبر نیست.");
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        username,
        fullName: fullName.trim(),
        passwordHash,
        isActive: true,
        accessLevel: UserAccessLevel.ERP,
        isSystem: false,
        roles: {
          create: {
            role: {
              connect: { id: role.id },
            },
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        accessLevel: true,
      },
    });

    console.log("\nحساب HR با موفقیت ساخته شد:");
    console.table(user);
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("خطا در ساخت حساب HR:", error);
  process.exitCode = 1;
});
