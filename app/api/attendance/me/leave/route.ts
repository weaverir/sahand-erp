import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/libs/prisma';
import { authenticateRequest, assertSameOriginRequest } from '@/modules/auth/auth.middleware';
import { validateLeaveSubmission } from '@/modules/attendance/leave-request-policy';
import { resolveLeaveMinutes } from '@/modules/attendance/leave-schedule-resolver';

const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
export async function GET(request: NextRequest) {
  let userId: string;
  try { userId = (await authenticateRequest(request)).id; } catch { return reply({error:'ابتدا وارد شوید.'},401); }
  const [requests, ledger, opening] = await Promise.all([
    prisma.leaveRequest.findMany({ where:{employeeUserId:userId}, orderBy:{createdAt:'desc'}, take:100, include:{approvalSteps:{orderBy:{stepOrder:'asc'},select:{stepOrder:true,requiredRole:true,decision:true,decidedAt:true,note:true}}} }),
    prisma.leaveLedgerEntry.groupBy({by:['leaveTypeKey'],where:{employeeUserId:userId},_sum:{minutes:true}}),
    prisma.leaveOpeningBalance.findMany({where:{employeeUserId:userId},select:{leaveTypeKey:true}}),
  ]);
  return reply({requests,balances:ledger.map(x=>({leaveTypeKey:x.leaveTypeKey,minutes:x._sum.minutes??0})),initializedTypes:opening.map(x=>x.leaveTypeKey)});
}
export async function POST(request: NextRequest) {
  let userId: string;
  try { assertSameOriginRequest(request); userId = (await authenticateRequest(request)).id; } catch { return reply({error:'درخواست یا نشست معتبر نیست.'},403); }
  let input;
  try { if (Number(request.headers.get('content-length')??0)>12000) return reply({error:'حجم درخواست زیاد است.'},413); const payload=await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('اطلاعات نامعتبر است.');
    // Validation checks shape and time window; the actual leave duration is always recalculated.
    const body = payload as Record<string, unknown>;
    const a = new Date(String(body.startAt));
    const b = new Date(String(body.endAt));
    const maximum = (b.getTime() - a.getTime()) / 60000;
    input=validateLeaveSubmission({...body, requestedMinutes: Number.isFinite(maximum) && maximum >= 1 ? 1 : 0}); }
  catch(e) { return reply({error:e instanceof Error?e.message:'اطلاعات نامعتبر است.'},400); }
  let calculatedMinutes: number;
  try {
    calculatedMinutes = await resolveLeaveMinutes(userId, input.startAt, input.endAt);
    if (calculatedMinutes < 1) return reply({error:'در این بازه ساعت کاری قابل کسر وجود ندارد.'},400);
  } catch (e) {
    return reply({error:e instanceof Error?e.message:'برنامه کاری معتبر یافت نشد.'},409);
  }
  try {
    const result=await prisma.$transaction(async tx=>{
      const assignment=await tx.employeeAssignment.findFirst({where:{userId,status:'ACTIVE'},orderBy:[{isPrimary:'desc'},{startDate:'desc'}],select:{id:true,managerAssignmentId:true,organizationUnitId:true}});
      if(!assignment) throw new Error('NO_ASSIGNMENT');
      const duplicate=await tx.leaveRequest.findFirst({where:{employeeUserId:userId,status:{in:['PENDING','PARTIALLY_APPROVED','APPROVED']},startAt:{lt:input.endAt},endAt:{gt:input.startAt}},select:{id:true}});
      if(duplicate) throw new Error('OVERLAP');
      // Production workflow requires supervisor and production manager; other departments HR then CEO/deputy.
      // Do not infer production from the user's title: only a unit explicitly keyed as production is eligible.
      const unit=await tx.organizationUnit.findUnique({where:{id:assignment.organizationUnitId},select:{name:true,code:true}});
      const isProduction=['production','prod'].includes(unit?.code?.trim().toLowerCase()??'') || unit?.name?.trim()==='تولید';
      const roles=isProduction?(['SECTION_SUPERVISOR','PRODUCTION_MANAGER'] as const):(['HR_MANAGER','CEO_OR_DEPUTY'] as const);
      return tx.leaveRequest.create({data:{employeeUserId:userId,employeeAssignmentId:assignment.id,leaveTypeKey:input.leaveTypeKey,startAt:input.startAt,endAt:input.endAt,requestedMinutes:calculatedMinutes,reason:input.reason,status:'PENDING',submittedAt:new Date(),approvalSteps:{create:roles.map((requiredRole,i)=>({stepOrder:i+1,requiredRole}))}},select:{id:true,status:true}});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    return reply({request:{...result,requestedMinutes:calculatedMinutes}},201);
  } catch(e) {
    if(e instanceof Error && e.message==='NO_ASSIGNMENT') return reply({error:'مسئولیت سازمانی فعال ندارید.'},409);
    if(e instanceof Error && e.message==='OVERLAP') return reply({error:'در این بازه درخواست باز یا تأییدشده دارید.'},409);
    if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==='P2034') return reply({error:'تداخل همزمان؛ دوباره تلاش کنید.'},409);
    console.error('employee leave POST',e);return reply({error:'ثبت درخواست ناموفق بود.'},500);
  }
}
