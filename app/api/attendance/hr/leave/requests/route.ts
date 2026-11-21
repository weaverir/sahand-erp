import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/libs/prisma';
import { authorizeGlobalRequest } from '@/modules/auth/auth.middleware';
export async function GET(request: NextRequest) {
  try { await authorizeGlobalRequest(request,'attendance.attendance.view'); } catch { return NextResponse.json({error:'دسترسی ندارید.'},{status:403}); }
  const requests=await prisma.leaveRequest.findMany({orderBy:{createdAt:'desc'},take:100,include:{employee:{select:{fullName:true}},employeeAssignment:{select:{organizationUnitId:true,managerAssignmentId:true}},approvalSteps:{orderBy:{stepOrder:'asc'}}}});
  return NextResponse.json({requests},{headers:{'Cache-Control':'no-store'}});
}
