
import "server-only";

import { NextRequest } from "next/server";

import {
  ApplicationStage,
  ApplicationReviewerType,
  DataScope,
} from "@/generated/prisma/client";

import {
  authorizeRequest,
} from "@/modules/auth/auth.middleware";

import {
  PermissionDeniedError,
} from "@/modules/permissions/access-control";

export function recruitmentPermissionKey(
  stage: ApplicationStage,
  reviewerType: ApplicationReviewerType
): string {
  const stageName =
    stage === ApplicationStage.INITIAL
      ? "initial"
      : "documents";

  const reviewerName =
    reviewerType === ApplicationReviewerType.HR
      ? "hr"
      : "executive";

  return `hr.recruitment.${stageName}.review.${reviewerName}`;
}

export async function authorizeRecruitmentReviewer(
  request: NextRequest,
  stage: ApplicationStage,
  reviewerType: ApplicationReviewerType
) {
  const permissionKey = recruitmentPermissionKey(
    stage,
    reviewerType
  );

  const authorization = await authorizeRequest(
    request,
    permissionKey
  );

  if (
    !authorization.permission.scopes.includes(
      DataScope.ALL
    )
  ) {
    throw new PermissionDeniedError(
      "برای بررسی پرونده‌های استخدامی، دسترسی سراسری منابع انسانی لازم است."
    );
  }

  return {
    user: authorization.user,
    reviewerType,
    stage,
  };
}
