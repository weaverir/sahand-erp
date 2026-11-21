
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

import { prisma } from "@/libs/prisma";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";



export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAMES.access)?.value;

    if (!token) {
      return NextResponse.json(
        { success: false, message: "ابتدا وارد سامانه شوید." },
        { status: 401 }
      );
    }

    const user = await getAuthenticatedUser(token);

    const application = await prisma.candidateApplication.findUnique({
      where: { userId: user.id },
      include: {
        educationRecords: {
          orderBy: { createdAt: "asc" },
        },
        workExperiences: {
          orderBy: { startDate: "desc" },
        },
        skills: true,
        references: {
          orderBy: { sortOrder: "asc" },
        },
        emergencyContact: true,
        sensitiveInfo: true,
        familyMembers: {
          orderBy: { sortOrder: "asc" },
        },
        documents: {
          where: { isCurrent: true },
          select: {
            id: true,
            documentType: true,
            stage: true,
            status: true,
            fileName: true,
            mimeType: true,
            sizeBytes: true,
            pageNumber: true,
            totalPages: true,
            uploadedAt: true,
          },
        },
        approvals: {
          orderBy: { decidedAt: "desc" },
          select: {
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
      },
    });

    if (!application) {
      return NextResponse.json(
        { success: false, message: "پرونده‌ای پیدا نشد." },
        { status: 404 }
      );
    }

    const latestInitialCorrection = application.approvals.find(
      (item) =>
        item.stage === "INITIAL" &&
        item.decision === "NEEDS_CORRECTION" &&
        item.applicationVersion === application.initialVersion
    );

    const latestDocumentsCorrection = application.approvals.find(
      (item) =>
        item.stage === "DOCUMENTS" &&
        item.decision === "NEEDS_CORRECTION" &&
        item.applicationVersion === application.documentsVersion
    );

    return NextResponse.json({
      success: true,
      data: {
        application,
        correctionRequests: {
          initial: latestInitialCorrection ?? null,
          documents: latestDocumentsCorrection ?? null,
        },
        permissions: {
          canEditInitial:
            application.initialStatus === "NEEDS_CORRECTION",
          canEditDocuments:
            application.documentsStatus === "NEEDS_CORRECTION",
        },
      },
    });
  } catch (error) {
    console.error("[RECRUITMENT_ME_ERROR]", error);

    return NextResponse.json(
      {
        success: false,
        message: "خطا در دریافت اطلاعات پرونده.",
      },
      { status: 500 }
    );
  }
}
