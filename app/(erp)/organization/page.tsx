"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Building2, BriefcaseBusiness, Users, GitBranch, ShieldCheck, History,
  Plus, RefreshCw, ChevronLeft, Network, MapPin, Activity, Layers3,
  Pencil, ArrowLeftRight, Search, X, AlertCircle,
  Info, UserRoundCog, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { api, list } from "@/components/organization/api";
import type { Unit, Position, Assignment, Location } from "@/components/organization/types";
import OrganizationTree from "@/components/organization/organization-tree";
import UnitDialog from "@/components/organization/unit-dialog";
import MoveUnitDialog from "@/components/organization/move-unit-dialog";
import PositionsManager from "@/components/organization/positions-manager";
import AssignmentsManager from "@/components/organization/assignments-manager";
import RelationshipsManager from "@/components/organization/relationships-manager";
import AssignmentAccessManager from "@/components/organization/assignment-access-manager";
import AuditLogPanel from "@/components/organization/audit-log-panel";

type Tab = "chart" | "positions" | "assignments" | "relationships" | "access" | "audit";
const nav: { id: Tab; label: string; description: string; icon: LucideIcon }[] = [
  { id: "chart", label: "چارت سازمانی", description: "واحدها و سلسله‌مراتب", icon: Network },
  { id: "positions", label: "سمت‌های سازمانی", description: "تعریف و مدیریت جایگاه‌ها", icon: BriefcaseBusiness },
  { id: "assignments", label: "انتصاب کارکنان", description: "تخصیص افراد به سمت‌ها", icon: Users },
  { id: "relationships", label: "روابط سازمانی", description: "ارتباط میان انتصاب‌ها", icon: GitBranch },
  { id: "access", label: "سطوح دسترسی", description: "مجوزهای اختصاصی انتصاب", icon: ShieldCheck },
  { id: "audit", label: "تاریخچه تغییرات", description: "سوابق و ردپای عملیات", icon: History },
];

const panel = "rounded-[24px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_40px_-28px_rgba(15,23,42,.35)]";
const subtle = "text-[var(--muted-foreground)]";
const outlineButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-semibold transition hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-600/15 transition hover:bg-blue-700 disabled:opacity-50";

