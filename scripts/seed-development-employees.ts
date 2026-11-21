/**
 * Development-only: creates 10 complete synthetic employees in sahand_erp.
 * Does not alter existing accounts, roles, permissions or organizational records.
 * Run: node --env-file=.env --import tsx scripts/seed-development-employees.ts --confirm-development-seed
 */
import { randomBytes } from 'node:crypto';
import { hash } from 'bcryptjs';
import { prisma } from '../libs/prisma';

const PREFIX = 'dev.staff.';
const PEOPLE = [
  {name:'آرمان نیک‌فر', first:'آرمان',last:'نیک‌فر', unit:'منابع انسانی', position:'کارشناس منابع انسانی',role:['hr_manager','hr_staff','employee'],gender:'MALE'},
  {name:'مهسا رستگار',first:'مهسا',last:'رستگار',unit:'تولید',position:'مدیر تولید',role:['production_manager','production_supervisor','employee'],gender:'FEMALE'},
  {name:'امیرحسین بهرامی',first:'امیرحسین',last:'بهرامی',unit:'تولید',position:'سرپرست تولید',role:['production_supervisor','shift_supervisor','employee'],gender:'MALE'},
  {name:'نیلوفر شریفی',first:'نیلوفر',last:'شریفی',unit:'تولید',position:'اپراتور تولید',role:['production_operator','employee'],gender:'FEMALE'},
  {name:'کیان مرادی',first:'کیان',last:'مرادی',unit:'تولید',position:'اپراتور تولید',role:['production_operator','employee'],gender:'MALE'},
  {name:'الهام توکلی',first:'الهام',last:'توکلی',unit:'انبار',position:'انباردار',role:['warehouse_staff','warehouse_manager','employee'],gender:'FEMALE'},
  {name:'پارسا کاظمی',first:'پارسا',last:'کاظمی',unit:'حسابداری',position:'حسابدار',role:['accountant','accounting_staff','employee'],gender:'MALE'},
  {name:'سارا احمدی',first:'سارا',last:'احمدی',unit:'فروش',position:'کارشناس فروش',role:['sales_staff','sales_manager','employee'],gender:'FEMALE'},
  {name:'سامان زمانی',first:'سامان',last:'زمانی',unit:'کنترل کیفیت',position:'بازرس کیفیت',role:['quality_inspector','quality_manager','employee'],gender:'MALE'},
  {name:'ترانه فراهانی',first:'ترانه',last:'فراهانی',unit:'اداری',position:'کارمند اداری',role:['employee','staff'],gender:'FEMALE'},
] as const;

