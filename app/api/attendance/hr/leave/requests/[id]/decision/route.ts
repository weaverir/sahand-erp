import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/prisma';
import { authenticateRequest, assertSameOriginRequest } from '@/modules/auth/auth.middleware';
import { nextUndecidedStep, canReviewLeaveStep } from '@/modules/attendance/leave-request-policy';
const send=(body:object,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:NextRequest,context:{params:Promise<{id:string}>}) {
  let actorId:string;
  try {assertSameOriginRequest(request);actorId=(await authenticateRequest(request)).id;}catch{return send({error:'دسترسی معتبر نیست.'},403);}
  const {id}=await context.params;
  if(!id || id.length>128) return send({error:'شناسه نامعتبر است.'},400);
  let decision:'APPROVED'|'REJECTED',note:string;
  try {const body:unknown=await request.json();if(!body||typeof body!=='object'||Array.isArray(body))throw Error();const b=body as Record<string,unknown>;if(b.decision!=='APPROVED'&&b.decision!=='REJECTED'||typeof b.note!=='string'||b.note.length>1000)throw Error();decision=b.decision;note=b.note.trim();}catch{return send({error:'اطلاعات تصمیم نامعتبر است.'},400);}
  try {
    const result=await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT id FROM "LeaveRequest" WHERE id = ${id} FOR UPDATE`;
      const leave=await tx.leaveRequest.findUnique({where:{id},include:{approvalSteps:{orderBy:{stepOrder:'asc'}},employeeAssignment:{select:{managerAssignmentId:true,organizationUnitId:true}}}});
      if(!leave) throw Error('NOT_FOUND');
      if(!['PENDING','PARTIALLY_APPROVED'].includes(leave.status))throw Error('ALREADY_DECIDED');
      if(leave.employeeUserId===actorId)throw Error('SELF_APPROVAL');
      const step=nextUndecidedStep(leave.approvalSteps);
      if(!step)throw Error('ALREADY_DECIDED');
      const actor=await tx.user.findUnique({where:{id:actorId},select:{isActive:true,isSystem:true,roles:{where:{isActive:true,role:{isActive:true}},select:{role:{select:{key:true}}}},employeeAssignments:{where:{status:'ACTIVE'},select:{id:true,organizationUnitId:true,roles:{where:{isActive:true,role:{isActive:true}},select:{role:{select:{key:true}}}}}}}});
      if(!actor?.isActive || actor.isSystem)throw Error('NO_PERMISSION');
      const roleKeys=new Set([...actor.roles.map(r=>r.role.key),...actor.employeeAssignments.flatMap(a=>a.roles.map(r=>r.role.key))]);
      const allowed=canReviewLeaveStep({
        requiredRole:step.requiredRole,
        roleKeys,
        reviewerAssignments:actor.employeeAssignments.map(a=>({
          id:a.id,
          organizationUnitId:a.organizationUnitId,
          roleKeys:a.roles.map(r=>r.role.key),
        })),
        employeeManagerAssignmentId:leave.employeeAssignment.managerAssignmentId,
        employeeOrganizationUnitId:leave.employeeAssignment.organizationUnitId,
      });
      if(!allowed)throw Error('NO_PERMISSION');
      await tx.leaveApprovalStep.update({where:{id:step.id},data:{decision,reviewerUserId:actorId,decidedAt:new Date(),note:note||null}});
      const final=decision==='REJECTED' || leave.approvalSteps.every(s=>s.id===step.id||s.decision==='APPROVED');
      const status=decision==='REJECTED'?'REJECTED':final?'APPROVED':'PARTIALLY_APPROVED';
      await tx.leaveRequest.update({where:{id},data:{status,decidedAt:final?new Date():null,approvedMinutes:status==='APPROVED'?leave.requestedMinutes:null}});
      if(status==='APPROVED'){
        const date=new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn',{timeZone:'Asia/Tehran',year:'numeric',month:'numeric'}).formatToParts(leave.startAt);
        const get=(key:string)=>Number(date.find(p=>p.type===key)?.value);
        await tx.leaveLedgerEntry.create({data:{employeeUserId:leave.employeeUserId,leaveTypeKey:leave.leaveTypeKey,jalaliYear:get('year'),jalaliMonth:get('month'),entryType:'APPROVED_USAGE',minutes:-leave.requestedMinutes,idempotencyKey:`usage:${leave.id}`,leaveRequestId:leave.id,createdByUserId:actorId,note:'کسر مرخصی پس از تأیید نهایی'}});
      }
      return {id,status};
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return send({request:result});
  }catch(e){
    if(e instanceof Error){if(e.message==='NOT_FOUND')return send({error:'درخواست یافت نشد.'},404);if(e.message==='NO_PERMISSION'||e.message==='SELF_APPROVAL')return send({error:'مجوز تأیید این مرحله را ندارید.'},403);if(e.message==='ALREADY_DECIDED')return send({error:'درخواست قبلاً تعیین تکلیف شده است.'},409);}
    if(e instanceof Prisma.PrismaClientKnownRequestError&&(e.code==='P2002'||e.code==='P2034'))return send({error:'درخواست همزمان یا تکراری است.'},409);
    console.error('leave decision',e);return send({error:'ثبت تصمیم ناموفق بود.'},500);
  }
}
