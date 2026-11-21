
import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";

import {
  ApplicationStage,
  CandidateDocumentStatus,
  CandidateDocumentType,
  DocumentsApplicationStatus,
  InitialApplicationStatus,
  UserAccessLevel,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import { getAuthenticatedCandidate } from "@/modules/auth/auth.service";

import {
  assertSameOriginRequest,
  RequestOriginError,
} from "@/modules/auth/auth.middleware";

import { authExceptionResponse } from "@/modules/auth/api-error-response";

import {
  storePrivateFile,
  deletePrivateFile,
} from "@/libs/private-file-storage";


const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_TOTAL_SIZE = 40 * 1024 * 1024;
const MAX_DOCUMENT_COUNT = 25;

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

// PARENT_CONSENT عمداً در این فهرست وجود ندارد.
const ALLOWED_DOCUMENT_TYPES = new Set<string>([
  "NATIONAL_CARD",
  "APPLICANT_BIRTH_CERTIFICATE_PAGE",
  "EDUCATION_CERTIFICATE",
  "INSURANCE_HISTORY",
  "MILITARY_SERVICE",
  "MARRIAGE_CERTIFICATE",
  "SPOUSE_BIRTH_CERTIFICATE_PAGE",
  "CHILD_BIRTH_CERTIFICATE_PAGE",
  "SPOUSE_CONSENT",
  "SOCIAL_SECURITY_FORM",
]);

type DocumentInput = {
  key: string;
  documentType: CandidateDocumentType;
  pageNumber?: number | null;
  totalPages?: number | null;
  subjectIndex?: number | null;
};

type Payload = {
  bankSinaIban: string;
  insuranceNumber?: string;
  documents: DocumentInput[];
};

type StoredFile = {
  storageKey: string;
};

class DocumentError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "DocumentError";
  }
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

// ==========================================
// PARSE PAYLOAD
// ==========================================

function parsePayload(value: unknown): Payload {
  if (!isObject(value)) {
    throw new DocumentError(
      "ساختار اطلاعات ارسالی معتبر نیست."
    );
  }

  if (
    typeof value.bankSinaIban !== "string" ||
    typeof value.documents === "undefined" ||
    !Array.isArray(value.documents)
  ) {
    throw new DocumentError(
      "اطلاعات بانکی یا مدارک ارسال نشده است."
    );
  }

  const documents: DocumentInput[] =
    value.documents.map((item) => {
      if (
        !isObject(item) ||
        typeof item.key !== "string" ||
        !/^[a-zA-Z0-9_-]{1,60}$/.test(item.key) ||
        typeof item.documentType !== "string" ||
        !ALLOWED_DOCUMENT_TYPES.has(item.documentType)
      ) {
        throw new DocumentError(
          "مشخصات یکی از مدارک معتبر نیست. رضایت‌نامه والدین جزو مدارک مجاز نیست."
        );
      }

      for (const field of [
        "pageNumber",
        "totalPages",
        "subjectIndex",
      ] as const) {
        const fieldValue = item[field];

        if (
          fieldValue !== undefined &&
          fieldValue !== null &&
          (
            !Number.isInteger(fieldValue) ||
            Number(fieldValue) < 1
          )
        ) {
          throw new DocumentError(
            "شماره صفحه یا عضو خانواده معتبر نیست."
          );
        }
      }

      return {
        key: item.key,
        documentType:
          item.documentType as CandidateDocumentType,
        pageNumber:
          (item.pageNumber as number | null) ?? null,
        totalPages:
          (item.totalPages as number | null) ?? null,
        subjectIndex:
          (item.subjectIndex as number | null) ?? null,
      };
    });

  if (
    documents.length === 0 ||
    documents.length > MAX_DOCUMENT_COUNT
  ) {
    throw new DocumentError(
      "تعداد مدارک ارسالی معتبر نیست."
    );
  }

  if (
    new Set(documents.map((item) => item.key)).size !==
    documents.length
  ) {
    throw new DocumentError(
      "شناسه فایل‌های ارسالی تکراری است."
    );
  }

  return {
    bankSinaIban: value.bankSinaIban,
    insuranceNumber:
      typeof value.insuranceNumber === "string"
        ? value.insuranceNumber
        : "",
    documents,
  };
}

// ==========================================
// AUTHENTICATED CANDIDATE
// ==========================================

