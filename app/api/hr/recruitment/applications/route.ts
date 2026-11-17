
import { NextRequest } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  ApplicationStage,
  ApplicationReviewerType,
  DocumentsApplicationStatus,
  InitialApplicationStatus,
  Prisma,
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


function parseStage(value: string | null) {
  if (value === "DOCUMENTS") {
    return ApplicationStage.DOCUMENTS;
  }

  if (value === "INITIAL" || value === null) {
    return ApplicationStage.INITIAL;
  }

  return null;
}

function parseReviewerType(value: string | null) {
  if (value === "HR") {
    return ApplicationReviewerType.HR;
  }

  if (value === "EXECUTIVE") {
    return ApplicationReviewerType.EXECUTIVE;
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const stage = parseStage(params.get("stage"));
    const reviewerType = parseReviewerType(
      params.get("reviewerType")
    );

    if (!stage || !reviewerType) {
      return errorResponse(
        "مرحله یا نوع بررسی معتبر نیست.",
        400
      );
    }

    await authorizeRecruitmentReviewer(
      request,
      stage,
      reviewerType
    );

    const page = Math.max(
      1,
      Number(params.get("page") || 1)
    );

    const limit = Math.min(
      50,
      Math.max(1, Number(params.get("limit") || 20))
    );

    const statuses =
      reviewerType === ApplicationReviewerType.HR
        ? [
            "SUBMITTED",
            "HR_REVIEW",
          ]
        : [
            "SUBMITTED",
            "EXECUTIVE_REVIEW",
          ];

    const where: Prisma.CandidateApplicationWhereInput =
      stage === ApplicationStage.INITIAL
        ? {
            initialStatus: {
              in: statuses as InitialApplicationStatus[],
            },
          }
        : {
            initialStatus:
              InitialApplicationStatus.APPROVED,
            documentsStatus: {
              in: statuses as DocumentsApplicationStatus[],
            },
          };

    const [applications, total] = await prisma.$transaction([
      prisma.candidateApplication.findMany({
        where,
        orderBy: {
          initialSubmittedAt: "asc",
        },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          applicationNumber: true,
          firstName: true,
          lastName: true,
          nationalId: true,
          mobilePhone: true,
          gender: true,
          maritalStatus: true,
          initialStatus: true,
          documentsStatus: true,
          initialSubmittedAt: true,
          documentsSubmittedAt: true,
          initialVersion: true,
          documentsVersion: true,
          createdAt: true,
        },
      }),

      prisma.candidateApplication.count({
        where,
      }),
    ]);

    return successResponse({
      stage,
      reviewerType,
      applications,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return authExceptionResponse(
      error,
      "خطا در دریافت پرونده‌های استخدامی."
    );
  }
}
