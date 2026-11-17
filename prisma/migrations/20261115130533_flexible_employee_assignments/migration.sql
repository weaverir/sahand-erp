
-- =====================================================
-- Sahand ERP
-- Flexible Employee Assignments Migration
-- =====================================================

-- 1. Create Enums

CREATE TYPE "EmployeeAssignmentType" AS ENUM (
    'PRIMARY',
    'SECONDARY',
    'TEMPORARY',
    'PROJECT'
);

CREATE TYPE "OrganizationRelationshipType" AS ENUM (
    'REPORTS_TO',
    'FUNCTIONAL_REPORTS_TO',
    'SUPERVISES',
    'COLLABORATES_WITH',
    'ADVISES',
    'DELEGATES_TO'
);

CREATE TYPE "OrganizationRelationshipStatus" AS ENUM (
    'ACTIVE',
    'ENDED',
    'SUSPENDED'
);

-- =====================================================
-- 2. Update EmployeeAssignment
-- =====================================================

ALTER TABLE "EmployeeAssignment"
ADD COLUMN "assignmentType" "EmployeeAssignmentType"
NOT NULL DEFAULT 'SECONDARY';

-- Preserve existing primary assignment information

UPDATE "EmployeeAssignment"
SET "assignmentType" =
    CASE
        WHEN "isPrimary" = true
        THEN 'PRIMARY'::"EmployeeAssignmentType"
        ELSE 'SECONDARY'::"EmployeeAssignmentType"
    END;

CREATE INDEX "EmployeeAssignment_assignmentType_status_idx"
ON "EmployeeAssignment"("assignmentType", "status");

-- Only one active primary assignment per employee

CREATE UNIQUE INDEX
"EmployeeAssignment_one_active_primary_per_user_key"
ON "EmployeeAssignment"("userId")
WHERE "status" = 'ACTIVE'
AND "assignmentType" = 'PRIMARY';

-- =====================================================
-- 3. EmployeeAssignmentRole
-- =====================================================

CREATE TABLE "EmployeeAssignmentRole" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "assignedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAssignmentRole_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"EmployeeAssignmentRole_assignmentId_roleId_key"
ON "EmployeeAssignmentRole"("assignmentId", "roleId");

CREATE INDEX
"EmployeeAssignmentRole_roleId_isActive_idx"
ON "EmployeeAssignmentRole"("roleId", "isActive");

CREATE INDEX
"EmployeeAssignmentRole_assignmentId_isActive_idx"
ON "EmployeeAssignmentRole"("assignmentId", "isActive");

CREATE INDEX
"EmployeeAssignmentRole_expiresAt_idx"
ON "EmployeeAssignmentRole"("expiresAt");

-- =====================================================
-- 4. EmployeeAssignmentPermission
-- =====================================================

CREATE TABLE "EmployeeAssignmentPermission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "isAllowed" BOOLEAN NOT NULL DEFAULT true,
    "scope" "DataScope" NOT NULL DEFAULT 'OWN',
    "assignedById" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeAssignmentPermission_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
"EmployeeAssignmentPermission_assignmentId_permissionId_key"
ON "EmployeeAssignmentPermission"("assignmentId", "permissionId");

CREATE INDEX
"EmployeeAssignmentPermission_permissionId_isActive_idx"
ON "EmployeeAssignmentPermission"("permissionId", "isActive");

CREATE INDEX
"EmployeeAssignmentPermission_assignmentId_isActive_idx"
ON "EmployeeAssignmentPermission"("assignmentId", "isActive");

CREATE INDEX
"EmployeeAssignmentPermission_expiresAt_idx"
ON "EmployeeAssignmentPermission"("expiresAt");

-- =====================================================
-- 5. OrganizationRelationship
-- =====================================================

CREATE TABLE "OrganizationRelationship" (
    "id" TEXT NOT NULL,
    "sourceAssignmentId" TEXT NOT NULL,
    "targetAssignmentId" TEXT NOT NULL,
    "relationshipType" "OrganizationRelationshipType" NOT NULL,
    "status" "OrganizationRelationshipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "description" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationRelationship_pkey"
    PRIMARY KEY ("id")
);

CREATE INDEX
"OrganizationRelationship_sourceAssignmentId_status_idx"
ON "OrganizationRelationship"("sourceAssignmentId", "status");

CREATE INDEX
"OrganizationRelationship_targetAssignmentId_status_idx"
ON "OrganizationRelationship"("targetAssignmentId", "status");

CREATE INDEX
"OrganizationRelationship_relationshipType_status_idx"
ON "OrganizationRelationship"("relationshipType", "status");

CREATE INDEX
"OrganizationRelationship_startDate_endDate_idx"
ON "OrganizationRelationship"("startDate", "endDate");

-- Allow historical relationships to be recreated
-- Only one active relationship of the same type is allowed

CREATE UNIQUE INDEX
"OrganizationRelationship_active_unique_key"
ON "OrganizationRelationship"(
    "sourceAssignmentId",
    "targetAssignmentId",
    "relationshipType"
)
WHERE "status" = 'ACTIVE';

-- =====================================================
-- 6. Foreign Keys
-- =====================================================

ALTER TABLE "EmployeeAssignmentRole"
ADD CONSTRAINT "EmployeeAssignmentRole_assignmentId_fkey"
FOREIGN KEY ("assignmentId")
REFERENCES "EmployeeAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeAssignmentRole"
ADD CONSTRAINT "EmployeeAssignmentRole_roleId_fkey"
FOREIGN KEY ("roleId")
REFERENCES "Role"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeAssignmentPermission"
ADD CONSTRAINT "EmployeeAssignmentPermission_assignmentId_fkey"
FOREIGN KEY ("assignmentId")
REFERENCES "EmployeeAssignment"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeAssignmentPermission"
ADD CONSTRAINT "EmployeeAssignmentPermission_permissionId_fkey"
FOREIGN KEY ("permissionId")
REFERENCES "Permission"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationRelationship"
ADD CONSTRAINT "OrganizationRelationship_sourceAssignmentId_fkey"
FOREIGN KEY ("sourceAssignmentId")
REFERENCES "EmployeeAssignment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrganizationRelationship"
ADD CONSTRAINT "OrganizationRelationship_targetAssignmentId_fkey"
FOREIGN KEY ("targetAssignmentId")
REFERENCES "EmployeeAssignment"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
