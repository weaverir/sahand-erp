
"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";

import {
  AlertCircle,
  CalendarCheck2,
  CalendarDays,
  Calculator,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FileClock,
  FilePlus2,
  History,
  Info,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  XCircle,
} from "lucide-react";

import { jalaliToGregorian } from "@/modules/attendance/jalali-date";

/* ---------------------------------------------
   Types
--------------------------------------------- */

type Leave = {
  id: string;
  leaveTypeKey: string;
  startAt: string;
  endAt: string;
  requestedMinutes: number;
  status: string;
  approvalSteps: {
    requiredRole: string;
    decision: string | null;
  }[];
};

type Balance = {
  leaveTypeKey: string;
  minutes: number;
};

type Preview = {
  requestedMinutes: number;
  balanceMinutes: number | null;
  remainingMinutes: number | null;
  initialized: boolean;
};

type LeaveData = {
  requests: Leave[];
  balances: Balance[];
  initializedTypes: string[];
};

/* ---------------------------------------------
   Design system
--------------------------------------------- */

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
  "w-full rounded-xl border border-white/[0.12] " +
  "bg-[#07132b]/65 px-4 py-3 text-sm text-white " +
  "outline-none transition-all duration-200 " +
  "placeholder:text-slate-500 " +
  "focus:border-sky-400/50 focus:bg-[#0b1b38]/80 " +
  "focus:ring-4 focus:ring-sky-400/10 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-sky-300/25 " +
  "bg-gradient-to-r from-blue-600/90 to-sky-500/90 " +
  "px-5 py-3 text-sm font-semibold text-white " +
  "shadow-[0_6px_22px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "transition-all duration-200 " +
  "hover:from-blue-500 hover:to-sky-400 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-white/[0.12] bg-white/[0.06] " +
  "px-4 py-3 text-sm font-medium text-slate-200 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] " +
  "transition-all duration-200 " +
  "hover:border-sky-300/30 hover:bg-white/[0.1] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

/* ---------------------------------------------
   Labels
--------------------------------------------- */

const leaveTypeLabels: Record<string, string> = {
  annual: "استحقاقی",
  hourly: "ساعتی",
  unpaid: "بدون حقوق",
  sick: "استعلاجی",
  maternity: "زایمان",
  marriage: "ازدواج",
  bereavement: "فوت بستگان",
};

