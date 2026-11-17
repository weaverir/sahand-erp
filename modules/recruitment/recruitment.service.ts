import "server-only";

import { prisma } from "@/libs/prisma";

import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import { hash } from "bcryptjs";

import {
  ApplicationStage,
  CandidateDocumentStatus,
  CandidateDocumentType,
  DocumentsApplicationStatus,
  InitialApplicationStatus,
  UserAccessLevel,
} from "@/generated/prisma/client";

import {
  INITIAL_DECLARATION_VERSION,
  MAX_PERSONAL_PHOTO_SIZE,
  PERSONAL_PHOTO_MIME_TYPES,
  RECRUITMENT_USERNAME_PREFIX,
} from "./recruitment.constants";

import type {
  InitialApplicationInput,
} from "./recruitment.validation";

import {
  storePrivateFile,
  deletePrivateFile,
  type StoredPrivateFile,
} from "@/libs/private-file-storage";

export class RecruitmentError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "RecruitmentError";
  }
}

type CreateInitialApplicationParams = {
  data: InitialApplicationInput;
  personalPhoto: File;
  ipAddress?: string;
};

function toDate(value?: string | null) {
  if (!value) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    throw new RecruitmentError("تاریخ واردشده معتبر نیست.");
  }

  return date;
}

function generatePassword() {
  return randomBytes(24).toString("base64url");
}

