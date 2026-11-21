import {NextRequest,NextResponse} from 'next/server';
import {prisma} from '@/libs/prisma';
import {authorizeGlobalRequest} from '@/modules/auth/auth.middleware';
export async function GET(request:NextRequest){try{await authorizeGlobalRequest(request,'attendance.shift.view');}catch{return NextResponse.json({error:'دسترسی ندارید.'},{status:403});}
 const [employees,units]=await Promise.all([prisma.employeeAssignment.findMany({where:{status:'ACTIVE'},select:{id:true,user:{select:{id:true,fullName:true}},organizationUnit:{select:{name:true}}},orderBy:{createdAt:'desc'},take:500}),prisma.organizationUnit.findMany({where:{status:'ACTIVE'},select:{id:true,name:true},orderBy:{name:'asc'},take:500})]);return NextResponse.json({employees,units},{headers:{'Cache-Control':'no-store'}});}
