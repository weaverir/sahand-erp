
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  AuthError,
  getAuthenticatedCandidate,
} from "@/modules/auth/auth.service";

import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.cookies";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get(
      AUTH_COOKIE_NAMES.candidate
    )?.value;

    if (!token) {
      throw new AuthError("ابتدا وارد پنل متقاضی شوید.");
    }

    const user = await getAuthenticatedCandidate(token);

    const application =
      await prisma.candidateApplication.findUnique({
        where: { userId: user.id },
        select: {
          id: true,
          applicationNumber: true,

          initialStatus: true,
          initialVersion: true,
          initialSubmittedAt: true,
          initialApprovedAt: true,

          documentsStatus: true,
          documentsVersion: true,
          documentsSubmittedAt: true,
          documentsApprovedAt: true,

          createdAt: true,
          updatedAt: true,

          approvals: {
            orderBy: {
              decidedAt: "desc",
            },
            select: {
              id: true,
              stage: true,
              reviewerType: true,
              decision: true,
              comment: true,
              applicationVersion: true,
              decidedAt: true,
              reviewer: {
                select: {
                  fullName: true,
                },
              },
            },
          },

          documents: {
            where: {
              isCurrent: true,
            },
            select: {
              id: true,
              documentType: true,
              stage: true,
              status: true,
              fileName: true,
              uploadedAt: true,
            },
          },
        },
      });

    if (!application) {
      return NextResponse.json(
        {
          success: false,
          message: "پرونده استخدامی پیدا نشد.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
        },

        application,

        workflow: {
          initial: {
            status: application.initialStatus,
            version: application.initialVersion,
            approvals: application.approvals.filter(
              (item) =>
                item.stage === "INITIAL" &&
                item.applicationVersion ===
                  application.initialVersion
            ),
          },

          documents: {
            status: application.documentsStatus,
            version: application.documentsVersion,
            approvals: application.approvals.filter(
              (item) =>
                item.stage === "DOCUMENTS" &&
                item.applicationVersion ===
                  application.documentsVersion
            ),
          },
        },
      },
    });
  } catch (error) {
    console.error("[CANDIDATE_ME_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof AuthError
            ? error.message
            : "خطا در دریافت اطلاعات پرونده.",
      },
      {
        status:
          error instanceof AuthError
            ? error.statusCode
            : 500,
      }
    );
  }
}