function generateApplicationNumber() {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");

  return `HR-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}

async function generateUniqueUsername() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const username =
      `${RECRUITMENT_USERNAME_PREFIX}${randomBytes(6).toString("hex")}`;

    const existing = await prisma.user.findUnique({
      where: { username },
      select: { id: true },
    });

    if (!existing) return username;
  }

  throw new RecruitmentError(
    "ساخت نام کاربری امکان‌پذیر نشد.",
    500
  );
}

export async function createInitialApplication({
  data,
  personalPhoto,
  ipAddress,
}: CreateInitialApplicationParams) {
  if (!data.declarationAccepted) {
    throw new RecruitmentError(
      "تأیید تعهدنامه برای ثبت درخواست الزامی است."
    );
  }

  const userId = randomUUID();
  const applicationId = randomUUID();

  const username = await generateUniqueUsername();
  const temporaryPassword = generatePassword();

  const passwordHash = await hash(temporaryPassword, 12);
  const applicationNumber = generateApplicationNumber();

  const fullName =
    `${data.firstName} ${data.lastName}`.trim();

  const storedFiles: StoredPrivateFile[] = [];

  try {
    // در مرحله اول فقط عکس پرسنلی دریافت می‌شود.
    const photo = await storePrivateFile(personalPhoto, {
      directory: `recruitment/${applicationId}/initial`,
      maxBytes: MAX_PERSONAL_PHOTO_SIZE,
      allowedMimeTypes: PERSONAL_PHOTO_MIME_TYPES,
    });

    storedFiles.push(photo);

    await prisma.$transaction(async (tx) => {
      await tx.user.create({
        data: {
          id: userId,
          username,
          email: data.email || null,
          phone: data.mobilePhone,
          fullName,
          passwordHash,
          isActive: false,
          accessLevel: UserAccessLevel.PENDING,
        },
      });

      await tx.candidateApplication.create({
        data: {
          id: applicationId,
          applicationNumber,
          userId,

          firstName: data.firstName,
          lastName: data.lastName,
          fatherName: data.fatherName,
          birthCertificateNumber: data.birthCertificateNumber,
          nationalId: data.nationalId,

          gender: data.gender,
          maritalStatus: data.maritalStatus,

          nationality: data.nationality,
          birthPlace: data.birthPlace,
          dateOfBirth: toDate(data.dateOfBirth)!,

          landlinePhone: data.landlinePhone || null,
          mobilePhone: data.mobilePhone,
          email: data.email || null,
          address: data.address,

          militaryStatus: data.militaryStatus || null,

          currentlyEmployed: data.currentlyEmployed,
          currentEmployer: data.currentlyEmployed
            ? data.currentEmployer || null
            : null,

          hasExternalCommitment: data.hasExternalCommitment,
          hasInsuranceHistory: data.hasInsuranceHistory,
          minimumEmploymentPeriod:
            data.minimumEmploymentPeriod || null,

          requestedSalary: data.requestedSalary || null,
          additionalNotes: data.additionalNotes || null,

          declarationAccepted: true,
          declarationTextVersion: INITIAL_DECLARATION_VERSION,
          declarationAcceptedAt: new Date(),
          declarationIpAddress: ipAddress,

          initialStatus: InitialApplicationStatus.SUBMITTED,
          initialSubmittedAt: new Date(),

          // مرحله دوم تا پایان تأییدهای مرحله اول قفل می‌ماند.
          documentsStatus: DocumentsApplicationStatus.LOCKED,

          educationRecords: {
            create: data.educationRecords.map((item) => ({
              degree: item.degree,
              fieldOfStudy: item.fieldOfStudy,
              institution: item.institution,
              city: item.city || null,
              startDate: toDate(item.startDate),
              endDate: toDate(item.endDate),
              isCurrentlyStudying: item.isCurrentlyStudying,
              grade: item.grade || null,
              description: item.description || null,
            })),
          },

          workExperiences: {
            create: data.workExperiences.map((item) => ({
              companyName: item.companyName,
              startDate: toDate(item.startDate)!,
              endDate: toDate(item.endDate),
              position: item.position,
              leavingReason: item.leavingReason || null,
              salaryReceived: item.salaryReceived || null,
            })),
          },

          skills: {
            create: data.skills.map((item) => ({
              specialty: item.specialty,
              description: item.description || null,
            })),
          },

          references: {
            create: data.references.map((item, index) => ({
              fullName: item.fullName,
              occupation: item.occupation,
              workplace: item.workplace,
              acquaintanceDuration: item.acquaintanceDuration,
              phone: item.phone,
              sortOrder: index + 1,
            })),
          },

          emergencyContact: {
            create: {
              firstName: data.emergencyContact.firstName,
              lastName: data.emergencyContact.lastName,
              relationship: data.emergencyContact.relationship,
              phone: data.emergencyContact.phone,
            },
          },

          sensitiveInfo: {
            create: {
              hasProlongedIllness:
                data.sensitiveInfo.hasProlongedIllness,
              illnessDescription:
                data.sensitiveInfo.hasProlongedIllness
                  ? data.sensitiveInfo.illnessDescription || null
                  : null,
              hasCriminalRecord:
                data.sensitiveInfo.hasCriminalRecord,
              convictionDescription:
                data.sensitiveInfo.hasCriminalRecord
                  ? data.sensitiveInfo.convictionDescription || null
                  : null,
            },
          },
        },
      });

      // در مرحله اول فقط سند عکس پرسنلی ثبت می‌شود.
      await tx.candidateDocument.create({
        data: {
          applicationId,
          documentType: CandidateDocumentType.PERSONAL_PHOTO,
          stage: ApplicationStage.INITIAL,
          status: CandidateDocumentStatus.UPLOADED,

          fileName: photo.fileName,
          storageKey: photo.storageKey,
          mimeType: photo.mimeType,
          sizeBytes: photo.sizeBytes,
          checksum: photo.checksum,

          uploadedByUserId: userId,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: userId,
          action: "CANDIDATE_APPLICATION_SUBMITTED",
          entityType: "CandidateApplication",
          entityId: applicationId,
          ipAddress,
          details: {
            applicationNumber,
            initialStatus: InitialApplicationStatus.SUBMITTED,
            documentsStatus: DocumentsApplicationStatus.LOCKED,
          },
        },
      });
    });

    return {
      applicationNumber,
      username,
      temporaryPassword,
      accessLevel: UserAccessLevel.PENDING,
      initialStatus: InitialApplicationStatus.SUBMITTED,
      documentsStatus: DocumentsApplicationStatus.LOCKED,
      message:
        "ثبت‌نام اولیه با موفقیت انجام شد. حساب کاربری پس از تأییدهای سازمانی فعال خواهد شد.",
    };
  } catch (error) {
    // اگر تراکنش دیتابیس شکست خورد، فایل ذخیره‌شده هم پاک می‌شود.
    await Promise.allSettled(
      storedFiles.map((file) => deletePrivateFile(file.storageKey))
    );

    throw error;
  }
}
