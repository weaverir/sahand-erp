/** Replays the exact seed and random call order from monthly-transaction-oracle.ts. No DB access. */
const DAY=86400000;
const start='2027-03-21',end='2027-04-21';
const date=(s:string)=>new Date(`${s}T00:00:00.000Z`);
const key=(d:Date)=>d.toISOString().slice(0,10);
const add=(d:Date,n:number)=>new Date(+d+n*DAY);
const local=(s:string,h:number)=>new Date(+date(s)+(h*60-210)*60000);
const friday=(s:string)=>date(s).getUTCDay()===5;
const holidays=new Set(['2027-03-24','2027-04-02','2027-04-12']);
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
type Span={date:string;start:Date;end:Date};
const overlap=(a:Span,b:Span)=>Math.max(0,(Math.min(+a.end,+b.end)-Math.max(+a.start,+b.start))/60000);
const fmt=(d:Date)=>d.toISOString();
const merge=(xs:Span[])=>{const out:Span[]=[];for(const x of [...xs].sort((a,b)=>+a.start-+b.start)){const last=out.at(-1);if(last&&+x.start<=+last.end){if(+x.end>+last.end)last.end=x.end}else out.push({...x})}return out};
const duration=(xs:Span[])=>merge(xs).reduce((n,s)=>n+(+s.end-+s.start)/60000,0);
const intersection=(xs:Span[],ys:Span[])=>merge(xs).reduce((n,x)=>n+merge(ys).reduce((m,y)=>m+overlap(x,y),0),0);
const report=[];
for(let i=0;i<10;i++){
 const rand=seeded(123456+i*773),required:Span[]=[],attendance:Span[]=[],leave:Span[]=[];
 for(let d=date(start);+d<+date(end);d=add(d,1)){
  const k=key(d),dayIndex=Math.round((+d-+date(start))/DAY),overnight=dayIndex%13===4;
  const hours=[6,8,10][Math.floor(rand()*3)];
  const hasShift=(!friday(k)&&!holidays.has(k))||(i%3===0&&(friday(k)||holidays.has(k)));
  const shiftStart=overnight?22:7+Math.floor(rand()*3);
  const s=local(k,shiftStart),e=new Date(+s+hours*3600000);
  if(hasShift)required.push({date:k,start:s,end:e});
  const hasPresence=hasShift?rand()>0.12:rand()<0.35;
  if(hasPresence){const a=hasShift?new Date(+s+(Math.floor(rand()*7)-3)*900000):local(k,9);const b=hasShift?new Date(+e+(Math.floor(rand()*7)-3)*900000):local(k,12);if(+b>+a)attendance.push({date:k,start:a,end:b})}
  if(hasShift&&dayIndex%11===i%11){const a=new Date(+s+3600000),b=new Date(Math.min(+e,+a+7200000));if(+b>+a)leave.push({date:k,start:a,end:b})}
 }
 const overlaps: Array<{
  dates: [string, string];
  minutes: number;
  first: [string, string];
  second: [string, string];
 }> = [];
 for(let a=0;a<required.length;a++)for(let b=a+1;b<required.length;b++){
  const n=overlap(required[a],required[b]);if(n>0)overlaps.push({dates:[required[a].date,required[b].date],minutes:n,first:[fmt(required[a].start),fmt(required[a].end)],second:[fmt(required[b].start),fmt(required[b].end)]});
 }
 const dayKeys=[...new Set([...required,...attendance,...leave].map(x=>x.date))];
 const dayRows=dayKeys.map(k=>{
  const r=required.filter(x=>x.date===k),a=attendance.filter(x=>x.date===k),l=leave.filter(x=>x.date===k);
  const rMinutes=duration(r),worked=intersection(r,a),leaveCovered=intersection(r,l)-intersection(r,merge(l.flatMap(x=>a.map(y=>({date:k,start:new Date(Math.max(+x.start,+y.start)),end:new Date(Math.min(+x.end,+y.end))})).filter(x=>+x.end>+x.start))));
  return {date:k,required:rMinutes,worked,leaveCovered,uncovered:rMinutes-worked-leaveCovered};
 });
 const sum=(f:'required'|'worked'|'leaveCovered'|'uncovered')=>dayRows.reduce((n,x)=>n+x[f],0);
 const globalRequired=duration(required),globalWorked=intersection(required,attendance);
 const crossAttendance: Array<{
  shiftDate: string;
  attendanceRecordDate: string;
  overlapMinutes: number;
  shift: [string, string];
  presence: [string, string];
 }> = [];
 for(const r of required)for(const a of attendance){if(r.date===a.date)continue;const n=overlap(r,a);if(n>0)crossAttendance.push({shiftDate:r.date,attendanceRecordDate:a.date,overlapMinutes:n,shift:[fmt(r.start),fmt(r.end)],presence:[fmt(a.start),fmt(a.end)]})}
 const entry={username:`dev.staff.${String(i+1).padStart(2,'0')}`,global:{required:globalRequired,worked:globalWorked},byOriginDay:{required:sum('required'),worked:sum('worked'),leaveCovered:sum('leaveCovered'),uncovered:sum('uncovered')},overlappingShifts:overlaps,crossOriginAttendance:crossAttendance,affectedDays:dayRows.filter(x=>overlaps.some(y=>y.dates.includes(x.date))||crossAttendance.some(y=>y.shiftDate===x.date||y.attendanceRecordDate===x.date))};
 if(overlaps.length||crossAttendance.length)report.push(entry);
}
console.log(JSON.stringify({mode:'OFFLINE_READ_ONLY',seed:123456,note:'Reconstructs seed data; does not query PostgreSQL or modify ERP.',report},null,2));
