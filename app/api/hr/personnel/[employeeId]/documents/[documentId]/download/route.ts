
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  authorizeGlobalRequest,
} from "@/modules/auth/auth.middleware";

import { AuthError } from "@/modules/auth/auth.service";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

import {
  readPrivateFile,
  PrivateFileStorageError,
} from "@/libs/private-file-storage";

type Context = {
  params: Promise<{
    employeeId: string;
    documentId: string;
  }>;
};

function safeFileName(name: string) {
  return name
    .replace(/[\\/\r\n"]/g, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "_")
    .slice(0, 150) || "document";
}

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    await authorizeGlobalRequest(
      request,
      "hr.personnel.view"
    );

    const {
      employeeId,
      documentId,
    } = await context.params;

    if (!employeeId?.trim() || !documentId?.trim()) {
      return NextResponse.json(
        { message: "شناسه پرونده یا مدرک معتبر نیست." },
        { status: 400 }
      );
    }

    const profile = await prisma.employeeProfile.findUnique({
      where: {
        id: employeeId,
      },
      select: {
        id: true,
        candidateApplicationId: true,
      },
    });

    if (!profile) {
      return NextResponse.json(
        { message: "پرونده پرسنلی پیدا نشد." },
        { status: 404 }
      );
    }

    const document = await prisma.candidateDocument.findFirst({
      where: {
        id: documentId,
        applicationId: profile.candidateApplicationId,
        stage: "DOCUMENTS",
      },
      select: {
        id: true,
        fileName: true,
        storageKey: true,
        mimeType: true,
        sizeBytes: true,
        isCurrent: true,
      },
    });

    if (!document) {
      return NextResponse.json(
        { message: "مدرک موردنظر در این پرونده پیدا نشد." },
        { status: 404 }
      );
    }

    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (!allowedMimeTypes.includes(document.mimeType)) {
      return NextResponse.json(
        { message: "نوع فایل قابل دانلود نیست." },
        { status: 415 }
      );
    }

    const fileBuffer = await readPrivateFile(
      document.storageKey
    );

    if (fileBuffer.length !== document.sizeBytes) {
      console.error(
        "[HR_DOCUMENT_SIZE_MISMATCH]",
        document.id
      );

      return NextResponse.json(
        { message: "فایل ذخیره‌شده با اطلاعات ثبت‌شده مطابقت ندارد." },
        { status: 500 }
      );
    }

    const fileName = safeFileName(document.fileName);

    const dispositionName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(fileBuffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(fileBuffer.length),
        "Content-Disposition":
          `attachment; filename="document"; filename*=UTF-8''${dispositionName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
        "Pragma": "no-cache",
      },
    });

  } catch (error) {
    if (
      error instanceof AuthError ||
      error instanceof PermissionDeniedError
    ) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }

    if (error instanceof PrivateFileStorageError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.statusCode }
      );
    }

    console.error(
      "[HR_PERSONNEL_DOCUMENT_DOWNLOAD_ERROR]",
      error
    );

    return NextResponse.json(
      { message: "خطا در دریافت فایل مدرک." },
      { status: 500 }
    );
  }
}
