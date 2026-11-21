
import { NextRequest } from "next/server";

import {
  EmployeeEmploymentStatus,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  authorizeGlobalRequest,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

// ==========================================
// TYPES
// ==========================================

type PersonnelListStatus =
  | "CURRENT"
  | "FORMER"
  | "ALL";

// ==========================================
// HELPERS
// ==========================================

function parseStatus(
  value: string | null
): PersonnelListStatus | null {
  if (!value || value === "CURRENT") {
    return "CURRENT";
  }

  if (value === "FORMER") {
    return "FORMER";
  }

  if (value === "ALL") {
    return "ALL";
  }

  return null;
}

function getEmploymentStatuses(
  status: PersonnelListStatus
): EmployeeEmploymentStatus[] {
  switch (status) {
    case "CURRENT":
      return [
        EmployeeEmploymentStatus.ACTIVE,
        EmployeeEmploymentStatus.ON_LEAVE,
        EmployeeEmploymentStatus.SUSPENDED,
      ];

    case "FORMER":
      return [
        EmployeeEmploymentStatus.TERMINATED,
      ];

    case "ALL":
      return [
        EmployeeEmploymentStatus.ACTIVE,
        EmployeeEmploymentStatus.ON_LEAVE,
        EmployeeEmploymentStatus.SUSPENDED,
        EmployeeEmploymentStatus.TERMINATED,
      ];
  }
}

function normalizeQuery(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function getPaginationValue(
  value: string | null,
  fallback: number
) {
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
}

// ==========================================
// GET - PERSONNEL LIST
// ==========================================

export async function GET(request: NextRequest) {
  try {
    // ======================================
    // ACCESS CONTROL
    // ======================================

    await authorizeGlobalRequest(
      request,
      "hr.personnel.view"
    );

    const params = request.nextUrl.searchParams;

    // ======================================
    // STATUS FILTER
    // ======================================

    const status = parseStatus(
      params.get("status")
    );

    if (!status) {
      return errorResponse(
        "وضعیت فهرست کارکنان معتبر نیست.",
        400
      );
    }

    // ======================================
    // SEARCH
    // ======================================

    const query = normalizeQuery(
      params.get("q") || ""
    );

    if (query.length > 100) {
      return errorResponse(
        "عبارت جست‌وجو نمی‌تواند بیشتر از ۱۰۰ کاراکتر باشد.",
        400
      );
    }

    // ======================================
    // PAGINATION
    // ======================================

    const page = getPaginationValue(
      params.get("page"),
      1
    );

    const limit = getPaginationValue(
      params.get("limit"),
      20
    );

    if (
      page === null ||
      limit === null ||
      limit > 100
    ) {
      return errorResponse(
        "شماره صفحه یا تعداد نتایج معتبر نیست.",
        400
      );
    }

    // ======================================
    // WHERE
    // ======================================

    const where: Prisma.EmployeeProfileWhereInput = {
      employmentStatus: {
        in: getEmploymentStatuses(status),
      },

      ...(query
        ? {
            OR: [
              {
                personnelCode: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                user: {
                  is: {
                    fullName: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                user: {
                  is: {
                    username: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                candidateApplication: {
                  is: {
                    firstName: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                candidateApplication: {
                  is: {
                    lastName: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                candidateApplication: {
                  is: {
                    nationalId: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
              {
                candidateApplication: {
                  is: {
                    applicationNumber: {
                      contains: query,
                      mode: "insensitive",
                    },
                  },
                },
              },
            ],
          }
        : {}),
    };

    // ======================================
    // STATISTICS FILTERS
    // ======================================

    const activeWhere = {
      employmentStatus:
        EmployeeEmploymentStatus.ACTIVE,
    };

    const onLeaveWhere = {
      employmentStatus:
        EmployeeEmploymentStatus.ON_LEAVE,
    };

    const suspendedWhere = {
      employmentStatus:
        EmployeeEmploymentStatus.SUSPENDED,
    };

    const terminatedWhere = {
      employmentStatus:
        EmployeeEmploymentStatus.TERMINATED,
    };

    // ======================================
    // DATABASE QUERIES
    // ======================================

    const [
      employees,
      total,
      activeCount,
      onLeaveCount,
      suspendedCount,
      terminatedCount,
    ] = await prisma.$transaction([
      prisma.employeeProfile.findMany({
        where,

        select: {
          id: true,
          userId: true,
          candidateApplicationId: true,
          personnelCode: true,
          employmentStatus: true,
          hireDate: true,
          terminationDate: true,
          terminationReason: true,
          createdAt: true,
          updatedAt: true,

          user: {
            select: {
              id: true,
              username: true,
              fullName: true,
              email: true,
              phone: true,
              isActive: true,
              accessLevel: true,
              createdAt: true,
            },
          },

          candidateApplication: {
            select: {
              id: true,
              applicationNumber: true,
              firstName: true,
              lastName: true,
              fatherName: true,
              nationalId: true,
              gender: true,
              maritalStatus: true,
              mobilePhone: true,
              email: true,
              dateOfBirth: true,
              initialStatus: true,
              documentsStatus: true,
              initialApprovedAt: true,
              documentsApprovedAt: true,
            },
          },
        },

        orderBy: [
          {
            hireDate: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        skip: (page - 1) * limit,

        take: limit,
      }),

      prisma.employeeProfile.count({
        where,
      }),

      prisma.employeeProfile.count({
        where: activeWhere,
      }),

      prisma.employeeProfile.count({
        where: onLeaveWhere,
      }),

      prisma.employeeProfile.count({
        where: suspendedWhere,
      }),

      prisma.employeeProfile.count({
        where: terminatedWhere,
      }),
    ]);

    // ======================================
    // STATISTICS
    // ======================================

    const statistics = {
      active: activeCount,
      onLeave: onLeaveCount,
      suspended: suspendedCount,
      terminated: terminatedCount,

      current:
        activeCount +
        onLeaveCount +
        suspendedCount,

      total:
        activeCount +
        onLeaveCount +
        suspendedCount +
        terminatedCount,
    };

    // ======================================
    // RESPONSE
    // ======================================

    return successResponse({
      employees,

      filters: {
        status,
        query: query || null,
      },

      statistics,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },

      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof PermissionDeniedError
    ) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    console.error(
      "[HR_PERSONNEL_LIST_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت فهرست پرونده‌های پرسنلی.",
      500
    );
  }
}
