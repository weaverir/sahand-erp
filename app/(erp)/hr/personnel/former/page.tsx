"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowLeft, BriefcaseBusiness, CalendarDays, ClipboardList, Eye, FileArchive, RefreshCw, Search, ShieldCheck, UserRoundCheck, UserRoundMinus, Users } from "lucide-react";

type Employee = {
  id: string;
  userId: string;
  personnelCode: string | null;
  employmentStatus: string;
  hireDate: string;
  terminationDate: string | null;
  terminationReason: string | null;
  createdAt: string;
  user: { id: string; username: string; fullName: string; email: string | null; phone: string | null; isActive: boolean };
  candidateApplication: { firstName: string; lastName: string; nationalId: string; mobilePhone: string; gender: string; maritalStatus: string; applicationNumber: string };
};

type Statistics = { active: number; onLeave: number; suspended: number; terminated: number; current: number; total: number };

const panel = "rounded-2xl border border-slate-200/80 bg-white/85 shadow-xl shadow-slate-900/5 backdrop-blur-xl [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]/85 [[data-theme=dark]_&]:shadow-black/20";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-500/10 disabled:cursor-not-allowed disabled:opacity-50 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-200";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-blue-600 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "w-full rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430] [[data-theme=dark]_&]:text-white";

function formatDate(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium", timeZone: "Asia/Tehran" }).format(parsed);
}

