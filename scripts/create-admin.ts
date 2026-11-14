
import "dotenv/config";

import { prisma } from "../libs/prisma";
import { hash } from "bcryptjs";

async function main() {
  const username = process.env.INITIAL_ADMIN_USERNAME?.trim();
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim() || null;
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim();
  const password = process.env.INITIAL_ADMIN_PASSWORD;

  if (!username || !fullName || !password) {
    throw new Error(
      "INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_NAME and INITIAL_ADMIN_PASSWORD are required."
    );
  }

  if (username.length < 3 || username.length > 50) {
    throw new Error("Username must contain 3 to 50 characters.");
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must contain 12 to 128 characters.");
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        ...(email ? [{ email }] : []),
      ],
    },
  });

  if (existingUser) {
    throw new Error("This username or email is already registered.");
  }

  const adminRole = await prisma.role.findUnique({
    where: { key: "system_admin" },
  });

  if (!adminRole || !adminRole.isSystem || !adminRole.isActive) {
    throw new Error(
      "System admin role was not found or is inactive. Run the permission seed first."
    );
  }

  const existingAdmin = await prisma.userRole.findFirst({
    where: {
      isActive: true,
      role: {
        key: "system_admin",
        isSystem: true,
      },
    },
  });

  if (existingAdmin) {
    throw new Error(
      "A system administrator is already assigned. Initial setup is locked."
    );
  }

  const passwordHash = await hash(password, 12);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        email,
        fullName,
        passwordHash,
        isActive: true,
      },
    });

    await tx.userRole.create({
      data: {
        userId: user.id,
        roleId: adminRole.id,
        isActive: true,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: user.id,
        action: "INITIAL_ADMIN_CREATED",
        entityType: "User",
        entityId: user.id,
        details: {
          username,
          role: "system_admin",
        },
      },
    });

    console.log("Initial administrator created successfully.");
    console.log(`Username: ${username}`);
    console.log(`User ID: ${user.id}`);
  });
}

main()
  .catch((error) => {
    console.error("Admin setup failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
