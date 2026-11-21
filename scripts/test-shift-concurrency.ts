import { randomUUID } from 'node:crypto';
import { prisma } from '../libs/prisma';
import { runShiftWrite } from '../modules/shifts/shift-write-transaction';
import { findShiftAssignmentConflict } from '../modules/shifts/assignment-conflict-db';
const tag = `race_${randomUUID()}`;
const date = (s:string) => new Date(`${s}T00:00:00Z`);
class Conflict extends Error {}
async function main() {
  if (process.env.SHIFT_RACE_TEST !== 'YES_MAIN_DATABASE') throw new Error('Explicit main database opt-in required');
  const db = await prisma.$queryRaw<{name:string}[]>`SELECT current_database() AS name`;
  if (db[0]?.name !== 'sahand_erp') throw new Error('Expected sahand_erp');
  const company = await prisma.shiftAssignment.count({where:{isActive:true,targetType:'COMPANY',validFrom:{lte:date('2027-04-11')},OR:[{validTo:null},{validTo:{gte:date('2027-04-02')}}]}});
  if (company) throw new Error('Existing company assignments may affect test fixtures; no fixtures created');
  console.log(`Main database test fixture tag: ${tag}`);
  const fixtures = await prisma.$transaction(async tx => {
    const unit = await tx.organizationUnit.create({data:{code:tag,name:tag}});
    async function employee(n:number) {
      const user = await tx.user.create({data:{username:`${tag}_${n}`,fullName:tag,passwordHash:'!INVALID_TEST_PASSWORD!',isActive:true}});
      return tx.employeeAssignment.create({data:{userId:user.id,organizationUnitId:unit.id,startDate:date('2027-04-01')}});
    }
    async function shift(n:string,dayOfWeek:number,startMinute:number,endMinute:number) {
      return tx.workShift.create({data:{code:`${tag}_${n}`,name:n,days:{create:{dayOfWeek,startMinute,endMinute,requiredMinutes:(endMinute-startMinute+1440)%1440}}}});
    }
    return {a:await employee(1),b:await employee(2),night:await shift('night',0,1320,480),morning:await shift('morning',1,420,900),adjacent:await shift('adjacent',1,480,900)};
  });
  const {a,b,night,morning,adjacent}=fixtures;
  const ids=[a.id,b.id];
  const shiftIds=[night.id,morning.id,adjacent.id];
  const owned = {employeeAssignmentId:{in:ids},shiftId:{in:shiftIds}};
  const candidate=(shiftId:string,employeeAssignmentId:string)=>({shiftId,employeeAssignmentId,organizationUnitId:null,targetType:'EMPLOYEE' as const,validFrom:date('2027-04-03'),validTo:date('2027-04-10')});
  const clear=()=>prisma.shiftAssignment.deleteMany({where:owned});
  const results: {name:string;pass:boolean;outcomes:string[];rows:number}[]=[];
  function write(c:ReturnType<typeof candidate>,id?:string) {
    return runShiftWrite(async tx=>{
      const conflict=await findShiftAssignmentConflict(tx,c,id);
      if(conflict) throw new Conflict(`${conflict.overlapMinutes} minutes`);
      await new Promise(resolve=>setTimeout(resolve,150));
      return id ? tx.shiftAssignment.update({where:{id},data:{shiftId:c.shiftId}}) : tx.shiftAssignment.create({data:c});
    });
  }
  async function race(name:string, left:ReturnType<typeof candidate>,right:ReturnType<typeof candidate>,expected:number,id?:string) {
    const settled=await Promise.allSettled([write(left,id),write(right)]);
    const outcomes=settled.map(r=>r.status==='fulfilled'?'committed':r.reason instanceof Conflict?'shift-conflict':`unexpected: ${String(r.reason)}`);
    const rows=await prisma.shiftAssignment.count({where:owned});
    const pass=outcomes.filter(x=>x==='committed').length===expected && outcomes.filter(x=>x==='shift-conflict').length===2-expected && rows===(id?1+Number(outcomes[1]==='committed'):expected);
    results.push({name,pass,outcomes,rows});
    await clear();
  }
  try {
    await race('create/create overlap',candidate(night.id,a.id),candidate(morning.id,a.id),1);
    await race('different employees',candidate(night.id,a.id),candidate(morning.id,b.id),2);
    await race('adjacent shifts',candidate(night.id,a.id),candidate(adjacent.id,a.id),2);
    // Existing adjacent shift is compatible with the new night shift;
    // editing it to morning introduces the competing overlap.
    const base=await write(candidate(adjacent.id,a.id));
    await race('edit/create overlap',candidate(morning.id,a.id),candidate(night.id,a.id),1,base.id);
  } finally {
    await prisma.$transaction(async tx=>{
      await tx.shiftAssignment.deleteMany({where:owned});
      await tx.workShiftDay.deleteMany({where:{shiftId:{in:[night.id,morning.id,adjacent.id]}}});
      await tx.workShift.deleteMany({where:{id:{in:[night.id,morning.id,adjacent.id]}}});
      await tx.employeeAssignment.deleteMany({where:{id:{in:ids}}});
      await tx.user.deleteMany({where:{id:{in:[a.userId,b.userId]}}});
      await tx.organizationUnit.deleteMany({where:{code:tag}});
    });
  }
  const remainingFixtures = await prisma.user.count({where:{id:{in:[a.userId,b.userId]}}}) + await prisma.employeeAssignment.count({where:{id:{in:ids}}}) + await prisma.workShift.count({where:{id:{in:shiftIds}}}) + await prisma.organizationUnit.count({where:{code:tag}}) + await prisma.shiftAssignment.count({where:owned});
  console.log(JSON.stringify({database:db[0].name,remainingFixtures,scope:'transaction service, not HTTP',tag,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
  if(remainingFixtures || results.some(r=>!r.pass)) process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
