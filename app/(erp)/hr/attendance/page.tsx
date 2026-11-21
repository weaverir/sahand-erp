"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { currentJalaliMonthRange, gregorianToJalali, jalaliToGregorian } from "@/modules/attendance/jalali-date";
import {
  ArrowUpLeft, CalendarCheck2, ClipboardCheck, RefreshCw,
  Search, UsersRound, Clock3, AlertTriangle, ChevronLeft, ChevronRight, CalendarDays, X,
} from "lucide-react";

type EmployeeRow = {
  userId: string;
  fullName: string;
  personnelCode: string | null;
  employmentStatus: string;
  accountActive: boolean;
  hireDate: string;
  terminationDate: string | null;
  recordedDays: number;
  provisionalWorkedMinutes: number;
  openRecordDays: number;
  ambiguousDays: number;
  needsReview: boolean;
};
type OverviewResponse = {
  from: string;
  to: string;
  rows: EmployeeRow[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  note: string;
  error?: string;
};
type CorrectionResponse = {
  pagination?: { total: number };
  error?: string;
};

const panel = "rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm shadow-slate-900/5 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]/90";
const inputClass = "min-h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430] [[data-theme=dark]_&]:text-white";
const buttonClass = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-40 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.06] [[data-theme=dark]_&]:text-slate-200";
const numberFormat = new Intl.NumberFormat("fa-IR");
function number(value: number) { return numberFormat.format(value); }
function minutes(value: number) {
  const sign = value < 0 ? "−" : "";
  const n = Math.abs(value);
  return `${sign}${number(Math.floor(n / 60))} ساعت و ${number(n % 60)} دقیقه`;
}
function jalaliDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}
function initialRange() { return currentJalaliMonthRange(); }

const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const weekNames = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

function parseJalali(value: string): { year: number; month: number; day: number } | null {
  const normalized = value.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(normalized);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
}

