CREATE TABLE "LeaveOpeningBalance" (
  "id" TEXT NOT NULL,
  "employeeUserId" TEXT NOT NULL,
  "leaveTypeKey" TEXT NOT NULL,
  "startJalaliYear" INTEGER NOT NULL,
  "startJalaliMonth" INTEGER NOT NULL,
  "openingMinutes" INTEGER NOT NULL,
  "ledgerEntryId" TEXT NOT NULL,
  "createdByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveOpeningBalance_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LeaveOpeningBalance_employeeUserId_leaveTypeKey_key" UNIQUE ("employeeUserId","leaveTypeKey"),
  CONSTRAINT "LeaveOpeningBalance_ledgerEntryId_key" UNIQUE ("ledgerEntryId")
);
CREATE INDEX "LeaveOpeningBalance_startJalaliYear_startJalaliMonth_idx" ON "LeaveOpeningBalance"("startJalaliYear","startJalaliMonth");
ALTER TABLE "LeaveOpeningBalance" ADD CONSTRAINT "LeaveOpeningBalance_employeeUserId_fkey" FOREIGN KEY ("employeeUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveOpeningBalance" ADD CONSTRAINT "LeaveOpeningBalance_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LeaveOpeningBalance" ADD CONSTRAINT "LeaveOpeningBalance_ledgerEntryId_fkey" FOREIGN KEY ("ledgerEntryId") REFERENCES "LeaveLedgerEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
