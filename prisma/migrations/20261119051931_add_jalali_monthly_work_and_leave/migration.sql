-- CreateEnum
CREATE TYPE "AttendanceMonthlyPeriodStatus" AS ENUM ('OPEN', 'CALCULATING', 'PENDING_REVIEW', 'CLOSED', 'REOPENED');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'PARTIALLY_APPROVED', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LeaveApprovalRole" AS ENUM ('SECTION_SUPERVISOR', 'PRODUCTION_MANAGER', 'HR_MANAGER', 'CEO_OR_DEPUTY');

-- CreateEnum
CREATE TYPE "LeaveApprovalDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LeaveLedgerEntryType" AS ENUM ('MONTHLY_CREDIT', 'APPROVED_USAGE', 'USAGE_REVERSAL', 'MANUAL_ADJUSTMENT');

-- CreateTable
CREATE TABLE "AttendanceMonthlyPeriod" (
    "id" TEXT NOT NULL,
    "jalaliYear" INTEGER NOT NULL,
    "jalaliMonth" INTEGER NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "AttendanceMonthlyPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "calculatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "closeNote" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMonthlyPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyWorkSummary" (
    "id" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "requiredMinutes" INTEGER NOT NULL DEFAULT 0,
    "workedMinutes" INTEGER NOT NULL DEFAULT 0,
    "approvedLeaveMinutes" INTEGER NOT NULL DEFAULT 0,
    "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
    "uncoveredMinutes" INTEGER NOT NULL DEFAULT 0,
    "unresolvedCount" INTEGER NOT NULL DEFAULT 0,
    "calculationVersion" INTEGER NOT NULL DEFAULT 1,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyWorkSummary_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "employeeAssignmentId" TEXT NOT NULL,
    "leaveTypeKey" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "requestedMinutes" INTEGER NOT NULL,
    "approvedMinutes" INTEGER,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "reason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveApprovalStep" (
    "id" TEXT NOT NULL,
    "leaveRequestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "requiredRole" "LeaveApprovalRole" NOT NULL,
    "reviewerUserId" TEXT,
    "decision" "LeaveApprovalDecision",
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveLedgerEntry" (
    "id" TEXT NOT NULL,
    "employeeUserId" TEXT NOT NULL,
    "leaveTypeKey" TEXT NOT NULL,
    "jalaliYear" INTEGER NOT NULL,
    "jalaliMonth" INTEGER NOT NULL,
    "entryType" "LeaveLedgerEntryType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "leaveRequestId" TEXT,
    "createdByUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaveLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceMonthlyPeriod_status_startsAt_idx" ON "AttendanceMonthlyPeriod"("status", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMonthlyPeriod_jalaliYear_jalaliMonth_key" ON "AttendanceMonthlyPeriod"("jalaliYear", "jalaliMonth");

-- CreateIndex
CREATE INDEX "MonthlyWorkSummary_employeeUserId_periodId_idx" ON "MonthlyWorkSummary"("employeeUserId", "periodId");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyWorkSummary_periodId_employeeUserId_key" ON "MonthlyWorkSummary"("periodId", "employeeUserId");

-- CreateIndex
CREATE INDEX "LeaveRequest_employeeUserId_startAt_endAt_idx" ON "LeaveRequest"("employeeUserId", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_status_submittedAt_idx" ON "LeaveRequest"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "LeaveApprovalStep_requiredRole_decision_idx" ON "LeaveApprovalStep"("requiredRole", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveApprovalStep_leaveRequestId_stepOrder_key" ON "LeaveApprovalStep"("leaveRequestId", "stepOrder");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveLedgerEntry_idempotencyKey_key" ON "LeaveLedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_employeeUserId_leaveTypeKey_jalaliYear_jal_idx" ON "LeaveLedgerEntry"("employeeUserId", "leaveTypeKey", "jalaliYear", "jalaliMonth");

-- CreateIndex
CREATE INDEX "LeaveLedgerEntry_leaveRequestId_entryType_idx" ON "LeaveLedgerEntry"("leaveRequestId", "entryType");

-- AddForeignKey
ALTER TABLE "AttendanceMonthlyPeriod" ADD CONSTRAINT "AttendanceMonthlyPeriod_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyWorkSummary" ADD CONSTRAINT "MonthlyWorkSummary_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AttendanceMonthlyPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonthlyWorkSummary" ADD CONSTRAINT "MonthlyWorkSummary_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_employeeAssignmentId_fkey" FOREIGN KEY ("employeeAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveApprovalStep" ADD CONSTRAINT "LeaveApprovalStep_reviewerUserId_fkey" FOREIGN KEY ("reviewerUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_leaveRequestId_fkey" FOREIGN KEY ("leaveRequestId") REFERENCES "LeaveRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveLedgerEntry" ADD CONSTRAINT "LeaveLedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
