"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ChevronLeft, ChevronRight, BriefcaseBusiness, CalendarDays, CircleAlert,
  ClipboardList, Eye, RefreshCw, Search, UserRoundCheck,
  UserRoundMinus, Users, X,
} from "lucide-react";

type Employee = {
  id: string;
  userId: string;
  personnelCode: string | null;
  employmentStatus: string;
  hireDate: string;
  terminationDate: string | null;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
  };
  candidateApplication: {
    firstName: string;
    lastName: string;
    nationalId: string;
    mobilePhone: string;
    gender: string;
    maritalStatus: string;
    applicationNumber: string;
  };
};

type Statistics = {
  active: number;
  onLeave: number;
  suspended: number;
  terminated: number;
  current: number;
  total: number;
};

const panel = "rounded-2xl border border-slate-200/80 bg-white/85 shadow-xl shadow-slate-900/5 backdrop-blur-xl [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]/85 [[data-theme=dark]_&]:shadow-black/20";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-200";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430] [[data-theme=dark]_&]:text-white";

function formatDate(value: string | null) {
  if (!value) return "ثبت نشده";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(parsed);
}

const persianPartsFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});

function persianParts(date: Date) {
  const parts = persianPartsFormatter.formatToParts(date);
  const number = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: number("year"), month: number("month"), day: number("day") };
}

