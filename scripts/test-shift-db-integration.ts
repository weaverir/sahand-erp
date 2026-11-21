import { randomUUID } from 'node:crypto';
import { prisma } from '../libs/prisma';
import { findShiftAssignmentConflict, lockShiftAssignments } from '../modules/shifts/assignment-conflict-db';

const tag = `shift_test_${randomUUID()}`;
const rollback = new Error(tag);
const date = (s: string) => new Date(`${s}T00:00:00Z`);
const results: { name: string; pass: boolean; expected: number; actual: number }[] = [];
async function main() {
  try {
    await prisma.$transaction(async tx => {
      await lockShiftAssignments(tx);
      if (await tx.shiftAssignment.count({ where: { isActive: true } })) throw new Error('Active recurring assignments exist; refusing to run isolated fixtures.');
      const unit = await tx.organizationUnit.create({data:{code:tag,name:tag}});
      async function employee(n: number) {
        const user = await tx.user.create({data:{username:`${tag}_${n}`,fullName:tag,passwordHash:'!INVALID_TEST_PASSWORD!',isActive:true}});
        const assignment = await tx.employeeAssignment.create({data:{userId:user.id,organizationUnitId:unit.id,startDate:date('2027-04-01')}});
        return { user, assignment };
      }
      const a = await employee(1), b = await employee(2);
      async function shift(n: string, dayOfWeek: number, startMinute: number, endMinute: number) {
        return tx.workShift.create({data:{code:`${tag}_${n}`,name:n,days:{create:{dayOfWeek,startMinute,endMinute,requiredMinutes:(endMinute-startMinute+1440)%1440}}}});
      }
      const night = await shift('night',0,1320,480);
      const morning = await shift('morning',1,420,900);
      const adjacent = await shift('adjacent',1,480,900);
      const candidate = (shiftId: string, employeeAssignmentId: string, from='2027-04-03',to='2027-04-10') => ({shiftId,employeeAssignmentId,organizationUnitId:null,targetType:'EMPLOYEE' as const,validFrom:date(from),validTo:date(to)});
      const base = await tx.shiftAssignment.create({data:candidate(night.id,a.assignment.id)});
      async function check(name:string, c: Parameters<typeof findShiftAssignmentConflict>[1], expected:number, excludeId?:string) {
        const conflict = await findShiftAssignmentConflict(tx,c,excludeId);
        const actual = conflict?.overlapMinutes ?? 0;
        results.push({name,pass:actual===expected,expected,actual});
      }
      await check('same employee overnight overlap',candidate(morning.id,a.assignment.id),60);
      await check('different employee',candidate(morning.id,b.assignment.id),0);
      await check('adjacent shifts',candidate(adjacent.id,a.assignment.id),0);
      await check('unit overlap',{...candidate(morning.id,a.assignment.id),targetType:'UNIT',employeeAssignmentId:null,organizationUnitId:unit.id},60);
      await check('company overlap',{...candidate(morning.id,a.assignment.id),targetType:'COMPANY',employeeAssignmentId:null},60);
      await check('edit excludes itself',candidate(night.id,a.assignment.id),0,base.id);
      await tx.shiftAssignment.update({where:{id:base.id},data:{validTo:date('2027-04-03')}});
      await check('overnight across validity boundary',candidate(morning.id,a.assignment.id,'2027-04-04','2027-04-04'),60);
      await tx.shiftAssignment.update({where:{id:base.id},data:{isActive:false}});
      const nextMorning = await tx.shiftAssignment.create({data:candidate(morning.id,a.assignment.id,'2027-04-04','2027-04-04')});
      await check('overnight across validity boundary reverse order',candidate(night.id,a.assignment.id,'2027-04-03','2027-04-03'),60);
      await tx.shiftAssignment.update({where:{id:nextMorning.id},data:{isActive:false}});
      const schedule = await tx.employeeShiftSchedule.create({data:{employeeUserId:a.user.id,createdByUserId:a.user.id,weekStartDate:date('2027-04-03'),status:'APPROVED',segments:{create:{workDate:date('2027-04-04'),segmentOrder:1,startsAt:new Date('2027-04-04T03:30:00Z'),endsAt:new Date('2027-04-04T11:30:00Z'),requiredMinutes:480}}}});
      await check('recurring versus approved weekly',candidate(night.id,a.assignment.id),60);
      await check('weekly different employee',candidate(night.id,b.assignment.id),0);
      await tx.employeeShiftSchedule.update({where:{id:schedule.id},data:{status:'DRAFT'}});
      await check('draft weekly ignored',candidate(night.id,a.assignment.id),0);
      throw rollback;
    },{timeout:60000});
    throw new Error('Unexpected transaction commit');
  } catch(e) { if(e!==rollback) throw e; }
  const remaining = await prisma.user.count({where:{username:{startsWith:tag}}}) + await prisma.workShift.count({where:{code:{startsWith:tag}}}) + await prisma.organizationUnit.count({where:{code:tag}});
  console.log(JSON.stringify({mode:'ROLLBACK',scope:'database guard only; not HTTP or concurrency',remainingFixtures:remaining,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length,results},null,2));
  if(remaining || results.some(r=>!r.pass)) process.exitCode=1;
}
main().catch(e=>{console.error('SHIFT_INTEGRATION_ERROR',e);process.exitCode=1;}).finally(()=>prisma.$disconnect());
