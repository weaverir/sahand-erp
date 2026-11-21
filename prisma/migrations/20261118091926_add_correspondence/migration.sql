-- CreateEnum
CREATE TYPE "CorrespondencePriority" AS ENUM ('NORMAL', 'URGENT');

-- CreateEnum
CREATE TYPE "CorrespondenceStatus" AS ENUM ('PENDING', 'REJECTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CorrespondenceAction" AS ENUM ('SENT', 'FORWARDED', 'REJECTED', 'CLOSED');

-- CreateTable
CREATE TABLE "CorrespondenceLetter" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "priority" "CorrespondencePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "CorrespondenceStatus" NOT NULL DEFAULT 'PENDING',
    "senderUserId" TEXT NOT NULL,
    "senderAssignmentId" TEXT NOT NULL,
    "currentReviewerAssignmentId" TEXT,
    "persianMonth" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CorrespondenceLetter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenceHistory" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorAssignmentId" TEXT NOT NULL,
    "action" "CorrespondenceAction" NOT NULL,
    "fromAssignmentId" TEXT,
    "toAssignmentId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorrespondenceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorrespondenceMonthlyQuota" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "persianMonth" TEXT NOT NULL,
    "urgentUsed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CorrespondenceMonthlyQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CorrespondenceLetter_senderUserId_persianMonth_priority_idx" ON "CorrespondenceLetter"("senderUserId", "persianMonth", "priority");

-- CreateIndex
CREATE INDEX "CorrespondenceLetter_currentReviewerAssignmentId_status_idx" ON "CorrespondenceLetter"("currentReviewerAssignmentId", "status");

-- CreateIndex
CREATE INDEX "CorrespondenceLetter_createdAt_idx" ON "CorrespondenceLetter"("createdAt");

-- CreateIndex
CREATE INDEX "CorrespondenceHistory_letterId_createdAt_idx" ON "CorrespondenceHistory"("letterId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrespondenceHistory_actorUserId_createdAt_idx" ON "CorrespondenceHistory"("actorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CorrespondenceMonthlyQuota_userId_persianMonth_key" ON "CorrespondenceMonthlyQuota"("userId", "persianMonth");

-- AddForeignKey
ALTER TABLE "CorrespondenceHistory" ADD CONSTRAINT "CorrespondenceHistory_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "CorrespondenceLetter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
