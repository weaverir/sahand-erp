CREATE TYPE "EmployeeEmploymentStatus" AS ENUM (
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
  'SUSPENDED'
);

CREATE TABLE "EmployeeProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "candidateApplicationId" TEXT NOT NULL,
  "personnelCode" TEXT,
  "employmentStatus" "EmployeeEmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
  "hireDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "terminationDate" DATE,
  "terminationReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmployeeProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeProfile_userId_key"
  ON "EmployeeProfile"("userId");

CREATE UNIQUE INDEX "EmployeeProfile_candidateApplicationId_key"
  ON "EmployeeProfile"("candidateApplicationId");

CREATE UNIQUE INDEX "EmployeeProfile_personnelCode_key"
  ON "EmployeeProfile"("personnelCode");

CREATE INDEX "EmployeeProfile_employmentStatus_hireDate_idx"
  ON "EmployeeProfile"("employmentStatus", "hireDate");

ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeProfile"
  ADD CONSTRAINT "EmployeeProfile_candidateApplicationId_fkey"
  FOREIGN KEY ("candidateApplicationId") REFERENCES "CandidateApplication"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
