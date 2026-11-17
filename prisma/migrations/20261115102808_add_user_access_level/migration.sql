-- CreateEnum
CREATE TYPE "CandidateFamilyMemberType" AS ENUM ('SPOUSE', 'CHILD');

-- CreateEnum
CREATE TYPE "CandidateDocumentStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CandidateDocumentType" ADD VALUE 'SPOUSE_CONSENT';
ALTER TYPE "CandidateDocumentType" ADD VALUE 'PARENT_CONSENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accessLevel" "UserAccessLevel" NOT NULL DEFAULT 'ERP';

-- CreateTable
CREATE TABLE "CandidateApplication" (
    "id" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "fatherName" TEXT NOT NULL,
    "birthCertificateNumber" TEXT NOT NULL,
    "nationalId" TEXT NOT NULL,
    "gender" "CandidateGender" NOT NULL,
    "maritalStatus" "CandidateMaritalStatus" NOT NULL,
    "nationality" TEXT NOT NULL,
    "birthPlace" TEXT NOT NULL,
    "dateOfBirth" DATE NOT NULL,
    "landlinePhone" TEXT,
    "mobilePhone" TEXT NOT NULL,
    "email" TEXT,
    "address" TEXT NOT NULL,
    "militaryStatus" "CandidateMilitaryStatus",
    "currentlyEmployed" BOOLEAN NOT NULL DEFAULT false,
    "currentEmployer" TEXT,
    "hasExternalCommitment" BOOLEAN NOT NULL DEFAULT false,
    "hasInsuranceHistory" BOOLEAN NOT NULL DEFAULT false,
    "minimumEmploymentPeriod" TEXT,
    "childrenCount" INTEGER NOT NULL DEFAULT 0,
    "requestedSalary" DECIMAL(18,2),
    "additionalNotes" TEXT,
    "insuranceNumber" TEXT,
    "bankSinaIban" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,
    "declarationTextVersion" TEXT,
    "declarationAcceptedAt" TIMESTAMP(3),
    "declarationIpAddress" TEXT,
    "initialStatus" "InitialApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "initialVersion" INTEGER NOT NULL DEFAULT 1,
    "initialSubmittedAt" TIMESTAMP(3),
    "initialApprovedAt" TIMESTAMP(3),
    "documentsStatus" "DocumentsApplicationStatus" NOT NULL DEFAULT 'LOCKED',
    "documentsVersion" INTEGER NOT NULL DEFAULT 1,
    "documentsSubmittedAt" TIMESTAMP(3),
    "documentsApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEducation" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "degree" TEXT NOT NULL,
    "fieldOfStudy" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "city" TEXT,
    "startDate" DATE,
    "endDate" DATE,
    "isCurrentlyStudying" BOOLEAN NOT NULL DEFAULT false,
    "grade" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateEducation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateWorkExperience" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "position" TEXT NOT NULL,
    "leavingReason" TEXT,
    "salaryReceived" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateWorkExperience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSkill" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateReference" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "occupation" TEXT NOT NULL,
    "workplace" TEXT NOT NULL,
    "acquaintanceDuration" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateEmergencyContact" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateSensitiveInfo" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "hasProlongedIllness" BOOLEAN NOT NULL DEFAULT false,
    "illnessDescription" TEXT,
    "hasCriminalRecord" BOOLEAN NOT NULL DEFAULT false,
    "convictionDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateSensitiveInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateFamilyMember" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "memberType" "CandidateFamilyMemberType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "insuranceNumber" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateFamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandidateDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" "CandidateDocumentType" NOT NULL,
    "stage" "ApplicationStage" NOT NULL,
    "status" "CandidateDocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "pageNumber" INTEGER,
    "totalPages" INTEGER,
    "subjectIndex" INTEGER,
    "stageVersion" INTEGER NOT NULL DEFAULT 1,
    "fileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CandidateDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationApproval" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "stage" "ApplicationStage" NOT NULL,
    "reviewerType" "ApplicationReviewerType" NOT NULL,
    "reviewerUserId" TEXT NOT NULL,
    "decision" "ApplicationDecision" NOT NULL,
    "comment" TEXT,
    "applicationVersion" INTEGER NOT NULL,
    "decidedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CandidateApplication_applicationNumber_key" ON "CandidateApplication"("applicationNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateApplication_userId_key" ON "CandidateApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateApplication_nationalId_key" ON "CandidateApplication"("nationalId");

-- CreateIndex
CREATE INDEX "CandidateApplication_initialStatus_createdAt_idx" ON "CandidateApplication"("initialStatus", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateApplication_documentsStatus_createdAt_idx" ON "CandidateApplication"("documentsStatus", "createdAt");

-- CreateIndex
CREATE INDEX "CandidateEducation_applicationId_idx" ON "CandidateEducation"("applicationId");

-- CreateIndex
CREATE INDEX "CandidateWorkExperience_applicationId_idx" ON "CandidateWorkExperience"("applicationId");

-- CreateIndex
CREATE INDEX "CandidateSkill_applicationId_idx" ON "CandidateSkill"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateReference_applicationId_sortOrder_key" ON "CandidateReference"("applicationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateEmergencyContact_applicationId_key" ON "CandidateEmergencyContact"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateSensitiveInfo_applicationId_key" ON "CandidateSensitiveInfo"("applicationId");

-- CreateIndex
CREATE INDEX "CandidateFamilyMember_applicationId_idx" ON "CandidateFamilyMember"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateFamilyMember_applicationId_memberType_sortOrder_key" ON "CandidateFamilyMember"("applicationId", "memberType", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CandidateDocument_storageKey_key" ON "CandidateDocument"("storageKey");

-- CreateIndex
CREATE INDEX "CandidateDocument_applicationId_stage_stageVersion_idx" ON "CandidateDocument"("applicationId", "stage", "stageVersion");

-- CreateIndex
CREATE INDEX "CandidateDocument_applicationId_documentType_isCurrent_idx" ON "CandidateDocument"("applicationId", "documentType", "isCurrent");

-- CreateIndex
CREATE INDEX "CandidateDocument_status_idx" ON "CandidateDocument"("status");

-- CreateIndex
CREATE INDEX "ApplicationApproval_reviewerUserId_decidedAt_idx" ON "ApplicationApproval"("reviewerUserId", "decidedAt");

-- CreateIndex
CREATE INDEX "ApplicationApproval_applicationId_stage_applicationVersion_idx" ON "ApplicationApproval"("applicationId", "stage", "applicationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationApproval_applicationId_stage_reviewerType_applic_key" ON "ApplicationApproval"("applicationId", "stage", "reviewerType", "applicationVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationApproval_applicationId_stage_reviewerUserId_appl_key" ON "ApplicationApproval"("applicationId", "stage", "reviewerUserId", "applicationVersion");

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEducation" ADD CONSTRAINT "CandidateEducation_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateWorkExperience" ADD CONSTRAINT "CandidateWorkExperience_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSkill" ADD CONSTRAINT "CandidateSkill_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateReference" ADD CONSTRAINT "CandidateReference_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateEmergencyContact" ADD CONSTRAINT "CandidateEmergencyContact_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateSensitiveInfo" ADD CONSTRAINT "CandidateSensitiveInfo_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateFamilyMember" ADD CONSTRAINT "CandidateFamilyMember_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateDocument" ADD CONSTRAINT "CandidateDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationApproval" ADD CONSTRAINT "ApplicationApproval_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationApproval" ADD CONSTRAINT "ApplicationApproval_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
