"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
type Row = {
  employeeUserId: string;
  fullName: string;
  personnelCode: string | null;
  employmentStatus: string | null;
  requiredMinutes: number;
  workedMinutes: number; holidayWorkMinutes: number;
  approvedLeaveMinutes: number;
  overtimeMinutes: number;
  uncoveredMinutes: number;
  unresolvedCount: number;
  calculationVersion: number;
  calculatedAt: string | null;
};
type ResponseData = {
  period: {
    status: string;
    revision: number;
    calculatedAt: string | null;
    closedAt: string | null;
  } | null;
  rows: Row[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  note: string;
  error?: string;
};
const monthNames = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];
const fmt = new Intl.NumberFormat("fa-IR");
const glass =
  "relative overflow-hidden rounded-[24px] border border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.12] " +
  "bg-gradient-to-br from-white/95 via-slate-50/90 to-white/85 group-data-[theme=dark]/theme:from-white/[0.12] group-data-[theme=dark]/theme:via-white/[0.055] group-data-[theme=dark]/theme:to-white/[0.025] " +
  "shadow-[0_12px_40px_rgba(15,23,42,0.07)] group-data-[theme=dark]/theme:shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] " +
  "backdrop-blur-2xl";
const glassInner =
  "rounded-2xl border border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.08] " +
  "bg-gradient-to-br from-white/90 to-slate-50/80 group-data-[theme=dark]/theme:from-white/[0.075] group-data-[theme=dark]/theme:to-white/[0.025] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] group-data-[theme=dark]/theme:shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]";
const inputStyle =
  "w-full rounded-xl border border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.12] " +
  "bg-white/85 group-data-[theme=dark]/theme:bg-[#07132b]/65 px-4 py-3 text-sm text-slate-900 group-data-[theme=dark]/theme:text-white " +
  "outline-none transition-all duration-200 " +
  "focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10";
const buttonStyle =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.12] bg-slate-100/80 group-data-[theme=dark]/theme:bg-white/[0.06] " +
  "px-4 py-2.5 text-sm font-medium text-slate-700 group-data-[theme=dark]/theme:text-slate-200 " +
  "transition-all hover:border-sky-300/30 hover:bg-slate-200/70 group-data-[theme=dark]/theme:hover:bg-white/[0.1] " +
  "disabled:cursor-not-allowed disabled:opacity-40";
