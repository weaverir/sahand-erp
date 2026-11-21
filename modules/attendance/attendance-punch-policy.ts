/** Pure attendance punch policy. No Prisma, database, GPS or camera dependencies. */
export type PunchAction = "CHECK_IN" | "CHECK_OUT";
export type PunchEventType =
  | "CHECK_IN" | "CHECK_OUT" | "BREAK_START" | "BREAK_END" | "AUTO_CHECK_OUT";

export interface PunchRecordState {
  id: string;
  workDate: Date;
  status: string;
  approvedAt: Date | null;
  approvedByUserId: string | null;
  lastEventType: PunchEventType | null;
}

export type PunchDecision =
  | { allowed: true; recordId: string | null; createNew: boolean }
  | { allowed: false; code: string; message: string };

function deny(code: string, message: string): PunchDecision {
  return { allowed: false, code, message };
}

function isOpen(type: PunchEventType | null): boolean {
  return type === "CHECK_IN" || type === "BREAK_START" || type === "BREAK_END";
}

/** All records must belong to the same employee; caller must enforce authorization. */
export function decideAttendancePunch(input: {
  action: PunchAction;
  today: Date;
  records: readonly PunchRecordState[];
}): PunchDecision {
  const { action, today, records } = input;
  const open = records.filter((r) => isOpen(r.lastEventType));
  if (open.length > 1) return deny("MULTIPLE_OPEN", "چند رکورد حضور باز وجود دارد و بررسی مسئول حضور و غیاب لازم است.");

  const todayRecords = records.filter((r) => r.workDate.getTime() === today.getTime());
  if (action === "CHECK_IN" && todayRecords.length > 1) {
    return deny("DUPLICATE_DAY", "چند رکورد برای یک کارمند در یک روز وجود دارد.");
  }
  if (action === "CHECK_IN" && open.length) {
    return deny("ALREADY_OPEN", "ورود قبلی هنوز بسته نشده است.");
  }
  if (action === "CHECK_OUT" && !open.length) {
    return deny("NO_OPEN_SESSION", "برای خروج، ورود باز معتبری یافت نشد.");
  }
  const target = action === "CHECK_OUT" ? open[0] : todayRecords[0];
  if (action === "CHECK_OUT" && target?.lastEventType === "BREAK_START") {
    return deny("BREAK_OPEN", "ابتدا باید استراحت باز پایان یابد.");
  }
  if (!target) return { allowed: true, recordId: null, createNew: true };
  if (target.approvedAt !== null || target.approvedByUserId !== null ||
      (target.status !== "OPEN" && target.status !== "COMPLETED")) {
    return deny("RECORD_LOCKED", "رکورد تأیید یا قفل شده است.");
  }
  if (action === "CHECK_IN" && target.lastEventType !== null &&
      target.lastEventType !== "CHECK_OUT" && target.lastEventType !== "AUTO_CHECK_OUT") {
    return deny("INVALID_CHECK_IN", "ورود قبلی هنوز بسته نشده است.");
  }
  if (action === "CHECK_OUT" && target.lastEventType !== "CHECK_IN" &&
      target.lastEventType !== "BREAK_END") {
    return deny("INVALID_CHECK_OUT", "برای خروج، ورود باز معتبر لازم است.");
  }
  return { allowed: true, recordId: target.id, createNew: false };
}
