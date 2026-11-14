import "dotenv/config";
import { prisma } from "../libs/prisma";
import { compare } from "bcryptjs";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });

  try {
    const password = await rl.question("Admin password: ");

    const user = await prisma.user.findUnique({
      where: { username: "ehsan" },
      select: {
        isActive: true,
        passwordHash: true,
      },
    });

    if (!user) {
      console.log("USER NOT FOUND");
      return;
    }

    console.log({
      isActive: user.isActive,
      hashExists: !!user.passwordHash,
      passwordMatches: await compare(password, user.passwordHash),
    });
  } finally {
    rl.close();
    await prisma.$disconnect();
  }
}

main().catch(console.error);