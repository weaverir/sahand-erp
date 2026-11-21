/** Synthetic DB integration audit. All inserts are rolled back, including on success. */
import { prisma } from "../libs/prisma";
import { previewMonthlyWorkFromDatabase } from "../modules/attendance/monthly-work-db";

const ROLLBACK = "__SAHAND_AUDIT_ROLLBACK__";
const DAY = 86_400_000;
const startDate = "2027-03-21";
const endDate = "2027-04-21"; // exclusive; 31 Tehran dates
const periodStart = new Date("2027-03-20T20:30:00.000Z");
const periodEnd = new Date("2027-04-20T20:30:00.000Z");
const date = (s: string) => new Date(`${s}T00:00:00.000Z`);
const key = (d: Date) => d.toISOString().slice(0, 10);
const add = (d: Date, n: number) => new Date(d.getTime() + n * DAY);
const local = (s: string, h: number, m = 0) => new Date(date(s).getTime() + (h * 60 + m - 210) * 60_000);
const minutes = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60_000);
const friday = (s: string) => date(s).getUTCDay() === 5;
const holidaySet = new Set(["2027-03-24", "2027-04-02", "2027-04-12"]);
const seeded = (seed: number) => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

type Span = { a: Date; b: Date };
type Expected = { requiredMinutes: number; workedMinutes: number; approvedLeaveMinutes: number; uncoveredMinutes: number; holidayWorkMinutes: number; overtimeMinutes: number; unresolvedCount: number };
function merge(spans: Span[]): Span[] {
  const out: Span[] = [];
  for (const s of [...spans].sort((x, y) => +x.a - +y.a)) {
    const last = out[out.length - 1];
    if (last && +s.a <= +last.b) { if (+s.b > +last.b) last.b = s.b; }
    else out.push({ ...s });
  }
  return out;
}
function intersect(xs: Span[], ys: Span[]): number {
  let total = 0;
  for (const x of merge(xs)) for (const y of merge(ys)) total += Math.max(0, Math.min(+x.b, +y.b) - Math.max(+x.a, +y.a)) / 60_000;
  return total;
}
function expected(required: Span[], attendance: Span[], leave: Span[], special: Set<string>): Expected {
  const requiredMinutes = merge(required).reduce((n, s) => n + minutes(s.a, s.b), 0);
  const workedMinutes = intersect(required, attendance);
  const leaveCoveredMinutes = intersect(required, leave) - intersect(required, merge(leave.flatMap(l => attendance.map(a => ({a:new Date(Math.max(+l.a,+a.a)),b:new Date(Math.min(+l.b,+a.b))})).filter(s => +s.b > +s.a))));
  let holidayWorkMinutes = 0;
  // Independent calendar-minute oracle, not the application's split/classification functions.
  for (const s of merge(attendance)) {
    for (let t = +s.a; t < +s.b; t += 60_000) {
      const k = key(new Date(t + 210 * 60_000));
      if (friday(k) || special.has(k)) holidayWorkMinutes++;
    }
  }
  return {requiredMinutes, workedMinutes, approvedLeaveMinutes: leaveCoveredMinutes, uncoveredMinutes: requiredMinutes - workedMinutes - leaveCoveredMinutes, holidayWorkMinutes, overtimeMinutes:0, unresolvedCount:0};
}

