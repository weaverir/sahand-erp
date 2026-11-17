/*
  Warnings:

  - A unique constraint covering the columns `[sourceAssignmentId,targetAssignmentId,relationshipType]` on the table `OrganizationRelationship` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "EmployeeAssignment" ADD COLUMN     "responsibilityTitle" TEXT,
ALTER COLUMN "positionId" DROP NOT NULL,
ALTER COLUMN "assignmentType" SET DEFAULT 'PRIMARY';

-- CreateIndex
CREATE INDEX "EmployeeAssignment_responsibilityTitle_idx" ON "EmployeeAssignment"("responsibilityTitle");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationRelationship_sourceAssignmentId_targetAssignmen_key" ON "OrganizationRelationship"("sourceAssignmentId", "targetAssignmentId", "relationshipType");
