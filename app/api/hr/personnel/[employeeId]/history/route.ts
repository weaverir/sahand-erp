
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

type HistoryItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  date: Date;
  actor: string | null;
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
        createdAt: true,
        hireDate: true,
        terminationDate: true,
        terminationReason: true,
        employmentStatus: true,
        user: {
          select: {
            fullName: true,
          },
        },
        candidateApplication: {
          select: {
            id: true,
            initialSubmittedAt: true,
            initialApprovedAt: true,
            documentsSubmittedAt: true,
            documentsApprovedAt: true,
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

    const applicationId =
      profile.candidateApplicationId;

    const [approvals, documents] = await Promise.all([
      prisma.applicationApproval.findMany({
        where: {
          applicationId,
        },
        orderBy: {
          decidedAt: "desc",
        },
        select: {
          id: true,
          stage: true,
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
      }),

      prisma.candidateDocument.findMany({
        where: {
          applicationId,
          stage: "DOCUMENTS",
          isCurrent: true,
        },
        orderBy: {
          uploadedAt: "desc",
        },
        select: {
          id: true,
          documentType: true,
          fileName: true,
          status: true,
          uploadedAt: true,
          uploadedBy: {
            select: {
              fullName: true,
            },
          },
        },
      }),
    ]);

    const history: HistoryItem[] = [];

    history.push({
      id: `profile-${profile.id}`,
      type: "PROFILE_CREATED",
      title: "ایجاد پرونده پرسنلی",
      description: "پرونده دائمی کارمند در سیستم ایجاد شد.",
      date: profile.createdAt,
      actor: null,
    });

    if (profile.hireDate) {
      history.push({
        id: `hire-${profile.id}`,
        type: "EMPLOYMENT_STARTED",
        title: "شروع همکاری",
        description: "تاریخ شروع همکاری ثبت‌شده در پرونده.",
        date: profile.hireDate,
        actor: null,
      });
    }

    if (
      profile.candidateApplication.initialSubmittedAt
    ) {
      history.push({
        id: `initial-submitted-${applicationId}`,
        type: "INITIAL_SUBMITTED",
        title: "ارسال مرحله اول ثبت‌نام",
        description: "اطلاعات اولیه متقاضی ارسال شد.",
        date: profile.candidateApplication.initialSubmittedAt,
        actor: null,
      });
    }

    if (
      profile.candidateApplication.initialApprovedAt
    ) {
      history.push({
        id: `initial-approved-${applicationId}`,
        type: "INITIAL_APPROVED",
        title: "تأیید مرحله اول ثبت‌نام",
        description: "مرحله اول ثبت‌نام تأیید شد.",
        date: profile.candidateApplication.initialApprovedAt,
        actor: null,
      });
    }

    if (
      profile.candidateApplication.documentsSubmittedAt
    ) {
      history.push({
        id: `documents-submitted-${applicationId}`,
        type: "DOCUMENTS_SUBMITTED",
        title: "ارسال مدارک مرحله دوم",
        description: "مدارک تکمیلی ثبت‌نام ارسال شدند.",
        date: profile.candidateApplication.documentsSubmittedAt,
        actor: null,
      });
    }

    if (
      profile.candidateApplication.documentsApprovedAt
    ) {
      history.push({
        id: `documents-approved-${applicationId}`,
        type: "DOCUMENTS_APPROVED",
        title: "تأیید مدارک مرحله دوم",
        description: "مدارک تکمیلی ثبت‌نام تأیید شدند.",
        date: profile.candidateApplication.documentsApprovedAt,
        actor: null,
      });
    }

    for (const approval of approvals) {
      history.push({
        id: `approval-${approval.id}`,
        type: "APPROVAL",
        title: `تصمیم تأیید مرحله ${approval.stage}`,
        description: [
          `نوع بررسی: ${approval.reviewerType}`,
          `نتیجه: ${approval.decision}`,
          approval.comment
            ? `توضیحات: ${approval.comment}`
            : null,
        ]
          .filter(Boolean)
          .join(" | "),
        date: approval.decidedAt,
        actor: approval.reviewer.fullName,
      });
    }

    for (const document of documents) {
      history.push({
        id: `document-${document.id}`,
        type: "DOCUMENT_UPLOADED",
        title: "بارگذاری مدرک",
        description: [
          `نام فایل: ${document.fileName}`,
          `نوع مدرک: ${document.documentType}`,
          `وضعیت: ${document.status}`,
        ].join(" | "),
        date: document.uploadedAt,
        actor: document.uploadedBy.fullName,
      });
    }

    if (profile.terminationDate) {
      history.push({
        id: `termination-${profile.id}`,
        type: "EMPLOYMENT_TERMINATED",
        title: "ثبت قطع همکاری",
        description:
          profile.terminationReason ||
          "قطع همکاری در پرونده ثبت شده است.",
        date: profile.terminationDate,
        actor: null,
      });
    }

    history.sort(
      (a, b) => b.date.getTime() - a.date.getTime()
    );

    return successResponse({
      employee: {
        id: profile.id,
        fullName: profile.user.fullName,
        employmentStatus: profile.employmentStatus,
      },
      history,
      summary: {
        total: history.length,
        approvals: approvals.length,
        documents: documents.length,
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
      "[HR_PERSONNEL_HISTORY_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت تاریخچه پرونده پرسنلی.",
      500
    );
  }
}
