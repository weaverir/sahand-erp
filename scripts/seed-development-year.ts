/** One-year synthetic HR history for dev.staff.01..10. Development DB only. */
import { prisma } from '../libs/prisma';

const PREFIX='DEV-YEAR-2025-2026';
const START='2025-11-19';
const END='2026-11-18';
const MINUTE=60000;
const profiles=[
  {code:'DAY-0700',name:'روزکار ۷ تا ۱۵',start:420,end:900,days:[0,1,2,3,4]},
  {code:'DAY-0800',name:'روزکار ۸ تا ۱۶',start:480,end:960,days:[0,1,2,3,4]},
  {code:'DAY-0900',name:'روزکار ۹ تا ۱۷',start:540,end:1020,days:[0,1,2,3,4]},
  {code:'EVENING',name:'عصرکار ۱۵ تا ۲۳',start:900,end:1380,days:[0,1,2,3,4,5]},
  {code:'NIGHT',name:'شب‌کار ۲۳ تا ۷',start:1380,end:420,days:[0,1,2,3,4]},
];
const mapping=[0,1,3,4,0,1,2,0,3,2];
function dateKey(d:Date){return d.toISOString().slice(0,10)}
function dateUTC(key:string){return new Date(`${key}T00:00:00.000Z`)}
function tehranInstant(key:string,minute:number){return new Date(dateUTC(key).getTime()+(minute-210)*MINUTE)}
function rng(seed:number){return ()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296}}
function jalali(date:Date){const p=new Intl.DateTimeFormat('en-US-u-ca-persian',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric'}).formatToParts(date);return {year:Number(p.find(x=>x.type==='year')?.value),month:Number(p.find(x=>x.type==='month')?.value)}}
async function main(){
 if(!process.argv.includes('--confirm-development-year'))throw Error('پرچم --confirm-development-year لازم است');
 const url=new URL(process.env.DATABASE_URL||'');
 if(url.pathname!=='/sahand_erp'||!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('فقط دیتابیس توسعه محلی sahand_erp مجاز است');
 const db=await prisma.$queryRaw<Array<{name:string}>>`SELECT current_database() AS name`;
 if(db[0]?.name!=='sahand_erp')throw Error('نام واقعی دیتابیس با انتظار مطابقت ندارد');
 const employees=await prisma.user.findMany({where:{username:{startsWith:'dev.staff.'}},select:{id:true,username:true,employeeAssignments:{where:{status:'ACTIVE'},select:{id:true},take:1},employeeProfile:{select:{id:true}}}});
 const byName=new Map(employees.map(x=>[x.username,x]));
 for(let i=1;i<=10;i++){const key=`dev.staff.${String(i).padStart(2,'0')}`;const e=byName.get(key);if(!e?.employeeProfile||!e.employeeAssignments.length)throw Error(`پرونده پرسنلی یا انتساب فعال برای ${key} یافت نشد. هیچ تغییری انجام نشد.`)}
 const existing=await prisma.workShift.findFirst({where:{code:{startsWith:PREFIX}}});
 const existingRecord=await prisma.attendanceRecord.findFirst({where:{notes:{startsWith:PREFIX}}});
 const existingLeave=await prisma.leaveRequest.findFirst({where:{reason:{startsWith:PREFIX}}});
 if(existing||existingRecord||existingLeave)throw Error('داده‌های این بسته قبلاً ایجاد شده‌اند؛ برای جلوگیری از تکرار متوقف شد.');
 const count=await prisma.attendanceRecord.count({where:{employeeAssignmentId:{in:employees.flatMap(e=>e.employeeAssignments.map(a=>a.id))},workDate:{gte:dateUTC(START),lte:dateUTC(END)}}});
 if(count)throw Error(`در بازه انتخابی ${count} رکورد تردد قبلی برای کارکنان هدف وجود دارد. برای جلوگیری از تداخل هیچ تغییری انجام نشد.`);
 console.log('پیش‌بررسی موفق؛ ساخت شیفت‌ها و سوابق یک‌ساله شروع شد.');
 const shifts=[];
 for(const p of profiles){
   const shift=await prisma.workShift.create({data:{code:`${PREFIX}-${p.code}`,name:`آزمایشی: ${p.name}`,description:`${PREFIX} داده ساختگی`,days:{create:Array.from({length:7},(_,day)=>({dayOfWeek:day,dayType:'NORMAL',segmentOrder:1,isWorkingDay:p.days.includes(day),startMinute:p.days.includes(day)?p.start:null,endMinute:p.days.includes(day)?p.end:null,requiredMinutes:p.days.includes(day)?480:0}))}}});
   shifts.push(shift);
 }
 let attendanceCount=0, eventCount=0, leaveCount=0;
 for(let i=1;i<=10;i++){
   const username=`dev.staff.${String(i).padStart(2,'0')}`;
   const e=byName.get(username)!;
   const assignment=e.employeeAssignments[0];
   const p=profiles[mapping[i-1]];
   const shift=shifts[mapping[i-1]];
   const random=rng(20261119+i*947);
   const shiftAssignment=await prisma.shiftAssignment.create({data:{shiftId:shift.id,targetType:'EMPLOYEE',employeeAssignmentId:assignment.id,validFrom:dateUTC(START),validTo:dateUTC(END),isActive:false,notes:`${PREFIX} historical synthetic assignment`}});
   const leaveDates=new Map<string,{type:string,status:'DRAFT'|'PENDING'|'REJECTED'|'CANCELLED'}>();
   const types=['annual','sick','unpaid','hourly'];
   const statuses=['PENDING','DRAFT','REJECTED','CANCELLED'] as const;
   for(let n=0;n<15;n++){
     const offset=12+n*23+(i*3)%7;
     const d=new Date(dateUTC(START).getTime()+offset*86400000);
     const key=dateKey(d);
     if(key>END)continue;
     const type=types[(n+i)%types.length];const status=statuses[(n+i)%statuses.length];
     leaveDates.set(key,{type,status});
     const start=tehranInstant(key,p.start+60);
     const end=new Date(start.getTime()+(type==='hourly'?120:360)*MINUTE);
     await prisma.leaveRequest.create({data:{employeeUserId:e.id,employeeAssignmentId:assignment.id,leaveTypeKey:type,startAt:start,endAt:end,requestedMinutes:type==='hourly'?120:360,status,reason:`${PREFIX} درخواست مرخصی ساختگی ${type}`,submittedAt:status==='DRAFT'?null:start,decidedAt:['REJECTED','CANCELLED'].includes(status)?end:null,cancelledAt:status==='CANCELLED'?end:null}});
     leaveCount++;
   }
   const batch=[] as any[];
   for(let d=dateUTC(START);dateKey(d)<=END;d=new Date(d.getTime()+86400000)){
     const key=dateKey(d),dow=(d.getUTCDay()+1)%7;
     if(!p.days.includes(dow))continue;
     const leave=leaveDates.get(key);
     // Pending/draft/rejected/cancelled leave does not imply absence.
     const roll=random();
     const absent=roll<0.035;
     const late=Math.round((random()*43)-13);
     const extra=Math.round((random()*85)-20);
     const inAt=new Date(tehranInstant(key,p.start).getTime()+late*MINUTE);
     const scheduledEnd=tehranInstant(key,p.end+(p.end<=p.start?1440:0));
     const outAt=new Date(scheduledEnd.getTime()+extra*MINUTE);
     const worked=absent?0:Math.max(0,Math.round((outAt.getTime()-inAt.getTime())/MINUTE));
     batch.push({employeeAssignmentId:assignment.id,shiftAssignmentId:shiftAssignment.id,workDate:d,timeZone:'Asia/Tehran',scheduledStartAt:tehranInstant(key,p.start),scheduledEndAt:scheduledEnd,requiredMinutes:480,firstCheckInAt:absent?null:inAt,lastCheckOutAt:absent?null:outAt,workedMinutes:worked,breakMinutes:0,overtimeMinutes:Math.max(0,worked-480),lateMinutes:absent?0:Math.max(0,late),earlyLeaveMinutes:absent?0:Math.max(0,-extra),status:absent?'PENDING_REVIEW':'COMPLETED',notes:`${PREFIX} synthetic attendance${absent?' / absent':''}`});
   }
   for(let offset=0;offset<batch.length;offset+=40){
     const chunk=batch.slice(offset,offset+40);
     await prisma.$transaction(async tx=>{
       for(const row of chunk){
         const rec=await tx.attendanceRecord.create({data:row});attendanceCount++;
         if(row.firstCheckInAt&&row.lastCheckOutAt){
           await tx.attendanceEvent.createMany({data:[{attendanceRecordId:rec.id,eventType:'CHECK_IN',occurredAt:row.firstCheckInAt,source:'DEV_SEED',notes:`${PREFIX} synthetic, not biometric verified`,idempotencyKey:`${PREFIX}:${rec.id}:in`},{attendanceRecordId:rec.id,eventType:'CHECK_OUT',occurredAt:row.lastCheckOutAt,source:'DEV_SEED',notes:`${PREFIX} synthetic, not biometric verified`,idempotencyKey:`${PREFIX}:${rec.id}:out`}]});eventCount+=2;
         }
       }
     },{timeout:60000});
   }
   console.log(`${username}: ${batch.length} روز کاری، ${leaveDates.size} درخواست مرخصی`);
 }
 console.log(`تمام شد: ${shifts.length} شیفت، ۱۰ انتساب، ${attendanceCount} رکورد تردد، ${eventCount} رویداد ورود/خروج، ${leaveCount} درخواست مرخصی.`);
 console.log('توجه: درخواست‌های مرخصی آزمایشی تأیید نهایی و کسر مانده ندارند؛ رویدادهای تردد فاقد تأیید بیومتریک هستند.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
