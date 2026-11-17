
import "dotenv/config";

import { prisma } from "../libs/prisma";
import {
  DataScope,
  UserAccessLevel,
} from "../generated/prisma/client";

async function main() {
  const username = process.env.SUPER_ADMIN_USERNAME?.trim();

  if (!username) {
    throw new Error(
      "SUPER_ADMIN_USERNAME is required."
    );
  }

  await prisma.$transaction(async (tx) => {
    // 1. پیدا کردن حساب مدیر سیستم
    const user = await tx.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        fullName: true,
        isActive: true,
        accessLevel: true,
      },
    });

    if (!user) {
      throw new Error(
        "Specified user was not found."
      );
    }

    if (!user.isActive) {
      throw new Error(
        "The specified user is inactive."
      );
    }

    if (user.accessLevel !== UserAccessLevel.ERP) {
      throw new Error(
        "Super Admin must have ERP access level."
      );
    }

    // 2. ایجاد یا بازیابی نقش Super Admin
    const role = await tx.role.upsert({
      where: {
        key: "super_admin",
      },
      create: {
        key: "super_admin",
        name: "مدیر ارشد فنی سامانه",
        description:
          "بالاترین سطح دسترسی فنی، توسعه، تست و پشتیبانی ERP",
        isSystem: true,
        isActive: true,
      },
      update: {
        name: "مدیر ارشد فنی سامانه",
        description:
          "بالاترین سطح دسترسی فنی، توسعه، تست و پشتیبانی ERP",
        isSystem: true,
        isActive: true,
      },
    });

    // 3. جلوگیری از تخصیص ناخواسته نقش به چند حساب
    const otherSuperAdmins = await tx.userRole.findMany({
      where: {
        roleId: role.id,
        isActive: true,
        userId: { not: user.id },
      },
      select: {
        userId: true,
      },
    });

    if (otherSuperAdmins.length > 0) {
      throw new Error(
        "Another active Super Admin assignment already exists."
      );
    }

    // 4. اتصال نقش به حساب مشخص‌شده
    const existingAssignment = await tx.userRole.findUnique({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
    });

    await tx.userRole.upsert({
      where: {
        userId_roleId: {
          userId: user.id,
          roleId: role.id,
        },
      },
      create: {
        userId: user.id,
        roleId: role.id,
        assignedById: user.id,
        isActive: true,
      },
      update: {
        isActive: true,
        expiresAt: null,
      },
    });

    // 5. ثبت تمام مجوزهای موجود برای نمایش در پنل نقش‌ها
    const permissions = await tx.permission.findMany({
      select: {
        id: true,
      },
    });

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
        update: {
          isAllowed: true,
          scope: DataScope.ALL,
        },
      });
    }

    // 6. ثبت رویداد امنیتی
    if (!existingAssignment?.isActive) {
      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "SUPER_ADMIN_ROLE_ASSIGNED",
          entityType: "User",
          entityId: user.id,
          details: {
            username: user.username,
            role: "super_admin",
            permissionCount: permissions.length,
          },
        },
      });
    }

    console.log("Super Admin configured successfully.");
    console.log(`Username: ${user.username}`);
    console.log(`User ID: ${user.id}`);
    console.log(`Permissions: ${permissions.length}`);
  });
}

main()
  .catch((error) => {
    console.error(
      "Super Admin setup failed:",
      error.message
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
