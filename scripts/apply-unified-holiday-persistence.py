from pathlib import Path
import shutil, sys, re
root=Path.cwd()
files={
 'prisma/schema.prisma': [('  workedMinutes Int @default(0)\n','  workedMinutes Int @default(0)\n  holidayWorkMinutes Int @default(0)\n')],
 'modules/attendance/monthly-work-save.ts': [
 ('        workedMinutes: preview.totals.workedMinutes,\n','        workedMinutes: preview.totals.workedMinutes,\n        holidayWorkMinutes: preview.totals.holidayWorkMinutes,\n'),
 ('        requiredMinutes: true, workedMinutes: true,\n','        requiredMinutes: true, workedMinutes: true, holidayWorkMinutes: true,\n')],
 'app/api/attendance/hr/monthly/route.ts': [
 ('          requiredMinutes: true, workedMinutes: true, approvedLeaveMinutes: true,','          requiredMinutes: true, workedMinutes: true, holidayWorkMinutes: true, approvedLeaveMinutes: true,')],
 'app/(erp)/hr/attendance/monthly/page.tsx': []

}
# guard: only schema's MonthlyWorkSummary, not another workedMinutes
schema=root/'prisma/schema.prisma'
if not schema.exists(): sys.exit('Missing prisma/schema.prisma')
source=schema.read_text(encoding='utf-8')
start=source.find('model MonthlyWorkSummary {')
if start<0: sys.exit('MonthlyWorkSummary model not found')
end=source.find('\n}',start)
if end<0: sys.exit('Invalid MonthlyWorkSummary model')
block=source[start:end]
if 'holidayWorkMinutes' in block: print('Schema already has holidayWorkMinutes')
else:
 old,new=files['prisma/schema.prisma'][0]
 match=re.search(r'(?m)^(?P<indent>\s*)workedMinutes\s+Int\s+@default\(0\)\s*$',block)
 if not match: sys.exit('Unexpected schema model: workedMinutes not found; no changes applied')
 if len(re.findall(r'(?m)^\s*workedMinutes\s+Int\s+@default\(0\)\s*$',block))!=1: sys.exit('Ambiguous workedMinutes; no changes applied')
 indent=match.group('indent')
 line=match.group(0)
 replacement=line+'\n'+indent+'holidayWorkMinutes Int @default(0)'
 files['prisma/schema.prisma']=[(block,block.replace(line,replacement,1))]
# preflight every file before touching any
updates={}
for rel,replacements in files.items():
 p=root/rel
 if not p.exists(): sys.exit(f'Missing {rel}; no changes applied')
 s=p.read_text(encoding='utf-8'); t=s
 for old,new in replacements:
  if old in t:
   if rel!='modules/attendance/monthly-work-save.ts' and t.count(old)!=1: sys.exit(f'Ambiguous target in {rel}: {old[:60]}')
   t=t.replace(old,new)
  elif new in t: pass
  else: sys.exit(f'Unexpected source in {rel}: {old[:65]}; no changes applied')
 updates[p]=t
# Flexible page update: avoid exact whitespace/layout assumptions.
page=root/'app/(erp)/hr/attendance/monthly/page.tsx'
s=updates[page]
if 'holidayWorkMinutes' not in s:
    # Insert field into the Row type after the workedMinutes declaration.
    row=re.search(r'(?s)\btype\s+Row\s*=\s*\{.*?\}',s)
    if not row: sys.exit('Cannot locate Row type in monthly page; no changes applied')
    row_text=row.group(0)
    match=re.search(r'\bworkedMinutes\s*:\s*number\s*;',row_text)
    if not match: sys.exit('Cannot locate workedMinutes in Row type; no changes applied')
    new_row=row_text[:match.end()]+' holidayWorkMinutes: number;'+row_text[match.end():]
    s=s[:row.start()]+new_row+s[row.end():]
if 'تعطیل‌کاری (شامل جمعه)' not in s:
    # Find header text, regardless of the surrounding formatting.
    hits=list(re.finditer(r'([\"\'])کارکرد\1',s))
    if len(hits)!=1: sys.exit('Cannot uniquely locate work header; no changes applied')
    m=hits[0]
    s=s[:m.end()]+', "تعطیل‌کاری (شامل جمعه)"'+s[m.end():]
if 'minuteLabel(row.holidayWorkMinutes)' not in s:
    # Actual page uses nested span inside a td and the variable is named row.
    pattern = r'(?s)<td\b[^>]*>\s*<span\b[^>]*>\s*\{minuteLabel\(row\.workedMinutes\)\}\s*</span>\s*</td>'
    hits=list(re.finditer(pattern,s))
    if len(hits)!=1: sys.exit('Cannot uniquely locate workedMinutes table cell in current page; no changes applied')
    m=hits[0]
    cell='''''''''
                      <td className="px-4 py-4 font-medium text-amber-700 group-data-[theme=dark]/theme:text-amber-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.holidayWorkMinutes)}
                        </span>
                      </td>''''''''' 
    s=s[:m.end()]+cell+s[m.end():]
updates[page]=s
# ensure calculation output exists
agg=root/'modules/attendance/monthly-work-aggregation.ts'
if not agg.exists() or 'holidayWorkMinutes' not in agg.read_text(encoding='utf-8'):
 sys.exit('Unified holiday calculation is missing. Install previous unified holiday package first. No changes applied.')
for p,t in updates.items():
 if p.read_text(encoding='utf-8')!=t:
  bak=p.with_name(p.name+'.before-holiday-persistence.bak')
  if not bak.exists(): shutil.copy2(p,bak)
  p.write_text(t,encoding='utf-8'); print('Updated',p.relative_to(root))
 else: print('Already updated',p.relative_to(root))
print('DONE: Next run prisma migrate dev, prisma generate, tests, tsc. No database modifications were performed by this script.')
