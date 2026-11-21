import assert from 'node:assert/strict';
import { test } from 'node:test';
import { aggregateMonthlyWork, type MonthlyWorkDay } from '../modules/attendance/monthly-work-aggregation';
import { classifyDayKind } from '../modules/attendance/holiday-work-policy';

type Interval = {startAt:string;endAt:string};
let state=20261120;
function random():number { state=(Math.imul(state,1664525)+1013904223)>>>0; return state/4294967296; }
function int(min:number,max:number){return min+Math.floor(random()*(max-min+1));}
const start=Date.UTC(2026,0,21);
function iso(minute:number){return new Date(minute*60000).toISOString();}
function interval(day:number,from:number,to:number):Interval {
  const base=(start+day*86400000)/60000;
  return {startAt:iso(base+from),endAt:iso(base+to)};
}
// Independent oracle: enumerate each UTC minute as a set, not interval merging/intersection.
function minutes(intervals:Interval[]):Set<number>{
 const result=new Set<number>();
 for(const i of intervals){const a=Date.parse(i.startAt)/60000,b=Date.parse(i.endAt)/60000;
  assert(Number.isInteger(a)&&Number.isInteger(b)&&b>a);
  for(let t=a;t<b;t++)result.add(t);
 }
 return result;
}
function expected(days:MonthlyWorkDay[]){
 let requiredMinutes=0,workedMinutes=0,approvedLeaveMinutes=0,uncoveredMinutes=0,holidayWorkMinutes=0,unresolvedCount=0;
 for(const day of days){
  const req=minutes(day.required),att=minutes(day.attendance),leave=minutes(day.approvedLeave);
  requiredMinutes+=req.size;
  for(const t of req){if(att.has(t))workedMinutes++;else if(leave.has(t))approvedLeaveMinutes++;else uncoveredMinutes++;}
  if(day.dayKind==='FRIDAY'||day.dayKind==='OFFICIAL_HOLIDAY')holidayWorkMinutes+=att.size;
  unresolvedCount+=(day.unresolvedReasons??[]).length;
 }
 return {requiredMinutes,workedMinutes,approvedLeaveMinutes,uncoveredMinutes,holidayWorkMinutes,unresolvedCount,overtimeMinutes:0};
}
function check(days:MonthlyWorkDay[]){
 const actual=aggregateMonthlyWork(days),oracle=expected(days);
 for(const [key,value] of Object.entries(oracle))assert.equal(actual[key as keyof typeof oracle],value,`${key}: ${JSON.stringify(days)}`);
}

test('independent minute-by-minute oracle: 10 employees × 31 days, reproducible random shifts and attendance',()=>{
 for(let employee=1;employee<=10;employee++){
  const days:MonthlyWorkDay[]=[];
  for(let d=0;d<30;d++){
   const date=new Date(start+d*86400000).toISOString().slice(0,10);
   const kind=classifyDayKind({workDate:date,isHoliday:random()<0.18,isWorkingDayOverride:random()<0.05});
   const shiftStart=int(6,12)*60,shiftLength=[360,480,600][int(0,2)];
   const required=kind==='REGULAR'&&random()<0.9?[interval(d,shiftStart,shiftStart+shiftLength)]:[];
   const attendance:Interval[]=[];
   if(random()<0.85){const arrival=shiftStart+int(-90,120),departure=shiftStart+shiftLength+int(-120,150);
    if(departure>arrival)attendance.push(interval(d,arrival,departure));
    if(random()<0.12)attendance.push({...attendance[0]}); // duplicate should not double count
   }
   const approvedLeave=random()<0.25?[interval(d,shiftStart+60,shiftStart+180)]:[];
   days.push({workDate:date,dayKind:kind,required,attendance,approvedLeave,
    unresolvedReasons:random()<0.1?['PENDING_REVIEW']:[]});
  }
  check(days);
 }
});

test('Friday and official holiday overlap: count once',()=>{
 const day='2026-01-23'; // Friday
 const attendance=[interval(2,480,780)];
 check([{workDate:day,dayKind:classifyDayKind({workDate:day,isHoliday:true}),required:[],attendance,approvedLeave:[]}]);
 assert.equal(aggregateMonthlyWork([{workDate:day,dayKind:'OFFICIAL_HOLIDAY',required:[],attendance,approvedLeave:[]}]).holidayWorkMinutes,300);
});

test('Thursday night to Friday: existing day-key attribution is a known limitation',()=>{
 // Thursday 2026-01-22 22:00 to Friday 2026-01-23 06:00 Tehran;
 // UTC: Thursday 18:30 to Friday 02:30. This oracle splits at Tehran midnight (20:30 UTC).
 const intervalNight={startAt:'2026-01-22T18:30:00.000Z',endAt:'2026-01-23T02:30:00.000Z'};
 const startMs=Date.parse(intervalNight.startAt),endMs=Date.parse(intervalNight.endAt);
 const midnight=Date.parse('2026-01-22T20:30:00.000Z');
 const fridayExpected=(endMs-midnight)/60000;
 assert.equal(fridayExpected,360);
 const actual=aggregateMonthlyWork([{workDate:'2026-01-22',dayKind:'REGULAR',required:[],attendance:[intervalNight],approvedLeave:[]}]);
 assert.equal(actual.holidayWorkMinutes,0);
 assert.notEqual(actual.holidayWorkMinutes,fridayExpected,'Current implementation cannot attribute overnight presence to Friday');
});