async function main() {
  const users = await prisma.user.findMany({ where: { username: { startsWith: "dev.staff." } }, select: { id: true, username: true, employeeAssignments: { select: { id: true }, take: 1 } }, orderBy: { username: "asc" }, take: 10 });
  if (users.length !== 10 || users.some(u => u.employeeAssignments.length !== 1)) throw new Error("Expected 10 dev.staff users with employee assignments");
  const existing = await prisma.attendanceMonthlyPeriod.findUnique({ where: { jalaliYear_jalaliMonth: {jalaliYear: 1406, jalaliMonth: 1} } });
  if (existing) throw new Error("1406/01 already exists; refusing to touch it. Choose a clean test period in the script.");
  const existingCalendar = await prisma.holidayCalendar.findUnique({where:{jalaliYear:1406}});
  if (existingCalendar) throw new Error("Holiday calendar 1406 exists; refusing to touch it.");
  const report: any[] = [];
  try {
    await prisma.$transaction(async tx => {
      const period = await tx.attendanceMonthlyPeriod.create({data:{jalaliYear:1406,jalaliMonth:1,startsAt:periodStart,endsAt:periodEnd,status:"OPEN"}});
      const calendar = await tx.holidayCalendar.create({data:{jalaliYear:1406,name:"TEMP RANDOM AUDIT",isActive:true}});
      for (const h of holidaySet) await tx.holidayCalendarDay.create({data:{calendarId:calendar.id,date:date(h),jalaliDate:"1406/01/test",title:"Synthetic holiday",holidayType:"COMPANY",isHoliday:true}});
      for (let i=0;i<users.length;i++) {
        const u = users[i]; const rand = seeded(123456 + i * 773);
        const required:Span[] = [], attendance:Span[] = [], leave:Span[] = [];
        const weekMap = new Map<string, Array<{workDate:Date; startsAt:Date; endsAt:Date; requiredMinutes:number; segmentOrder:number}>>();
        for (let d=date(startDate); +d < +date(endDate); d=add(d,1)) {
          const k=key(d), isFri=friday(k), isHoliday=holidaySet.has(k);
          const dayIndex = Math.round((+d - +date(startDate))/DAY);
          const overnight = dayIndex % 13 === 4;
          const shiftHours = [6,8,10][Math.floor(rand()*3)];
          const hasShift = (!isFri && !isHoliday) || (i % 3 === 0 && (isFri || isHoliday));
          const shiftStart = overnight ? 22 : 7 + Math.floor(rand()*3);
          const s=local(k,shiftStart), e=new Date(+s+shiftHours*3_600_000);
          const saturdayOffset=(d.getUTCDay()+1)%7;
          const week=key(add(d,-saturdayOffset));
          if (!weekMap.has(week)) weekMap.set(week,[]);
          if (hasShift) {
            required.push({a:s,b:e});
            weekMap.get(week)!.push({workDate:d,startsAt:s,endsAt:e,requiredMinutes:shiftHours*60,segmentOrder:1});
          }
          const hasPresence = hasShift ? rand() > 0.12 : rand() < 0.35;
          if (hasPresence) {
            const a = hasShift ? new Date(+s + (Math.floor(rand()*7)-3)*15*60_000) : local(k,9);
            const b = hasShift ? new Date(+e + (Math.floor(rand()*7)-3)*15*60_000) : local(k,12);
            if (+b > +a) {
              attendance.push({a,b});
              await tx.attendanceRecord.create({data:{employeeAssignmentId:u.employeeAssignments[0].id,workDate:d,status:"APPROVED",requiredMinutes:hasShift?shiftHours*60:0,events:{create:[{eventType:"CHECK_IN",occurredAt:a,source:"TEST"},{eventType:"CHECK_OUT",occurredAt:b,source:"TEST"}]}}});
            }
          }
          // Leave for selected scheduled days; overlaps with presence are intentional.
          if (hasShift && dayIndex % 11 === (i % 11)) {
            const la=new Date(+s+60*60_000), lb=new Date(Math.min(+e,+la+120*60_000));
            if (+lb > +la) {
              leave.push({a:la,b:lb});
              await tx.leaveRequest.create({data:{employeeUserId:u.id,employeeAssignmentId:u.employeeAssignments[0].id,leaveTypeKey:"ANNUAL",startAt:la,endAt:lb,requestedMinutes:minutes(la,lb),approvedMinutes:minutes(la,lb),status:"APPROVED"}});
            }
          }
        }
        for (const [week,segments] of weekMap) {
          await tx.employeeShiftSchedule.create({data:{employeeUserId:u.id,weekStartDate:date(week),version:1,status:"APPROVED",createdByUserId:u.id,segments:{create:segments}}});
        }
        const oracle = expected(required,attendance,leave,holidaySet);
        const actual = (await previewMonthlyWorkFromDatabase(period.id,u.id,tx)).totals;
        const fields = Object.keys(oracle) as (keyof Expected)[];
        const differences=fields.filter(f => actual[f] !== oracle[f]).map(f => ({field:f,expected:oracle[f],actual:actual[f]}));
        report.push({username:u.username,oracle,actual,differences,issues:actual.issues});
      }
      throw new Error(ROLLBACK);
    },{maxWait:20_000,timeout:180_000});
  } catch(e) { if (!(e instanceof Error) || e.message !== ROLLBACK) throw e; }
  const failures=report.filter(r=>r.differences.length || r.issues.length);
  console.log(JSON.stringify({mode:"TRANSACTION_ROLLBACK",seed:123456,period:"1406/01",users:report.length,failures:failures.length,results:report},null,2));
  if (failures.length) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