async function main() {
  if (!process.argv.includes('--confirm-development-seed')) throw new Error('برای اجرا پرچم --confirm-development-seed لازم است.');
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL تنظیم نشده است.');
  const url = new URL(raw);
  if (url.pathname !== '/sahand_erp' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) {
    throw new Error('این اسکریپت فقط برای دیتابیس توسعه محلی sahand_erp مجاز است.');
  }
  const [existing, roles, units, positions] = await Promise.all([
    prisma.user.findMany({where:{username:{startsWith:PREFIX}},select:{username:true}}),
    prisma.role.findMany({where:{isActive:true},select:{id:true,key:true,name:true}}),
    prisma.organizationUnit.findMany({where:{status:'ACTIVE'},select:{id:true,name:true,code:true}}),
    prisma.organizationPosition.findMany({where:{isActive:true},select:{id:true,title:true,code:true}}),
  ]);
  if (existing.length) throw new Error(`حساب‌های توسعه از قبل وجود دارند: ${existing.map(x=>x.username).join(', ')}. برای جلوگیری از تکرار، هیچ تغییری انجام نشد.`);
  const forbidden = /^(system_admin|ceo|ceo_deputy)$/;
  const safeRoles = roles.filter(r=>!forbidden.test(r.key));
  if (!safeRoles.length) throw new Error('هیچ نقش غیرمدیریتی فعالی وجود ندارد. ابتدا نقش‌های واقعی پروژه را تعریف کنید.');
  // Validate access roles before making any database changes.
  const missingRoles = PEOPLE.filter(p=>!p.role.some(key=>safeRoles.some(r=>r.key===key)));
  if (missingRoles.length) {
    console.error('نقش‌های فعال موجود:', safeRoles.map(r=>`${r.name} (${r.key})`).join('، '));
    throw new Error('نقش مناسب برای این سمت‌ها تعریف نشده است: ' + missingRoles.map(p=>`${p.position} [${p.role.join(' / ')}]`).join('، ') + '. هیچ رکوردی ساخته نشد.');
  }
  const requiredUnits = [...new Set(PEOPLE.map(p=>p.unit))];
  const requiredPositions = [...new Set(PEOPLE.map(p=>p.position))];
  const newUnits = requiredUnits.filter(name=>!units.some(u=>u.name===name));
  const newPositions = requiredPositions.filter(title=>!positions.some(p=>p.title===title));
  const positionManagerial = new Set(['مدیر تولید','سرپرست تولید']);
  const created = await prisma.$transaction(async tx=>{
    const unitRows = [...units];
    const positionRows = [...positions];
    for (const [i,name] of newUnits.entries()) {
      const row = await tx.organizationUnit.create({data:{name,code:`DEV-UNIT-${String(i+1).padStart(2,'0')}`,description:'واحد آزمایشی ایجادشده برای تست توسعه ERP',status:'ACTIVE'}});
      unitRows.push(row);
    }
    for (const [i,title] of newPositions.entries()) {
      const row = await tx.organizationPosition.create({data:{title,code:`DEV-POS-${String(i+1).padStart(2,'0')}`,description:'سمت آزمایشی ایجادشده برای تست توسعه ERP',isManagerial:positionManagerial.has(title),isActive:true}});
      positionRows.push(row);
    }
    return {unitRows,positionRows};
  });
  const effectiveUnits = created.unitRows;
  const effectivePositions = created.positionRows;
  const choices = PEOPLE.map((p,i)=>{
    const role = p.role.map(key=>safeRoles.find(r=>r.key===key)).find(Boolean);
    if (!role) throw new Error(`نقش مناسب برای ${p.position} تعریف نشده است. نقش‌های مورد انتظار: ${p.role.join(', ')}. نقش‌های موجود: ${safeRoles.map(r=>r.key).join(', ')}`);
    return {p,i,role:role!,unit:effectiveUnits.find(u=>u.name===p.unit)!,position:effectivePositions.find(x=>x.title===p.position)!};
  });
  const secrets = await Promise.all(choices.map(async ({p,i,role,unit,position})=>{
    const password = randomBytes(18).toString('base64url') + 'aA1!';
    return {p,i,role,unit,position,password,passwordHash:await hash(password,12)};
  }));
  await prisma.$transaction(async tx=>{
    for (const {p,i,role,unit,position,passwordHash} of secrets) {
      const username = `${PREFIX}${String(i+1).padStart(2,'0')}`;
      const user = await tx.user.create({data:{username,fullName:p.name,passwordHash,isActive:true,isSystem:false,accessLevel:'ERP'}});
      const application = await tx.candidateApplication.create({data:{
        applicationNumber:`DEV-STAFF-${String(i+1).padStart(2,'0')}`,
        userId:user.id,firstName:p.first,lastName:p.last,fatherName:'آزمایشی',
        birthCertificateNumber:`DEVBC${String(i+1).padStart(5,'0')}`,
        nationalId:`DEV-NID-${String(i+1).padStart(5,'0')}`,
        gender:p.gender,maritalStatus:i%3===0?'MARRIED':'SINGLE',
        nationality:'ایرانی',birthPlace:['تهران','کرج','اصفهان','شیراز','تبریز'][i%5],
        dateOfBirth:new Date(Date.UTC(1987+i, i%12, 4+i)),
        mobilePhone:`DEV-MOBILE-${String(i+1).padStart(3,'0')}`,
        address:`نشانی ساختگی برای تست ERP - رکورد ${i+1}`,
        militaryStatus:p.gender==='MALE'?'COMPLETED':'NOT_APPLICABLE',
        hasInsuranceHistory:i%2===0,currentlyEmployed:false,
        declarationAccepted:true,declarationTextVersion:'DEV_FIXTURE',
        declarationAcceptedAt:new Date(),
        initialStatus:'APPROVED',documentsStatus:'APPROVED',
        additionalNotes:'رکورد ساختگی توسعه؛ استخدام واقعی و بررسی مدارک انجام نشده است.',
      }});
      await tx.employeeProfile.create({data:{userId:user.id,candidateApplicationId:application.id,personnelCode:`DEV-${String(i+1).padStart(4,'0')}`,employmentStatus:'ACTIVE',hireDate:new Date(Date.UTC(2024+i%3,i%12,1+i))}});
      await tx.employeeAssignment.create({data:{userId:user.id,organizationUnitId:unit.id,positionId:position.id,responsibilityTitle:p.position,status:'ACTIVE',assignmentType:'PRIMARY',isPrimary:true,startDate:new Date(Date.UTC(2024+i%3,i%12,1+i)),roles:{create:{roleId:role.id,isActive:true}}}});
      await tx.userRole.create({data:{userId:user.id,roleId:role.id,isActive:true}});
    }
  },{timeout:120000});
  console.log('۱۰ کارمند ساختگی کامل در دیتابیس توسعه ایجاد شدند. اطلاعات ورود (فقط همین بار نمایش داده می‌شود):');
  console.table(secrets.map(({p,i,role,password})=>({username:`${PREFIX}${String(i+1).padStart(2,'0')}`,name:p.name,role:role.key,password})));
  console.log('رمزها را در مخزن Git یا فایل مشترک ذخیره نکنید.');
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>prisma.$disconnect());