async function getCandidate() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    "sahand_candidate_access"
  )?.value;

  if (!token) {
    throw new DocumentError(
      "ابتدا وارد حساب کاربری شوید.",
      401
    );
  }

  const authUser =
    await getAuthenticatedCandidate(token);

  const user = await prisma.user.findFirst({
    where: {
      id: authUser.id,
      isActive: true,
      accessLevel: UserAccessLevel.CANDIDATE_PORTAL,
    },
    select: {
      id: true,
      accessLevel: true,
    },
  });

  if (!user) {
    throw new DocumentError(
      "دسترسی به پنل تکمیل مدارک استخدامی ندارید.",
      403
    );
  }

  const application =
    await prisma.candidateApplication.findUnique({
      where: {
        userId: user.id,
      },
      include: {
        familyMembers: {
          select: {
            memberType: true,
            sortOrder: true,
          },
        },
      },
    });

  if (!application) {
    throw new DocumentError(
      "پرونده استخدامی پیدا نشد.",
      404
    );
  }

  if (
    application.initialStatus !==
    InitialApplicationStatus.APPROVED
  ) {
    throw new DocumentError(
      "مرحله اول استخدام هنوز تأیید نهایی نشده است.",
      409
    );
  }

  return {
    user,
    application,
  };
}

// ==========================================
// REQUIRED DOCUMENT VALIDATION
// ==========================================

function validateRequiredDocuments(
  application: {
    gender: string;
    maritalStatus: string;
    hasInsuranceHistory: boolean;
    childrenCount: number;
    familyMembers: {
      memberType: string;
    }[];
  },
  documents: DocumentInput[],
  files: Map<string, File>
) {
  const count = (type: string) =>
    documents.filter(
      (item) => item.documentType === type
    ).length;

  const requireOne = (
    type: string,
    label: string
  ) => {
    if (count(type) !== 1) {
      throw new DocumentError(
        `بارگذاری ${label} الزامی است و باید یک فایل باشد.`
      );
    }
  };

  // مدارک عمومی
  requireOne("NATIONAL_CARD", "کارت ملی");

  requireOne(
    "EDUCATION_CERTIFICATE",
    "مدرک تحصیلی"
  );

  requireOne(
    "SOCIAL_SECURITY_FORM",
    "فرم تکمیل‌شده تأمین اجتماعی"
  );

  // تمام صفحات شناسنامه متقاضی
  const birthPages = documents.filter(
    (item) =>
      item.documentType ===
      "APPLICANT_BIRTH_CERTIFICATE_PAGE"
  );

  if (birthPages.length === 0) {
    throw new DocumentError(
      "تمام صفحات شناسنامه متقاضی الزامی است."
    );
  }

  const birthPdf =
    birthPages.length === 1 &&
    files.get(birthPages[0].key)?.type ===
      "application/pdf" &&
    birthPages[0].pageNumber == null &&
    birthPages[0].totalPages == null;

  if (!birthPdf) {
    const total = birthPages[0].totalPages;

    if (
      !total ||
      total > 20 ||
      birthPages.length !== total ||
      birthPages.some(
        (item) => item.totalPages !== total
      ) ||
      new Set(
        birthPages.map((item) => item.pageNumber)
      ).size !== total
    ) {
      throw new DocumentError(
        "تمام صفحات شناسنامه باید به ترتیب و بدون نقص بارگذاری شوند."
      );
    }

    for (let page = 1; page <= total; page++) {
      if (
        !birthPages.some(
          (item) => item.pageNumber === page
        )
      ) {
        throw new DocumentError(
          `صفحه ${page} شناسنامه بارگذاری نشده است.`
        );
      }
    }
  }

  // سابقه بیمه
  if (application.hasInsuranceHistory) {
    requireOne(
      "INSURANCE_HISTORY",
      "سوابق بیمه"
    );
  }

  // نظام وظیفه برای آقایان
  if (application.gender === "MALE") {
    requireOne(
      "MILITARY_SERVICE",
      "مدرک نظام وظیفه"
    );
  }

  // ========================================
  // MARITAL DOCUMENTS
  // ========================================

  if (application.maritalStatus === "MARRIED") {
    requireOne(
      "MARRIAGE_CERTIFICATE",
      "سند ازدواج"
    );

    requireOne(
      "SPOUSE_BIRTH_CERTIFICATE_PAGE",
      "صفحه اول شناسنامه همسر"
    );
  }

  // رضایت‌نامه همسر فقط برای خانم متأهل
  const spouseConsentCount =
    count("SPOUSE_CONSENT");

  if (
    application.gender === "FEMALE" &&
    application.maritalStatus === "MARRIED"
  ) {
    requireOne(
      "SPOUSE_CONSENT",
      "رضایت‌نامه کتبی همسر"
    );
  } else if (spouseConsentCount !== 0) {
    throw new DocumentError(
      "رضایت‌نامه همسر فقط برای خانم متأهل قابل بارگذاری است."
    );
  }

  // رضایت‌نامه والدین در ALLOWED_DOCUMENT_TYPES
  // وجود ندارد و در parsePayload رد می‌شود.

  // ========================================
  // CHILD DOCUMENTS
  // ========================================

  const childrenCount = Math.max(
    application.childrenCount,
    application.familyMembers.filter(
      (member) => member.memberType === "CHILD"
    ).length
  );

  const childDocuments = documents.filter(
    (item) =>
      item.documentType ===
      "CHILD_BIRTH_CERTIFICATE_PAGE"
  );

  if (
    childDocuments.length !== childrenCount
  ) {
    throw new DocumentError(
      `صفحه اول شناسنامه ${childrenCount} فرزند باید بارگذاری شود.`
    );
  }

  const childIndexes = childDocuments.map(
    (item) => item.subjectIndex
  );

  if (
    new Set(childIndexes).size !== childrenCount ||
    Array.from(
      { length: childrenCount },
      (_, index) => index + 1
    ).some(
      (index) => !childIndexes.includes(index)
    )
  ) {
    throw new DocumentError(
      "مدارک شناسنامه فرزندان باید برای هر فرزند جداگانه مشخص شوند."
    );
  }
}

