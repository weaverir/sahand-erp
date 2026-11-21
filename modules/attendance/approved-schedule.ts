
import "server-only";

import {
  EmployeeShiftScheduleStatus,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";

const TIME_ZONE = "Asia/Tehran";

export interface ApprovedWorkSegment {
  id: string;
  workDate: Date;
  startsAt: Date;
  endsAt: Date;
  requiredMinutes: number;
  segmentOrder: number;
  workShiftId: string | null;
}

export interface ApprovedWorkSchedule {
  source: "APPROVED_WEEKLY_SCHEDULE" | "NOT_FOUND";
  employeeUserId: string;
  workDate: Date;
  weekStartDate: Date;
  scheduleId: string | null;
  scheduleVersion: number | null;
  requiredMinutes: number | null;
  scheduledStartAt: Date | null;
  scheduledEndAt: Date | null;
  segments: ApprovedWorkSegment[];
}

function validateDate(date: Date): Date {
  if (
    !(date instanceof Date) ||
    !Number.isFinite(date.getTime())
  ) {
    throw new Error("تاریخ کاری معتبر نیست.");
  }

  return date;
}

function normalizeDate(date: Date): Date {
  validateDate(date);

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );
}

function getWeekStart(date: Date): Date {
  const result = normalizeDate(date);

  const daysSinceSaturday =
    (result.getUTCDay() + 1) % 7;

  result.setUTCDate(
    result.getUTCDate() - daysSinceSaturday
  );

  return result;
}

function getTehranDate(date: Date): Date {
  validateDate(date);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const read = (type: string) => {
    const value = parts.find(
      (part) => part.type === type
    )?.value;

    if (!value) {
      throw new Error(
        "تبدیل تاریخ به منطقه زمانی تهران ناموفق بود."
      );
    }

    return Number(value);
  };

  return new Date(
    Date.UTC(
      read("year"),
      read("month") - 1,
      read("day")
    )
  );
}

function emptyResult(
  employeeUserId: string,
  workDate: Date
): ApprovedWorkSchedule {
  return {
    source: "NOT_FOUND",
    employeeUserId,
    workDate,
    weekStartDate: getWeekStart(workDate),
    scheduleId: null,
    scheduleVersion: null,
    requiredMinutes: null,
    scheduledStartAt: null,
    scheduledEndAt: null,
    segments: [],
  };
}

/**
 * Find the approved weekly schedule for one employee
 * and one Tehran business date.
 *
 * An approved week with no segments on this date
 * represents a day with zero scheduled minutes.
 *
 * A missing approved week is different from a day off.
 * Callers must not silently treat missing schedules
 * as zero required minutes.
 */
export async function getApprovedWorkSchedule(
  employeeUserId: string,
  date: Date
): Promise<ApprovedWorkSchedule> {
  if (
    typeof employeeUserId !== "string" ||
    !employeeUserId.trim()
  ) {
    throw new Error("شناسه کارمند معتبر نیست.");
  }

  const workDate = normalizeDate(date);
  const weekStartDate = getWeekStart(workDate);

  const schedule =
    await prisma.employeeShiftSchedule.findFirst({
      where: {
        employeeUserId,
        weekStartDate,
        status: EmployeeShiftScheduleStatus.APPROVED,
      },
      orderBy: [
        { version: "desc" },
        { createdAt: "desc" },
      ],
      select: {
        id: true,
        version: true,
        segments: {
          where: { workDate },
          orderBy: [
            { startsAt: "asc" },
            { segmentOrder: "asc" },
          ],
          select: {
            id: true,
            workDate: true,
            startsAt: true,
            endsAt: true,
            requiredMinutes: true,
            segmentOrder: true,
            workShiftId: true,
          },
        },
      },
    });

  if (!schedule) {
    return emptyResult(
      employeeUserId,
      workDate
    );
  }

  const segments: ApprovedWorkSegment[] =
    schedule.segments.map((segment) => ({
      id: segment.id,
      workDate: segment.workDate,
      startsAt: segment.startsAt,
      endsAt: segment.endsAt,
      requiredMinutes: segment.requiredMinutes,
      segmentOrder: segment.segmentOrder,
      workShiftId: segment.workShiftId,
    }));

  const requiredMinutes = segments.reduce(
    (total, segment) =>
      total + segment.requiredMinutes,
    0
  );

  const scheduledStartAt =
    segments.length > 0
      ? segments[0].startsAt
      : null;

  const scheduledEndAt =
    segments.length > 0
      ? segments.reduce(
          (latest, segment) =>
            segment.endsAt > latest
              ? segment.endsAt
              : latest,
          segments[0].endsAt
        )
      : null;

  return {
    source: "APPROVED_WEEKLY_SCHEDULE",
    employeeUserId,
    workDate,
    weekStartDate,
    scheduleId: schedule.id,
    scheduleVersion: schedule.version,
    requiredMinutes,
    scheduledStartAt,
    scheduledEndAt,
    segments,
  };
}

/**
 * Find a scheduled segment containing the given instant.
 *
 * Useful when resolving overnight attendance:
 * a 00:30 checkout may belong to the previous
 * business day's 15:00-23:00 shift.
 *
 * This function does not automatically assign
 * a punch to a record; that requires checking
 * the employee's currently open attendance record.
 */
export async function findScheduledSegmentAt(
  employeeUserId: string,
  instant: Date
): Promise<{
  schedule: ApprovedWorkSchedule;
  segment: ApprovedWorkSegment;
} | null> {
  validateDate(instant);

  const currentWorkDate = getTehranDate(instant);

  const previousWorkDate =
    new Date(currentWorkDate);

  previousWorkDate.setUTCDate(
    previousWorkDate.getUTCDate() - 1
  );

  const dates = [
    previousWorkDate,
    currentWorkDate,
  ];

  for (const date of dates) {
    const schedule =
      await getApprovedWorkSchedule(
        employeeUserId,
        date
      );

    const matchingSegment =
      schedule.segments.find(
        (segment) =>
          instant >= segment.startsAt &&
          instant <= segment.endsAt
      );

    if (matchingSegment) {
      return {
        schedule,
        segment: matchingSegment,
      };
    }
  }

  return null;
}
