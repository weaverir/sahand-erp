/** Read-only audit of shift assignments and approved weekly schedules.
 * Run: npx tsx scripts/audit-shift-conflicts.ts
 * No inserts, updates, deletes, or transactions are performed.
 */
import { prisma } from "../libs/prisma";
import { findRecurringShiftConflict, type RecurringAssignment } from "../modules/shifts/recurring-shift-conflict";
import { findRecurringVsWeeklyConflict } from "../modules/shifts/recurring-vs-weekly";

const iso = (d: Date) => d.toISOString().slice(0, 10);
const DAY = 86_400_000;
type Issue = { kind: string; employeeUserId: string; firstId: string; secondId: string; workDate: string; overlapMinutes: number };

async function main(): Promise<void> {
  const [employees, assignments, schedules] = await Promise.all([
    prisma.employeeAssignment.findMany({
      where: { status: "ACTIVE", user: { isActive: true } },
      select: { id: true, userId: true, organizationUnitId: true, startDate: true, endDate: true },
    }),
    prisma.shiftAssignment.findMany({
      where: { isActive: true },
      include: { shift: { include: { days: true } } },
    }),
    prisma.employeeShiftSchedule.findMany({
      where: { status: "APPROVED" },
      select: { id: true, employeeUserId: true, segments: { select: { id: true, startsAt: true, endsAt: true, workDate: true } } },
    }),
  ]);
  const issues: Issue[] = [];
  const invalid: Array<{ id: string; error: string }> = [];
  const unique = new Set<string>();
  let recurringPairs = 0;
  let recurringWeeklyPairs = 0;
  let weeklyPairs = 0;

  // Restrict effective recurring assignment validity to the employee's tenure.
  // This is a current-membership audit: historical organization moves are not reconstructed.
  const byUser = new Map<string, RecurringAssignment[]>();
  for (const employee of employees) {
    for (const a of assignments) {
      if (a.targetType === "EMPLOYEE" && a.employeeAssignmentId !== employee.id) continue;
      if (a.targetType === "UNIT" && a.organizationUnitId !== employee.organizationUnitId) continue;
      if (a.targetType !== "EMPLOYEE" && a.targetType !== "UNIT" && a.targetType !== "COMPANY") continue;
      const from = Math.max(a.validFrom.getTime(), employee.startDate.getTime());
      const to = Math.min(a.validTo?.getTime() ?? Infinity, employee.endDate?.getTime() ?? Infinity);
      if (from > to) continue;
      const item: RecurringAssignment = {
        id: a.id,
        validFrom: iso(new Date(from)),
        validTo: Number.isFinite(to) ? iso(new Date(to)) : null,
        days: a.shift.days.map(d => ({
          dayOfWeek: d.dayOfWeek, isWorkingDay: d.isWorkingDay,
          startMinute: d.startMinute, endMinute: d.endMinute, dayType: d.dayType,
        })),
      };
      const existing = byUser.get(employee.userId) ?? [];
      // Same assignment can match two concurrent employment records; do not duplicate.
      if (!existing.some(x => x.id === item.id && x.validFrom === item.validFrom && x.validTo === item.validTo)) existing.push(item);
      byUser.set(employee.userId, existing);
    }
  }

  function record(issue: Issue): void {
    const id = [issue.kind, issue.employeeUserId, issue.firstId, issue.secondId, issue.workDate].join("|");
    if (!unique.has(id)) { unique.add(id); issues.push(issue); }
  }

  for (const [userId, list] of byUser) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        recurringPairs++;
        try {
          const conflict = findRecurringShiftConflict(list[i], list[j]);
          if (conflict) record({ kind: "RECURRING_RECURRING", employeeUserId: userId,
            firstId: list[i].id, secondId: list[j].id, workDate: conflict.workDate,
            overlapMinutes: conflict.overlapMinutes });
        } catch (e) { invalid.push({ id: `${list[i].id}/${list[j].id}`, error: String(e) }); }
      }
    }
  }

  for (const schedule of schedules) {
    const segments = schedule.segments;
    for (let i = 0; i < segments.length; i++) {
      const a = segments[i];
      if (!(a.endsAt > a.startsAt)) {
        invalid.push({ id: a.id, error: "Invalid approved weekly segment interval" });
        continue;
      }
      for (let j = i + 1; j < segments.length; j++) {
        weeklyPairs++;
        const b = segments[j];
        const minutes = Math.max(0, Math.min(+a.endsAt, +b.endsAt) - Math.max(+a.startsAt, +b.startsAt)) / 60000;
        if (minutes > 0) record({ kind: "WEEKLY_WEEKLY", employeeUserId: schedule.employeeUserId,
          firstId: a.id, secondId: b.id, workDate: iso(a.workDate), overlapMinutes: minutes });
      }
      for (const recurring of byUser.get(schedule.employeeUserId) ?? []) {
        recurringWeeklyPairs++;
        try {
          const conflict = findRecurringVsWeeklyConflict(recurring, a);
          if (conflict) record({ kind: "RECURRING_WEEKLY", employeeUserId: schedule.employeeUserId,
            firstId: recurring.id, secondId: a.id, workDate: conflict.workDate,
            overlapMinutes: conflict.overlapMinutes });
        } catch (e) { invalid.push({ id: `${recurring.id}/${a.id}`, error: String(e) }); }
      }
    }
  }

  // Approved schedules belonging to DIFFERENT weeks/versions can also overlap.
  const allWeekly = schedules.flatMap(s => s.segments.map(g => ({ ...g, userId: s.employeeUserId, scheduleId: s.id })));
  const weeklyByUser = new Map<string, typeof allWeekly>();
  for (const segment of allWeekly) weeklyByUser.set(segment.userId, [...(weeklyByUser.get(segment.userId) ?? []), segment]);
  for (const [userId, segments] of weeklyByUser) {
    segments.sort((a, b) => +a.startsAt - +b.startsAt);
    for (let i = 0; i < segments.length; i++) {
      for (let j = i + 1; j < segments.length && +segments[j].startsAt < +segments[i].endsAt; j++) {
        if (segments[i].scheduleId === segments[j].scheduleId) continue; // checked above
        weeklyPairs++;
        const minutes = Math.max(0, Math.min(+segments[i].endsAt, +segments[j].endsAt) - Math.max(+segments[i].startsAt, +segments[j].startsAt)) / 60000;
        if (minutes > 0) record({ kind: "WEEKLY_WEEKLY", employeeUserId: userId,
          firstId: segments[i].id, secondId: segments[j].id,
          workDate: iso(segments[i].workDate), overlapMinutes: minutes });
      }
    }
  }

  console.log(JSON.stringify({ mode: "READ_ONLY", auditedAt: new Date().toISOString(),
    scope: "Current active employee assignments and approved weekly schedules; historical unit membership not reconstructed",
    counts: { activeEmployeeAssignments: employees.length, activeRecurringAssignments: assignments.length,
      approvedWeeklySchedules: schedules.length, approvedWeeklySegments: allWeekly.length,
      recurringPairs, recurringWeeklyPairs, weeklyPairs, conflicts: issues.length, invalidInputs: invalid.length },
    issues: issues.slice(0, 100), invalidInputs: invalid.slice(0, 50),
    truncated: issues.length > 100 || invalid.length > 50 }, null, 2));
  if (issues.length || invalid.length) process.exitCode = 2;
}

main().catch(e => { console.error("SHIFT_AUDIT_ERROR", e); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