export default function OrganizationPage() {
  const [tab, setTab] = useState<Tab>("chart");
  const [tree, setTree] = useState<Unit[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Unit | null>(null);
  const [unitOpen, setUnitOpen] = useState(false);
  const [editing, setEditing] = useState<Unit | undefined>();
  const [moving, setMoving] = useState<Unit | null>(null);
  const [access, setAccess] = useState<Assignment | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [unitQuery, setUnitQuery] = useState("");
  const [accessQuery, setAccessQuery] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(true);

  const flatten = useCallback((xs: Unit[]): Unit[] => xs.flatMap((x) => [x, ...flatten(x.children || [])]), []);
  const refresh = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const [c, p, a, l] = await Promise.all([
        api<any>("/api/organization/chart"),
        api<any>("/api/organization/positions"),
        api<any>("/api/organization/assignments"),
        api<any>("/api/organization/locations"),
      ]);
      const ct: Unit[] = c?.chart || c?.data?.chart || list<Unit>(c, "units");
      const flat = flatten(ct);
      setTree(ct);
      setUnits(flat);
      setPositions(list<Position>(p, "positions"));
      setAssignments(list<Assignment>(a, "assignments"));
      setLocations(list<Location>(l, "locations"));
      setSelected((old) => old ? flat.find((x) => x.id === old.id) || null : ct[0] || null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "دریافت اطلاعات سازمان ناموفق بود");
    } finally {
      setBusy(false);
    }
  }, [flatten]);
  useEffect(() => { void refresh(); }, [refresh]);

  const stats = useMemo(() => [
    { label: "واحدهای سازمانی", value: units.length, icon: Building2, color: "text-blue-600", tint: "bg-blue-500/10", note: "در ساختار سازمان" },
    { label: "سمت‌های فعال", value: positions.filter((x) => x.isActive).length, icon: BriefcaseBusiness, color: "text-violet-600", tint: "bg-violet-500/10", note: "جایگاه تعریف‌شده" },
    { label: "انتصاب‌های فعال", value: assignments.filter((x) => x.status === "ACTIVE").length, icon: UserRoundCog, color: "text-emerald-600", tint: "bg-emerald-500/10", note: "مسئولیت‌های جاری" },
    { label: "محل‌های سازمان", value: locations.length, icon: MapPin, color: "text-amber-600", tint: "bg-amber-500/10", note: "مکان ثبت‌شده" },
  ], [units, positions, assignments, locations]);
  const current = nav.find((x) => x.id === tab)!;
  const filteredUnits = useMemo(() => units.filter((u) => `${u.name} ${u.code}`.toLocaleLowerCase().includes(unitQuery.trim().toLocaleLowerCase())), [units, unitQuery]);
  const filteredAssignments = useMemo(() => assignments.filter((a) => `${a.user?.fullName || ""} ${a.userId} ${a.position?.title || ""} ${a.organizationUnit?.name || ""}`.toLocaleLowerCase().includes(accessQuery.trim().toLocaleLowerCase())), [assignments, accessQuery]);
  const selectUnit = (unit: Unit) => { setSelected(unit); setDetailsOpen(true); };
  const createRoot = () => { setSelected(null); setEditing(undefined); setUnitOpen(true); };
  const createChild = (unit: Unit) => { setSelected(unit); setEditing(undefined); setUnitOpen(true); };
  const editUnit = (unit: Unit) => { setEditing(unit); setUnitOpen(true); };

  return (
    <main dir="rtl" className="relative mx-auto min-h-screen max-w-[1700px] space-y-5 p-3 text-[var(--foreground)] sm:p-5 xl:p-7">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-bl from-blue-500/[0.07] via-violet-500/[0.025] to-transparent" />

      <header className="flex flex-col justify-between gap-5 rounded-[28px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-7 lg:flex-row lg:items-center">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"><Network size={28} /></div>
          <div>
            <div className={`mb-2 flex flex-wrap items-center gap-1.5 text-xs ${subtle}`}><span>مدیریت سازمان</span><ChevronLeft size={13}/><span>ساختار و تشکیلات</span></div>
            <h1 className="text-xl font-black tracking-tight sm:text-2xl xl:text-[28px]">ساختار و تشکیلات سازمانی</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-7 ${subtle}`}>نمای یکپارچه از واحدها، جایگاه‌های شغلی، انتصاب کارکنان و مجوزهای سازمانی</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void refresh()} disabled={busy} className={outlineButton}><RefreshCw size={16} className={busy ? "animate-spin" : ""} /> بروزرسانی</button>
          <button type="button" onClick={createRoot} className={primaryButton}><Plus size={17}/> واحد سازمانی جدید</button>
        </div>
      </header>

      <section aria-label="آمار سازمان" className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {stats.map((s) => <article key={s.label} className={`${panel} flex min-w-0 flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center sm:p-5`}>
          <div className="min-w-0"><p className={`text-xs font-semibold sm:text-sm ${subtle}`}>{s.label}</p><p className="mt-2 text-2xl font-black tabular-nums sm:text-3xl">{s.value.toLocaleString("fa-IR")}</p><p className={`mt-1 hidden text-xs sm:block ${subtle}`}>{s.note}</p></div>
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${s.tint} ${s.color}`}><s.icon size={22}/></span>
        </article>)}
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[245px_minmax(0,1fr)]">
        <aside className={`${panel} overflow-hidden p-2 xl:sticky xl:top-5`}>
          <div className="hidden px-3 pb-3 pt-4 xl:block"><p className="text-xs font-bold tracking-wide text-[var(--muted-foreground)]">بخش‌های مدیریت سازمان</p></div>
          <nav aria-label="بخش‌های سازمان" className="flex gap-1.5 overflow-x-auto p-1 xl:flex-col xl:overflow-visible">
            {nav.map((n) => <button key={n.id} type="button" onClick={() => setTab(n.id)} aria-current={tab === n.id ? "page" : undefined} className={`group flex shrink-0 items-center gap-3 rounded-2xl px-3.5 py-3 text-right transition xl:w-full ${tab === n.id ? "bg-blue-600 text-white shadow-md shadow-blue-500/15" : "hover:bg-[var(--muted)]"}`}>
              <n.icon size={19} className="shrink-0"/><span className="min-w-0"><span className="block whitespace-nowrap text-sm font-bold">{n.label}</span><span className={`mt-0.5 hidden text-[11px] xl:block ${tab === n.id ? "text-blue-100" : subtle}`}>{n.description}</span></span>
              {tab === n.id && <ChevronLeft size={15} className="mr-auto hidden xl:block"/>}
            </button>)}
          </nav>
          <div className="mx-2 mb-2 mt-3 hidden rounded-2xl border border-blue-500/15 bg-blue-500/5 p-3 xl:flex xl:items-start xl:gap-2"><Info size={17} className="mt-0.5 shrink-0 text-blue-600"/><p className={`text-xs leading-6 ${subtle}`}>تغییرات واحدها و دسترسی‌ها طبق مجوزهای ثبت‌شده در سامانه انجام می‌شوند.</p></div>
        </aside>

        <div className="min-w-0 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 px-1"><div className="flex items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><current.icon size={19}/></span><div><h2 className="text-base font-black sm:text-lg">{current.label}</h2><p className={`text-xs ${subtle}`}>{current.description}</p></div></div>{tab === "chart" && <span className={`inline-flex items-center gap-1.5 text-xs ${subtle}`}><Activity size={14}/> {units.length.toLocaleString("fa-IR")} واحد ثبت‌شده</span>}</div>
          {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-600"><AlertCircle size={18} className="shrink-0"/>{error}</div>}
          {busy ? <div className={`${panel} flex min-h-[360px] flex-col items-center justify-center gap-4 p-10`}><RefreshCw size={30} className="animate-spin text-blue-600"/><p className={`text-sm ${subtle}`}>در حال دریافت اطلاعات سازمان...</p></div> : <>
            {tab === "chart" && <div className="grid items-start gap-4 2xl:grid-cols-[minmax(0,1fr)_340px]">
              <section className={`${panel} min-w-0 overflow-hidden`}>
                <div className="flex flex-col justify-between gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:p-5"><div><h3 className="flex items-center gap-2 text-sm font-black"><Layers3 size={18} className="text-blue-600"/> نقشه ساختار سازمان</h3><p className={`mt-1 text-xs leading-6 ${subtle}`}>واحد موردنظر را انتخاب کنید تا جزئیات آن نمایش داده شود.</p></div><button type="button" onClick={createRoot} className={outlineButton}><Plus size={16}/> افزودن واحد ریشه</button></div>
                <div className="p-3 sm:p-5"><OrganizationTree units={tree} selected={selected?.id} onSelect={selectUnit} onEdit={editUnit} onMove={setMoving} onAdd={createChild}/></div>
              </section>
              <div className="space-y-4">
                <section className={`${panel} overflow-hidden`}>
                  <div className="flex items-center justify-between border-b border-[var(--border)] p-4"><h3 className="flex items-center gap-2 text-sm font-black"><Building2 size={17} className="text-blue-600"/> اطلاعات واحد انتخاب‌شده</h3><button type="button" onClick={() => setDetailsOpen((v) => !v)} className="rounded-lg p-2 hover:bg-[var(--muted)]" aria-label={detailsOpen ? "بستن جزئیات" : "نمایش جزئیات"}>{detailsOpen ? <PanelRightClose size={18}/> : <PanelRightOpen size={18}/>}</button></div>
                  {detailsOpen && (selected ? <div className="space-y-4 p-4"><div className="flex items-start gap-3"><span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><Building2 size={23}/></span><div className="min-w-0"><h4 className="break-words text-lg font-black">{selected.name}</h4><p dir="ltr" className={`mt-1 text-right font-mono text-xs ${subtle}`}>{selected.code}</p></div></div><p className={`text-sm leading-7 ${subtle}`}>{selected.description || "توضیحی برای این واحد ثبت نشده است."}</p><div className="grid grid-cols-3 gap-2"><MiniStat label="وضعیت" value={selected.status === "ACTIVE" ? "فعال" : "غیرفعال"}/><MiniStat label="زیرواحد" value={(selected.children?.length || 0).toLocaleString("fa-IR")}/><MiniStat label="انتصاب" value={(selected.assignments?.length || 0).toLocaleString("fa-IR")}/></div><div className="grid grid-cols-2 gap-2 border-t border-[var(--border)] pt-4"><button type="button" onClick={() => editUnit(selected)} className={outlineButton}><Pencil size={15}/> ویرایش</button><button type="button" onClick={() => setMoving(selected)} className={outlineButton}><ArrowLeftRight size={15}/> انتقال</button></div></div> : <div className="p-7 text-center"><Building2 size={32} className="mx-auto mb-3 text-[var(--muted-foreground)]"/><p className="text-sm font-semibold">واحدی انتخاب نشده است</p><p className={`mt-2 text-xs leading-6 ${subtle}`}>یک واحد را از نمودار انتخاب کنید.</p></div>)}
                </section>
                <section className={`${panel} p-4`}><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black">دسترسی سریع به واحدها</h3><span className={`text-xs ${subtle}`}>{filteredUnits.length.toLocaleString("fa-IR")}</span></div><div className="relative"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"/><input value={unitQuery} onChange={(e) => setUnitQuery(e.target.value)} placeholder="نام یا کد واحد..." className="w-full rounded-xl border border-[var(--border)] bg-transparent py-2.5 pl-9 pr-9 text-sm outline-none focus:border-blue-500"/>{unitQuery && <button type="button" onClick={() => setUnitQuery("")} className="absolute left-2 top-1/2 -translate-y-1/2 p-1"><X size={15}/></button>}</div><div className="mt-3 max-h-64 space-y-1 overflow-y-auto">{filteredUnits.map((u) => <button type="button" key={u.id} onClick={() => selectUnit(u)} className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-right text-sm transition ${selected?.id === u.id ? "bg-blue-500/10 font-bold text-blue-600" : "hover:bg-[var(--muted)]"}`}><span className="min-w-0 truncate">{u.name}</span><ChevronLeft size={14} className="shrink-0"/></button>)}{filteredUnits.length === 0 && <p className={`py-5 text-center text-xs ${subtle}`}>واحدی یافت نشد.</p>}</div></section>
              </div>
            </div>}
            {tab === "positions" && <div className={`${panel} min-w-0 overflow-hidden p-3 sm:p-5`}><PositionsManager/></div>}
            {tab === "assignments" && <div className={`${panel} min-w-0 overflow-hidden p-3 sm:p-5`}><AssignmentsManager units={units} positions={positions} locations={locations}/></div>}
            {tab === "relationships" && <div className={`${panel} min-w-0 overflow-hidden p-3 sm:p-5`}><RelationshipsManager assignments={assignments}/></div>}
            {tab === "access" && <section className={`${panel} overflow-hidden`}><div className="flex flex-col gap-3 border-b border-[var(--border)] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"><div><h3 className="flex items-center gap-2 font-black"><ShieldCheck size={19} className="text-blue-600"/> دسترسی‌های اختصاصی انتصاب‌ها</h3><p className={`mt-1 text-xs leading-6 ${subtle}`}>برای هر انتصاب، مجوزهای اختصاصی آن را مشاهده و تنظیم کنید.</p></div><div className="relative"><Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"/><input value={accessQuery} onChange={(e) => setAccessQuery(e.target.value)} placeholder="جست‌وجوی کارمند یا سمت..." className="w-full rounded-xl border border-[var(--border)] bg-transparent py-2.5 pl-3 pr-9 text-sm outline-none focus:border-blue-500 sm:w-64"/></div></div><div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">{filteredAssignments.map((a) => <article key={a.id} className="flex min-w-0 flex-col justify-between gap-4 rounded-2xl border border-[var(--border)] bg-[var(--muted)]/20 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600"><Users size={19}/></div><div className="min-w-0"><p className="truncate text-sm font-bold">{a.user?.fullName || a.userId}</p><p className={`mt-1 text-xs leading-5 ${subtle}`}>{a.position?.title || "بدون سمت"} · {a.organizationUnit?.name || "بدون واحد"}</p></div></div><button type="button" onClick={() => setAccess(a)} className={`${outlineButton} shrink-0 text-xs`}><ShieldCheck size={15}/> تنظیم دسترسی</button></article>)}{filteredAssignments.length === 0 && <div className={`col-span-full py-12 text-center text-sm ${subtle}`}>انتصابی با این مشخصات پیدا نشد.</div>}</div></section>}
            {tab === "audit" && <div className={`${panel} min-w-0 overflow-hidden p-3 sm:p-5`}><AuditLogPanel/></div>}
          </>}
        </div>
      </div>
      {unitOpen && <UnitDialog unit={editing} units={units} locations={locations} close={() => setUnitOpen(false)} saved={() => void refresh()}/>}
      {moving && <MoveUnitDialog unit={moving} units={units} close={() => setMoving(null)} saved={() => void refresh()}/>}
      {access && <AssignmentAccessManager assignment={access} close={() => setAccess(null)}/>}
    </main>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--muted)]/20 p-2.5 text-center"><p className="text-[10px] text-[var(--muted-foreground)]">{label}</p><p className="mt-1 truncate text-sm font-bold">{value}</p></div>;
}
