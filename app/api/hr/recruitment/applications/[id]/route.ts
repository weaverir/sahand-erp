
import { NextRequest } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  ApplicationStage,
  ApplicationReviewerType,
  ApplicationApproval,
  ApplicationDecision,
  DocumentsApplicationStatus,
  InitialApplicationStatus,
} from "@/generated/prisma/client";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  authExceptionResponse,
} from "@/modules/auth/api-error-response";

import {
  authorizeRecruitmentReviewer,
} from "@/modules/recruitment/recruitment.authorization";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const params = request.nextUrl.searchParams;

    const stageValue = params.get("stage") || "INITIAL";
    const reviewerValue =
      params.get("reviewerType") || "HR";

    const stage =
      stageValue === "INITIAL"
        ? ApplicationStage.INITIAL
        : stageValue === "DOCUMENTS"
          ? ApplicationStage.DOCUMENTS
          : null;

    const reviewerType =
      reviewerValue === "HR"
        ? ApplicationReviewerType.HR
        : reviewerValue === "EXECUTIVE"
          ? ApplicationReviewerType.EXECUTIVE
          : null;

    if (!stage || !reviewerType) {
      return errorResponse(
        "مرحله یا نوع بررسی معتبر نیست.",
        400
      );
    }

    const { user } =
      await authorizeRecruitmentReviewer(
        request,
        stage,
        reviewerType
      );

    const { id } = await context.params;

    const application =
      await prisma.candidateApplication.findUnique({
        where: { id },

        include: {
          user: {
            select: {
              id: true,
              username: true,
              accessLevel: true,
              isActive: true,
              createdAt: true,
            },
          },

          educationRecords: {
            orderBy: {
              createdAt: "asc",
            },
          },

          workExperiences: {
            orderBy: {
              startDate: "desc",
            },
          },

          skills: true,

          references: {
            orderBy: {
              sortOrder: "asc",
            },
          },

          emergencyContact: true,

          sensitiveInfo: true,

          familyMembers: {
            orderBy: {
              sortOrder: "asc",
            },
          },

          documents: {
            where: {
              stage,
              isCurrent: true,
            },
            orderBy: [
              { documentType: "asc" },
              { pageNumber: "asc" },
            ],
            select: {
              id: true,
              documentType: true,
              stage: true,
              status: true,
              pageNumber: true,
              totalPages: true,
              subjectIndex: true,
              fileName: true,
              mimeType: true,
              sizeBytes: true,
              checksum: true,
              uploadedAt: true,
            },
          },
        },
      });

    if (!application) {
      return errorResponse(
        "پرونده استخدامی پیدا نشد.",
        404
      );
    }

    const currentStatus =
      stage === ApplicationStage.INITIAL
        ? application.initialStatus
        : application.documentsStatus;

    const allowedStatuses =
      reviewerType === ApplicationReviewerType.HR
        ? ["SUBMITTED", "HR_REVIEW"]
        : ["SUBMITTED", "EXECUTIVE_REVIEW"];

    if (
      !allowedStatuses.includes(currentStatus)
    ) {
      return errorResponse(
        "این پرونده در حال حاضر در نوبت بررسی شما نیست.",
        409
      );
    }

    if (
      stage === ApplicationStage.DOCUMENTS &&
      application.initialStatus !==
        InitialApplicationStatus.APPROVED
    ) {
      return errorResponse(
        "مرحله اول پرونده هنوز تأیید نشده است.",
        409
      );
    }

    const applicationVersion =
      stage === ApplicationStage.INITIAL
        ? application.initialVersion
        : application.documentsVersion;

    const approvals =
      await prisma.applicationApproval.findMany({
        where: {
          applicationId: application.id,
          stage,
          applicationVersion,
        },
        orderBy: {
          decidedAt: "asc",
        },
        select: {
          reviewerType: true,
          decision: true,
          comment: true,
          decidedAt: true,
          reviewer: {
            select: {
              fullName: true,
            },
          },
        },
      });

    const documents = application.documents.map(
      (document) => ({
        ...document,
        fileUrl:
          `/api/hr/recruitment/documents/${document.id}/file`,
      })
    );

    return successResponse({
      application: {
        ...application,
        documents,
      },
      approvals,
      currentReviewer: {
        userId: user.id,
        reviewerType,
        stage,
      },
    });
  } catch (error) {
    return authExceptionResponse(
      error,
      "خطا در دریافت جزئیات پرونده."
    );
  }
}
