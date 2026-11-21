
import { NextRequest } from "next/server";

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

type Context = {
  params: Promise<{
    employeeId: string;
  }>;
};

// ==========================================
// GET - EMPLOYEE PERSONNEL FILE
// ==========================================

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    // ======================================
    // ACCESS CONTROL
    // ======================================

    await authorizeGlobalRequest(
      request,
      "hr.personnel.view"
    );

    const { employeeId } = await context.params;

    if (!employeeId?.trim()) {
      return errorResponse(
        "شناسه پرونده معتبر نیست.",
        400
      );
    }

    // ======================================
    // FIND EMPLOYEE PROFILE
    // ======================================

    const profile =
      await prisma.employeeProfile.findUnique({
        where: {
          id: employeeId,
        },

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
              lastLoginAt: true,
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
              birthCertificateNumber: true,
              nationalId: true,

              gender: true,
              maritalStatus: true,
              nationality: true,
              birthPlace: true,
              dateOfBirth: true,

              landlinePhone: true,
              mobilePhone: true,
              email: true,
              address: true,

              militaryStatus: true,

              currentlyEmployed: true,
              currentEmployer: true,
              hasExternalCommitment: true,
              hasInsuranceHistory: true,
              minimumEmploymentPeriod: true,
              childrenCount: true,

              requestedSalary: true,
              additionalNotes: true,

              insuranceNumber: true,
              bankSinaIban: true,

              initialStatus: true,
              initialSubmittedAt: true,
              initialApprovedAt: true,

              documentsStatus: true,
              documentsSubmittedAt: true,
              documentsApprovedAt: true,

              declarationAccepted: true,
              declarationAcceptedAt: true,

              createdAt: true,
              updatedAt: true,

              educationRecords: {
                orderBy: {
                  createdAt: "desc",
                },
              },

              workExperiences: {
                orderBy: {
                  createdAt: "desc",
                },
              },
            },
          },
        },
      });

    // ======================================
    // NOT FOUND
    // ======================================

    if (!profile) {
      return errorResponse(
        "پرونده پرسنلی موردنظر پیدا نشد.",
        404
      );
    }

    // ======================================
    // RESPONSE
    // ======================================

    return successResponse({
      employee: profile,

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
      "[HR_PERSONNEL_DETAIL_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت اطلاعات پرونده پرسنلی.",
      500
    );
  }
}
