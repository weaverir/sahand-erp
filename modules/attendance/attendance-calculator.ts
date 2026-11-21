
export type AttendancePunchType =
  | "CHECK_IN"
  | "CHECK_OUT"
  | "BREAK_START"
  | "BREAK_END"
  | "AUTO_CHECK_OUT";

export interface AttendancePunch {
  type: AttendancePunchType;
  occurredAt: Date | string;
}

export interface AttendanceCalculationInput {
  punches: AttendancePunch[];
  requiredMinutes: number;
  scheduledStartAt?: Date | string | null;
  scheduledEndAt?: Date | string | null;
}

export interface AttendanceCalculationResult {
  firstCheckInAt: Date | null;
  lastCheckOutAt: Date | null;
  workedMinutes: number;
  breakMinutes: number;
  requiredMinutes: number;
  deficitMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  isComplete: boolean;
  requiresReview: boolean;
  warnings: string[];
}

function toDate(value: Date | string): Date {
  const date = value instanceof Date
    ? new Date(value.getTime())
    : new Date(value);

  if (!Number.isFinite(date.getTime())) {
    throw new Error("تاریخ یا ساعت تردد معتبر نیست.");
  }

  return date;
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(
    0,
    Math.floor((end.getTime() - start.getTime()) / 60000)
  );
}

export function calculateAttendance(
  input: AttendanceCalculationInput
): AttendanceCalculationResult {
  if (
    !Number.isInteger(input.requiredMinutes) ||
    input.requiredMinutes < 0 ||
    input.requiredMinutes > 1440
  ) {
    throw new Error("دقایق موظفی معتبر نیست.");
  }

  const scheduledStart = input.scheduledStartAt
    ? toDate(input.scheduledStartAt)
    : null;

  const scheduledEnd = input.scheduledEndAt
    ? toDate(input.scheduledEndAt)
    : null;

  if (
    scheduledStart &&
    scheduledEnd &&
    scheduledEnd <= scheduledStart
  ) {
    throw new Error("پایان شیفت باید بعد از شروع آن باشد.");
  }

  const punches = input.punches
    .map((punch, index) => ({
      type: punch.type,
      occurredAt: toDate(punch.occurredAt),
      index,
    }))
    .sort(
      (a, b) =>
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        a.index - b.index
    );

  const warnings: string[] = [];

  let firstCheckInAt: Date | null = null;
  let lastCheckOutAt: Date | null = null;

  let workStart: Date | null = null;
  let breakStart: Date | null = null;

  let workedMilliseconds = 0;
  let breakMilliseconds = 0;

  let requiresReview = false;

  for (const punch of punches) {
    const time = punch.occurredAt;

    switch (punch.type) {
      case "CHECK_IN": {
        if (workStart !== null) {
          warnings.push("ورود تکراری بدون خروج قبلی.");
          requiresReview = true;
          break;
        }

        firstCheckInAt ??= time;
        workStart = time;
        breakStart = null;
        break;
      }

      case "BREAK_START": {
        if (workStart === null || breakStart !== null) {
          warnings.push("شروع استراحت در وضعیت نامعتبر.");
          requiresReview = true;
          break;
        }

        workedMilliseconds +=
          time.getTime() - workStart.getTime();

        workStart = null;
        breakStart = time;
        break;
      }

      case "BREAK_END": {
        if (breakStart === null) {
          warnings.push("پایان استراحت بدون شروع معتبر.");
          requiresReview = true;
          break;
        }

        breakMilliseconds +=
          time.getTime() - breakStart.getTime();

        breakStart = null;
        workStart = time;
        break;
      }

      case "CHECK_OUT":
      case "AUTO_CHECK_OUT": {
        if (breakStart !== null) {
          warnings.push(
            "خروج هنگام استراحت؛ زمان استراحت بسته شد."
          );

          breakMilliseconds +=
            time.getTime() - breakStart.getTime();

          breakStart = null;
          lastCheckOutAt = time;
          requiresReview = true;
          break;
        }

        if (workStart === null) {
          warnings.push("خروج بدون ورود معتبر.");
          requiresReview = true;
          break;
        }

        workedMilliseconds +=
          time.getTime() - workStart.getTime();

        workStart = null;
        lastCheckOutAt = time;

        if (punch.type === "AUTO_CHECK_OUT") {
          warnings.push("خروج خودکار نیازمند بررسی است.");
          requiresReview = true;
        }

        break;
      }

      default: {
        warnings.push("نوع رویداد ناشناخته است.");
        requiresReview = true;
      }
    }
  }

  const isComplete =
    workStart === null &&
    breakStart === null &&
    firstCheckInAt !== null &&
    lastCheckOutAt !== null;

  if (workStart !== null) {
    warnings.push("ورود باز بدون خروج نهایی.");
    requiresReview = true;
  }

  if (breakStart !== null) {
    warnings.push("استراحت باز بدون پایان.");
    requiresReview = true;
  }

  const workedMinutes = Math.floor(
    workedMilliseconds / 60000
  );

  const breakMinutes = Math.floor(
    breakMilliseconds / 60000
  );

  const requiredMinutes = input.requiredMinutes;

  const deficitMinutes = Math.max(
    requiredMinutes - workedMinutes,
    0
  );

  const overtimeMinutes = isComplete
    ? Math.max(workedMinutes - requiredMinutes, 0)
    : 0;

  const lateMinutes =
    scheduledStart && firstCheckInAt
      ? minutesBetween(scheduledStart, firstCheckInAt)
      : 0;

  const earlyLeaveMinutes =
    scheduledEnd && lastCheckOutAt
      ? minutesBetween(lastCheckOutAt, scheduledEnd)
      : 0;

  return {
    firstCheckInAt,
    lastCheckOutAt,
    workedMinutes,
    breakMinutes,
    requiredMinutes,
    deficitMinutes,
    overtimeMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    isComplete,
    requiresReview: requiresReview || !isComplete,
    warnings,
  };
}
