
import { prisma } from "@/libs/prisma";
import { DataScope } from "@/generated/prisma/client";

type PermissionCheck = {
  userId: string;
  permission: string;
};

export type PermissionResult = {
  allowed: boolean;
  scopes: DataScope[];
  isSystemAdmin: boolean;
};

export class PermissionDeniedError extends Error {
  statusCode = 403;

  constructor(message = "شما اجازه انجام این عملیات را ندارید.") {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

/**
 * بررسی مجوز کاربر
 *
 * نمونه:
 * warehouse.goods_receipt.approve
 */
export async function checkPermission({
  userId,
  permission,
}: PermissionCheck): Promise<PermissionResult> {
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
    select: {
      id: true,
      roles: {
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
          role: {
            isActive: true,
          },
        },
        select: {
          role: {
            select: {
              key: true,
              isSystem: true,
              permissions: {
                where: {
                  permission: {
                    key: permission,
                  },
                },
                select: {
                  isAllowed: true,
                  scope: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    return {
      allowed: false,
      scopes: [],
      isSystemAdmin: false,
    };
  }

  // مدیر سیستم به تمام مجوزهای فعلی و آینده دسترسی دارد.
  const isSystemAdmin = user.roles.some(
    (userRole) =>
      userRole.role.isSystem &&
      userRole.role.key === "system_admin"
  );

  if (isSystemAdmin) {
    return {
      allowed: true,
      scopes: [DataScope.ALL],
      isSystemAdmin: true,
    };
  }

  const grants = user.roles.flatMap(
    (userRole) => userRole.role.permissions
  );

  // مجوز صریحاً ردشده، بر سایر نقش‌ها اولویت دارد.
  if (grants.some((grant) => !grant.isAllowed)) {
    return {
      allowed: false,
      scopes: [],
      isSystemAdmin: false,
    };
  }

  const allowedGrants = grants.filter(
    (grant) => grant.isAllowed
  );

  if (allowedGrants.length === 0) {
    return {
      allowed: false,
      scopes: [],
      isSystemAdmin: false,
    };
  }

  const scopes = [
    ...new Set(allowedGrants.map((grant) => grant.scope)),
  ];

  return {
    allowed: true,
    scopes,
    isSystemAdmin: false,
  };
}

/**
 * بررسی ساده مجوز
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const result = await checkPermission({
    userId,
    permission,
  });

  return result.allowed;
}

/**
 * بررسی اجباری مجوز
 * در صورت نداشتن دسترسی خطای 403 ایجاد می‌کند.
 */
export async function requirePermission(
  userId: string,
  permission: string
): Promise<PermissionResult> {
  const result = await checkPermission({
    userId,
    permission,
  });

  if (!result.allowed) {
    throw new PermissionDeniedError();
  }

  return result;
}

/**
 * بررسی دسترسی به اطلاعات متعلق به کاربر
 */
export function canAccessOwnData(
  result: PermissionResult,
  ownerUserId: string,
  currentUserId: string
): boolean {
  if (!result.allowed) return false;

  if (result.scopes.includes(DataScope.ALL)) {
    return true;
  }

  if (result.scopes.includes(DataScope.OWN)) {
    return ownerUserId === currentUserId;
  }

  return false;
}
