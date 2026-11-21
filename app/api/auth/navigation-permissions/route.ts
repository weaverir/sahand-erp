
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/libs/prisma";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";
import { checkPermission } from "@/modules/permissions/access-control";



export async function GET() {
  try {
    const cookieStore = await cookies();

    const token = cookieStore.get(
      AUTH_COOKIE_NAMES.access
    )?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "ابتدا وارد سامانه شوید." },
        { status: 401 }
      );
    }

    const user = await getAuthenticatedUser(token);

    const permissions = await prisma.permission.findMany({
      where: {
        action: "view",
        module: {
          isActive: true,
        },
      },
      select: {
        key: true,
        module: {
          select: {
            key: true,
          },
        },
      },
    });

    const results = await Promise.all(
      permissions.map(async (permission) => ({
        moduleKey: permission.module.key,
        result: await checkPermission({
          userId: user.id,
          permission: permission.key,
        }),
      }))
    );

    const allowedModules = [
      ...new Set(
        results
          .filter((item) => item.result.allowed)
          .map((item) => item.moduleKey)
      ),
    ];

    return NextResponse.json(
      {
        success: true,
        data: {
          modules: allowedModules,
        },
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "[NAVIGATION_PERMISSIONS_ERROR]",
      error
    );

    return NextResponse.json(
      {
        success: false,
        message: "خطا در دریافت مجوزهای کاربر.",
      },
      { status: 500 }
    );
  }
}
