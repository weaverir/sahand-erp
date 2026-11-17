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
 * اگر assignmentId ارسال نشود:
 * فقط مسئولیت اصلی و فعال کاربر بررسی می‌شود.
 *
 * اگر assignmentId ارسال شود:
 * مالکیت و فعال بودن آن مسئولیت بررسی می‌شود.
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
            {
              OR: [
                { endDate: null },
                { endDate: { gt: now } },
              ],
            },

            assignmentId
              ? { id: assignmentId }
              : { isPrimary: true },
          ],
        },

        orderBy: [
          { isPrimary: "desc" },
          { startDate: "desc" },
        ],

        take: 1,

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

  if (!user) {
    return emptyResult();
  }

  const assignment =
    user.employeeAssignments[0] ?? null;

  // مسئولیت ارسالی باید متعلق به همین کاربر و فعال باشد.
  if (assignmentId && !assignment) {
    return emptyResult();
  }

  // مدیر سیستم به تمام مجوزها دسترسی دارد.
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
      activeAssignmentId: assignment?.id ?? null,
    };
  }

  // مجوزهای نقش‌های عمومی کاربر
  const globalGrants = user.roles.flatMap(
    (userRole) => userRole.role.permissions
  );

  // مجوزهای نقش‌های مسئولیت فعال
  const assignmentRoleGrants =
    assignment?.roles.flatMap(
      (assignmentRole) =>
        assignmentRole.role.permissions
    ) ?? [];

  // مجوزهای مستقیم مسئولیت
  const assignmentDirectGrants =
    assignment?.permissions ?? [];

  const grants = [
    ...globalGrants,
    ...assignmentRoleGrants,
    ...assignmentDirectGrants,
  ];

  // منع صریح دسترسی بر اجازه اولویت دارد.
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
    return emptyResult();
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