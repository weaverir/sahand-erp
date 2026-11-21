"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, Eye, FolderOpen, PauseCircle, RefreshCw, Search, ShieldCheck, UserRoundCheck, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Employee = {
  id: string;
  personnelCode: string | null;
  employmentStatus: string;
  hireDate: string;
  terminationDate: string | null;
  user: { id: string; fullName: string; username: string; isActive: boolean };
  candidateApplication: { firstName: string; lastName: string; nationalId: string; mobilePhone: string };
};
type Statistics = { active: number; onLeave: number; suspended: number; terminated: number; current: number; total: number };
const emptyStatistics: Statistics = { active: 0, onLeave: 0, suspended: 0, terminated: 0, current: 0, total: 0 };
const panel = "rounded-2xl border border-slate-200/80 bg-white/85 shadow-xl shadow-slate-900/5 backdrop-blur-xl [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]/85 [[data-theme=dark]_&]:shadow-black/20";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-blue-400/40 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-200";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(date);
}
function statusLabel(status: string) {
  return ({ ACTIVE: "فعال", ON_LEAVE: "در مرخصی", SUSPENDED: "معلق", TERMINATED: "قطع همکاری" } as Record<string, string>)[status] || status;
}
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-300",
    ON_LEAVE: "border-amber-500/25 bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300",
    SUSPENDED: "border-orange-500/25 bg-orange-500/10 text-orange-700 [[data-theme=dark]_&]:text-orange-300",
    TERMINATED: "border-rose-500/25 bg-rose-500/10 text-rose-700 [[data-theme=dark]_&]:text-rose-300",
  };
  return <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status] || "border-slate-200 bg-slate-100 text-slate-600 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/10 [[data-theme=dark]_&]:text-slate-300"}`}><span className="size-1.5 rounded-full bg-current" />{statusLabel(status)}</span>;
}
function StatCard({ title, value, description, icon: Icon, accent }: { title: string; value: number; description: string; icon: LucideIcon; accent: "blue" | "emerald" | "amber" | "rose" | "violet" | "orange" }) {
  const accents = {
    blue: "bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-600 [[data-theme=dark]_&]:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-600 [[data-theme=dark]_&]:text-amber-300",
    rose: "bg-rose-500/10 text-rose-600 [[data-theme=dark]_&]:text-rose-300",
    violet: "bg-violet-500/10 text-violet-600 [[data-theme=dark]_&]:text-violet-300",
    orange: "bg-orange-500/10 text-orange-600 [[data-theme=dark]_&]:text-orange-300",
  };
  return <div className={`${panel} p-5 transition-transform duration-300 hover:-translate-y-1`}><div className="flex items-center justify-between gap-3"><p className="text-sm font-medium text-slate-500 [[data-theme=dark]_&]:text-slate-400">{title}</p><span className={`flex size-11 items-center justify-center rounded-xl ${accents[accent]}`}><Icon size={21} /></span></div><p className="mt-3 text-3xl font-black text-slate-900 [[data-theme=dark]_&]:text-white">{value.toLocaleString("fa-IR")}</p><p className="mt-2 text-xs leading-6 text-slate-500 [[data-theme=dark]_&]:text-slate-400">{description}</p></div>;
}
export default function PersonnelDashboardPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statistics, setStatistics] = useState<Statistics>(emptyStatistics);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/hr/personnel?status=ALL&page=1&limit=8", { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "دریافت اطلاعات داشبورد ناموفق بود.");
      const result = body.data ?? body;
      setEmployees(Array.isArray(result.employees) ? result.employees : []);
      setStatistics({ active: result.statistics?.active ?? 0, onLeave: result.statistics?.onLeave ?? 0, suspended: result.statistics?.suspended ?? 0, terminated: result.statistics?.terminated ?? 0, current: result.statistics?.current ?? 0, total: result.statistics?.total ?? 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت داشبورد پرونده پرسنلی.");
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  function handleSearch() {
    const value = query.trim();
    router.push(value ? `/hr/personnel/current?q=${encodeURIComponent(value)}` : "/hr/personnel/current");
  }
  return (
    <main dir="rtl" className="mx-auto min-h-full max-w-7xl space-y-6 p-3 text-slate-900 sm:p-4 md:p-6 lg:p-7 [[data-theme=dark]_&]:text-slate-100">
      <header className={`${panel} relative overflow-hidden p-5 sm:p-7`}>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"><ClipboardList size={27} /></span><div><p className="mb-1 text-xs font-semibold text-blue-600 [[data-theme=dark]_&]:text-blue-300">منابع انسانی / مدیریت کارکنان</p><h1 className="text-2xl font-black sm:text-3xl">پرونده پرسنلی کارکنان</h1><p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">مدیریت متمرکز اطلاعات، سوابق و پرونده دائمی کارکنان</p></div></div>
          <button type="button" onClick={() => void loadDashboard()} disabled={loading} className={primaryButton}><RefreshCw size={17} className={loading ? "animate-spin" : ""} />به‌روزرسانی اطلاعات</button>
        </div>
      </header>
      {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300"><span>{error}</span><button type="button" onClick={() => void loadDashboard()} className={secondaryButton}>تلاش مجدد</button></div>}
      <section aria-label="آمار کلی منابع انسانی" className="space-y-4"><h2 className="flex items-center gap-2 text-base font-bold"><Users size={19} className="text-blue-500" />آمار کلی منابع انسانی</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard title="کل پرونده‌ها" value={statistics.total} description="تمام کارکنان ثبت‌شده" icon={FolderOpen} accent="blue" /><StatCard title="کارکنان فعال" value={statistics.active} description="دارای همکاری فعال" icon={UserRoundCheck} accent="emerald" /><StatCard title="در مرخصی" value={statistics.onLeave} description="کارکنان دارای وضعیت مرخصی" icon={CalendarDays} accent="amber" /><StatCard title="کارکنان سابق" value={statistics.terminated} description="پرونده‌های بایگانی‌شده" icon={Archive} accent="rose" /></div><div className="grid gap-4 sm:grid-cols-2"><StatCard title="مجموع کارکنان فعلی" value={statistics.current} description="فعال، در مرخصی و معلق" icon={BriefcaseBusiness} accent="violet" /><StatCard title="کارکنان معلق" value={statistics.suspended} description="دارای وضعیت تعلیق همکاری" icon={PauseCircle} accent="orange" /></div></section>
      <section className="space-y-4"><h2 className="flex items-center gap-2 text-base font-bold"><ShieldCheck size={19} className="text-blue-500" />دسترسی سریع</h2><div className="grid gap-4 md:grid-cols-2">
        <button type="button" onClick={() => router.push("/hr/personnel/current")} className={`${panel} group flex items-center justify-between gap-4 p-6 text-right transition hover:border-blue-400/50 hover:bg-blue-500/5`}><div><h3 className="text-lg font-bold">کارکنان فعلی</h3><p className="mt-2 text-sm leading-7 text-slate-500 [[data-theme=dark]_&]:text-slate-400">مشاهده و مدیریت پرونده کارکنان مجموعه</p><p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-600 [[data-theme=dark]_&]:text-blue-300">مشاهده فهرست کارکنان <ArrowLeft size={16} /></p></div><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300"><Users size={27} /></span></button>
        <button type="button" onClick={() => router.push("/hr/personnel/former")} className={`${panel} group flex items-center justify-between gap-4 p-6 text-right transition hover:border-rose-400/50 hover:bg-rose-500/5`}><div><h3 className="text-lg font-bold">بایگانی کارکنان سابق</h3><p className="mt-2 text-sm leading-7 text-slate-500 [[data-theme=dark]_&]:text-slate-400">دسترسی به پرونده دائمی کارکنان قطع همکاری‌شده</p><p className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-rose-600 [[data-theme=dark]_&]:text-rose-300">مشاهده بایگانی <ArrowLeft size={16} /></p></div><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 [[data-theme=dark]_&]:text-rose-300"><Archive size={27} /></span></button>
      </div></section>
      <section className={`${panel} p-5`} aria-label="جست‌وجوی پرونده پرسنلی"><h2 className="flex items-center gap-2 font-bold"><Search size={19} className="text-blue-500" />جست‌وجوی پرونده پرسنلی</h2><p className="mt-2 text-xs leading-6 text-slate-500 [[data-theme=dark]_&]:text-slate-400">برای جست‌وجو می‌توانید نام، نام خانوادگی یا کد پرسنلی را وارد کنید.</p><div className="mt-4 flex flex-col gap-3 sm:flex-row"><div className="relative min-w-0 flex-1"><Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleSearch(); }} placeholder="عبارت جست‌وجو..." aria-label="عبارت جست‌وجو" className="w-full rounded-xl border border-slate-200 bg-white/80 py-3 pl-4 pr-11 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430] [[data-theme=dark]_&]:text-white" /></div><button type="button" onClick={handleSearch} className={primaryButton}><Search size={17} />جست‌وجو</button></div></section>
      <section className={`${panel} overflow-hidden`} aria-label="آخرین پرونده‌های ثبت‌شده"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-5 [[data-theme=dark]_&]:border-white/10"><div><h2 className="flex items-center gap-2 font-bold"><ClipboardList size={19} className="text-blue-500" />آخرین پرونده‌های ثبت‌شده</h2><p className="mt-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">آخرین کارکنان ثبت‌شده در سیستم</p></div><button type="button" onClick={() => router.push("/hr/personnel/current")} className="inline-flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-500 [[data-theme=dark]_&]:text-blue-300">مشاهده همه کارکنان <ArrowLeft size={15} /></button></div>
        {loading ? <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-300"><RefreshCw size={20} className="animate-spin text-blue-500" />در حال دریافت اطلاعات...</div> : employees.length === 0 ? <div className="p-12 text-center"><FolderOpen size={35} className="mx-auto mb-3 text-slate-400" /><p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">هنوز پرونده پرسنلی ثبت نشده است.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[750px] text-right text-sm"><thead className="bg-slate-50/90 text-xs text-slate-500 [[data-theme=dark]_&]:bg-white/[0.04] [[data-theme=dark]_&]:text-slate-400"><tr><th className="px-5 py-4">نام کارمند</th><th className="px-5 py-4">کد پرسنلی</th><th className="px-5 py-4">تاریخ استخدام</th><th className="px-5 py-4">وضعیت همکاری</th><th className="px-5 py-4">عملیات</th></tr></thead><tbody className="divide-y divide-slate-200/70 [[data-theme=dark]_&]:divide-white/10">{employees.map((employee) => <tr key={employee.id} className="transition-colors hover:bg-blue-500/5"><td className="px-5 py-4"><p className="font-bold text-slate-900 [[data-theme=dark]_&]:text-white">{employee.user.fullName}</p><p className="mt-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">{employee.user.username}</p></td><td className="px-5 py-4 font-semibold text-blue-700 [[data-theme=dark]_&]:text-blue-300">{employee.personnelCode || "تخصیص داده نشده"}</td><td className="px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300">{formatDate(employee.hireDate)}</td><td className="px-5 py-4"><StatusBadge status={employee.employmentStatus} /></td><td className="px-5 py-4"><button type="button" onClick={() => router.push(`/hr/personnel/${encodeURIComponent(employee.id)}`)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/20 [[data-theme=dark]_&]:text-blue-300"><Eye size={15} />مشاهده پرونده</button></td></tr>)}</tbody></table></div>}
      </section>
      <footer className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 text-xs leading-7 text-slate-600 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-400"><ShieldCheck size={18} className="mt-1 shrink-0 text-blue-500" /><p>پرونده‌های پرسنلی سوابق دائمی کارکنان هستند. تغییر وضعیت همکاری نباید موجب حذف اطلاعات هویتی، سوابق شغلی یا مدارک ثبت‌شده شود.</p></footer>
    </main>
  );
}
