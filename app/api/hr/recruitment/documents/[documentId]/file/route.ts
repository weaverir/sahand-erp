
import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "@/libs/prisma";

import {
  ApplicationReviewerType,
  DataScope,
} from "@/generated/prisma/client";

import {
  authenticateRequest,
} from "@/modules/auth/auth.middleware";

import {
  checkPermission,
} from "@/modules/permissions/access-control";

import {
  recruitmentPermissionKey,
} from "@/modules/recruitment/recruitment.authorization";

import {
  errorResponse,
} from "@/libs/api-response";

import {
  authExceptionResponse,
} from "@/modules/auth/api-error-response";

type Context = {
  params: Promise<{ documentId: string }>;
};

const MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];


export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    const user = await authenticateRequest(request);

    const { documentId } = await context.params;

    const document =
      await prisma.candidateDocument.findFirst({
        where: {
          id: documentId,
          isCurrent: true,
        },
        select: {
          id: true,
          stage: true,
          storageKey: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
        },
      });

    if (!document) {
      return errorResponse("مدرک پیدا نشد.", 404);
    }

    let authorized = false;

    for (const reviewerType of [
      ApplicationReviewerType.HR,
      ApplicationReviewerType.EXECUTIVE,
    ]) {
      const permission = await checkPermission({
        userId: user.id,
        permission: recruitmentPermissionKey(
          document.stage,
          reviewerType
        ),
      });

      if (
        permission.allowed &&
        permission.scopes.includes(DataScope.ALL)
      ) {
        authorized = true;
        break;
      }
    }

    if (!authorized) {
      return errorResponse(
        "اجازه مشاهده این مدرک را ندارید.",
        403
      );
    }

    if (!MIME_TYPES.includes(document.mimeType)) {
      return errorResponse(
        "نوع فایل مجاز نیست.",
        415
      );
    }

    const root = path.resolve(
      process.env.PRIVATE_UPLOAD_DIR ||
      path.join(process.cwd(), "private-uploads")
    );

    const key = document.storageKey.replace(/\\/g, "/");

    if (
      key.startsWith("/") ||
      key.split("/").some(
        (part) => !part || part === "." || part === ".."
      )
    ) {
      return errorResponse("مسیر فایل معتبر نیست.", 400);
    }

    const absolutePath = path.resolve(root, ...key.split("/"));

    if (!absolutePath.startsWith(root + path.sep)) {
      return errorResponse("دسترسی غیرمجاز.", 403);
    }

    const buffer = await readFile(absolutePath);

    if (buffer.length !== document.sizeBytes) {
      return errorResponse("فایل ناقص یا خراب است.", 500);
    }

    const fileName = encodeURIComponent(
      document.fileName.replace(/[\r\n"]/g, "_")
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": document.mimeType,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename*=UTF-8''${fileName}`,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, no-store, max-age=0",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch (error) {
    return authExceptionResponse(
      error,
      "خطا در دریافت مدرک."
    );
  }
}
