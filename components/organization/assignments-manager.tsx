"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Ban, BriefcaseBusiness, Building2, CalendarDays, CheckCircle2, ChevronDown, CircleAlert, LoaderCircle, MapPin, Plus, RefreshCw, Search, UserRound, Users, X } from "lucide-react";
import type { Assignment, Unit, Position, Location } from "./types";
import { api, req, list } from "./api";
import { Modal, Field, input, primary, secondary, ErrorBox } from "./ui";
import { JalaliDatePicker, getTehranTodayIso, tehranDateTimeToIso } from "./jalali-date-picker";

type AssignmentKind = "PRIMARY" | "SECONDARY" | "TEMPORARY" | "PROJECT";
type AssignmentRow = Omit<Assignment, "positionId"> & {
  positionId: string | null;
  responsibilityTitle?: string | null;
  managerAssignmentId?: string | null;
  managerAssignment?: { id: string; user?: { id: string; fullName?: string }; position?: { title: string } | null; responsibilityTitle?: string | null; organizationUnit?: { name: string } } | null;
};
type EmployeeSearchResult = { id: string; fullName: string; username: string };
type Props = { units: Unit[]; positions: Position[]; locations: Location[] };
const kinds: Record<AssignmentKind, string> = { PRIMARY: "اصلی", SECONDARY: "دوم", TEMPORARY: "موقت", PROJECT: "پروژه‌ای" };
const statuses: Record<string, string> = { ACTIVE: "فعال", ENDED: "پایان‌یافته", SUSPENDED: "معلق" };
const surface = "rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-sm";
const soft = "rounded-2xl border border-[var(--border)] bg-black/[0.025] p-4 dark:bg-white/[0.035]";
function titleOf(a: AssignmentRow) { return a.position?.title || a.responsibilityTitle || "بدون عنوان"; }
function managerOf(a: AssignmentRow) { return a.managerAssignment?.user?.fullName || a.managerAssignment?.position?.title || a.managerAssignment?.responsibilityTitle || "—"; }
function persianDate(value?: string | null) { if (!value) return "—"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long", day: "numeric" }).format(date); }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(x => x[0] || "").join(""); }

function AssignmentForm({ units, positions, locations, assignments, close, saved }: Props & { assignments: AssignmentRow[]; close: () => void; saved: () => void }) {
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [results, setResults] = useState<EmployeeSearchResult[]>([]);
  const [selected, setSelected] = useState<EmployeeSearchResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [unitId, setUnitId] = useState("");
  const [mode, setMode] = useState<"OFFICIAL" | "CUSTOM">("OFFICIAL");
  const [positionId, setPositionId] = useState("");
  const [responsibilityTitle, setResponsibilityTitle] = useState("");
  const [locationId, setLocationId] = useState("");
  const [managerAssignmentId, setManagerAssignmentId] = useState("");
  const [assignmentType, setAssignmentType] = useState<AssignmentKind>("PRIMARY");
  const [startDate, setStartDate] = useState(() => getTehranTodayIso());
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const q = employeeQuery.trim();
    if (selected || q.length < 2) { setResults([]); setSearching(false); setSearchError(""); return; }
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true); setSearchError("");
      try { const response = await api(`/api/organization/assignments/employees?q=${encodeURIComponent(q)}`, { signal: controller.signal }); if (active) setResults(list<EmployeeSearchResult>(response, "employees")); }
      catch (e) { if (active) { setResults([]); setSearchError(e instanceof Error ? e.message : "جست‌وجوی کارکنان انجام نشد."); } }
      finally { if (active) setSearching(false); }
    }, 350);
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [employeeQuery, selected]);
  const managers = useMemo(() => assignments.filter(a => a.status === "ACTIVE" && a.userId !== selected?.id), [assignments, selected]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!selected) return setError("کارمند را از نتایج جست‌وجو انتخاب کنید.");
    if (!unitId) return setError("واحد سازمانی را انتخاب کنید.");
    if (mode === "OFFICIAL" && !positionId) return setError("سمت رسمی را انتخاب کنید.");
    if (mode === "CUSTOM" && responsibilityTitle.trim().length < 2) return setError("عنوان مسئولیت سفارشی را وارد کنید.");
    if (!startDate) return setError("تاریخ شروع الزامی است.");
    if (endDate && endDate < startDate) return setError("تاریخ پایان نمی‌تواند قبل از شروع باشد.");
    setSaving(true);
    try {
      await api("/api/organization/assignments", req("POST", {
        userId: selected.id, organizationUnitId: unitId,
        positionId: mode === "OFFICIAL" ? positionId : null,
        responsibilityTitle: mode === "CUSTOM" ? responsibilityTitle.trim() : null,
        locationId: locationId || null, managerAssignmentId: managerAssignmentId || null,
        assignmentType, isPrimary: assignmentType === "PRIMARY",
        startDate: tehranDateTimeToIso(startDate, "00:00")!,
        endDate: endDate ? tehranDateTimeToIso(endDate, "23:59:59", true) : null,
        notes: notes.trim() || null,
      }));
      saved(); close();
    } catch (e) { setError(e instanceof Error ? e.message : "ثبت انتصاب انجام نشد."); }
    finally { setSaving(false); }
  }
  return <Modal title="ثبت انتصاب جدید" close={close}>
    <form dir="rtl" onSubmit={submit} className="grid gap-5 pb-2">
      <div className="rounded-2xl bg-[var(--primary)]/10 p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-[var(--primary)]/15 p-3 text-[var(--primary)]"><Users size={22}/></div><div><p className="font-bold">تعریف مسئولیت سازمانی</p><p className="mt-1 text-xs text-[var(--muted)]">کارمند، سمت، واحد و بازه زمانی مسئولیت را مشخص کنید.</p></div></div></div>
      <section className={soft}><h3 className="mb-4 flex items-center gap-2 font-bold"><UserRound size={18} className="text-[var(--primary)]"/> ۱. انتخاب کارمند</h3>
        {!selected ? <><Field label="جست‌وجوی کارمند"><div className="relative"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input className={`${input} pr-10`} value={employeeQuery} onChange={e=>setEmployeeQuery(e.target.value)} placeholder="نام، نام خانوادگی یا نام کاربری..." autoComplete="off" disabled={saving}/></div></Field>
          {searching && <p className="mt-3 text-xs text-[var(--muted)]">در حال جست‌وجو...</p>}{searchError && <p className="mt-3 text-xs text-red-500">{searchError}</p>}
          {!!results.length && <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--border)]">{results.map(employee=><button type="button" key={employee.id} onClick={()=>{setSelected(employee);setEmployeeQuery(employee.fullName);setResults([]);setError("");}} className="flex w-full items-center gap-3 border-b border-[var(--border)] p-3 text-right last:border-0 hover:bg-[var(--primary)]/10"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">{initials(employee.fullName)}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{employee.fullName}</span><span className="block truncate text-xs text-[var(--muted)]">{employee.username}</span></span><span className="text-xs text-[var(--primary)]">انتخاب</span></button>)}</div>}
          {!searching && !searchError && employeeQuery.trim().length >= 2 && results.length === 0 && <p className="mt-3 text-xs text-[var(--muted)]">نتیجه‌ای پیدا نشد.</p>}
          <p className="mt-3 text-xs text-[var(--muted)]">حداقل دو حرف وارد کنید.</p></> : <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3"><span className="flex size-11 items-center justify-center rounded-xl bg-emerald-500/10 font-bold text-emerald-600">{initials(selected.fullName)}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold">{selected.fullName}</p><p className="text-xs text-[var(--muted)]">{selected.username}</p></div><CheckCircle2 size={18} className="text-emerald-600"/><button type="button" title="تغییر کارمند" onClick={()=>{setSelected(null);setEmployeeQuery("");setManagerAssignmentId("");}} disabled={saving} className="rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/5"><X size={17}/></button></div>}
      </section>
      <section className={soft}><h3 className="mb-4 flex items-center gap-2 font-bold"><Building2 size={18} className="text-[var(--primary)]"/> ۲. جایگاه و مسئولیت</h3>
        <div className="grid gap-4"><Field label="واحد سازمانی"><select required className={input} value={unitId} onChange={e=>setUnitId(e.target.value)}><option value="">انتخاب واحد سازمانی</option>{units.filter(u=>u.status==="ACTIVE").map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <div><p className="mb-2 text-sm font-medium">شیوه تعریف مسئولیت</p><div className="grid grid-cols-2 gap-2">{(["OFFICIAL","CUSTOM"] as const).map(value=><button type="button" key={value} onClick={()=>{setMode(value);setPositionId("");setResponsibilityTitle("");}} className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-semibold transition ${mode===value?"border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]":"border-[var(--border)] hover:bg-black/5 dark:hover:bg-white/5"}`}>{value==="OFFICIAL"?<BriefcaseBusiness size={17}/>:<Plus size={17}/>} {value==="OFFICIAL"?"سمت رسمی":"مسئولیت سفارشی"}</button>)}</div></div>
        {mode==="OFFICIAL"?<Field label="سمت سازمانی"><select required className={input} value={positionId} onChange={e=>setPositionId(e.target.value)}><option value="">انتخاب سمت</option>{positions.filter(p=>p.isActive).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select></Field>:<Field label="عنوان مسئولیت سفارشی"><input required maxLength={120} className={input} value={responsibilityTitle} onChange={e=>setResponsibilityTitle(e.target.value)} placeholder="مثلاً مسئول کنترل کیفیت"/></Field>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="نوع انتصاب"><select className={input} value={assignmentType} onChange={e=>setAssignmentType(e.target.value as AssignmentKind)}>{Object.entries(kinds).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></Field><Field label="محل خدمت"><select className={input} value={locationId} onChange={e=>setLocationId(e.target.value)}><option value="">بدون محل مشخص</option>{locations.filter(l=>l.status==="ACTIVE").map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></Field></div>
        <Field label="مدیر مستقیم"><select className={input} value={managerAssignmentId} onChange={e=>setManagerAssignmentId(e.target.value)}><option value="">بدون مدیر مستقیم</option>{managers.map(m=><option key={m.id} value={m.id}>{m.user?.fullName || m.userId} — {titleOf(m)} — {m.organizationUnit?.name || ""}</option>)}</select></Field>
        {assignmentType==="PRIMARY"&&<p className="flex gap-2 rounded-xl bg-blue-500/10 p-3 text-xs leading-6 text-blue-700 dark:text-blue-300"><CircleAlert size={17} className="mt-1 shrink-0"/> هر کارمند فقط یک مسئولیت اصلی فعال می‌تواند داشته باشد.</p>}</div>
      </section>
      <section className={soft}><h3 className="mb-4 flex items-center gap-2 font-bold"><CalendarDays size={18} className="text-[var(--primary)]"/> ۳. زمان‌بندی و توضیحات</h3><div className="grid gap-4 sm:grid-cols-2"><Field label="تاریخ شروع (شمسی)"><JalaliDatePicker value={startDate} onChange={setStartDate}/></Field><Field label="تاریخ پایان (شمسی، اختیاری)"><JalaliDatePicker value={endDate} min={startDate} onChange={setEndDate}/></Field></div><div className="mt-4"><Field label="توضیحات"><textarea rows={3} maxLength={2000} className={input} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="توضیحات تکمیلی درباره این مسئولیت..."/></Field></div></section>
      {error&&<ErrorBox>{error}</ErrorBox>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4"><button type="button" className={secondary} onClick={close} disabled={saving}>انصراف</button><button type="submit" className={primary} disabled={saving || !selected}>{saving?<><LoaderCircle size={16} className="ml-2 inline animate-spin"/>در حال ثبت...</>:<><Plus size={16} className="ml-2 inline"/>ثبت انتصاب</>}</button></div>
    </form>
  </Modal>;
}

export default function AssignmentsManager({ units, positions, locations }: Props) {
  const [rows, setRows] = useState<AssignmentRow[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [endingId, setEndingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("ALL");
  const load = useCallback(async () => { setLoading(true); try { const response = await api("/api/organization/assignments"); setRows(list<AssignmentRow>(response,"assignments")); setError(""); } catch(e) { setError(e instanceof Error?e.message:"دریافت انتصاب‌ها ناموفق بود."); } finally { setLoading(false); } }, []);
  useEffect(()=>{void load();},[load]);
  const active = rows.filter(r=>r.status==="ACTIVE");
  const stats = [{label:"انتصاب‌های فعال",value:active.length,icon:Users},{label:"مسئولیت‌های اصلی",value:active.filter(r=>r.isPrimary).length,icon:BriefcaseBusiness},{label:"مسئولیت‌های دیگر",value:active.filter(r=>!r.isPrimary).length,icon:Building2},{label:"کل سوابق انتصاب",value:rows.length,icon:CalendarDays}];
  const filtered = useMemo(()=>rows.filter(r=>{
    if(filter!=="ALL" && r.status!==filter) return false;
    const text=[r.user?.fullName,r.user?.username,r.userId,r.organizationUnit?.name,units.find(u=>u.id===r.organizationUnitId)?.name,titleOf(r),managerOf(r)].join(" ").toLocaleLowerCase("fa-IR");
    return text.includes(query.trim().toLocaleLowerCase("fa-IR"));
  }),[rows,filter,query,units]);
  async function endAssignment(row:AssignmentRow) {
    if(endingId) return;
    const employee=row.user?.fullName || row.user?.username || row.userId;
    if(!window.confirm(`آیا از پایان انتصاب «${titleOf(row)}» برای «${employee}» مطمئن هستید؟\nسوابق انتصاب حفظ خواهد شد.`)) return;
    setEndingId(row.id);setError("");
    try { await api(`/api/organization/assignments/${encodeURIComponent(row.id)}`,{method:"DELETE"}); await load(); }
    catch(e){setError(e instanceof Error?e.message:"پایان انتصاب ناموفق بود.");}
    finally{setEndingId(null);}
  }
  return <section dir="rtl" className="grid gap-5 text-[var(--foreground)]">
    <header className={`${surface} relative overflow-hidden p-5 md:p-7`}><div className="pointer-events-none absolute -left-14 -top-16 size-56 rounded-full bg-[var(--primary)]/10 blur-3xl"/><div className="relative flex flex-wrap items-center justify-between gap-5"><div className="flex items-start gap-4"><div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]"><Users size={28}/></div><div><p className="mb-1 text-xs font-semibold text-[var(--primary)]">مدیریت منابع انسانی / تشکیلات</p><h2 className="text-xl font-black md:text-2xl">انتصاب و مسئولیت کارکنان</h2><p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">مسئولیت‌های اصلی، دوم، موقت و پروژه‌ای کارکنان را در واحدهای مختلف مدیریت کنید.</p></div></div><div className="flex flex-wrap gap-2"><button type="button" className={`${secondary} inline-flex items-center gap-2`} onClick={()=>void load()} disabled={loading}><RefreshCw size={16} className={loading?"animate-spin":""}/>بروزرسانی</button><button type="button" className={`${primary} inline-flex items-center gap-2`} onClick={()=>setOpen(true)}><Plus size={17}/>انتصاب جدید</button></div></div></header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{stats.map(s=><article key={s.label} className={`${surface} p-4 md:p-5`}><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium text-[var(--muted)] md:text-sm">{s.label}</span><span className="rounded-xl bg-[var(--primary)]/10 p-2 text-[var(--primary)]"><s.icon size={18}/></span></div><p className="mt-3 text-2xl font-black tabular-nums md:text-3xl">{s.value.toLocaleString("fa-IR")}</p></article>)}</div>
    {error&&<ErrorBox>{error}</ErrorBox>}
    <div className={`${surface} overflow-hidden`}><div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] p-4 md:p-5"><div><h3 className="font-bold">فهرست انتصاب‌ها</h3><p className="mt-1 text-xs text-[var(--muted)]">{filtered.length.toLocaleString("fa-IR")} مورد مطابق فیلترها</p></div><div className="flex w-full flex-wrap gap-2 md:w-auto"><div className="relative min-w-[180px] flex-1 md:w-72"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"/><input className={`${input} w-full pr-10`} value={query} onChange={e=>setQuery(e.target.value)} placeholder="جست‌وجوی کارمند، واحد یا سمت..." aria-label="جست‌وجوی انتصاب‌ها"/></div><div className="relative"><select className={`${input} min-w-32 appearance-none pl-8`} value={filter} onChange={e=>setFilter(e.target.value)} aria-label="فیلتر وضعیت"><option value="ALL">همه وضعیت‌ها</option><option value="ACTIVE">فعال</option><option value="ENDED">پایان‌یافته</option><option value="SUSPENDED">معلق</option></select><ChevronDown size={15} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[var(--muted)]"/></div></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[950px] text-right text-sm"><thead className="bg-black/[0.035] text-xs text-[var(--muted)] dark:bg-white/[0.035]"><tr><th className="p-4 font-semibold">کارمند</th><th className="p-4 font-semibold">جایگاه سازمانی</th><th className="p-4 font-semibold">نوع مسئولیت</th><th className="p-4 font-semibold">مدیر مستقیم</th><th className="p-4 font-semibold">تاریخ شروع</th><th className="p-4 font-semibold">وضعیت</th><th className="p-4 font-semibold">عملیات</th></tr></thead><tbody>{filtered.map(row=>{const employee=row.user?.fullName || row.user?.username || row.userId;return <tr key={row.id} className="border-t border-[var(--border)] transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.025]"><td className="p-4"><div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-xs font-bold text-[var(--primary)]">{initials(employee)}</span><div className="min-w-0"><p className="font-bold">{employee}</p><p className="mt-1 max-w-44 truncate text-xs text-[var(--muted)]" title={row.userId}>{row.user?.username || row.userId}</p></div></div></td><td className="p-4"><p className="font-semibold">{titleOf(row)}</p><p className="mt-1 flex items-center gap-1 text-xs text-[var(--muted)]"><Building2 size={12}/>{row.organizationUnit?.name || units.find(u=>u.id===row.organizationUnitId)?.name || "—"}</p>{!row.positionId&&<span className="mt-1 inline-block text-[11px] text-[var(--primary)]">مسئولیت سفارشی</span>}</td><td className="p-4"><span className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs">{kinds[row.assignmentType as AssignmentKind] || row.assignmentType}</span></td><td className="p-4 text-[var(--muted)]">{managerOf(row)}</td><td className="p-4 text-xs tabular-nums text-[var(--muted)]">{persianDate(row.startDate)}</td><td className="p-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${row.status==="ACTIVE"?"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400":row.status==="SUSPENDED"?"bg-amber-500/10 text-amber-600":"bg-black/5 text-[var(--muted)] dark:bg-white/10"}`}><span className="size-1.5 rounded-full bg-current"/>{statuses[row.status] || row.status}</span></td><td className="p-4">{row.status==="ACTIVE"?<button type="button" disabled={endingId!==null} onClick={()=>void endAssignment(row)} className="inline-flex items-center gap-1.5 rounded-xl border border-red-500/25 px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-50">{endingId===row.id?<LoaderCircle size={14} className="animate-spin"/>:<Ban size={14}/>} {endingId===row.id?"در حال ثبت...":"پایان انتصاب"}</button>:<span className="text-xs text-[var(--muted)]">—</span>}</td></tr>})}</tbody></table></div>
      {!loading&&filtered.length===0&&<div className="flex flex-col items-center gap-3 px-5 py-16 text-center"><span className="rounded-2xl bg-[var(--primary)]/10 p-4 text-[var(--primary)]"><Users size={27}/></span><p className="font-bold">{rows.length?"موردی با این فیلتر پیدا نشد":"هنوز انتصابی ثبت نشده است"}</p><p className="text-sm text-[var(--muted)]">{rows.length?"عبارت جست‌وجو یا وضعیت را تغییر دهید.":"برای شروع، یک انتصاب جدید تعریف کنید."}</p>{rows.length>0&&<button className={secondary} type="button" onClick={()=>{setQuery("");setFilter("ALL");}}>پاک کردن فیلترها</button>}</div>}
      {loading&&<div className="flex items-center justify-center gap-3 p-12 text-sm text-[var(--muted)]"><LoaderCircle size={20} className="animate-spin"/>در حال دریافت اطلاعات...</div>}
      <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">سوابق انتصاب‌ها پس از پایان مسئولیت حفظ می‌شوند.</div>
    </div>
    {open&&<AssignmentForm units={units} positions={positions} locations={locations} assignments={rows} close={()=>setOpen(false)} saved={()=>void load()}/>}
  </section>;
}
