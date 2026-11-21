import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { prisma } from "@/libs/prisma";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.cookies";
import { AuthError, getAuthenticatedUser } from "@/modules/auth/auth.service";
import {
  checkPermission,
  requirePermission,
} from "@/modules/permissions/access-control";

async function getCurrentUser() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(AUTH_COOKIE_NAMES.access)?.value;

  if (!accessToken) {
    redirect("/login");
  }

  try {
    return await getAuthenticatedUser(accessToken);
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/login");
    }

    redirect("/login");
  }
}

/**
 * Enforce one exact permission on a server-rendered page.
 *
 * Example:
 * requirePagePermission("items.items.view")
 */
export async function requirePagePermission(permissionKey: string) {
  const user = await getCurrentUser();

  try {
    await requirePermission(user.id, permissionKey);
    return user;
  } catch {
    redirect("/forbidden");
  }
}

/**
 * Enforce access to an ERP module on a server-rendered layout.
 *
 * Access is granted when the authenticated user has at least
 * one permission belonging to the requested module.
 *
 * Example:
 * requireModulePageAccess("organization")
 */
export async function requireModulePageAccess(moduleKey: string) {
  const user = await getCurrentUser();

  /*
   * We intentionally do not filter Permission by `isActive`.
   *
   * The current Prisma Permission model does not expose an isActive
   * field. Module ownership is determined through the related Module
   * record.
   */
  const permissions = await prisma.permission.findMany({
    where: {
      module: {
        key: moduleKey,
      },
    },
    select: {
      key: true,
    },
  });

  /*
   * A module with no registered permissions must not become
   * automatically accessible.
   */
  if (permissions.length === 0) {
    redirect("/forbidden");
  }

  /*
   * Check the actual permissions of the authenticated user.
   * Having a permission record in the system is not enough;
   * the user must actually be granted that permission.
   */
  const results = await Promise.all(
    permissions.map(({ key }) =>
      checkPermission({
        userId: user.id,
        permission: key,
      })
    )
  );

  /*
   * Module access is granted when at least one permission
   * belonging to that module is allowed for this user.
   */
  if (!results.some((result) => result.allowed)) {
    redirect("/forbidden");
  }

  return user;
}