// ==========================================
// FILE HELPERS
// ==========================================

function cleanFileName(name: string) {
  return name
    .replace(/[\\/]/g, "_")
    .replace(/[^\p{L}\p{N}._ -]/gu, "")
    .slice(0, 180);
}

function validateIban(value: string) {
  const iban = value
    .replace(/\s/g, "")
    .toUpperCase();

  if (!/^IR[0-9]{24}$/.test(iban)) {
    throw new DocumentError(
      "شماره شبای بانک سینا باید با IR شروع شود و ۲۴ رقم داشته باشد."
    );
  }

  return iban;
}

// ==========================================
// GET - DOCUMENTS AND APPLICATION INFO
// ==========================================

export async function GET() {
  try {
    const { application } = await getCandidate();

    const documents =
      await prisma.candidateDocument.findMany({
        where: {
          applicationId: application.id,
          stage: ApplicationStage.DOCUMENTS,
          isCurrent: true,
        },
        orderBy: [
          { documentType: "asc" },
          { pageNumber: "asc" },
        ],
        select: {
          id: true,
          documentType: true,
          status: true,
          pageNumber: true,
          totalPages: true,
          subjectIndex: true,
          fileName: true,
          sizeBytes: true,
          uploadedAt: true,
        },
      });

    return successResponse({
      application: {
        applicationNumber:
          application.applicationNumber,
        firstName: application.firstName,
        lastName: application.lastName,
        gender: application.gender,
        maritalStatus: application.maritalStatus,
        hasInsuranceHistory:
          application.hasInsuranceHistory,
        insuranceNumber:
          application.insuranceNumber,
        bankSinaIban:
          application.bankSinaIban,
        childrenCount:
          application.childrenCount,
        documentsStatus:
          application.documentsStatus,
        documentsVersion:
          application.documentsVersion,
      },
      documents,
    });
  } catch (error) {
    if (error instanceof DocumentError) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    return authExceptionResponse(
      error,
      "خطا در دریافت اطلاعات مدارک استخدامی."
    );
  }
}

// ==========================================
// POST - UPLOAD DOCUMENTS
// ==========================================