const statusLabels: Record<string, string> = {
  DRAFT: "پیش‌نویس",
  PENDING: "در انتظار بررسی",
  PARTIALLY_APPROVED: "تأیید مرحله‌ای",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

const roleLabels: Record<string, string> = {
  hr_manager: "مدیر منابع انسانی",
  ceo: "مدیرعامل",
  ceo_deputy: "قائم‌مقام مدیرعامل",
  department_manager: "مدیر واحد",
  unit_manager: "مدیر واحد",
  supervisor: "سرپرست",
};

const defaultLeaveTypes = [
  "annual",
  "hourly",
  "unpaid",
  "sick",
];

function leaveLabel(key: string) {
  return leaveTypeLabels[key.toLowerCase()] || key;
}

function roleLabel(key: string) {
  return roleLabels[key.toLowerCase()] || key;
}

function statusLabel(key: string) {
  return statusLabels[key] || key;
}

function statusStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "REJECTED":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";

    case "PENDING":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";

    case "PARTIALLY_APPROVED":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";

    case "CANCELLED":
      return "border-slate-400/20 bg-slate-400/10 text-slate-400";

    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

/* ---------------------------------------------
   Formatters
--------------------------------------------- */

function formatMinutes(value: number) {
  const absolute = Math.abs(value);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const prefix = value < 0 ? "−" : "";

  if (!hours) {
    return `${prefix}${minutes.toLocaleString("fa-IR")} دقیقه`;
  }

  if (!minutes) {
    return `${prefix}${hours.toLocaleString("fa-IR")} ساعت`;
  }

  return (
    `${prefix}${hours.toLocaleString("fa-IR")} ساعت و ` +
    `${minutes.toLocaleString("fa-IR")} دقیقه`
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
}

/* ---------------------------------------------
   Shared components
--------------------------------------------- */

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

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={
        "inline-flex items-center gap-2 rounded-full border " +
        "px-3 py-1.5 text-xs font-medium " +
        statusStyle(status)
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

function BalanceCard({
  balance,
}: {
  balance: Balance;
}) {
  const negative = balance.minutes < 0;

  return (
    <div
      className={`${glassInner} group relative overflow-hidden p-4 transition-all duration-300 hover:border-sky-300/20`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-slate-400">
            مرخصی {leaveLabel(balance.leaveTypeKey)}
          </p>

          <p
            className={
              "mt-3 text-lg font-bold sm:text-xl " +
              (negative ? "text-rose-300" : "text-slate-100")
            }
          >
            {formatMinutes(balance.minutes)}
          </p>
        </div>

        <div
          className={
            "flex h-11 w-11 items-center justify-center rounded-xl border " +
            (negative
              ? "border-rose-400/15 bg-rose-400/10 text-rose-300"
              : "border-sky-400/15 bg-sky-400/10 text-sky-300")
          }
        >
          <Wallet className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className={
            "h-full w-full rounded-full bg-gradient-to-l " +
            (negative
              ? "from-rose-400/60 to-rose-400/10"
              : "from-sky-400/60 to-blue-400/10")
          }
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------
   Main page
--------------------------------------------- */

export default function MyLeavePage() {
  const [data, setData] = useState<LeaveData | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [preview, setPreview] = useState<Preview | null>(null);

  const [type, setType] = useState("annual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:00");
  const [reason, setReason] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/attendance/me/leave",
        {
          cache: "no-store",
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "خطا در دریافت اطلاعات مرخصی"
        );
      }

      setData(body);
      setError("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطا در دریافت اطلاعات"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const availableTypes = Array.from(
    new Set([
      ...defaultLeaveTypes,
      ...(data?.balances.map((b) => b.leaveTypeKey) ?? []),
      ...(data?.initializedTypes ?? []),
      ...(data?.requests.map((r) => r.leaveTypeKey) ?? []),
      type,
    ])
  );

  function buildPayload() {
    const start = jalaliToGregorian(from);
    const end = jalaliToGregorian(to);

    if (!start || !end) {
      throw new Error("تاریخ شمسی نامعتبر است.");
    }

    const startAt = new Date(
      `${start}T${startTime}:00+03:30`
    );

    const endAt = new Date(
      `${end}T${endTime}:00+03:30`
    );

    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      !(startAt < endAt)
    ) {
      throw new Error("بازه زمانی معتبر نیست.");
    }

    return {
      leaveTypeKey: type,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      reason,
    };
  }

  async function calculatePreview() {
    if (busy) return;

    setBusy(true);
    setError("");
    setMessage("");
    setPreview(null);

    try {
      const payload = buildPayload();

      const response = await fetch(
        "/api/attendance/me/leave/preview",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "محاسبه مرخصی ناموفق بود"
        );
      }

      setPreview(body);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در محاسبه پیش‌نمایش"
      );
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    if (busy) return;

    if (
      !window.confirm(
        "آیا از انصراف این درخواست مرخصی اطمینان دارید؟"
      )
    ) {
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/attendance/me/leave/${encodeURIComponent(id)}/cancel`,
        {
          method: "POST",
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "انصراف از درخواست انجام نشد"
        );
      }

      setMessage("درخواست مرخصی با موفقیت لغو شد.");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در انصراف از درخواست"
      );
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");
    setMessage("");

    let payload: ReturnType<typeof buildPayload>;

    try {
      payload = buildPayload();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطا در اطلاعات"
      );
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(
        "/api/attendance/me/leave",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "ثبت درخواست انجام نشد"
        );
      }

      setMessage("درخواست مرخصی ثبت و برای تأیید ارسال شد.");

      setReason("");
      setPreview(null);

      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ثبت درخواست"
      );
    } finally {
      setBusy(false);
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
            <span>پرتال کارکنان</span>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-sky-300">
              درخواست و مانده مرخصی
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div
              className={`${glassInner} flex h-12 w-12 items-center justify-center`}
            >
              <CalendarCheck2 className="h-6 w-6 text-sky-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                درخواست و مانده مرخصی من
              </h1>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                مشاهده مانده، ثبت درخواست و پیگیری مراحل تأیید
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void refresh()}
          className={secondaryButton}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          به‌روزرسانی
        </button>
      </header>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 backdrop-blur-xl"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 backdrop-blur-xl"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-sm text-emerald-200">{message}</p>
        </div>
      )}

      {/* Balances */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold">
              <Wallet className="h-5 w-5 text-sky-300" />
              مانده مرخصی‌های من
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              مانده‌های محاسبه‌شده بر اساس تراکنش‌های ثبت‌شده
            </p>
          </div>

          <span className="rounded-full border border-sky-400/15 bg-sky-400/[0.07] px-3 py-1.5 text-xs text-sky-300">
            اطلاعات پرسنلی
          </span>
        </div>

        {loading && !data ? (
          <div className="flex min-h-28 items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            در حال دریافت مانده‌ها...
          </div>
        ) : data?.balances.length ? (
          <div className="relative grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.balances.map((balance) => (
              <BalanceCard
                key={balance.leaveTypeKey}
                balance={balance}
              />
            ))}
          </div>
        ) : (
          <div className={`${glassInner} relative flex items-start gap-3 p-4`}>
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />

            <div>
              <p className="text-sm font-medium text-slate-200">
                مانده مرخصی ثبت نشده است
              </p>

              <p className="mt-2 text-xs leading-6 text-slate-400">
                برای ثبت مانده افتتاحیه مرخصی با واحد منابع انسانی
                هماهنگ کنید.
              </p>
            </div>
          </div>
        )}

        <div className="relative mt-4 flex items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

          <p className="text-xs leading-6 text-slate-400">
            مانده بر اساس تراکنش‌های ثبت‌شده محاسبه می‌شود.
            ممکن است اعتبار ماه جاری هنوز محاسبه نشده باشد.
          </p>
        </div>
      </section>

      {/* New request */}
      <section className={`${glass} p-4 sm:p-6`}>
        <GlassShine />

        <div className="relative mb-6">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <FilePlus2 className="h-5 w-5 text-sky-300" />
            ثبت درخواست مرخصی جدید
          </h2>

          <p className="mt-2 text-xs text-slate-400">
            اطلاعات مرخصی را وارد کرده و پیش از ارسال، مدت آن را
            محاسبه کنید.
          </p>
        </div>

        <form
          onSubmit={(event) => void submit(event)}
          className="relative space-y-5"
        >
          {/* Leave type */}
          <div className="space-y-2">
            <label
              htmlFor="leave-type"
              className="block text-sm font-medium text-slate-200"
            >
              نوع مرخصی
            </label>

            <select
              id="leave-type"
              required
              value={type}
              disabled={busy}
              onChange={(event) => {
                setType(event.target.value);
                setPreview(null);
              }}
              className={inputClass}
            >
              {availableTypes.map((key) => (
                <option key={key} value={key}>
                  مرخصی {leaveLabel(key)}
                </option>
              ))}
            </select>
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <CalendarDays className="h-4 w-4 text-sky-300" />
                از تاریخ شمسی
              </span>

              <input
                required
                value={from}
                disabled={busy}
                onChange={(event) => {
                  setFrom(event.target.value);
                  setPreview(null);
                }}
                placeholder="۱۴۰۵/۰۹/۰۱"
                className={inputClass}
                dir="ltr"
              />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <CalendarDays className="h-4 w-4 text-sky-300" />
                تا تاریخ شمسی
              </span>

              <input
                required
                value={to}
                disabled={busy}
                onChange={(event) => {
                  setTo(event.target.value);
                  setPreview(null);
                }}
                placeholder="۱۴۰۵/۰۹/۰۱"
                className={inputClass}
                dir="ltr"
              />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Clock3 className="h-4 w-4 text-sky-300" />
                ساعت شروع
              </span>

              <input
                required
                type="time"
                value={startTime}
                disabled={busy}
                onChange={(event) => {
                  setStartTime(event.target.value);
                  setPreview(null);
                }}
                className={inputClass}
                dir="ltr"
              />
            </label>

            <label className="block space-y-2">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-200">
                <Clock3 className="h-4 w-4 text-sky-300" />
                ساعت پایان
              </span>

              <input
                required
                type="time"
                value={endTime}
                disabled={busy}
                onChange={(event) => {
                  setEndTime(event.target.value);
                  setPreview(null);
                }}
                className={inputClass}
                dir="ltr"
              />
            </label>
          </div>

          {/* Reason */}
          <label className="block space-y-2">
            <span className="text-sm font-medium text-slate-200">
              توضیحات درخواست
            </span>

            <textarea
              rows={3}
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(event) => {
                setReason(event.target.value);
                setPreview(null);
              }}
              placeholder="در صورت نیاز، توضیحات مربوط به درخواست را وارد کنید..."
              className={`${inputClass} resize-y leading-7`}
            />

            <span className="block text-left text-xs text-slate-500">
              {reason.length.toLocaleString("fa-IR")} / ۱۰۰۰
            </span>
          </label>

          {/* Calculation info */}
          <div className="flex items-start gap-3 rounded-xl border border-sky-400/10 bg-sky-400/[0.05] p-4">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-sky-300" />

            <p className="text-xs leading-7 text-slate-400">
              مدت مرخصی در سرور و بر اساس شیفت هفتگی
              تأییدشده و تعطیلات ثبت‌شده محاسبه می‌شود.
              در صورت نبود برنامه کاری تأییدشده،
              امکان ثبت درخواست وجود ندارد.
            </p>
          </div>

          {/* Preview */}
          {preview && (
            <div className={`${glassInner} space-y-4 p-4`}>
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sky-300" />

                <h3 className="text-sm font-semibold">
                  نتیجه محاسبه مرخصی
                </h3>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                  <p className="text-xs text-slate-400">
                    مدت قابل کسر
                  </p>

                  <p className="mt-2 text-sm font-bold text-sky-300">
                    {formatMinutes(preview.requestedMinutes)}
                  </p>
                </div>

                {preview.initialized ? (
                  <>
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.035] p-3">
                      <p className="text-xs text-slate-400">
                        مانده فعلی
                      </p>

                      <p className="mt-2 text-sm font-bold">
                        {preview.balanceMinutes === null
                          ? "نامشخص"
                          : formatMinutes(preview.balanceMinutes)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3">
                      <p className="text-xs text-slate-400">
                        مانده احتمالی پس از تأیید
                      </p>

                      <p className="mt-2 text-sm font-bold text-emerald-300">
                        {preview.remainingMinutes === null
                          ? "نامشخص"
                          : formatMinutes(preview.remainingMinutes)}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-3 sm:col-span-2">
                    <p className="text-sm text-amber-300">
                      مانده افتتاحیه ثبت نشده یا نامشخص است.
                    </p>
                  </div>
                )}
              </div>

              <p className="flex items-start gap-2 text-xs leading-6 text-slate-400">
                <Info className="mt-0.5 h-4 w-4 shrink-0" />
                این پیش‌نمایش قطعی نیست. هنگام ارسال درخواست،
                محاسبات دوباره در سرور انجام می‌شود.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-3 border-t border-white/[0.08] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void calculatePreview()}
              className={secondaryButton}
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Calculator className="h-4 w-4 text-sky-300" />
              )}
              محاسبه و پیش‌نمایش
            </button>

            <button
              type="submit"
              disabled={busy}
              className={primaryButton}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  لطفاً صبر کنید...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  ارسال درخواست مرخصی
                </>
              )}
            </button>
          </div>
        </form>
      </section>

      {/* Request history */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <History className="h-5 w-5 text-sky-300" />
            سوابق درخواست‌های مرخصی
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            مشاهده وضعیت درخواست‌ها و مراحل تأیید
          </p>
        </div>

        {loading && !data ? (
          <div className="flex min-h-36 items-center justify-center gap-3 text-sm text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            در حال دریافت سوابق...
          </div>
        ) : !data?.requests.length ? (
          <div className={`${glassInner} flex min-h-40 flex-col items-center justify-center gap-3 p-5 text-center`}>
            <FileClock className="h-8 w-8 text-slate-500" />

            <p className="text-sm font-medium">
              درخواستی ثبت نشده است
            </p>

            <p className="text-xs text-slate-400">
              درخواست‌های جدید شما در این بخش نمایش داده می‌شوند.
            </p>
          </div>
        ) : (
          <div className="relative space-y-3">
            {data.requests.map((request) => {
              const canWithdraw =
                request.status === "PENDING" &&
                request.approvalSteps.every(
                  (step) => step.decision === null
                );

              return (
                <article
                  key={request.id}
                  className={`${glassInner} p-4 transition-all duration-200 hover:border-sky-300/20 sm:p-5`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10">
                        <CalendarCheck2 className="h-5 w-5 text-sky-300" />
                      </div>

                      <div>
                        <h3 className="text-sm font-semibold">
                          مرخصی {leaveLabel(request.leaveTypeKey)}
                        </h3>

                        <p className="mt-1 text-xs text-slate-400">
                          {formatMinutes(request.requestedMinutes)}
                        </p>
                      </div>
                    </div>

                    <StatusBadge status={request.status} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <p className="mb-2 text-xs text-slate-500">
                        شروع مرخصی
                      </p>

                      <p className="text-sm text-slate-200">
                        {formatDateTime(request.startAt)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
                      <p className="mb-2 text-xs text-slate-500">
                        پایان مرخصی
                      </p>

                      <p className="text-sm text-slate-200">
                        {formatDateTime(request.endAt)}
                      </p>
                    </div>
                  </div>

                  {/* Approval steps */}
                  {request.approvalSteps.length > 0 && (
                    <div className="mt-4 border-t border-white/[0.07] pt-4">
                      <p className="mb-3 flex items-center gap-2 text-xs font-medium text-slate-400">
                        <ShieldCheck className="h-4 w-4 text-sky-300" />
                        مراحل تأیید
                      </p>

                      <div className="flex flex-wrap gap-2">
                        {request.approvalSteps.map((step, index) => {
                          const approved =
                            step.decision === "APPROVED";

                          const rejected =
                            step.decision === "REJECTED";

                          return (
                            <div
                              key={`${step.requiredRole}-${index}`}
                              className={
                                "flex items-center gap-2 rounded-xl border px-3 py-2 text-xs " +
                                (approved
                                  ? "border-emerald-400/15 bg-emerald-400/[0.07] text-emerald-300"
                                  : rejected
                                    ? "border-rose-400/15 bg-rose-400/[0.07] text-rose-300"
                                    : "border-amber-400/15 bg-amber-400/[0.07] text-amber-300")
                              }
                            >
                              {approved ? (
                                <CheckCircle2 className="h-4 w-4" />
                              ) : rejected ? (
                                <XCircle className="h-4 w-4" />
                              ) : (
                                <Clock3 className="h-4 w-4" />
                              )}

                              <span>{roleLabel(step.requiredRole)}</span>

                              <span className="opacity-70">
                                {approved
                                  ? "تأیید شد"
                                  : rejected
                                    ? "رد شد"
                                    : "در انتظار"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Withdraw */}
                  {canWithdraw && (
                    <div className="mt-4 flex justify-end border-t border-white/[0.07] pt-4">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void withdraw(request.id)}
                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-2.5 text-xs font-medium text-rose-300 transition hover:bg-rose-400/[0.14] disabled:opacity-40"
                      >
                        <XCircle className="h-4 w-4" />
                        انصراف از درخواست
                      </button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