function minuteLabel(value: number): string {
  const n = Number.isFinite(value) ? Math.max(0, value) : 0;
  const hours = Math.floor(n / 60);
  const minutes = Math.floor(n % 60);
  return `${fmt.format(hours)}:${String(minutes).padStart(2, "0")}`;
}
function currentMonth() {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
    timeZone: "Asia/Tehran",
    year: "numeric",
    month: "numeric",
  }).formatToParts(new Date());
  return {
    year: Number(parts.find((p) => p.type === "year")?.value),
    month: Number(parts.find((p) => p.type === "month")?.value),
  };
}
function formatDateTime(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(date);
}
function periodStatusLabel(status: string | undefined) {
  if (!status) return "ثبت نشده";
  const labels: Record<string, string> = {
    OPEN: "باز",
    CALCULATED: "محاسبه‌شده",
    CLOSED: "بسته‌شده",
    FINALIZED: "نهایی‌شده",
    LOCKED: "قفل‌شده",
  };
  return labels[status] ?? status;
}
function GlassShine() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <div className="absolute -left-24 -top-32 h-64 w-64 rounded-full bg-sky-400/[0.07] blur-3xl" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/70 group-data-[theme=dark]/theme:via-white/20 to-transparent" />
    </div>
  );
}
function SummaryCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Clock3;
  tone: "blue" | "green" | "amber" | "rose";
}) {
  const colors = {
    blue: "bg-sky-100/80 group-data-[theme=dark]/theme:bg-sky-400/10 text-sky-700 group-data-[theme=dark]/theme:text-sky-300 border-sky-400/15",
    green:
      "bg-emerald-100/80 group-data-[theme=dark]/theme:bg-emerald-400/10 text-emerald-700 group-data-[theme=dark]/theme:text-emerald-300 border-emerald-400/15",
    amber:
      "bg-amber-100/80 group-data-[theme=dark]/theme:bg-amber-400/10 text-amber-700 group-data-[theme=dark]/theme:text-amber-300 border-amber-400/15",
    rose: "bg-rose-400/10 text-rose-700 group-data-[theme=dark]/theme:text-rose-300 border-rose-400/15",
  };
  return (
    <div className={`${glassInner} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">{title}</p>
        <div
          className={
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border " +
            colors[tone]
          }
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 text-xl font-bold tabular-nums">
        {value}
      </p>
    </div>
  );
}
function CalculationBadge({ row }: { row: Row }) {
  if (row.unresolvedCount > 0) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-amber-400/20 bg-amber-100/80 group-data-[theme=dark]/theme:bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-700 group-data-[theme=dark]/theme:text-amber-300">
        <AlertCircle className="h-3.5 w-3.5" />
        نیازمند بررسی
      </span>
    );
  }
  if (row.calculatedAt) {
    return (
      <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-emerald-400/20 bg-emerald-100/80 group-data-[theme=dark]/theme:bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-700 group-data-[theme=dark]/theme:text-emerald-300">
        <CheckCircle2 className="h-3.5 w-3.5" />
        محاسبه‌شده
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-400/20 bg-slate-100 group-data-[theme=dark]/theme:bg-slate-400/10 px-3 py-1.5 text-xs font-medium text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
      <Clock3 className="h-3.5 w-3.5" />
      محاسبه‌نشده
    </span>
  );
}
export default function MonthlyAttendancePage() {
  const [initial] = useState(currentMonth);
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams({
          year: String(year),
          month: String(month),
          page: String(page),
        });
        const response = await fetch(
          `/api/attendance/hr/monthly?${params.toString()}`,
          {
            cache: "no-store",
            signal,
          }
        );
        const json = (await response.json()) as ResponseData;
        if (!response.ok) {
          throw new Error(json.error || "خطا در دریافت گزارش");
        }
        if (!signal.aborted) {
          setData(json);
        }
      } catch (err) {
        if (!signal.aborted) {
          setData(null);
          setError(
            err instanceof Error
              ? err.message
              : "خطای ناشناخته"
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [year, month, page]
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load, reload]);
  const summary = useMemo(() => {
    const rows = data?.rows ?? [];
    return {
      employees: data?.pagination.total ?? 0,
      worked: rows.reduce(
        (sum, row) => sum + row.workedMinutes,
        0
      ),
      overtime: rows.reduce(
        (sum, row) => sum + row.overtimeMinutes,
        0
      ),
      unresolved: rows.reduce(
        (sum, row) => sum + row.unresolvedCount,
        0
      ),
    };
  }, [data]);
  return (
    <main
      dir="rtl"
      className="relative isolate min-h-full space-y-6 overflow-hidden p-4 text-slate-900 group-data-[theme=dark]/theme:text-slate-100 sm:p-6"
    >
      {/* Ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -right-40 top-0 h-[420px] w-[420px] rounded-full bg-blue-400/[0.05] group-data-[theme=dark]/theme:bg-blue-500/[0.07] blur-[110px]" />
        <div className="absolute -left-40 top-[450px] h-[450px] w-[450px] rounded-full bg-cyan-400/[0.04] group-data-[theme=dark]/theme:bg-cyan-500/[0.05] blur-[120px]" />
      </div>
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
            <span>منابع انسانی</span>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-sky-700 group-data-[theme=dark]/theme:text-sky-300">
              گزارش کارکرد ماهانه
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className={`${glassInner} flex h-12 w-12 items-center justify-center`}>
              <FileSpreadsheet className="h-6 w-6 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                گزارش کارکرد ماهانه
              </h1>
              <p className="mt-1 text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400 sm:text-sm">
                نمایش محاسبات ذخیره‌شده کارکنان، بدون تغییر یا نهایی‌سازی اطلاعات
              </p>
            </div>
          </div>
        </div>
        <Link
          href="/hr/attendance"
          className={buttonStyle}
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به حضور و غیاب
        </Link>
      </header>
      {/* Filters */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />
        <div className="relative mb-4 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
          <h2 className="font-semibold">
            انتخاب دوره گزارش
          </h2>
        </div>
        <div className="relative flex flex-wrap items-end gap-3">
          <label className="grid min-w-[130px] flex-1 gap-2 text-sm sm:max-w-[180px]">
            <span className="text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
              سال شمسی
            </span>
            <input
              className={inputStyle}
              type="number"
              min={1400}
              max={1499}
              value={year}
              onChange={(event) => {
                setYear(Number(event.target.value));
                setPage(1);
              }}
            />
          </label>
          <label className="grid min-w-[150px] flex-1 gap-2 text-sm sm:max-w-[200px]">
            <span className="text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
              ماه شمسی
            </span>
            <select
              className={inputStyle}
              value={month}
              onChange={(event) => {
                setMonth(Number(event.target.value));
                setPage(1);
              }}
            >
              {monthNames.map((name, index) => (
                <option key={name} value={index + 1}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => setReload((value) => value + 1)}
            className={buttonStyle}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            به‌روزرسانی
          </button>
        </div>
      </section>
      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-50/90 group-data-[theme=dark]/theme:bg-rose-500/10 p-4 backdrop-blur-xl"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 group-data-[theme=dark]/theme:text-rose-300" />
          <p className="text-sm text-rose-800 group-data-[theme=dark]/theme:text-rose-200">{error}</p>
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div
          role="status"
          className={`${glass} flex min-h-44 flex-col items-center justify-center gap-3`}
        >
          <Loader2 className="h-7 w-7 animate-spin text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
          <p className="text-sm text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
            در حال دریافت گزارش...
          </p>
        </div>
      )}
      {!loading && data && (
        <>
          {/* Period status */}
          <section className={`${glass} p-4 sm:p-5`}>
            <GlassShine />
            <div className="relative flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <ShieldCheck className="h-5 w-5 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
                  وضعیت دوره
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className="rounded-full border border-sky-400/20 bg-sky-100/80 group-data-[theme=dark]/theme:bg-sky-400/10 px-3 py-1.5 text-xs font-medium text-sky-700 group-data-[theme=dark]/theme:text-sky-300">
                    {periodStatusLabel(data.period?.status)}
                  </span>
                  {data.period && (
                    <span className="text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                      نسخه دوره: {fmt.format(data.period.revision)}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-xs leading-7 text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                <p>
                  آخرین محاسبه:{" "}
                  {formatDateTime(data.period?.calculatedAt ?? null)}
                </p>
                <p>
                  تاریخ بستن دوره:{" "}
                  {formatDateTime(data.period?.closedAt ?? null)}
                </p>
              </div>
            </div>
            {data.note && (
              <div className="relative mt-4 flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-50/80 group-data-[theme=dark]/theme:bg-amber-400/[0.06] p-3">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 group-data-[theme=dark]/theme:text-amber-300" />
                <p className="text-xs leading-6 text-amber-800 group-data-[theme=dark]/theme:text-amber-200/90">
                  {data.note}
                </p>
              </div>
            )}
          </section>
          {/* Summary */}
          <section>
            <div className="mb-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <Activity className="h-5 w-5 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
                خلاصه گزارش
              </h2>
              <p className="mt-1 text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                جمع ساعات و موارد حل‌نشده مربوط به کارکنان صفحه فعلی است.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <SummaryCard
                title="کارکنان دارای خلاصه"
                value={fmt.format(summary.employees)}
                icon={Users}
                tone="blue"
              />
              <SummaryCard
                title="مجموع کارکرد صفحه"
                value={minuteLabel(summary.worked)}
                icon={Clock3}
                tone="green"
              />
              <SummaryCard
                title="اضافه‌کاری صفحه"
                value={minuteLabel(summary.overtime)}
                icon={Timer}
                tone="blue"
              />
              <SummaryCard
                title="موارد حل‌نشده صفحه"
                value={fmt.format(summary.unresolved)}
                icon={AlertCircle}
                tone="amber"
              />
            </div>
          </section>
          {/* Data table */}
          <section className={`${glass}`}>
            <GlassShine />
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.08] p-4 sm:p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileSpreadsheet className="h-5 w-5 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
                  جدول کارکرد کارکنان
                </h2>
                <p className="mt-1 text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                  {monthNames[month - 1]} {fmt.format(year)}
                </p>
              </div>
              <span className="rounded-full border border-slate-200/80 group-data-[theme=dark]/theme:border-white/10 bg-slate-100/80 group-data-[theme=dark]/theme:bg-white/5 px-3 py-1.5 text-xs text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                {fmt.format(data.pagination.total)} کارمند
              </span>
            </div>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[1050px] border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.09] bg-slate-100/80 group-data-[theme=dark]/theme:bg-white/[0.06] text-xs text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                    {[
                      "کارمند",
                      "کد پرسنلی",
                      "موظفی",
                      "کارکرد", "تعطیل‌کاری (شامل جمعه)",
                      "مرخصی تأییدشده",
                      "اضافه‌کاری",
                      "کسری پوشش‌داده‌نشده",
                      "موارد حل‌نشده",
                      "وضعیت محاسبه",
                    ].map((heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="whitespace-nowrap px-4 py-4 font-semibold"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((row) => (
                    <tr
                      key={row.employeeUserId}
                      className="border-b border-slate-200/70 group-data-[theme=dark]/theme:border-white/[0.06] transition-colors last:border-0 hover:bg-slate-100/70 group-data-[theme=dark]/theme:hover:bg-white/[0.055]"
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-100/80 group-data-[theme=dark]/theme:bg-sky-400/10 text-sky-700 group-data-[theme=dark]/theme:text-sky-300">
                            <Users className="h-4 w-4" />
                          </div>
                          <span className="whitespace-nowrap font-semibold text-slate-900 group-data-[theme=dark]/theme:text-slate-100">
                            {row.fullName}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                        {row.personnelCode ?? "—"}
                      </td>
                      <td className="px-4 py-4 text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.requiredMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-sky-700 group-data-[theme=dark]/theme:text-sky-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.workedMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-medium text-amber-700 group-data-[theme=dark]/theme:text-amber-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.holidayWorkMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.approvedLeaveMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-emerald-700 group-data-[theme=dark]/theme:text-emerald-300">
                        <span dir="ltr" className="inline-block tabular-nums">
                          {minuteLabel(row.overtimeMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          dir="ltr"
                          className={
                            "inline-block tabular-nums " +
                            (row.uncoveredMinutes > 0
                              ? "text-amber-700 group-data-[theme=dark]/theme:text-amber-300"
                              : "text-slate-600 group-data-[theme=dark]/theme:text-slate-300")
                          }
                        >
                          {minuteLabel(row.uncoveredMinutes)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={
                            "inline-flex min-w-8 items-center justify-center rounded-lg px-2 py-1 text-xs font-semibold " +
                            (row.unresolvedCount > 0
                              ? "bg-amber-100/80 group-data-[theme=dark]/theme:bg-amber-400/10 text-amber-700 group-data-[theme=dark]/theme:text-amber-300"
                              : "bg-emerald-100/80 group-data-[theme=dark]/theme:bg-emerald-400/10 text-emerald-700 group-data-[theme=dark]/theme:text-emerald-300")
                          }
                        >
                          {fmt.format(row.unresolvedCount)}
                        </span>
                      </td>
                      <td className="px-4 py-4">
                        <CalculationBadge row={row} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.rows.length === 0 && (
                <div className="flex min-h-44 flex-col items-center justify-center gap-3 p-5 text-center">
                  <FileSpreadsheet className="h-8 w-8 text-slate-500" />
                  <p className="text-sm text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                    برای این دوره هنوز خلاصه کارکردی ذخیره نشده است.
                  </p>
                </div>
              )}
            </div>
            {/* Pagination */}
            <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 group-data-[theme=dark]/theme:border-white/[0.08] p-4 sm:p-5">
              <p className="text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                تعداد کارکنان دارای خلاصه:{" "}
                <span className="font-semibold text-slate-700 group-data-[theme=dark]/theme:text-slate-200">
                  {fmt.format(data.pagination.total)}
                </span>
              </p>
              <nav
                aria-label="صفحه‌بندی گزارش"
                className="flex items-center gap-3"
              >
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                  className={buttonStyle}
                >
                  <ChevronRight className="h-4 w-4" />
                  قبلی
                </button>
                <span className="whitespace-nowrap text-xs text-slate-600 group-data-[theme=dark]/theme:text-slate-300">
                  {fmt.format(page)} از{" "}
                  {fmt.format(
                    Math.max(1, data.pagination.pages)
                  )}
                </span>
                <button
                  type="button"
                  disabled={page >= data.pagination.pages}
                  onClick={() => setPage((value) => value + 1)}
                  className={buttonStyle}
                >
                  بعدی
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </nav>
            </div>
          </section>
          {/* Read-only note */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-400/10 bg-sky-50/80 group-data-[theme=dark]/theme:bg-sky-400/[0.04] p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-700 group-data-[theme=dark]/theme:text-sky-300" />
            <p className="text-xs leading-6 text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
              این گزارش صرفاً برای مشاهده محاسبات ذخیره‌شده است.
              مشاهده یا به‌روزرسانی صفحه هیچ تغییری در کارکرد
              کارکنان ایجاد نمی‌کند و باعث نهایی‌سازی دوره نمی‌شود.
            </p>
          </div>
        </>
      )}
    </main>
  );
}