function StatCard({ title, value, description, icon: Icon, accent }: { title: string; value: number; description: string; icon: typeof Users; accent: "rose" | "blue" | "emerald" }) {
  const accents = {
    rose: "bg-rose-500/10 text-rose-600 [[data-theme=dark]_&]:text-rose-300",
    blue: "bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300",
    emerald: "bg-emerald-500/10 text-emerald-600 [[data-theme=dark]_&]:text-emerald-300",
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

export default function FormerPersonnelPage() {
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

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ status: "FORMER", page: String(page), limit: "20" });
      if (search) params.set("q", search);
      const response = await fetch(`/api/hr/personnel?${params.toString()}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message || body.error || "دریافت فهرست کارکنان سابق ناموفق بود.");
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
      setError(err instanceof Error ? err.message : "خطا در دریافت اطلاعات کارکنان سابق.");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void loadEmployees(); }, [loadEmployees]);

  function handleSearch() {
    setPage(1);
    setSearch(query.trim());
  }

  return (
    <main dir="rtl" className="mx-auto min-h-full max-w-7xl space-y-6 p-3 text-slate-900 sm:p-4 md:p-6 lg:p-7 [[data-theme=dark]_&]:text-slate-100">
      <header className={`${panel} relative overflow-hidden p-5 sm:p-7`}>
        <div aria-hidden="true" className="pointer-events-none absolute -left-20 -top-20 size-64 rounded-full bg-rose-500/10 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-600 to-indigo-600 text-white shadow-lg shadow-rose-500/20"><Archive size={27} /></span>
            <div>
              <p className="mb-1 text-xs font-semibold text-blue-600 [[data-theme=dark]_&]:text-blue-300">منابع انسانی / پرونده پرسنلی</p>
              <h1 className="text-2xl font-black sm:text-3xl">کارکنان سابق</h1>
              <p className="mt-2 text-sm leading-7 text-slate-500 [[data-theme=dark]_&]:text-slate-400">بایگانی و مشاهده پرونده کارکنانی که همکاری آن‌ها خاتمه یافته است</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => router.push("/hr/personnel")} className={secondaryButton}><ClipboardList size={16} />داشبورد پرونده‌ها</button>
            <button type="button" onClick={() => router.push("/hr/personnel/current")} className={secondaryButton}><UserRoundCheck size={16} />کارکنان فعلی</button>
            <button type="button" disabled={loading} onClick={() => void loadEmployees()} className={primaryButton}><RefreshCw size={16} className={loading ? "animate-spin" : ""} />به‌روزرسانی</button>
          </div>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="کل کارکنان سابق" value={statistics.terminated} description="پرونده‌های دارای وضعیت قطع همکاری" icon={UserRoundMinus} accent="rose" />
        <StatCard title="کل پرونده‌های پرسنلی" value={statistics.total} description="مجموع پرونده‌ها در تمام وضعیت‌های استخدامی" icon={FileArchive} accent="blue" />
        <StatCard title="کارکنان فعلی" value={statistics.current} description="شاغل، در مرخصی و معلق" icon={BriefcaseBusiness} accent="emerald" />
      </div>

      <section className="flex items-start gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 sm:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 [[data-theme=dark]_&]:text-amber-300"><ShieldCheck size={21} /></span>
        <div>
          <h2 className="text-sm font-bold text-amber-900 [[data-theme=dark]_&]:text-amber-200">بایگانی پرونده‌های پرسنلی</h2>
          <p className="mt-1 text-xs leading-7 text-slate-700 [[data-theme=dark]_&]:text-slate-300">قطع همکاری به معنی حذف پرونده کارمند نیست. اطلاعات هویتی، سوابق شغلی و مدارک ثبت‌شده باید برای مراجعات و سوابق آینده حفظ شوند.</p>
        </div>
      </section>

      <section className={`${panel} p-4 sm:p-5`} aria-label="جست‌وجوی کارکنان سابق">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Search size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") handleSearch(); }} placeholder="جست‌وجو با نام، کد ملی یا کد پرسنلی..." aria-label="جست‌وجوی کارکنان سابق" className={`${inputClass} pr-11`} />
          </div>
          <button type="button" onClick={handleSearch} className={primaryButton}><Search size={17} />جست‌وجو</button>
          <button type="button" onClick={() => { setQuery(""); setSearch(""); setPage(1); }} className={secondaryButton}>پاک کردن</button>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300">{error}</p>}

      <section className={`${panel} overflow-hidden`} aria-label="بایگانی کارکنان سابق">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 p-5 [[data-theme=dark]_&]:border-white/10">
          <div>
            <h2 className="flex items-center gap-2 font-bold"><Archive size={19} className="text-rose-500" />بایگانی کارکنان سابق</h2>
            <p className="mt-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">تعداد پرونده‌ها: {total.toLocaleString("fa-IR")}</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700 [[data-theme=dark]_&]:text-rose-300"><span className="size-1.5 rounded-full bg-current" />قطع همکاری</span>
        </div>

        {loading ? (
          <div role="status" className="flex items-center justify-center gap-3 p-12 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-300"><RefreshCw size={20} className="animate-spin text-blue-500" />در حال دریافت اطلاعات بایگانی...</div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <Archive size={35} className="mx-auto mb-3 text-slate-400" />
            <p className="font-bold">پرونده‌ای در بایگانی پیدا نشد</p>
            <p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">در حال حاضر پرونده‌ای با وضعیت قطع همکاری ثبت نشده یا نتیجه جست‌وجو خالی است.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-right text-sm">
                <thead className="bg-slate-50/90 text-xs text-slate-500 [[data-theme=dark]_&]:bg-white/[0.04] [[data-theme=dark]_&]:text-slate-400">
                  <tr>
                    <th className="px-5 py-4">نام و نام خانوادگی</th>
                    <th className="px-5 py-4">کد پرسنلی</th>
                    <th className="px-5 py-4">کد ملی</th>
                    <th className="px-5 py-4">تاریخ استخدام</th>
                    <th className="px-5 py-4">تاریخ قطع همکاری</th>
                    <th className="px-5 py-4">علت قطع همکاری</th>
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
                      <td className="px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300"><span className="inline-flex items-center gap-1.5"><CalendarDays size={14} className="text-slate-400" />{formatDate(employee.hireDate)}</span></td>
                      <td className="px-5 py-4 font-semibold text-rose-700 [[data-theme=dark]_&]:text-rose-300">{formatDate(employee.terminationDate)}</td>
                      <td className="max-w-[240px] px-5 py-4 text-slate-600 [[data-theme=dark]_&]:text-slate-300"><span className="line-clamp-2 break-words" title={employee.terminationReason || ""}>{employee.terminationReason || "ثبت نشده"}</span></td>
                      <td className="px-5 py-4"><button type="button" onClick={() => router.push(`/hr/personnel/${encodeURIComponent(employee.id)}`)} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-500/20 [[data-theme=dark]_&]:text-blue-300"><Eye size={15} />مشاهده پرونده</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav aria-label="صفحه‌بندی کارکنان سابق" className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 p-4 [[data-theme=dark]_&]:border-white/10">
              <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">صفحه {page.toLocaleString("fa-IR")} از {totalPages.toLocaleString("fa-IR")}</p>
              <div className="flex gap-2">
                <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))} className={secondaryButton}>قبلی</button>
                <button type="button" disabled={page >= totalPages || loading} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} className={secondaryButton}>بعدی <ArrowLeft size={15} /></button>
              </div>
            </nav>
          </>
        )}
      </section>
    </main>
  );
}
