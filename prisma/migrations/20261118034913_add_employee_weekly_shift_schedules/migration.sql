-- CreateEnum
CREATE TYPE "AttendanceRecordStatus" AS ENUM ('OPEN', 'COMPLETED', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceEventType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END', 'AUTO_CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceVerificationType" AS ENUM ('GPS', 'FACE', 'DEVICE', 'LIVENESS');

-- CreateEnum
CREATE TYPE "AttendanceVerificationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'REVIEW_REQUIRED');

-- CreateEnum
CREATE TYPE "AttendanceAdjustmentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceChallengeAction" AS ENUM ('CHECK_IN', 'CHECK_OUT');

-- CreateEnum
CREATE TYPE "AttendanceChallengeStatus" AS ENUM ('OPEN', 'CONSUMED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "EmployeeShiftScheduleStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "employeeAssignmentId" TEXT NOT NULL,
    "shiftAssignmentId" TEXT,
    "checkpointLocationId" TEXT,
    "workDate" DATE NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "scheduledStartAt" TIMESTAMP(3),
    "scheduledEndAt" TIMESTAMP(3),
    "requiredMinutes" INTEGER NOT NULL DEFAULT 480,
    "firstCheckInAt" TIMESTAMP(3),
    "lastCheckOutAt" TIMESTAMP(3),
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "breakMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "earlyLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceRecordStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "eventType" "AttendanceEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "accuracyMeters" DECIMAL(10,2),
    "distanceFromCheckpointMeters" DECIMAL(10,2),
    "geofencePassed" BOOLEAN,
    "source" TEXT NOT NULL DEFAULT 'MOBILE',
    "deviceFingerprint" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "photoStorageKey" TEXT,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceVerification" (
    "id" TEXT NOT NULL,
    "attendanceEventId" TEXT NOT NULL,
    "verificationType" "AttendanceVerificationType" NOT NULL,
    "status" "AttendanceVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "score" DECIMAL(7,4),
    "provider" TEXT,
    "details" JSONB,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceAdjustment" (
    "id" TEXT NOT NULL,
    "attendanceRecordId" TEXT NOT NULL,
    "attendanceEventId" TEXT,
    "requestedByUserId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "proposedEventType" "AttendanceEventType",
    "proposedOccurredAt" TIMESTAMP(3),
    "reason" TEXT NOT NULL,
    "status" "AttendanceAdjustmentStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerComment" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceChallenge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeAssignmentId" TEXT NOT NULL,
    "action" "AttendanceChallengeAction" NOT NULL,
    "nonceHash" TEXT NOT NULL,
    "status" "AttendanceChallengeStatus" NOT NULL DEFAULT 'OPEN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "ipAddress" TEXT,
    "userAgentHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaceIdentityProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "referenceImageEncrypted" BYTEA NOT NULL,
    "referenceImageIv" BYTEA NOT NULL,
    "referenceImageAuthTag" BYTEA NOT NULL,
    "referenceImageMimeType" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL DEFAULT 'v1',
    "consentAcceptedAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "enrolledByUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaceIdentityProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeShiftSchedule" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "weekStartDate" DATE NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "EmployeeShiftScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "submittedByUserId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewComment" TEXT,
    "publishedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeShiftSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeShiftScheduleSegment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "workDate" DATE NOT NULL,
    "segmentOrder" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "requiredMinutes" INTEGER NOT NULL,
    "workShiftId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeShiftScheduleSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeShiftScheduleRevision" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeShiftScheduleRevision_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceRecord_employeeAssignmentId_workDate_idx" ON "AttendanceRecord"("employeeAssignmentId", "workDate");

-- CreateIndex
CREATE INDEX "AttendanceRecord_workDate_status_idx" ON "AttendanceRecord"("workDate", "status");

-- CreateIndex
CREATE INDEX "AttendanceRecord_shiftAssignmentId_idx" ON "AttendanceRecord"("shiftAssignmentId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_checkpointLocationId_idx" ON "AttendanceRecord"("checkpointLocationId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_approvedByUserId_idx" ON "AttendanceRecord"("approvedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceRecord_employeeAssignmentId_workDate_key" ON "AttendanceRecord"("employeeAssignmentId", "workDate");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceEvent_idempotencyKey_key" ON "AttendanceEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AttendanceEvent_attendanceRecordId_occurredAt_idx" ON "AttendanceEvent"("attendanceRecordId", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_eventType_occurredAt_idx" ON "AttendanceEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE INDEX "AttendanceEvent_geofencePassed_idx" ON "AttendanceEvent"("geofencePassed");

-- CreateIndex
CREATE INDEX "AttendanceVerification_attendanceEventId_verificationType_idx" ON "AttendanceVerification"("attendanceEventId", "verificationType");

-- CreateIndex
CREATE INDEX "AttendanceVerification_status_createdAt_idx" ON "AttendanceVerification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_attendanceRecordId_status_idx" ON "AttendanceAdjustment"("attendanceRecordId", "status");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_attendanceEventId_idx" ON "AttendanceAdjustment"("attendanceEventId");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_requestedByUserId_createdAt_idx" ON "AttendanceAdjustment"("requestedByUserId", "createdAt");

-- CreateIndex
CREATE INDEX "AttendanceAdjustment_reviewedByUserId_reviewedAt_idx" ON "AttendanceAdjustment"("reviewedByUserId", "reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceChallenge_nonceHash_key" ON "AttendanceChallenge"("nonceHash");

-- CreateIndex
CREATE INDEX "AttendanceChallenge_userId_status_expiresAt_idx" ON "AttendanceChallenge"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "AttendanceChallenge_employeeAssignmentId_createdAt_idx" ON "AttendanceChallenge"("employeeAssignmentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FaceIdentityProfile_userId_key" ON "FaceIdentityProfile"("userId");

-- CreateIndex
CREATE INDEX "FaceIdentityProfile_isActive_enrolledAt_idx" ON "FaceIdentityProfile"("isActive", "enrolledAt");

-- CreateIndex
CREATE INDEX "EmployeeShiftSchedule_employeeUserId_weekStartDate_status_idx" ON "EmployeeShiftSchedule"("employeeUserId", "weekStartDate", "status");

-- CreateIndex
CREATE INDEX "EmployeeShiftSchedule_status_weekStartDate_idx" ON "EmployeeShiftSchedule"("status", "weekStartDate");

-- CreateIndex
CREATE INDEX "EmployeeShiftSchedule_createdByUserId_createdAt_idx" ON "EmployeeShiftSchedule"("createdByUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeShiftSchedule_employeeUserId_weekStartDate_version_key" ON "EmployeeShiftSchedule"("employeeUserId", "weekStartDate", "version");

-- CreateIndex
CREATE INDEX "EmployeeShiftScheduleSegment_workDate_startsAt_idx" ON "EmployeeShiftScheduleSegment"("workDate", "startsAt");

-- CreateIndex
CREATE INDEX "EmployeeShiftScheduleSegment_workShiftId_idx" ON "EmployeeShiftScheduleSegment"("workShiftId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeShiftScheduleSegment_scheduleId_workDate_segmentOrd_key" ON "EmployeeShiftScheduleSegment"("scheduleId", "workDate", "segmentOrder");

-- CreateIndex
CREATE INDEX "EmployeeShiftScheduleRevision_scheduleId_createdAt_idx" ON "EmployeeShiftScheduleRevision"("scheduleId", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeShiftScheduleRevision_actorUserId_createdAt_idx" ON "EmployeeShiftScheduleRevision"("actorUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_employeeAssignmentId_fkey" FOREIGN KEY ("employeeAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_checkpointLocationId_fkey" FOREIGN KEY ("checkpointLocationId") REFERENCES "OrganizationLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceVerification" ADD CONSTRAINT "AttendanceVerification_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_attendanceEventId_fkey" FOREIGN KEY ("attendanceEventId") REFERENCES "AttendanceEvent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceAdjustment" ADD CONSTRAINT "AttendanceAdjustment_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceChallenge" ADD CONSTRAINT "AttendanceChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceChallenge" ADD CONSTRAINT "AttendanceChallenge_employeeAssignmentId_fkey" FOREIGN KEY ("employeeAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FaceIdentityProfile" ADD CONSTRAINT "FaceIdentityProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftSchedule" ADD CONSTRAINT "EmployeeShiftSchedule_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftSchedule" ADD CONSTRAINT "EmployeeShiftSchedule_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftSchedule" ADD CONSTRAINT "EmployeeShiftSchedule_submittedByUserId_fkey" FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftSchedule" ADD CONSTRAINT "EmployeeShiftSchedule_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftScheduleSegment" ADD CONSTRAINT "EmployeeShiftScheduleSegment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "EmployeeShiftSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftScheduleSegment" ADD CONSTRAINT "EmployeeShiftScheduleSegment_workShiftId_fkey" FOREIGN KEY ("workShiftId") REFERENCES "WorkShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftScheduleRevision" ADD CONSTRAINT "EmployeeShiftScheduleRevision_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "EmployeeShiftSchedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeShiftScheduleRevision" ADD CONSTRAINT "EmployeeShiftScheduleRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
