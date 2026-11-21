
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import Link from "next/link";

import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Info,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";

type Balance = {
  leaveTypeKey: string;
  monthlyCreditMinutes: number;
  approvedUsageMinutes: number;
  reversalMinutes: number;
  adjustmentMinutes: number;
  balanceMinutes: number;
};

type EmployeeRow = {
  employeeUserId: string;
  fullName: string;
  personnelCode: string | null;
  employmentStatus: string;
  balances: Balance[];
};

type ResponseData = {
  rows: EmployeeRow[];
  leaveTypes: string[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
  note: string;
  error?: string;
};

const fmt = new Intl.NumberFormat("fa-IR");

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

const leaveLabels: Record<string, string> = {
  annual: "استحقاقی",
  hourly: "ساعتی",
  unpaid: "بدون حقوق",
  sick: "استعلاجی",
  maternity: "زایمان",
  marriage: "ازدواج",
  bereavement: "فوت بستگان",
};

const glass =
  "relative overflow-hidden rounded-[24px] border border-white/[0.12] " +
  "bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-white/[0.025] " +
  "shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] " +
  "backdrop-blur-2xl";

const glassInner =
  "rounded-2xl border border-white/[0.08] " +
  "bg-gradient-to-br from-white/[0.075] to-white/[0.025] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]";

const inputClass =
  "w-full min-w-0 rounded-xl border border-white/[0.12] " +
  "bg-[#07132b]/75 px-4 py-3 text-sm text-white " +
  "outline-none transition-all duration-200 " +
  "placeholder:text-slate-500 " +
  "focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-white/[0.12] bg-white/[0.06] " +
  "px-4 py-2.5 text-sm font-medium text-slate-200 " +
  "transition-all hover:border-sky-300/30 hover:bg-white/[0.1] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-sky-300/25 " +
  "bg-gradient-to-r from-blue-600/90 to-sky-500/90 " +
  "px-5 py-2.5 text-sm font-semibold text-white " +
  "shadow-[0_6px_22px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "transition-all hover:from-blue-500 hover:to-sky-400 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

function leaveLabel(key: string) {
  return leaveLabels[key.toLowerCase()] ?? key;
}

function formatMinutes(value: number) {
  const sign = value < 0 ? "−" : "";
  const abs = Math.abs(value);
  const hours = Math.floor(abs / 60);
  const minutes = Math.floor(abs % 60);

  return (
    sign +
    fmt.format(hours) +
    ":" +
    String(minutes).padStart(2, "0")
  );
}

function GlassShine() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <div className="absolute -left-24 -top-32 h-64 w-64 rounded-full bg-sky-400/[0.07] blur-3xl" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof Users;
  tone: "blue" | "green" | "amber";
}) {
  const colors = {
    blue: "border-sky-400/15 bg-sky-400/10 text-sky-300",
    green:
      "border-emerald-400/15 bg-emerald-400/10 text-emerald-300",
    amber:
      "border-amber-400/15 bg-amber-400/10 text-amber-300",
  };

  return (
    <div className={`${glassInner} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-400">{title}</p>

        <div
          className={
            "flex h-10 w-10 items-center justify-center rounded-xl border " +
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

export default function HrLeavePage() {
  const [openingUserId, setOpeningUserId] = useState("");
  const [openingType, setOpeningType] = useState("ANNUAL");
  const [openingHours, setOpeningHours] = useState("0");
  const [openingMinutes, setOpeningMinutes] = useState("0");
  const [openingNegative, setOpeningNegative] = useState(false);
  const [openingYear, setOpeningYear] = useState("1405");
  const [openingMonth, setOpeningMonth] = useState("9");
  const [openingNote, setOpeningNote] = useState("");
  const [openingMessage, setOpeningMessage] = useState("");
  const [openingMessageError, setOpeningMessageError] = useState(false);
  const [openingBusy, setOpeningBusy] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [leaveTypeKey, setLeaveTypeKey] = useState("");
  const [page, setPage] = useState(1);
  const [refresh, setRefresh] = useState(0);

  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams({
          page: String(page),
        });

        if (search) {
          params.set("search", search);
        }

        if (leaveTypeKey) {
          params.set("leaveTypeKey", leaveTypeKey);
        }

        const response = await fetch(
          `/api/attendance/hr/leave/balances?${params}`,
          {
            cache: "no-store",
            signal,
          }
        );

        const result =
          (await response.json()) as ResponseData;

        if (!response.ok) {
          throw new Error(
            result.error || "خطا در دریافت مانده مرخصی"
          );
        }

        if (!signal.aborted) {
          setData(result);
        }
      } catch (caught) {
        if (!signal.aborted) {
          setData(null);
          setError(
            caught instanceof Error
              ? caught.message
              : "خطای ناشناخته"
          );
        }
      } finally {
        if (!signal.aborted) {
          setLoading(false);
        }
      }
    },
    [page, search, leaveTypeKey]
  );

  useEffect(() => {
    const controller = new AbortController();

    void load(controller.signal);

    return () => controller.abort();
  }, [load, refresh]);

  const summary = useMemo(() => {
    const rows = data?.rows ?? [];

    return {
      employees: data?.pagination.total ?? 0,
      balances: rows.reduce(
        (sum, row) => sum + row.balances.length,
        0
      ),
      negative: rows.reduce(
        (sum, row) =>
          sum +
          row.balances.filter(
            (balance) => balance.balanceMinutes < 0
          ).length,
        0
      ),
    };
  }, [data]);

  async function submitOpening(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (openingBusy) return;

    setOpeningMessage("");
    setOpeningMessageError(false);

    const hours = Number(openingHours);
    const minutes = Number(openingMinutes);

    if (
      !openingUserId ||
      !Number.isSafeInteger(hours) ||
      hours < 0 ||
      hours > 10000 ||
      !Number.isInteger(minutes) ||
      minutes < 0 ||
      minutes > 59
    ) {
      setOpeningMessage(
        "کارمند یا مقدار ساعت و دقیقه معتبر نیست."
      );
      setOpeningMessageError(true);
      return;
    }

    if (
      !window.confirm(
        "مانده افتتاحیه فقط یک‌بار ثبت می‌شود و قابل حذف نیست. آیا از ثبت قطعی آن اطمینان دارید؟"
      )
    ) {
      return;
    }

    setOpeningBusy(true);

    try {
      const response = await fetch(
        "/api/attendance/hr/leave/opening",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeUserId: openingUserId,
            leaveTypeKey: openingType,
            openingMinutes:
              (hours * 60 + minutes) *
              (openingNegative ? -1 : 1),
            startJalaliYear: Number(openingYear),
            startJalaliMonth: Number(openingMonth),
            note: openingNote,
          }),
        }
      );

      const result = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          result.error ?? "ثبت مانده افتتاحیه ناموفق بود"
        );
      }

      setOpeningMessage("مانده افتتاحیه با موفقیت ثبت شد.");
      setOpeningMessageError(false);
      setRefresh((value) => value + 1);
    } catch (err) {
      setOpeningMessage(
        err instanceof Error
          ? err.message
          : "خطای نامشخص"
      );
      setOpeningMessageError(true);
    } finally {
      setOpeningBusy(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative isolate min-h-full space-y-6 overflow-hidden p-4 text-slate-100 sm:p-6"
    >
      {/* Ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -right-40 top-0 h-[420px] w-[420px] rounded-full bg-blue-500/[0.07] blur-[110px]" />
        <div className="absolute -left-40 top-[450px] h-[450px] w-[450px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <span>منابع انسانی</span>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-sky-300">
              مانده مرخصی کارکنان
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`${glassInner} flex h-12 w-12 items-center justify-center`}
            >
              <Wallet className="h-6 w-6 text-sky-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                مانده مرخصی کارکنان
              </h1>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                گزارش دفتر مرخصی و مدیریت مانده افتتاحیه کارکنان
              </p>
            </div>
          </div>
        </div>

        <Link
          href="/hr/attendance"
          className={buttonClass}
        >
          <ArrowRight className="h-4 w-4" />
          بازگشت به حضور و غیاب
        </Link>
      </header>

      {/* Summary */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-4">
          <h2 className="flex items-center gap-2 font-semibold">
            <FileSpreadsheet className="h-5 w-5 text-sky-300" />
            نمای کلی مانده‌ها
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            آمار مانده‌ها مربوط به کارکنان صفحه فعلی است،
            به‌جز تعداد کل کارکنان.
          </p>
        </div>

        <div className="relative grid grid-cols-2 gap-3 xl:grid-cols-3">
          <MetricCard
            title="کل کارکنان"
            value={fmt.format(summary.employees)}
            icon={Users}
            tone="blue"
          />

          <MetricCard
            title="مانده‌های ثبت‌شده در صفحه"
            value={fmt.format(summary.balances)}
            icon={Wallet}
            tone="green"
          />

          <MetricCard
            title="مانده‌های منفی در صفحه"
            value={fmt.format(summary.negative)}
            icon={AlertCircle}
            tone="amber"
          />
        </div>
      </section>

      {/* Opening balance */}
      <details className={`${glass} group/opening`}>
        <GlassShine />

        <summary className="relative flex cursor-pointer list-none items-center justify-between gap-3 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-amber-400/15 bg-amber-400/10">
              <ShieldAlert className="h-5 w-5 text-amber-300" />
            </div>

            <div>
              <h2 className="text-sm font-semibold sm:text-base">
                ثبت مانده افتتاحیه کارکنان قدیمی
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                عملیات یک‌باره و قطعی — مخصوص مدیر منابع انسانی
              </p>
            </div>
          </div>

          <ChevronDown className="h-5 w-5 shrink-0 text-slate-400 transition-transform group-open/opening:rotate-180" />
        </summary>

        <div className="relative border-t border-white/[0.08] p-4 sm:p-5">
          <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-4">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

            <p className="text-xs leading-7 text-amber-200/90">
              مانده افتتاحیه فقط یک‌بار ثبت می‌شود و قابل حذف
              نیست. قبل از ثبت، اطلاعات کارمند، مقدار مانده
              و تاریخ شروع محاسبات را بررسی کنید.
            </p>
          </div>

          <form
            onSubmit={(event) => void submitOpening(event)}
            className="grid gap-4 md:grid-cols-3"
          >
            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                کارمند
              </span>

              <select
                required
                disabled={openingBusy}
                value={openingUserId}
                onChange={(event) =>
                  setOpeningUserId(event.target.value)
                }
                className={inputClass}
              >
                <option value="">
                  انتخاب کارمند از صفحه جاری
                </option>

                {(data?.rows ?? []).map((row) => (
                  <option
                    key={row.employeeUserId}
                    value={row.employeeUserId}
                  >
                    {row.fullName} (
                    {row.personnelCode ?? "بدون کد"})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                نوع مرخصی
              </span>

              <input
                required
                pattern="[a-zA-Z0-9_-]+"
                maxLength={60}
                disabled={openingBusy}
                value={openingType}
                onChange={(event) =>
                  setOpeningType(event.target.value)
                }
                className={inputClass}
                placeholder="annual"
                dir="ltr"
              />

              <span className="text-xs text-slate-500">
                شناسه انگلیسی نوع مرخصی
              </span>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                ساعت
              </span>

              <input
                type="number"
                min="0"
                max="10000"
                required
                disabled={openingBusy}
                value={openingHours}
                onChange={(event) =>
                  setOpeningHours(event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                دقیقه
              </span>

              <input
                type="number"
                min="0"
                max="59"
                required
                disabled={openingBusy}
                value={openingMinutes}
                onChange={(event) =>
                  setOpeningMinutes(event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className={`${glassInner} flex items-center gap-3 p-4 text-sm`}>
              <input
                type="checkbox"
                checked={openingNegative}
                disabled={openingBusy}
                onChange={(event) =>
                  setOpeningNegative(event.target.checked)
                }
                className="h-4 w-4 accent-sky-500"
              />

              <span className="text-slate-200">
                ثبت مانده منفی
              </span>
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                سال شروع محاسبات
              </span>

              <input
                type="number"
                min="1300"
                max="1600"
                required
                disabled={openingBusy}
                value={openingYear}
                onChange={(event) =>
                  setOpeningYear(event.target.value)
                }
                className={inputClass}
              />
            </label>

            <label className="grid gap-2 text-sm">
              <span className="text-slate-300">
                ماه شروع محاسبات
              </span>

              <select
                value={openingMonth}
                disabled={openingBusy}
                onChange={(event) =>
                  setOpeningMonth(event.target.value)
                }
                className={inputClass}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm md:col-span-2">
              <span className="text-slate-300">
                توضیح و مستند مبنای مانده
              </span>

              <input
                required
                maxLength={1000}
                disabled={openingBusy}
                value={openingNote}
                onChange={(event) =>
                  setOpeningNote(event.target.value)
                }
                className={inputClass}
                placeholder="مبنای ثبت مانده افتتاحیه را توضیح دهید..."
              />
            </label>

            <div className="flex flex-col gap-3 md:col-span-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-xs leading-6 text-amber-300/90">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                ماه شروع، اولین ماه مجاز برای اعتباردهی
                خودکار است. ماه‌های قبل از آن اعتبار نمی‌گیرند.
              </p>

              <button
                type="submit"
                disabled={openingBusy}
                className={primaryButton}
              >
                {openingBusy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    در حال ثبت...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    ثبت قطعی مانده افتتاحیه
                  </>
                )}
              </button>
            </div>

            {openingMessage && (
              <div
                role={openingMessageError ? "alert" : "status"}
                className={
                  "flex items-start gap-2 rounded-xl border p-3 text-sm md:col-span-3 " +
                  (openingMessageError
                    ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                    : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200")
                }
              >
                {openingMessageError ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}

                {openingMessage}
              </div>
            )}
          </form>
        </div>
      </details>

      {/* Filters */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-4 flex items-center gap-2">
          <Search className="h-5 w-5 text-sky-300" />
          <h2 className="font-semibold">
            جست‌وجو و فیلتر مانده‌ها
          </h2>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setSearch(searchInput.trim());
          }}
          className="relative flex flex-wrap items-end gap-3"
        >
          <label className="grid min-w-[220px] flex-1 gap-2 text-sm">
            <span className="text-slate-300">
              جست‌وجوی کارمند یا کد پرسنلی
            </span>

            <input
              value={searchInput}
              maxLength={100}
              onChange={(event) =>
                setSearchInput(event.target.value)
              }
              placeholder="نام یا کد پرسنلی"
              className={inputClass}
            />
          </label>

          <label className="grid min-w-[180px] gap-2 text-sm">
            <span className="text-slate-300">
              نوع مرخصی
            </span>

            <select
              value={leaveTypeKey}
              onChange={(event) => {
                setLeaveTypeKey(event.target.value);
                setPage(1);
              }}
              className={inputClass}
            >
              <option value="">
                همه انواع مرخصی
              </option>

              {(data?.leaveTypes ?? []).map((key) => (
                <option key={key} value={key}>
                  {leaveLabel(key)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            disabled={loading}
            className={primaryButton}
          >
            <Search className="h-4 w-4" />
            جست‌وجو
          </button>

          <button
            type="button"
            disabled={loading}
            onClick={() =>
              setRefresh((value) => value + 1)
            }
            className={buttonClass}
          >
            <RefreshCw
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            به‌روزرسانی
          </button>
        </form>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div
          role="status"
          className={`${glass} flex min-h-40 items-center justify-center gap-3 text-slate-400`}
        >
          <Loader2 className="h-6 w-6 animate-spin text-sky-300" />
          در حال دریافت اطلاعات...
        </div>
      )}

      {!loading && data && (
        <>
          {data.note && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/15 bg-amber-400/[0.06] p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />

              <p className="text-xs leading-7 text-amber-200/90">
                {data.note}
              </p>
            </div>
          )}

          {/* Table */}
          <section className={glass}>
            <GlassShine />

            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] p-4 sm:p-5">
              <div>
                <h2 className="flex items-center gap-2 font-semibold">
                  <FileSpreadsheet className="h-5 w-5 text-sky-300" />
                  جدول مانده مرخصی کارکنان
                </h2>

                <p className="mt-1 text-xs text-slate-400">
                  اعتبار، مصرف، برگشت و اصلاحات ثبت‌شده
                </p>
              </div>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                {fmt.format(data.pagination.total)} کارمند
              </span>
            </div>

            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-right text-sm">
                <thead>
                  <tr className="border-b border-white/[0.09] bg-white/[0.06] text-xs text-slate-300">
                    {[
                      "کارمند",
                      "کد پرسنلی",
                      "وضعیت",
                      "نوع مرخصی",
                      "اعتبار ثبت‌شده",
                      "مصرف تأییدشده",
                      "برگشت مصرف",
                      "اصلاحات",
                      "مانده",
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
                  {data.rows.flatMap((employee) => {
                    const entries = employee.balances.length
                      ? employee.balances
                      : [null];

                    return entries.map((balance, index) => (
                      <tr
                        key={`${employee.employeeUserId}-${balance?.leaveTypeKey ?? "none"}`}
                        className="border-b border-white/[0.06] transition-colors last:border-0 hover:bg-white/[0.055]"
                      >
                        <td className="px-4 py-4 font-semibold text-slate-100">
                          {index === 0
                            ? employee.fullName
                            : ""}
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          {index === 0
                            ? employee.personnelCode ?? "—"
                            : ""}
                        </td>

                        <td className="px-4 py-4">
                          {index === 0 && (
                            <span className="rounded-full border border-sky-400/15 bg-sky-400/10 px-3 py-1.5 text-xs text-sky-300">
                              {employee.employmentStatus}
                            </span>
                          )}
                        </td>

                        <td className="whitespace-nowrap px-4 py-4 text-slate-200">
                          {balance
                            ? leaveLabel(balance.leaveTypeKey)
                            : "تراکنشی ثبت نشده"}
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          <span dir="ltr" className="inline-block tabular-nums">
                            {balance
                              ? formatMinutes(balance.monthlyCreditMinutes)
                              : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-amber-300">
                          <span dir="ltr" className="inline-block tabular-nums">
                            {balance
                              ? formatMinutes(balance.approvedUsageMinutes)
                              : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-emerald-300">
                          <span dir="ltr" className="inline-block tabular-nums">
                            {balance
                              ? formatMinutes(balance.reversalMinutes)
                              : "—"}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-slate-300">
                          <span dir="ltr" className="inline-block tabular-nums">
                            {balance
                              ? formatMinutes(balance.adjustmentMinutes)
                              : "—"}
                          </span>
                        </td>

                        <td
                          className={
                            "px-4 py-4 font-bold " +
                            (balance && balance.balanceMinutes < 0
                              ? "text-rose-300"
                              : "text-emerald-300")
                          }
                        >
                          <span dir="ltr" className="inline-block tabular-nums">
                            {balance
                              ? formatMinutes(balance.balanceMinutes)
                              : "نامشخص"}
                          </span>
                        </td>
                      </tr>
                    ));
                  })}
                </tbody>
              </table>

              {data.rows.length === 0 && (
                <div className="flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center">
                  <Users className="h-8 w-8 text-slate-500" />

                  <p className="text-sm text-slate-400">
                    کارمندی با این شرایط یافت نشد.
                  </p>
                </div>
              )}
            </div>

            {/* Pagination */}
            <div className="relative flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.08] p-4 sm:p-5">
              <p className="text-xs text-slate-400">
                تعداد کارکنان:{" "}
                <span className="font-semibold text-slate-200">
                  {fmt.format(data.pagination.total)}
                </span>
              </p>

              <nav
                aria-label="صفحه‌بندی مانده‌ها"
                className="flex items-center gap-3"
              >
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() =>
                    setPage((value) => value - 1)
                  }
                  className={buttonClass}
                >
                  <ChevronRight className="h-4 w-4" />
                  قبلی
                </button>

                <span className="whitespace-nowrap text-xs text-slate-300">
                  {fmt.format(page)} از{" "}
                  {fmt.format(
                    Math.max(1, data.pagination.pages)
                  )}
                </span>

                <button
                  type="button"
                  disabled={
                    page >= data.pagination.pages || loading
                  }
                  onClick={() =>
                    setPage((value) => value + 1)
                  }
                  className={buttonClass}
                >
                  بعدی
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </nav>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