function JalaliCalendarField({ label, value, onChange }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(() => {
    const date = parseJalali(value);
    const fallback = parseJalali(gregorianToJalali(new Date().toISOString().slice(0, 10)) ?? "1405/01/01")!;
    return { year: date?.year ?? fallback.year, month: date?.month ?? fallback.month };
  });
  const cells = useMemo(() => {
    const start = jalaliToGregorian(`${visible.year}/${String(visible.month).padStart(2, "0")}/01`);
    if (!start) return [];
    const firstDate = new Date(`${start}T00:00:00.000Z`);
    const offset = (firstDate.getUTCDay() + 1) % 7; // Saturday = 0
    const result: Array<{ date: string; day: number; current: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const day = new Date(firstDate.getTime() + (i - offset) * 86_400_000);
      const date = gregorianToJalali(day.toISOString().slice(0, 10));
      const parsed = date ? parseJalali(date) : null;
      if (date && parsed) result.push({ date, day: parsed.day, current: parsed.year === visible.year && parsed.month === visible.month });
    }
    return result;
  }, [visible.year, visible.month]);
  const today = gregorianToJalali(new Date().toISOString().slice(0, 10));
  const shiftMonth = (amount: number) => setVisible((prev) => {
    const index = prev.year * 12 + prev.month - 1 + amount;
    return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 + 1 };
  });
  const toggle = () => {
    if (!open) {
      const parsed = parseJalali(value);
      if (parsed && jalaliToGregorian(value)) setVisible({ year: parsed.year, month: parsed.month });
    }
    setOpen(!open);
  };
  return (
    <div className="relative text-xs font-semibold">
      <span>{label}</span>
      <div className="relative mt-2">
        <input className={`${inputClass} pl-11 text-center`} dir="ltr" inputMode="numeric" value={value}
          onChange={(e) => onChange(e.target.value)} placeholder="1405/08/01" maxLength={12} required
          aria-label={label} />
        <button type="button" onClick={toggle} aria-label={`باز کردن تقویم ${label}`} aria-expanded={open}
          className="absolute left-1 top-1 flex size-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 [[data-theme=dark]_&]:hover:bg-white/10">
          <CalendarDays size={18} />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(320px,calc(100vw-40px))] rounded-2xl border border-slate-200 bg-white p-3 text-slate-900 shadow-xl [[data-theme=dark]_&]:border-white/15 [[data-theme=dark]_&]:bg-[#151c38] [[data-theme=dark]_&]:text-white"
          role="dialog" aria-label={`تقویم جلالی ${label}`} onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" onClick={() => shiftMonth(-1)} aria-label="ماه قبل" className="rounded-lg p-2 hover:bg-slate-100 [[data-theme=dark]_&]:hover:bg-white/10"><ChevronRight size={18} /></button>
            <strong className="text-sm">{monthNames[visible.month - 1]} {number(visible.year)}</strong>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => shiftMonth(1)} aria-label="ماه بعد" className="rounded-lg p-2 hover:bg-slate-100 [[data-theme=dark]_&]:hover:bg-white/10"><ChevronLeft size={18} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="بستن تقویم" className="rounded-lg p-2 hover:bg-slate-100 [[data-theme=dark]_&]:hover:bg-white/10"><X size={16} /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekNames.map((name, i) => <span key={i} className="py-2 text-[11px] text-slate-500">{name}</span>)}
            {cells.map((cell) => (
              <button key={cell.date} type="button" onClick={() => { onChange(cell.date); setOpen(false); }}
                className={`aspect-square rounded-lg text-xs transition hover:bg-blue-100 [[data-theme=dark]_&]:hover:bg-blue-500/25 ${cell.current ? "" : "text-slate-400 opacity-50"} ${cell.date === value ? "bg-blue-600 font-bold text-white hover:bg-blue-700" : ""} ${cell.date === today && cell.date !== value ? "ring-1 ring-blue-500" : ""}`}
                aria-label={cell.date} aria-pressed={cell.date === value}>{number(cell.day)}</button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-200 pt-3 [[data-theme=dark]_&]:border-white/10">
            <button type="button" className="text-xs font-bold text-blue-600" onClick={() => {
              if (today) { onChange(today); const parsed = parseJalali(today); if (parsed) setVisible({ year: parsed.year, month: parsed.month }); }
              setOpen(false);
            }}>امروز</button>
            <span className="text-[11px] text-slate-500">شروع هفته: شنبه</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HrAttendancePage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [fromInput, setFromInput] = useState(() => gregorianToJalali(initialRange().from) ?? "");
  const [toInput, setToInput] = useState(() => gregorianToJalali(initialRange().to) ?? "");
  const [range, setRange] = useState(initialRange);
  const [page, setPage] = useState(1);
  const [overview, setOverview] = useState<OverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterError, setFilterError] = useState("");
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [correctionError, setCorrectionError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const loadCorrections = useCallback(async (signal: AbortSignal) => {
    setCorrectionError("");
    try {
      const response = await fetch("/api/attendance/hr/corrections?status=PENDING&page=1", { cache: "no-store", credentials: "same-origin", signal });
      const body = (await response.json()) as CorrectionResponse;
      if (!response.ok) throw new Error(body.error || "دریافت درخواست‌های اصلاح ناموفق بود.");
      if (!Number.isSafeInteger(body.pagination?.total) || (body.pagination?.total ?? -1) < 0) throw new Error("پاسخ درخواست‌های اصلاح معتبر نیست.");
      if (!signal.aborted) setPendingCount(body.pagination!.total);
    } catch (cause) {
      if (signal.aborted) return;
      setPendingCount(null);
      setCorrectionError(cause instanceof Error ? cause.message : "خطا در دریافت درخواست‌ها");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadCorrections(controller.signal);
    return () => controller.abort();
  }, [loadCorrections, refreshKey]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({ page: String(page), from: range.from, to: range.to });
        if (search) params.set("search", search);
        const response = await fetch(`/api/attendance/hr/overview?${params}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = (await response.json()) as OverviewResponse;
        if (!response.ok) throw new Error(body.error || "دریافت گزارش کارکنان ناموفق بود.");
        if (!Array.isArray(body.rows) || !body.pagination || !Number.isSafeInteger(body.pagination.total)) throw new Error("ساختار پاسخ گزارش معتبر نیست.");
        if (!controller.signal.aborted) setOverview(body);
      } catch (cause) {
        if (controller.signal.aborted) return;
        setOverview(null);
        setError(cause instanceof Error ? cause.message : "خطا در دریافت گزارش");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [page, range, search, refreshKey]);

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const from = jalaliToGregorian(fromInput);
    const to = jalaliToGregorian(toInput);
    if (!from || !to || from > to) {
      setFilterError("بازه تاریخ را به‌درستی انتخاب کنید.");
      return;
    }
    const span = (new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86400000;
    if (!Number.isFinite(span) || span > 366) {
      setFilterError("حداکثر بازه مجاز ۳۶۷ روز است.");
      return;
    }
    if (searchInput.trim().length > 100) {
      setFilterError("جست‌وجو نباید بیشتر از ۱۰۰ نویسه باشد.");
      return;
    }
    setFilterError("");
    setPage(1);
    setSearch(searchInput.trim());
    setRange({ from, to });
  }

  return (
    <main dir="rtl" className="mx-auto max-w-7xl space-y-6 p-3 text-slate-900 sm:p-4 md:p-6 [[data-theme=dark]_&]:text-slate-100">
      <header className={`${panel} flex flex-wrap items-start justify-between gap-4 p-5 sm:p-7`}>
        <div className="flex items-start gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white"><CalendarCheck2 size={27} /></span>
          <div>
            <p className="text-xs font-semibold text-blue-600 [[data-theme=dark]_&]:text-blue-300">منابع انسانی / مدیریت تردد</p>
            <h1 className="mt-1 text-xl font-black sm:text-2xl">داشبورد حضور و غیاب</h1>
            <p className="mt-2 text-sm leading-7 text-slate-500 [[data-theme=dark]_&]:text-slate-400">گزارش واقعی کارکنان، کارکرد موقت و موارد نیازمند بررسی</p>
          </div>
        </div>
        <button type="button" className={buttonClass} onClick={() => setRefreshKey((key) => key + 1)} disabled={loading}>
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> به‌روزرسانی
        </button>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <section className={`${panel} p-5`}>
          <ClipboardCheck className="text-amber-600" size={23} />
          <p className="mt-3 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">اصلاحات در انتظار بررسی</p>
          <p className="mt-1 text-3xl font-black">{pendingCount === null ? "—" : number(pendingCount)}</p>
          <Link href="/hr/attendance/corrections" className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline [[data-theme=dark]_&]:text-blue-300">بررسی درخواست‌ها <ArrowUpLeft size={15} /></Link>
          {correctionError && <p className="mt-2 text-xs text-amber-700 [[data-theme=dark]_&]:text-amber-300">آمار اصلاحات در دسترس نیست؛ ممکن است مجوز جداگانه لازم باشد.</p>}
        </section>
        <section className={`${panel} p-5`}>
          <UsersRound className="text-blue-600" size={23} />
          <p className="mt-3 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">کارکنان مطابق فیلتر جست‌وجو</p>
          <p className="mt-1 text-3xl font-black">{overview ? number(overview.pagination.total) : "—"}</p>
          <p className="mt-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">تعداد افراد، مستقل از تعداد سمت‌های سازمانی</p>
        </section>
        <section className={`${panel} p-5 sm:col-span-2 lg:col-span-1`}>
          <AlertTriangle className="text-orange-600" size={23} />
          <p className="mt-3 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">نیازمند بررسی در صفحه فعلی</p>
          <p className="mt-1 text-3xl font-black">{overview ? number(overview.rows.filter((row) => row.needsReview).length) : "—"}</p>
          <p className="mt-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">فقط کارکنان همین صفحه؛ نه کل سازمان</p>
        </section>
      </div>

      <section className={`${panel} overflow-hidden`} aria-labelledby="employees-title">
        <div className="border-b border-slate-200 p-5 [[data-theme=dark]_&]:border-white/10">
          <h2 id="employees-title" className="text-base font-black">گزارش کارکنان</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500 [[data-theme=dark]_&]:text-slate-400">بازه گزارش را با تقویم شمسی انتخاب کنید یا دستی وارد کنید؛ تبدیل به میلادی فقط برای ارسال به API انجام می‌شود. محاسبه نهایی حقوق و مرخصی در این گزارش انجام نمی‌شود.</p>
          <form onSubmit={applyFilters} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_170px_170px_auto] lg:items-end">
            <label className="text-xs font-semibold">جست‌وجوی نام یا کد پرسنلی
              <span className="relative mt-2 block"><Search size={16} className="pointer-events-none absolute right-3 top-3 text-slate-400" /><input className={`${inputClass} pr-9`} value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="نام یا کد پرسنلی" maxLength={100} /></span>
            </label>
            <JalaliCalendarField label="از تاریخ (شمسی)" value={fromInput} onChange={setFromInput} />
            <JalaliCalendarField label="تا تاریخ (شمسی)" value={toInput} onChange={setToInput} />
            <button type="submit" className="min-h-10 rounded-xl bg-blue-600 px-5 py-2 text-sm font-bold text-white hover:bg-blue-700">اعمال فیلتر</button>
          </form>
          {filterError && <p role="alert" className="mt-3 text-sm text-rose-600">{filterError}</p>}
        </div>

        {error && <p role="alert" className="m-5 rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300">{error}</p>}
        {loading && <p role="status" className="p-8 text-center text-sm text-slate-500">در حال دریافت اطلاعات کارکنان...</p>}
        {!loading && overview && overview.rows.length === 0 && <p className="p-10 text-center text-sm text-slate-500">کارمندی مطابق فیلتر انتخابی یافت نشد.</p>}
        {!loading && overview && overview.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[930px] text-right text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600 [[data-theme=dark]_&]:bg-white/[0.04] [[data-theme=dark]_&]:text-slate-300">
                <tr><th scope="col" className="p-4">کارمند</th><th scope="col" className="p-4">وضعیت اشتغال</th><th scope="col" className="p-4">تاریخ استخدام</th><th scope="col" className="p-4">روزهای ثبت‌شده</th><th scope="col" className="p-4">کارکرد موقت</th><th scope="col" className="p-4">رکورد باز</th><th scope="col" className="p-4">روز مبهم</th><th scope="col" className="p-4">بررسی</th><th scope="col" className="p-4">جزئیات</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 [[data-theme=dark]_&]:divide-white/10">
                {overview.rows.map((row) => (
                  <tr key={row.userId} className="hover:bg-blue-500/[0.04]">
                    <td className="p-4"><div className="font-bold">{row.fullName}</div><div className="mt-1 text-xs text-slate-500">{row.personnelCode || "بدون کد پرسنلی"}</div></td>
                    <td className="p-4"><div>{row.employmentStatus === "ACTIVE" ? "شاغل" : row.employmentStatus}</div>{!row.accountActive && <span className="text-xs text-amber-600">حساب غیرفعال</span>}</td>
                    <td className="p-4 whitespace-nowrap">{jalaliDate(row.hireDate)}</td>
                    <td className="p-4 tabular-nums">{number(row.recordedDays)}</td>
                    <td className="p-4 whitespace-nowrap tabular-nums">{minutes(row.provisionalWorkedMinutes)}</td>
                    <td className="p-4 tabular-nums">{number(row.openRecordDays)}</td>
                    <td className="p-4 tabular-nums">{number(row.ambiguousDays)}</td>
                    <td className="p-4">{row.needsReview ? <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 [[data-theme=dark]_&]:text-amber-300">نیازمند بررسی</span> : <span className="text-xs text-slate-500">بدون هشدار ثبت‌شده</span>}</td>
                    <td className="p-4"><Link className="whitespace-nowrap font-bold text-blue-600 hover:underline [[data-theme=dark]_&]:text-blue-300" href={`/hr/attendance/employees/${encodeURIComponent(row.userId)}?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>مشاهده ترددها</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {overview && !loading && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4 [[data-theme=dark]_&]:border-white/10">
            <p className="text-xs text-slate-500">صفحه {number(overview.pagination.page)} از {number(Math.max(1, overview.pagination.pages))} — مجموع {number(overview.pagination.total)} کارمند</p>
            <div className="flex gap-2">
              <button className={buttonClass} type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronRight size={16} /> قبلی</button>
              <button className={buttonClass} type="button" disabled={page >= overview.pagination.pages} onClick={() => setPage((p) => p + 1)}>بعدی <ChevronLeft size={16} /></button>
            </div>
          </div>
        )}
      </section>
      <div className={`${panel} flex flex-wrap items-center justify-between gap-3 p-4 text-xs leading-6 text-slate-500 [[data-theme=dark]_&]:text-slate-400`}>
        <span className="flex items-center gap-2"><Clock3 size={18} className="text-blue-500" /> مجموع کارکرد موقت است؛ روزهای مبهم و رکوردهای باز در آن محاسبه نشده‌اند.</span>
        <Link href="/hr/personnel/current" className="inline-flex items-center gap-1 font-bold text-blue-600 [[data-theme=dark]_&]:text-blue-300">پرونده کارکنان <ArrowUpLeft size={15} /></Link>
      </div>
    </main>
  );
}
