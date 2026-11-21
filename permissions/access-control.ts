
import "server-only";

import { prisma } from "@/libs/prisma";
import { DataScope } from "@/generated/prisma/client";

type PermissionCheck = {
  userId: string;
  permission: string;
  assignmentId?: string;
};

export type PermissionResult = {
  allowed: boolean;
  scopes: DataScope[];
  isSystemAdmin: boolean;
  activeAssignmentId: string | null;
};

export class PermissionDeniedError extends Error {
  statusCode = 403;

  constructor(
    message = "شما اجازه انجام این عملیات را ندارید."
  ) {
    super(message);
    this.name = "PermissionDeniedError";
  }
}

const emptyResult = (): PermissionResult => ({
  allowed: false,
  scopes: [],
  isSystemAdmin: false,
  activeAssignmentId: null,
});

/**
 * بررسی مجوز در سطح کاربر و مسئولیت سازمانی
 *
 * بدون assignmentId:
 * مسئولیت اصلی و فعال کاربر بررسی می‌شود.
 *
 * با assignmentId:
 * همان مسئولیت مشخص، در صورت تعلق به کاربر و فعال بودن،
 * بررسی می‌شود.
 */
export async function checkPermission({
  userId,
  permission,
  assignmentId,
}: PermissionCheck): Promise<PermissionResult> {
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
    },
    select: {
      id: true,
      accessLevel: true,

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

      employeeAssignments: {
        where: {
          status: "ACTIVE",
          AND: [
            { startDate: { lte: now } },
            {
              OR: [
                { endDate: null },
                { endDate: { gt: now } },
              ],
            },
            assignmentId
              ? { id: assignmentId }
              : {},
          ],
        },
        orderBy: [
          { isPrimary: "desc" },
          { startDate: "desc" },
        ],
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
                isSystem: false,
              },
            },
            select: {
              role: {
                select: {
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

          permissions: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
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
  });

  if (!user || user.accessLevel !== "ERP") {
    return emptyResult();
  }

  const assignments = user.employeeAssignments;
  const assignment = assignments[0] ?? null;

  if (assignmentId && !assignment) {
    return emptyResult();
  }

  // Technical administrators must never bypass business approval permissions.
  const businessDecision = /(?:^|\.)(?:approve|approval|reject|finalize|decision|review)(?:\.|$)/i.test(permission);

  // مدیر سیستم
  const isSystemAdmin = user.roles.some(
    (userRole) =>
      userRole.role.isSystem &&
      userRole.role.key === "system_admin"
  );

  if (isSystemAdmin && !businessDecision) {
    return {
      allowed: true,
      scopes: [DataScope.ALL],
      isSystemAdmin: true,
      activeAssignmentId: assignment?.id ?? null,
    };
  }

  // مجوزهای عمومی
  const globalGrants = user.roles.flatMap(
    (userRole) => userRole.role.permissions
  );

  // مجوزهای نقش‌های مسئولیت انتخاب‌شده
  const assignmentRoleGrants = assignments.flatMap(
    (item) => item.roles.flatMap(
      (assignmentRole) => assignmentRole.role.permissions
    )
  );

  // مجوزهای مستقیم مسئولیت
  const assignmentDirectGrants = assignments.flatMap(
    (item) => item.permissions
  );

  const grants = [
    ...globalGrants,
    ...assignmentRoleGrants,
    ...assignmentDirectGrants,
  ];

  // منع صریح دسترسی اولویت دارد.
  if (grants.some((grant) => !grant.isAllowed)) {
    return {
      allowed: false,
      scopes: [],
      isSystemAdmin: false,
      activeAssignmentId: assignment?.id ?? null,
    };
  }

  const allowedGrants = grants.filter(
    (grant) => grant.isAllowed
  );

  if (allowedGrants.length === 0) {
    return {
      ...emptyResult(),
      activeAssignmentId: assignment?.id ?? null,
    };
  }

  const scopes = [
    ...new Set(
      allowedGrants.map((grant) => grant.scope)
    ),
  ];

  return {
    allowed: true,
    scopes,
    isSystemAdmin: false,
    activeAssignmentId: assignment?.id ?? null,
  };
}

/**
 * دریافت تمام مجوزهای مؤثر کاربر
 *
 * این تابع از همان موتور checkPermission استفاده می‌کند.
 * بنابراین منطق Sidebar و کنترل دسترسی صفحات یکسان است.
 *
 * فقط مجوزهای ماژول‌های فعال بررسی می‌شوند.
 */
export async function getUserPermissions(
  userId: string
): Promise<string[]> {
  const permissions = await prisma.permission.findMany({
    where: {
      module: {
        isActive: true,
      },
    },
    select: {
      key: true,
    },
    orderBy: {
      key: "asc",
    },
  });

  if (permissions.length === 0) {
    return [];
  }

  const results = await Promise.all(
    permissions.map(async ({ key }) => {
      const result = await checkPermission({
        userId,
        permission: key,
      });

      return {
        key,
        allowed: result.allowed,
      };
    })
  );

  return results
    .filter((item) => item.allowed)
    .map((item) => item.key);
}

/**
 * بررسی ساده مجوز
 */
export async function hasPermission(
  userId: string,
  permission: string,
  assignmentId?: string
): Promise<boolean> {
  const result = await checkPermission({
    userId,
    permission,
    assignmentId,
  });

  return result.allowed;
}

/**
 * بررسی اجباری مجوز
 */
export async function requirePermission(
  userId: string,
  permission: string,
  assignmentId?: string
): Promise<PermissionResult> {
  const result = await checkPermission({
    userId,
    permission,
    assignmentId,
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
  if (!result.allowed) {
    return false;
  }

  if (result.scopes.includes(DataScope.ALL)) {
    return true;
  }

  if (result.scopes.includes(DataScope.OWN)) {
    return ownerUserId === currentUserId;
  }

  return false;
}
