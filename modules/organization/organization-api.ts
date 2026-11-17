import "server-only";
import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";
import { checkPermission } from "@/modules/permissions/access-control";

export class OrganizationApiError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
    this.name = "OrganizationApiError";
  }
}

export async function currentActor() {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE_NAMES.access)?.value;
  if (!token) throw new OrganizationApiError("ابتدا وارد سامانه شوید.", 401);
  try {
    return await getAuthenticatedUser(token);
  } catch {
    throw new OrganizationApiError("نشست شما معتبر نیست؛ دوباره وارد شوید.", 401);
  }
}

export async function requireOrganizationAccess(permission: string) {
  const actor = await currentActor();
  const user = await prisma.user.findFirst({
    where: { id: actor.id, isActive: true, accessLevel: "ERP" },
    select: {
      roles: {
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          role: { isActive: true },
        },
        select: { role: { select: { key: true, isSystem: true } } },
      },
    },
  });
  if (!user) throw new OrganizationApiError("کاربر فعال ERP یافت نشد.", 403);

  const roleKeys = user.roles.map(x => x.role.key);
  const isSuperAdmin = user.roles.some(x => x.role.key === "super_admin" && x.role.isSystem);
  const isSystemAdmin = user.roles.some(x => x.role.key === "system_admin" && x.role.isSystem);
  const businessRoles = ["hr_manager", "ceo", "ceo_deputy"];
  const hasBusinessRole = roleKeys.some(key => businessRoles.includes(key));

  // مدیران فنی به چارت واقعی دسترسی دارند؛ هر عملیات تغییردهنده در همین API ثبت حسابرسی می‌شود.
  if (isSuperAdmin || isSystemAdmin || hasBusinessRole) {
    if (isSystemAdmin || isSuperAdmin) return { actor, isSystemAdmin, isSuperAdmin };
    const result = await checkPermission({ userId: actor.id, permission });
    if (result.allowed) return { actor, isSystemAdmin, isSuperAdmin };
  }
  throw new OrganizationApiError("برای این عملیات مجوز سازمانی ندارید.", 403);
}

export async function audit(
  actorUserId: string,
  entityType: string,
  entityId: string,
  action: string,
  beforeData?: unknown,
  afterData?: unknown
) {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  await prisma.organizationAuditLog.create({
    data: {
      actorUserId,
      entityType,
      entityId,
      action,
      beforeData: beforeData === undefined ? undefined : (beforeData as any),
      afterData: afterData === undefined ? undefined : (afterData as any),
      ipAddress,
    },
  });
}

export function jsonError(error: unknown) {
  if (error instanceof OrganizationApiError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return NextResponse.json({ success: false, message: "این مورد قبلاً ثبت شده است." }, { status: 409 });
  }
  console.error("Organization API error:", error);
  return NextResponse.json({ success: false, message: "خطای داخلی در پردازش درخواست سازمانی." }, { status: 500 });
}

export function parseDate(value: unknown, field: string, optional = false): Date | null {
  if ((value === null || value === undefined || value === "") && optional) return null;
  if (typeof value !== "string" && !(value instanceof Date)) {
    throw new OrganizationApiError(`${field} معتبر نیست.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new OrganizationApiError(`${field} معتبر نیست.`);
  return date;
}
