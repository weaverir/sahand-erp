import { NextRequest } from "next/server";

import {
  errorResponse,
  successResponse,
} from "@/libs/api-response";

import {
  assertSameOriginRequest,
  RequestOriginError,
} from "@/modules/auth/auth.middleware";

import {
  validateInitialApplication,
} from "@/modules/recruitment/recruitment.validation";

import {
  createInitialApplication,
  RecruitmentError,
} from "@/modules/recruitment/recruitment.service";

import {
  MAX_PERSONAL_PHOTO_SIZE,
  PERSONAL_PHOTO_MIME_TYPES,
} from "@/modules/recruitment/recruitment.constants";


const MAX_REQUEST_BYTES = 14 * 1024 * 1024;
const MAX_APPLICATION_BYTES = 256 * 1024;

const ALLOWED_FIELDS = new Set([
  "application",
  "personalPhoto",
]);

function requestIp(request: NextRequest) {
  return request.headers.get("x-real-ip") || undefined;
}

function isUploadedFile(
  value: FormDataEntryValue | null
): value is File {
  return typeof File !== "undefined" && value instanceof File;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function getValidationMessage(errors: unknown): string {
  if (!Array.isArray(errors)) {
    return "اطلاعات فرم معتبر نیست.";
  }

  const messages = errors
    .map((issue: unknown) => {
      if (typeof issue === "string") return issue;

      if (
        typeof issue === "object" &&
        issue !== null &&
        "message" in issue &&
        typeof issue.message === "string"
      ) {
        return issue.message;
      }

      return "";
    })
    .filter(Boolean);

  return messages.join(" ") || "اطلاعات فرم معتبر نیست.";
}

export async function POST(request: NextRequest) {
  try {
    // بررسی مبدأ درخواست برای جلوگیری از ارسال cross-site.
    assertSameOriginRequest(request);

    const contentType =
      request.headers.get("content-type") || "";

    if (!contentType.toLowerCase().startsWith("multipart/form-data;")) {
      return errorResponse(
        "نوع درخواست باید multipart/form-data باشد.",
        415
      );
    }

    const contentLengthHeader =
      request.headers.get("content-length");

    if (contentLengthHeader !== null) {
      const contentLength = Number(contentLengthHeader);

      if (
        !Number.isSafeInteger(contentLength) ||
        contentLength < 0
      ) {
        return errorResponse("اندازه درخواست معتبر نیست.", 400);
      }

      if (contentLength > MAX_REQUEST_BYTES) {
        return errorResponse(
          "حجم درخواست بیشتر از حد مجاز است.",
          413
        );
      }
    }

    let formData: FormData;

    try {
      formData = await request.formData();
    } catch {
      return errorResponse(
        "خواندن اطلاعات ارسالی امکان‌پذیر نیست.",
        400
      );
    }

    // فقط application و personalPhoto مجاز هستند.
    for (const key of formData.keys()) {
      if (!ALLOWED_FIELDS.has(key)) {
        return errorResponse(
          `فیلد غیرمجاز ارسال شده است: ${key}`,
          400
        );
      }
    }

    const applicationEntries = formData.getAll("application");
    const photoEntries = formData.getAll("personalPhoto");

    if (
      applicationEntries.length !== 1 ||
      photoEntries.length !== 1
    ) {
      return errorResponse(
        "اطلاعات فرم و عکس پرسنلی باید دقیقاً یک‌بار ارسال شوند.",
        400
      );
    }

    const applicationRaw = applicationEntries[0];

    if (typeof applicationRaw !== "string") {
      return errorResponse(
        "اطلاعات فرم ارسال نشده یا معتبر نیست.",
        400
      );
    }

    if (
      Buffer.byteLength(applicationRaw, "utf8") >
      MAX_APPLICATION_BYTES
    ) {
      return errorResponse(
        "حجم اطلاعات فرم بیشتر از حد مجاز است.",
        413
      );
    }

    let applicationData: unknown;

    try {
      applicationData = JSON.parse(applicationRaw);
    } catch {
      return errorResponse(
        "ساختار اطلاعات فرم معتبر نیست.",
        400
      );
    }

    const validation =
      validateInitialApplication(applicationData);

    if (!validation.success) {
      return errorResponse(
        getValidationMessage(validation.errors),
        400
      );
    }

    const personalPhotoValue = photoEntries[0];

    if (!isUploadedFile(personalPhotoValue)) {
      return errorResponse(
        "بارگذاری عکس پرسنلی الزامی است.",
        400
      );
    }

    if (personalPhotoValue.size <= 0) {
      return errorResponse("فایل عکس پرسنلی خالی است.", 400);
    }

    if (personalPhotoValue.size > MAX_PERSONAL_PHOTO_SIZE) {
      return errorResponse(
        "حجم عکس پرسنلی بیشتر از حد مجاز است.",
        413
      );
    }

    if (
      !PERSONAL_PHOTO_MIME_TYPES.includes(
        personalPhotoValue.type as (typeof PERSONAL_PHOTO_MIME_TYPES)[number]
      )
    ) {
      return errorResponse(
        "فرمت عکس پرسنلی باید JPG، PNG یا WEBP باشد.",
        415
      );
    }

    const actualRequestSize =
      Buffer.byteLength(applicationRaw, "utf8") +
      personalPhotoValue.size;

    if (actualRequestSize > MAX_REQUEST_BYTES) {
      return errorResponse(
        "حجم کل اطلاعات و فایل ارسالی بیشتر از حد مجاز است.",
        413
      );
    }

    const result = await createInitialApplication({
      data: validation.data,
      personalPhoto: personalPhotoValue,
      ipAddress: requestIp(request),
    });

    return successResponse(result, 201);
  } catch (error: unknown) {
    console.error("[RECRUITMENT_REGISTER_ERROR]", error);

    if (error instanceof RequestOriginError) {
      return errorResponse(error.message, error.statusCode);
    }

    if (error instanceof RecruitmentError) {
      return errorResponse(error.message, error.statusCode);
    }

    if (isUniqueConstraintError(error)) {
      return errorResponse(
        "کد ملی، شماره همراه یا ایمیل قبلاً در سامانه ثبت شده است.",
        409
      );
    }

    return errorResponse(
      "خطای داخلی در ثبت درخواست استخدام رخ داد.",
      500
    );
  }
}
