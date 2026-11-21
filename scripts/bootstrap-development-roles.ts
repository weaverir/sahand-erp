/** Create development job roles using ONLY permission keys already present in Sahand ERP. */
import { prisma } from '../libs/prisma';

const definitions = [
  {key:'employee', name:'کارمند', patterns:[/^attendance\.attendance\.view$/, /^organization\.chart\.view$/]},
  {key:'production_manager', name:'مدیر تولید', patterns:[/^production\./, /^attendance\.shift\.view$/]},
  {key:'production_supervisor', name:'سرپرست تولید', patterns:[/^production\./, /^attendance\.shift\.view$/]},
  {key:'production_operator', name:'اپراتور تولید', patterns:[/^production\..*\.view$/, /^organization\.chart\.view$/]},
  {key:'warehouse_staff', name:'انباردار', patterns:[/^warehouse\./]},
  {key:'accountant', name:'حسابدار', patterns:[/^accounting\./, /^payroll\./]},
  {key:'sales_staff', name:'کارشناس فروش', patterns:[/^sales\./]},
  {key:'quality_inspector', name:'بازرس کیفیت', patterns:[/^quality\./]},
] as const;

async function main() {
  if (!process.argv.includes('--confirm-development-roles')) throw new Error('پرچم تأیید لازم است.');
  const raw=process.env.DATABASE_URL;
  if(!raw) throw new Error('DATABASE_URL تعریف نشده است.');
  const url=new URL(raw);
  if(url.pathname!=='/sahand_erp' || !['localhost','127.0.0.1','[::1]'].includes(url.hostname)) throw new Error('فقط دیتابیس توسعه محلی sahand_erp مجاز است.');
  const [permissions, existing]=await Promise.all([
    prisma.permission.findMany({select:{id:true,key:true}}),
    prisma.role.findMany({select:{key:true,isActive:true}}),
  ]);
  const plans=definitions.map(d=>({...d, matching:permissions.filter(p=>d.patterns.some(pattern=>pattern.test(p.key)))}));
  const missing=plans.filter(p=>p.matching.length===0);
  if(missing.length){
    console.error('مجوزهای موجود:',permissions.map(p=>p.key).join('، '));
    throw new Error('برای نقش‌های زیر هیچ مجوز متناسبی در دیتابیس موجود نیست؛ هیچ تغییری انجام نشد: '+missing.map(x=>x.key).join(', '));
  }
  const inactive=existing.filter(r=>!r.isActive && plans.some(p=>p.key===r.key));
  if(inactive.length) throw new Error('نقش غیرفعال موجود است؛ برای جلوگیری از فعال‌سازی ناخواسته عملیات متوقف شد: '+inactive.map(x=>x.key).join(', '));
  console.log('برنامه اختصاص مجوزها:');
  for(const p of plans) console.log(`${p.key}: ${p.matching.map(x=>x.key).join(', ')}`);
  await prisma.$transaction(async tx=>{
    for(const p of plans){
      const role=await tx.role.upsert({where:{key:p.key},create:{key:p.key,name:p.name,description:'نقش توسعه‌ای؛ مجوزها باید پیش از بهره‌برداری بازبینی شوند',isSystem:false,isActive:true},update:{}});
      // Existing roles are left unchanged; no silent permission escalation.
      if(existing.some(x=>x.key===p.key)) continue;
      for(const permission of p.matching){
        await tx.rolePermission.create({data:{roleId:role.id,permissionId:permission.id,isAllowed:true,scope:'OWN'}});
      }
    }
  });
  console.log('نقش‌ها ایجاد شدند. همه مجوزهای جدید با دامنه OWN ثبت شده‌اند.');
  console.log('توجه: نقش‌های مدیریتی برای گردش تأیید نیازمند بازبینی دامنه و سیاست مجوز هستند؛ صرف ایجاد نقش اختیار تأیید نمی‌دهد.');
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>prisma.$disconnect());