function dateToIso(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function todayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const persianMonths = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const weekdays = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function jalaliMonthStart(year: number, month: number): Date | null {
  // Convert the first day of a Persian month to a Gregorian UTC date.
  // The scan is calendar-independent and handles leap years automatically.
  const start = Date.UTC(year + 620, 2, 1);
  for (let offset = 0; offset < 750; offset++) {
    const candidate = new Date(start + offset * 86400000);
    const parts = persianParts(candidate);
    if (parts.year === year && parts.month === month && parts.day === 1) return candidate;
  }
  return null;
}

function JalaliDatePicker({ value, onChange }: {
  value: string;
  onChange: (next: string) => void;
}) {
  const initial = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00Z`)
    : new Date(`${todayIso()}T00:00:00Z`);
  const initialParts = persianParts(initial);
  const [view, setView] = useState({ year: initialParts.year, month: initialParts.month });
  const [expanded, setExpanded] = useState(false);
  const start = jalaliMonthStart(view.year, view.month);
  const nextMonth = view.month === 12
    ? { year: view.year + 1, month: 1 }
    : { year: view.year, month: view.month + 1 };
  const end = jalaliMonthStart(nextMonth.year, nextMonth.month);
  const length = start && end ? Math.round((end.getTime() - start.getTime()) / 86400000) : 0;
  const offset = start ? (start.getUTCDay() + 1) % 7 : 0;
  const selectedParts = value ? persianParts(new Date(`${value}T00:00:00Z`)) : null;

  function move(delta: number) {
    setView((current) => {
      const total = current.year * 12 + current.month - 1 + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 + 1 };
    });
  }

  return (
    <div className="relative mt-2">
      <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}
        className={`${inputClass} flex items-center justify-between gap-3 text-right`}>
        <span>{value ? `${selectedParts?.day.toLocaleString("fa-IR")} ${persianMonths[(selectedParts?.month ?? 1) - 1]} ${selectedParts?.year.toLocaleString("fa-IR")}` : "انتخاب تاریخ شمسی"}</span>
        <CalendarDays size={18} className="shrink-0 text-blue-500" />
      </button>
      {expanded && (
        <div className="mt-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#101936]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <button type="button" aria-label="ماه قبل" onClick={() => move(-1)} className={secondaryButton}><ChevronRight size={17} /></button>
            <strong className="text-sm">{persianMonths[view.month - 1]} {view.year.toLocaleString("fa-IR")}</strong>
            <button type="button" aria-label="ماه بعد" onClick={() => move(1)} className={secondaryButton}><ChevronLeft size={17} /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekdays.map((day) => <span key={day} className="py-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">{day}</span>)}
            {Array.from({ length: offset }, (_, i) => <span key={`empty-${i}`} />)}
            {Array.from({ length }, (_, i) => {
              const date = new Date((start?.getTime() ?? 0) + i * 86400000);
              const iso = dateToIso(date);
              const selected = iso === value;
              return (
                <button type="button" key={iso} aria-label={`${i + 1} ${persianMonths[view.month - 1]}`} aria-pressed={selected}
                  onClick={() => { onChange(iso); setExpanded(false); }}
                  className={`aspect-square rounded-lg text-sm transition-colors ${selected ? "bg-blue-600 font-bold text-white" : "hover:bg-blue-500/10 [[data-theme=dark]_&]:hover:bg-white/10"}`}>
                  {(i + 1).toLocaleString("fa-IR")}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end border-t border-slate-200 pt-3 [[data-theme=dark]_&]:border-white/10">
            <button type="button" onClick={() => {
              const iso = todayIso();
              onChange(iso);
              const parts = persianParts(new Date(`${iso}T00:00:00Z`));
              setView({ year: parts.year, month: parts.month });
              setExpanded(false);
            }} className={secondaryButton}>امروز</button>
          </div>
        </div>
      )}
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "فعال",
    ON_LEAVE: "در مرخصی",
    SUSPENDED: "معلق",
    TERMINATED: "قطع همکاری",
  };
  return labels[status] || status;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ACTIVE: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-300",
    ON_LEAVE: "border-amber-500/25 bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300",
    SUSPENDED: "border-orange-500/25 bg-orange-500/10 text-orange-700 [[data-theme=dark]_&]:text-orange-300",
    TERMINATED: "border-rose-500/25 bg-rose-500/10 text-rose-700 [[data-theme=dark]_&]:text-rose-300",
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${styles[status] || "border-slate-300 bg-slate-100 text-slate-600 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/10 [[data-theme=dark]_&]:text-slate-300"}`}>
      <span className="size-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

function StatCard({ title, value, description, icon: Icon, accent }: {
  title: string;
  value: number;
  description: string;
  icon: typeof Users;
  accent: "blue" | "emerald" | "amber";
}) {
  const accents = {
    blue: "bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-600 [[data-theme=dark]_&]:text-emerald-300",
    amber: "bg-amber-500/10 text-amber-600 [[data-theme=dark]_&]:text-amber-300",
  };
  return (
    <div className={`${panel} p-5 transition-transform duration-300 hover:-translate-y-1`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500 [[data-theme=dark]_&]:text-slate-400">{title}</p>
        <span className={`flex size-11 items-center justify-center rounded-xl ${accents[accent]}`}><Icon size={21} /></span>
      </div>
      <p className="mt-3 text-3xl font-black text-slate-900 [[data-theme=dark]_&]:text-white">{value.toLocaleString("fa-IR")}</p>
      <p className="mt-2 text-xs leading-6 text-slate-500 [[data-theme=dark]_&]:text-slate-400">{description}</p>
    </div>
  );
}

export default function CurrentPersonnelPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [statistics, setStatistics] = useState<Statistics>({ active: 0, onLeave: 0, suspended: 0, terminated: 0, current: 0, total: 0 });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [terminationEmployee, setTerminationEmployee] = useState<Employee | null>(null);
  const [terminationDate, setTerminationDate] = useState("");
  const [terminationReason, setTerminationReason] = useState("");

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "CURRENT", page: String(page), limit: "20" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/hr/personnel?${params.toString()}`, {
        credentials: "same-origin",
        cache: "no-store",
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "دریافت فهرست کارکنان ناموفق بود.");
      const result = body.data ?? body;
      setEmployees(Array.isArray(result.employees) ? result.employees : []);
      setStatistics({
        active: result.statistics?.active ?? 0,
        onLeave: result.statistics?.onLeave ?? 0,
        suspended: result.statistics?.suspended ?? 0,
        terminated: result.statistics?.terminated ?? 0,
        current: result.statistics?.current ?? 0,
        total: result.statistics?.total ?? 0,
      });
      setTotal(result.pagination?.total ?? 0);
      setTotalPages(Math.max(1, result.pagination?.totalPages ?? 1));
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در دریافت اطلاعات کارکنان.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  useEffect(() => {
    if (!terminationEmployee) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTerminationEmployee(null);
    };
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [terminationEmployee]);

  function handleSearch() {
    setPage(1);
    setSearch(query.trim());
  }

  function openTermination(employee: Employee) {
    setTerminationEmployee(employee);
    setTerminationDate(todayIso());
    setTerminationReason("");
  }

  return (
    <main dir="rtl" className="mx-auto min-h-full max-w-7xl space-y-6 p-3 text-slate-900 sm:p-4 md:p-6 lg:p-7 [[data-theme=dark]_&]:text-slate-100">
      <header className={`${panel} relative overflow-hidden p-5 sm:p-7`}>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20"><Users size={27} /></span>
            <div>
              <p className="mb-1 text-xs font-semibold text-blue-600 [[data-theme=dark]_&]:text-blue-300">منابع انسانی / پرونده پرسنلی</p>
              <h1 className="text-2xl font-black sm:text-3xl">کارکنان فعلی</h1>
              <p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">مدیریت و مشاهده پرونده کارکنان مجموعه</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push("/hr/personnel")} className={secondaryButton}><ClipboardList size={16} />داشبورد پرونده‌ها</button>
            <button type="button" onClick={() => router.push("/hr/personnel/former")} className={secondaryButton}><UserRoundMinus size={16} />کارکنان سابق</button>
            <button type="button" disabled={loading} onClick={() => void loadEmployees()} className={primaryButton}><RefreshCw size={16} className={loading ? "animate-spin" : ""} />به‌روزرسانی</button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="مجموع کارکنان فعلی" value={statistics.current} description="شاغل، در مرخصی و معلق" icon={Users} accent="blue" />
        <StatCard title="کارکنان فعال" value={statistics.active} description="دارای وضعیت همکاری فعال" icon={UserRoundCheck} accent="emerald" />
        <StatCard title="در مرخصی" value={statistics.onLeave} description="کارکنان با وضعیت مرخصی" icon={CalendarDays} accent="amber" />
      </div>

      <section className={`${panel} p-4 sm:p-5`} aria-label="جست‌وجوی کارکنان">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleSearch(); }} placeholder="جست‌وجو با نام، نام خانوادگی یا کد پرسنلی..." aria-label="جست‌وجوی کارکنان" className={`${inputClass} pr-11`} />
          </div>
          <button type="button" onClick={handleSearch} className={primaryButton}><Search size={17} />جست‌وجو</button>
          <button type="button" onClick={() => { setQuery(""); setSearch(""); setPage(1); }} className={secondaryButton}>پاک کردن</button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300">{error}</p>}

      <section className={`${panel} overflow-hidden`} aria-label="فهرست کارکنان">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-5 [[data-theme=dark]_&]:border-white/10">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><BriefcaseBusiness size={19} className="text-blue-500" />فهرست کارکنان</h2>
            <p className="mt-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">تعداد نتایج: {total.toLocaleString("fa-IR")}</p>
          </div>
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 [[data-theme=dark]_&]:text-emerald-300">کارکنان فعلی</span>
        </div>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-300"><RefreshCw size={20} className="animate-spin text-blue-500" />در حال دریافت اطلاعات کارکنان...</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Users size={35} className="mx-auto mb-3 text-slate-400" />
            <p className="font-bold">کارمندی پیدا نشد</p>
            <p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">هنوز پرونده‌ای در این فهرست ثبت نشده یا نتیجه جست‌وجو خالی است.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-right text-sm">
                <thead className="bg-slate-50/90 text-xs text-slate-500 [[data-theme=dark]_&]:bg-white/[0.04] [[data-theme=dark]_&]:text-slate-400">
                  <tr>
                    <th className="px-5 py-4">نام و نام خانوادگی</th>
                    <th className="px-5 py-4">کد پرسنلی</th>
                    <th className="px-5 py-4">کد ملی</th>
                    <th className="px-5 py-4">شماره تماس</th>
                    <th className="px-5 py-4">تاریخ استخدام</th>
                    <th className="px-5 py-4">وضعیت</th>
                    <th className="px-5 py-4">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 [[data-theme=dark]_&]:divide-white/10">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="transition-colors hover:bg-blue-500/5">
                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-900 [[data-theme=dark]_&]:text-white">{employee.user.fullName}</p>
                        <p className="mt-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">{employee.user.username}</p>
                      </td>
                      <td className="px-5 py-4 font-semibold text-blue-700 [[data-theme=dark]_&]:text-blue-300">{employee.personnelCode || "تخصیص داده نشده"}</td>
                      <td className="px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300">{employee.candidateApplication.nationalId}</td>
                      <td className="px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300">{employee.candidateApplication.mobilePhone}</td>
                      <td className="px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300">{formatDate(employee.hireDate)}</td>
                      <td className="px-5 py-4"><StatusBadge status={employee.employmentStatus} /></td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => router.push(`/hr/personnel/${encodeURIComponent(employee.id)}`)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/20 [[data-theme=dark]_&]:text-blue-300"><Eye size={15} />مشاهده پرونده</button>
                          <button type="button" onClick={() => openTermination(employee)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-bold text-rose-700 transition-colors hover:bg-rose-500/20 [[data-theme=dark]_&]:text-rose-300"><UserRoundMinus size={15} />قطع همکاری</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="صفحه‌بندی کارکنان" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 p-4 [[data-theme=dark]_&]:border-white/10">
              <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className={secondaryButton}>قبلی</button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className={secondaryButton}>بعدی <ArrowLeft size={15} /></button>
              </div>
            </nav>
          </>
        )}
      </section>

      {terminationEmployee && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setTerminationEmployee(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="termination-title" className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 text-slate-900 shadow-2xl sm:p-6 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38] [[data-theme=dark]_&]:text-slate-100">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 pb-4 [[data-theme=dark]_&]:border-white/10">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 [[data-theme=dark]_&]:text-rose-300"><UserRoundMinus size={22} /></span>
                <div><p className="text-xs text-rose-600 [[data-theme=dark]_&]:text-rose-300">مدیریت وضعیت همکاری</p><h2 id="termination-title" className="mt-1 text-lg font-black">قطع همکاری کارمند</h2></div>
              </div>
              <button type="button" onClick={() => setTerminationEmployee(null)} aria-label="بستن پنجره" className={secondaryButton}><X size={18} /></button>
            </div>
            <p className="mt-5 text-sm leading-8">کارمند: <strong>{terminationEmployee.user.fullName}</strong></p>
            <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">کد پرسنلی: {terminationEmployee.personnelCode || "تخصیص داده نشده"}</p>
            <div className="mt-5 space-y-4">
              <div className="text-sm font-semibold">تاریخ قطع همکاری (شمسی)<JalaliDatePicker key={terminationEmployee.id} value={terminationDate} onChange={setTerminationDate} /></div>
              <label className="block text-sm font-semibold">دلیل قطع همکاری<textarea rows={4} maxLength={2000} value={terminationReason} onChange={(event) => setTerminationReason(event.target.value)} placeholder="دلیل قطع همکاری را ثبت کنید..." className={`mt-2 resize-y ${inputClass}`} /></label>
            </div>
            <div className="mt-5 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-7 text-amber-800 [[data-theme=dark]_&]:text-amber-200">
              <CircleAlert size={20} className="mt-1 shrink-0" />
              <p>ثبت نهایی هنوز فعال نیست؛ برای اتصال ایمن این فرم به عملیات قطع همکاری، باید API مربوطه بررسی شود. پرونده و مدارک کارمند نباید حذف شوند و دسترسی حساب باید در سمت سرور غیرفعال شود.</p>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-slate-200 pt-5 [[data-theme=dark]_&]:border-white/10">
              <button type="button" onClick={() => setTerminationEmployee(null)} className={secondaryButton}>انصراف</button>
              <button type="button" disabled title="پس از اتصال API قطع همکاری فعال می‌شود" className="inline-flex items-center gap-2 rounded-xl bg-rose-700 px-5 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><UserRoundMinus size={17} />ثبت قطع همکاری</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