export async function POST(
  request: NextRequest
) {
  const storedFiles: StoredFile[] = [];

  try {
    assertSameOriginRequest(request);

    const { user, application } =
      await getCandidate();

    if (
      application.documentsStatus !==
        DocumentsApplicationStatus.PENDING &&
      application.documentsStatus !==
        DocumentsApplicationStatus.NEEDS_CORRECTION
    ) {
      throw new DocumentError(
        "در حال حاضر امکان ارسال یا ویرایش مدارک وجود ندارد.",
        409
      );
    }

    const formData = await request.formData();

    const payloadRaw = formData.get("payload");

    if (
      typeof payloadRaw !== "string" ||
      payloadRaw.length > 100_000
    ) {
      throw new DocumentError(
        "اطلاعات فرم معتبر نیست."
      );
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(payloadRaw);
    } catch {
      throw new DocumentError(
        "ساختار اطلاعات فرم معتبر نیست."
      );
    }

    const payload = parsePayload(parsed);

    const bankSinaIban =
      validateIban(payload.bankSinaIban);

    const insuranceNumber =
      payload.insuranceNumber?.trim() || "";

    if (
      application.hasInsuranceHistory &&
      !/^[a-zA-Z0-9-]{3,30}$/.test(
        insuranceNumber
      )
    ) {
      throw new DocumentError(
        "شماره بیمه معتبر نیست."
      );
    }

    // ======================================
    // READ UPLOADED FILES
    // ======================================

    const files = new Map<string, File>();

    let totalSize = 0;

    for (const item of payload.documents) {
      const entries = formData.getAll(
        `file_${item.key}`
      );

      if (
        entries.length !== 1 ||
        !(entries[0] instanceof File)
      ) {
        throw new DocumentError(
          `فایل ${item.key} ارسال نشده یا تکراری است.`
        );
      }

      const file = entries[0];

      if (
        file.size <= 0 ||
        file.size > MAX_FILE_SIZE
      ) {
        throw new DocumentError(
          `حجم فایل ${file.name} خالی یا بیشتر از ۱۰ مگابایت است.`
        );
      }

      if (
        !ALLOWED_MIME_TYPES.includes(
          file.type as
            (typeof ALLOWED_MIME_TYPES)[number]
        )
      ) {
        throw new DocumentError(
          `فرمت فایل ${file.name} مجاز نیست. PDF، JPG، PNG و WEBP مجاز هستند.`
        );
      }

      totalSize += file.size;

      files.set(item.key, file);
    }

    if (totalSize > MAX_TOTAL_SIZE) {
      throw new DocumentError(
        "حجم کل مدارک نباید بیشتر از ۴۰ مگابایت باشد."
      );
    }

    // اعتبارسنجی مدارک بر اساس اطلاعات مرحله اول
    validateRequiredDocuments(
      application,
      payload.documents,
      files
    );

    // ======================================
    // DOCUMENT VERSION
    // ======================================

    const nextVersion =
      application.documentsVersion +
      (
        application.documentsStatus ===
        DocumentsApplicationStatus.NEEDS_CORRECTION
          ? 1
          : 0
      );

    // ======================================
    // PRIVATE FILE STORAGE
    // ======================================

    const storedByKey = new Map<
      string,
      {
        storageKey: string;
        checksum: string;
      }
    >();

    for (const item of payload.documents) {
      const file = files.get(item.key)!;

      const stored = await storePrivateFile(
        file,
        {
          directory:
            `recruitment/${application.id}/documents/v${nextVersion}`,
          maxBytes: MAX_FILE_SIZE,
          allowedMimeTypes: [
            ...ALLOWED_MIME_TYPES,
          ],
        }
      );

      storedFiles.push(stored);

      const checksum = createHash("sha256")
        .update(
          Buffer.from(await file.arrayBuffer())
        )
        .digest("hex");

      storedByKey.set(item.key, {
        storageKey: stored.storageKey,
        checksum,
      });
    }

    const now = new Date();

    // ======================================
    // DATABASE TRANSACTION
    // ======================================

    await prisma.$transaction(async (tx) => {
      if (
        application.documentsStatus ===
        DocumentsApplicationStatus.NEEDS_CORRECTION
      ) {
        await tx.candidateDocument.updateMany({
          where: {
            applicationId: application.id,
            stage: ApplicationStage.DOCUMENTS,
            isCurrent: true,
          },
          data: {
            isCurrent: false,
          },
        });
      }

      for (const item of payload.documents) {
        const file = files.get(item.key)!;

        const stored = storedByKey.get(item.key)!;

        await tx.candidateDocument.create({
          data: {
            applicationId: application.id,
            documentType: item.documentType,
            stage: ApplicationStage.DOCUMENTS,
            status: CandidateDocumentStatus.UPLOADED,
            pageNumber: item.pageNumber ?? null,
            totalPages: item.totalPages ?? null,
            subjectIndex: item.subjectIndex ?? null,
            stageVersion: nextVersion,
            fileName: cleanFileName(file.name),
            storageKey: stored.storageKey,
            mimeType: file.type,
            sizeBytes: file.size,
            checksum: stored.checksum,
            isCurrent: true,
            uploadedByUserId: user.id,
          },
        });
      }

      await tx.candidateApplication.update({
        where: {
          id: application.id,
        },
        data: {
          bankSinaIban,
          insuranceNumber:
            application.hasInsuranceHistory
              ? insuranceNumber
              : null,
          documentsVersion: nextVersion,
          documentsStatus:
            DocumentsApplicationStatus.SUBMITTED,
          documentsSubmittedAt: now,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action: "CANDIDATE_DOCUMENTS_SUBMITTED",
          entityType: "CandidateApplication",
          entityId: application.id,
          ipAddress:
            request.headers.get("x-real-ip") ||
            undefined,
          details: {
            applicationNumber:
              application.applicationNumber,
            documentsVersion: nextVersion,
            documentCount:
              payload.documents.length,
          },
        },
      });
    });

    return successResponse({
      message:
        "مدارک مرحله دوم با موفقیت ارسال شد.",
      documentsStatus:
        DocumentsApplicationStatus.SUBMITTED,
      documentsVersion: nextVersion,
    });

  } catch (error) {
    await Promise.allSettled(
      storedFiles.map((file) =>
        deletePrivateFile(file.storageKey)
      )
    );

    if (error instanceof DocumentError) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    if (error instanceof RequestOriginError) {
      return errorResponse(
        error.message,
        error.statusCode
      );
    }

    return authExceptionResponse(
      error,
      "خطا در ثبت مدارک مرحله دوم استخدام."
    );
  }
}
