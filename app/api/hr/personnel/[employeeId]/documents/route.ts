
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

type Context = {
  params: Promise<{
    employeeId: string;
  }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
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

    const profile = await prisma.employeeProfile.findUnique({
      where: {
        id: employeeId,
      },
      select: {
        id: true,
        candidateApplicationId: true,
        user: {
          select: {
            fullName: true,
          },
        },
      },
    });

    if (!profile) {
      return errorResponse(
        "پرونده پرسنلی پیدا نشد.",
        404
      );
    }

    const application = await prisma.candidateApplication.findUnique({
      where: {
        id: profile.candidateApplicationId,
      },
      select: {
        id: true,
        applicationNumber: true,
        documentsStatus: true,
        documentsVersion: true,
        documentsSubmittedAt: true,
        documentsApprovedAt: true,
        insuranceNumber: true,
        bankSinaIban: true,
        hasInsuranceHistory: true,
      },
    });

    if (!application) {
      return errorResponse(
        "اطلاعات درخواست استخدام پیدا نشد.",
        404
      );
    }

    const documents = await prisma.candidateDocument.findMany({
      where: {
        applicationId: application.id,
        stage: "DOCUMENTS",
      },
      orderBy: [
        {
          documentType: "asc",
        },
        {
          stageVersion: "desc",
        },
        {
          pageNumber: "asc",
        },
        {
          uploadedAt: "desc",
        },
      ],
      select: {
        id: true,
        documentType: true,
        stage: true,
        status: true,
        pageNumber: true,
        totalPages: true,
        subjectIndex: true,
        stageVersion: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        checksum: true,
        isCurrent: true,
        uploadedAt: true,
        createdAt: true,
      },
    });

    const groupedDocuments = documents.reduce<
      Record<string, typeof documents>
    >((groups, document) => {
      const key = document.documentType;

      if (!groups[key]) {
        groups[key] = [];
      }

      groups[key].push(document);

      return groups;
    }, {});

    return successResponse({
      employee: {
        id: profile.id,
        fullName: profile.user.fullName,
      },

      application: {
        applicationNumber: application.applicationNumber,
        documentsStatus: application.documentsStatus,
        documentsVersion: application.documentsVersion,
        documentsSubmittedAt: application.documentsSubmittedAt,
        documentsApprovedAt: application.documentsApprovedAt,
        insuranceNumber: application.insuranceNumber,
        bankSinaIban: application.bankSinaIban,
        hasInsuranceHistory: application.hasInsuranceHistory,
      },

      documents,
      groupedDocuments,

      summary: {
        total: documents.length,
        current: documents.filter(
          (item) => item.isCurrent
        ).length,
        previous: documents.filter(
          (item) => !item.isCurrent
        ).length,
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
      "[HR_PERSONNEL_DOCUMENTS_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت مدارک پرونده پرسنلی.",
      500
    );
  }
}
