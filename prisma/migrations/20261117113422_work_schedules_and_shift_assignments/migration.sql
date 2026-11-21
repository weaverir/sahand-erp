-- CreateEnum
CREATE TYPE "ShiftAssignmentTarget" AS ENUM ('COMPANY', 'UNIT', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "WorkShiftDayType" AS ENUM ('NORMAL', 'HOLIDAY');

-- CreateEnum
CREATE TYPE "HolidayType" AS ENUM ('OFFICIAL', 'RELIGIOUS', 'NATIONAL', 'COMPANY', 'OTHER');

-- AlterTable
ALTER TABLE "OrganizationLocation" ADD COLUMN     "geofenceEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "geofenceRadiusMeters" INTEGER NOT NULL DEFAULT 50,
ADD COLUMN     "latitude" DECIMAL(10,7),
ADD COLUMN     "longitude" DECIMAL(10,7);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkShiftDay" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "segmentOrder" INTEGER NOT NULL DEFAULT 1,
    "dayType" "WorkShiftDayType" NOT NULL DEFAULT 'NORMAL',
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "requiredMinutes" INTEGER NOT NULL DEFAULT 480,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkShiftDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftAssignment" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "targetType" "ShiftAssignmentTarget" NOT NULL,
    "organizationUnitId" TEXT,
    "employeeAssignmentId" TEXT,
    "validFrom" DATE NOT NULL,
    "validTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "assignedById" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendar" (
    "id" TEXT NOT NULL,
    "jalaliYear" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendarDay" (
    "id" TEXT NOT NULL,
    "calendarId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "jalaliDate" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "holidayType" "HolidayType" NOT NULL,
    "isHoliday" BOOLEAN NOT NULL DEFAULT true,
    "isWorkingDayOverride" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendarDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkShift_isActive_idx" ON "WorkShift"("isActive");

-- CreateIndex
CREATE INDEX "WorkShift_isDefault_isActive_idx" ON "WorkShift"("isDefault", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShift_code_version_key" ON "WorkShift"("code", "version");

-- CreateIndex
CREATE INDEX "WorkShiftDay_shiftId_dayOfWeek_dayType_idx" ON "WorkShiftDay"("shiftId", "dayOfWeek", "dayType");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShiftDay_shiftId_dayOfWeek_dayType_segmentOrder_key" ON "WorkShiftDay"("shiftId", "dayOfWeek", "dayType", "segmentOrder");

-- CreateIndex
CREATE INDEX "ShiftAssignment_shiftId_isActive_idx" ON "ShiftAssignment"("shiftId", "isActive");

-- CreateIndex
CREATE INDEX "ShiftAssignment_organizationUnitId_isActive_idx" ON "ShiftAssignment"("organizationUnitId", "isActive");

-- CreateIndex
CREATE INDEX "ShiftAssignment_employeeAssignmentId_isActive_idx" ON "ShiftAssignment"("employeeAssignmentId", "isActive");

-- CreateIndex
CREATE INDEX "ShiftAssignment_targetType_isActive_idx" ON "ShiftAssignment"("targetType", "isActive");

-- CreateIndex
CREATE INDEX "ShiftAssignment_validFrom_validTo_idx" ON "ShiftAssignment"("validFrom", "validTo");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendar_jalaliYear_key" ON "HolidayCalendar"("jalaliYear");

-- CreateIndex
CREATE INDEX "HolidayCalendar_isActive_idx" ON "HolidayCalendar"("isActive");

-- CreateIndex
CREATE INDEX "HolidayCalendarDay_date_idx" ON "HolidayCalendarDay"("date");

-- CreateIndex
CREATE INDEX "HolidayCalendarDay_jalaliDate_idx" ON "HolidayCalendarDay"("jalaliDate");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayCalendarDay_calendarId_date_key" ON "HolidayCalendarDay"("calendarId", "date");

-- AddForeignKey
ALTER TABLE "WorkShiftDay" ADD CONSTRAINT "WorkShiftDay_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftAssignment" ADD CONSTRAINT "ShiftAssignment_employeeAssignmentId_fkey" FOREIGN KEY ("employeeAssignmentId") REFERENCES "EmployeeAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendarDay" ADD CONSTRAINT "HolidayCalendarDay_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "HolidayCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;
