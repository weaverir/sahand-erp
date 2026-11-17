-- CreateEnum
CREATE TYPE "OrganizationLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "OrganizationUnitStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "EmployeeAssignmentStatus" AS ENUM ('ACTIVE', 'ENDED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "OrganizationLocation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "locationType" TEXT NOT NULL,
    "description" TEXT,
    "country" TEXT,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "status" "OrganizationLocationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationUnit" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "locationId" TEXT,
    "status" "OrganizationUnitStatus" NOT NULL DEFAULT 'ACTIVE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationPosition" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "isManagerial" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationUnitId" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "locationId" TEXT,
    "managerAssignmentId" TEXT,
    "status" "EmployeeAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT true,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAssignmentHistory" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "previousData" JSONB,
    "newData" JSONB,
    "changedByUserId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAssignmentHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "beforeData" JSONB,
    "afterData" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationLocation_code_key" ON "OrganizationLocation"("code");

-- CreateIndex
CREATE INDEX "OrganizationLocation_status_idx" ON "OrganizationLocation"("status");

-- CreateIndex
CREATE INDEX "OrganizationLocation_locationType_idx" ON "OrganizationLocation"("locationType");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationUnit_code_key" ON "OrganizationUnit"("code");

-- CreateIndex
CREATE INDEX "OrganizationUnit_parentId_idx" ON "OrganizationUnit"("parentId");

-- CreateIndex
CREATE INDEX "OrganizationUnit_locationId_idx" ON "OrganizationUnit"("locationId");

-- CreateIndex
CREATE INDEX "OrganizationUnit_status_idx" ON "OrganizationUnit"("status");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationPosition_code_key" ON "OrganizationPosition"("code");

-- CreateIndex
CREATE INDEX "OrganizationPosition_title_idx" ON "OrganizationPosition"("title");

-- CreateIndex
CREATE INDEX "OrganizationPosition_isActive_idx" ON "OrganizationPosition"("isActive");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_userId_status_idx" ON "EmployeeAssignment"("userId", "status");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_organizationUnitId_status_idx" ON "EmployeeAssignment"("organizationUnitId", "status");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_positionId_idx" ON "EmployeeAssignment"("positionId");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_managerAssignmentId_idx" ON "EmployeeAssignment"("managerAssignmentId");

-- CreateIndex
CREATE INDEX "EmployeeAssignment_locationId_idx" ON "EmployeeAssignment"("locationId");

-- CreateIndex
CREATE INDEX "OrganizationAssignmentHistory_assignmentId_changedAt_idx" ON "OrganizationAssignmentHistory"("assignmentId", "changedAt");

-- CreateIndex
CREATE INDEX "OrganizationAssignmentHistory_changedByUserId_idx" ON "OrganizationAssignmentHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_actorUserId_createdAt_idx" ON "OrganizationAuditLog"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "OrganizationAuditLog_entityType_entityId_idx" ON "OrganizationAuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationUnit" ADD CONSTRAINT "OrganizationUnit_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "OrganizationLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "OrganizationPosition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "OrganizationLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeAssignment" ADD CONSTRAINT "EmployeeAssignment_managerAssignmentId_fkey" FOREIGN KEY ("managerAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationAssignmentHistory" ADD CONSTRAINT "OrganizationAssignmentHistory_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
