/**
 * Demo-only attendance records for username ehsan.
 * Run: npx tsx scripts/seed-attendance-ehsan.ts
 * Does not overwrite existing attendance records. Safe to rerun.
 */
import { prisma } from "../libs/prisma";
import { calculateAttendance, type AttendancePunchType } from "../modules/attendance/attendance-calculator";

const USERNAME = "ehsan";
const MARKER = "SAHAND_DEMO_ATTENDANCE_EHSAN_V1";
const TZ = "Asia/Tehran";
const DAY_MS = 86_400_000;
const iranDateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
});

type Punch = { type: AttendancePunchType; at: Date };

function localBusinessDay(instant: Date): string {
  const parts = iranDateParts.formatToParts(instant);
  const get = (name: string) => parts.find((p) => p.type === name)?.value;
  const year = get("year");
  const month = get("month");
  const day = get("day");
  if (!year || !month || !day) throw new Error("Cannot resolve Tehran business day");
  return `${year}-${month}-${day}`;
}

/** Iran currently uses UTC+03:30 year-round. Assert local day to avoid silent drift. */
function tehranTime(day: string, hour: number, minute = 0, nextDay = false): Date {
  const [y, m, d] = day.split("-").map(Number);
  const utcDay = Date.UTC(y, m - 1, d + (nextDay ? 1 : 0));
  const date = new Date(utcDay + (hour * 60 + minute - 210) * 60_000);
  const expected = new Date(utcDay).toISOString().slice(0, 10);
  if (localBusinessDay(date) !== expected) {
    throw new Error("Tehran timezone offset differs; do not seed with an incorrect date");
  }
  return date;
}

const scenarios: Array<{
  label: string;
  requiredMinutes: number;
  schedule: [number, number, number, number];
  punches: Array<[AttendancePunchType, number, number, boolean?]>;
  pendingCorrection?: [AttendancePunchType, number, number, boolean?];
}> = [
  { label: "Normal shift", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 0], ["CHECK_OUT", 15, 0]] },
  { label: "Late arrival", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 25], ["CHECK_OUT", 15, 0]] },
  { label: "Temporary exit and return", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 0], ["CHECK_OUT", 10, 0], ["CHECK_IN", 10, 30], ["CHECK_OUT", 15, 30]] },
  { label: "Overtime", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 0], ["CHECK_OUT", 18, 0]] },
  { label: "Break", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 0], ["BREAK_START", 11, 0], ["BREAK_END", 11, 30], ["CHECK_OUT", 15, 30]] },
  { label: "Missing checkout", requiredMinutes: 480, schedule: [7, 0, 15, 0], punches: [["CHECK_IN", 7, 0]], pendingCorrection: ["CHECK_OUT", 15, 0] },
];

async function main() {
  const user = await prisma.user.findUnique({
    where: { username: USERNAME },
    select: {
      id: true, username: true, fullName: true,
      employeeAssignments: {
        where: { status: "ACTIVE" },
        select: { id: true, isPrimary: true, assignmentType: true },
      },
    },
  });
  if (!user) throw new Error(`User '${USERNAME}' not found. No changes made.`);
  const active = user.employeeAssignments;
  const assignment = active.find((a) => a.isPrimary) ?? (active.length === 1 ? active[0] : null);
  if (!assignment) {
    throw new Error("No unambiguous active employee assignment. No changes made. Assign an active primary assignment first.");
  }

  // Start 7 days ago and end 2 days ago: avoid today's live records.
  const today = localBusinessDay(new Date());
  const start = Date.parse(`${today}T00:00:00.000Z`);
  const plan = scenarios.map((scenario, i) => ({
    scenario,
    day: new Date(start - (7 - i) * DAY_MS).toISOString().slice(0, 10),
  }));
  let created = 0;
  let skipped = 0;

  for (const { scenario, day } of plan) {
    const workDate = new Date(`${day}T00:00:00.000Z`);
    const existing = await prisma.attendanceRecord.findUnique({
      where: { employeeAssignmentId_workDate: { employeeAssignmentId: assignment.id, workDate } },
      select: { id: true },
    });
    if (existing) {
      console.log(`SKIP ${day}: attendance record already exists; left untouched`);
      skipped++;
      continue;
    }
    const punches: Punch[] = scenario.punches.map(([type, hour, minute, nextDay]) => ({
      type, at: tehranTime(day, hour, minute, Boolean(nextDay)),
    }));
    const [sh, sm, eh, em] = scenario.schedule;
    const scheduledStartAt = tehranTime(day, sh, sm);
    const scheduledEndAt = tehranTime(day, eh, em);
    const calc = calculateAttendance({
      punches: punches.map((p) => ({ type: p.type, occurredAt: p.at })),
      requiredMinutes: scenario.requiredMinutes,
      scheduledStartAt, scheduledEndAt,
    });
    const status = calc.requiresReview ? "PENDING_REVIEW" as const : "COMPLETED" as const;
    await prisma.$transaction(async (tx) => {
      const record = await tx.attendanceRecord.create({
        data: {
          employeeAssignmentId: assignment.id, workDate, timeZone: TZ,
          scheduledStartAt, scheduledEndAt, requiredMinutes: scenario.requiredMinutes,
          firstCheckInAt: calc.firstCheckInAt, lastCheckOutAt: calc.lastCheckOutAt,
          workedMinutes: calc.workedMinutes, breakMinutes: calc.breakMinutes,
          overtimeMinutes: calc.overtimeMinutes, lateMinutes: calc.lateMinutes,
          earlyLeaveMinutes: calc.earlyLeaveMinutes, status,
          notes: `${MARKER} | ${scenario.label} | TEST DATA — NOT REAL ATTENDANCE`,
          events: {
            create: punches.map((p, index) => ({
              eventType: p.type, occurredAt: p.at, source: "DEMO_SEED",
              notes: MARKER,
              idempotencyKey: `${MARKER}:${assignment.id}:${day}:${index}`,
            })),
          },
        },
      });
      if (scenario.pendingCorrection) {
        const [eventType, hour, minute, nextDay] = scenario.pendingCorrection;
        await tx.attendanceAdjustment.create({
          data: {
            attendanceRecordId: record.id, requestedByUserId: user.id,
            proposedEventType: eventType,
            proposedOccurredAt: tehranTime(day, hour, minute, Boolean(nextDay)),
            reason: `${MARKER} | درخواست اصلاح آزمایشی برای خروج فراموش‌شده`,
            status: "PENDING",
          },
        });
      }
    });
    created++;
    console.log(`CREATED ${day}: ${scenario.label}, worked ${calc.workedMinutes} min`);
  }
  console.log(JSON.stringify({ username: user.username, fullName: user.fullName, assignmentId: assignment.id, created, skipped, marker: MARKER }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => { await prisma.$disconnect(); });
