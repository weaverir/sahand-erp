
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Activity,
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileClock,
  FilePenLine,
  History,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Timer,
  X,
  XCircle,
} from "lucide-react";

import {
  JalaliDateTimePicker,
  tehranDateTimeToIso,
} from "../../../../components/jalali-date-picker";

/* ---------------------------------------------
   Types
--------------------------------------------- */

type AttendanceEvent = {
  id: string;
  eventType: string;
  occurredAt: string;
  source: string;
};

type Adjustment = {
  id: string;
  attendanceEventId: string | null;
  proposedEventType: string | null;
  proposedOccurredAt: string | null;
  reason: string;
  status: string;
  reviewerComment: string | null;
  createdAt: string;
};

type RecordItem = {
  id: string;
  workDate: string;
  status: string;
  workedMinutes: number;
  overtimeMinutes: number;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  events: AttendanceEvent[];
  adjustments: Adjustment[];
};

type ResponseData = {
  records: RecordItem[];
  page: number;
  totalPages: number;
  total: number;
  error?: string;
};

/* ---------------------------------------------
   Design tokens
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

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-white/[0.12] bg-white/[0.06] " +
  "px-4 py-2.5 text-sm font-medium text-slate-200 " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] " +
  "transition-all duration-200 " +
  "hover:border-sky-300/30 hover:bg-white/[0.1] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-sky-300/25 " +
  "bg-gradient-to-r from-blue-600/90 to-sky-500/90 " +
  "px-5 py-2.5 text-sm font-semibold text-white " +
  "shadow-[0_6px_22px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "transition-all duration-200 " +
  "hover:from-blue-500 hover:to-sky-400 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

/* ---------------------------------------------
   Formatters
--------------------------------------------- */

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function formatClock(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Tehran",
  }).format(date);
}

function formatMinutes(value: number) {
  const total = Math.max(0, Math.floor(value || 0));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;

  if (!hours) {
    return `${minutes.toLocaleString("fa-IR")} دقیقه`;
  }

  if (!minutes) {
    return `${hours.toLocaleString("fa-IR")} ساعت`;
  }

  return (
    `${hours.toLocaleString("fa-IR")} ساعت و ` +
    `${minutes.toLocaleString("fa-IR")} دقیقه`
  );
}

const eventLabels: Record<string, string> = {
  CHECK_IN: "ورود",
  CHECK_OUT: "خروج",
  BREAK_START: "شروع استراحت",
  BREAK_END: "پایان استراحت",
  AUTO_CHECK_OUT: "خروج خودکار",
};

const statusLabels: Record<string, string> = {
  OPEN: "باز",
  PENDING_REVIEW: "در انتظار بررسی",
  APPROVED: "تأییدشده",
  PENDING: "در انتظار",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

const sourceLabels: Record<string, string> = {
  TABLET: "تبلت شرکت",
  KIOSK: "دستگاه حضور و غیاب",
  MANUAL: "ثبت دستی",
  SYSTEM: "سیستم",
  OFFLINE: "ثبت آفلاین",
  WEB: "وب",
};

function getStatusStyle(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";

    case "REJECTED":
      return "border-rose-400/20 bg-rose-400/10 text-rose-300";

    case "PENDING":
    case "PENDING_REVIEW":
      return "border-amber-400/20 bg-amber-400/10 text-amber-300";

    case "OPEN":
      return "border-sky-400/20 bg-sky-400/10 text-sky-300";

    default:
      return "border-white/10 bg-white/5 text-slate-300";
  }
}

/* ---------------------------------------------
   Shared UI
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
        getStatusStyle(status)
      }
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabels[status] || status}
    </span>
  );
}

function Metric({
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
    blue: "bg-sky-400/10 text-sky-300 border-sky-400/15",
    green:
      "bg-emerald-400/10 text-emerald-300 border-emerald-400/15",
    amber:
      "bg-amber-400/10 text-amber-300 border-amber-400/15",
    rose: "bg-rose-400/10 text-rose-300 border-rose-400/15",
  };

  return (
    <div className={`${glassInner} p-3 sm:p-4`}>
      <div className="flex items-center gap-2.5">
        <div
          className={
            "flex h-9 w-9 shrink-0 items-center justify-center " +
            "rounded-xl border " +
            colors[tone]
          }
        >
          <Icon className="h-4 w-4" />
        </div>

        <span className="text-xs text-slate-400">{title}</span>
      </div>

      <p className="mt-3 text-sm font-semibold text-slate-100 sm:text-base">
        {value}
      </p>
    </div>
  );
}

/* ---------------------------------------------
   Main page
--------------------------------------------- */

export default function MyAttendancePage() {
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState<string | null>(null);

  const [eventId, setEventId] = useState("");
  const [eventType, setEventType] = useState("");
  const [proposedDate, setProposedDate] = useState("");
  const [proposedTime, setProposedTime] = useState("08:00");
  const [reason, setReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeError, setNoticeError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/attendance/me/records?page=${page}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const body = (await response.json()) as ResponseData;

      if (!response.ok) {
        throw new Error(body.error || "خطا در دریافت سوابق");
      }

      setData(body);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطای ناشناخته"
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const records = data?.records ?? [];

  const current = records.find((record) => record.id === selected);

  const summary = useMemo(() => {
    return records.reduce(
      (result, record) => {
        result.worked += record.workedMinutes;
        result.overtime += record.overtimeMinutes;
        result.late += record.lateMinutes;
        result.early += record.earlyLeaveMinutes;
        return result;
      },
      {
        worked: 0,
        overtime: 0,
        late: 0,
        early: 0,
      }
    );
  }, [records]);

  function openCorrection(recordId: string) {
    setSelected(recordId);
    setNotice("");
    setNoticeError(false);
    setEventId("");
    setEventType("");
    setProposedDate("");
    setProposedTime("08:00");
    setReason("");
  }

  function closeCorrection() {
    if (saving) return;
    setSelected(null);
    setNotice("");
    setNoticeError(false);
  }

  useEffect(() => {
    if (!selected) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !saving) {
        setSelected(null);
      }
    }

    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [selected, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!current || saving) return;

    setSaving(true);
    setNotice("");
    setNoticeError(false);

    try {
      const date = proposedDate
        ? tehranDateTimeToIso(proposedDate, proposedTime)
        : null;

      if (proposedDate && !date) {
        throw new Error("زمان پیشنهادی معتبر نیست.");
      }

      if (!eventId && (!eventType || !date)) {
        throw new Error(
          "برای ثبت تردد جاافتاده، نوع و زمان تردد را مشخص کنید."
        );
      }

      const response = await fetch(
        "/api/attendance/me/corrections",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            recordId: current.id,
            attendanceEventId: eventId || null,
            proposedEventType: eventType || null,
            proposedOccurredAt: date ?? null,
            reason,
          }),
        }
      );

      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "ثبت درخواست ناموفق بود."
        );
      }

      setNotice(body.message || "درخواست با موفقیت ثبت شد.");
      setNoticeError(false);

      setReason("");
      setEventId("");
      setEventType("");
      setProposedDate("");
      setProposedTime("08:00");

      await load();
    } catch (err) {
      setNotice(
        err instanceof Error
          ? err.message
          : "خطا در ثبت درخواست"
      );
      setNoticeError(true);
    } finally {
      setSaving(false);
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
            <span className="text-sky-300">حضور و غیاب من</span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`${glassInner} flex h-12 w-12 items-center justify-center`}>
              <CalendarClock className="h-6 w-6 text-sky-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">
                حضور و غیاب من
              </h1>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                مشاهده سوابق تردد و مدیریت درخواست‌های اصلاح
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={secondaryButton}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          به‌روزرسانی
        </button>
      </header>

      {/* Overview */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-sky-300" />

              <h2 className="font-semibold">
                خلاصه عملکرد حضور و غیاب
              </h2>
            </div>

            <p className="mt-1 text-xs text-slate-400">
              مجموع اطلاعات سوابق نمایش‌داده‌شده در این صفحه
            </p>
          </div>

          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
            {records.length.toLocaleString("fa-IR")} روز ثبت‌شده
          </div>
        </div>

        <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric
            title="مجموع کارکرد"
            value={formatMinutes(summary.worked)}
            icon={Clock3}
            tone="blue"
          />

          <Metric
            title="اضافه‌کاری"
            value={formatMinutes(summary.overtime)}
            icon={Activity}
            tone="green"
          />

          <Metric
            title="مجموع تأخیر"
            value={formatMinutes(summary.late)}
            icon={Timer}
            tone="amber"
          />

          <Metric
            title="تعجیل در خروج"
            value={formatMinutes(summary.early)}
            icon={ArrowUpRight}
            tone="rose"
          />
        </div>
      </section>

      {/* Error */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4 backdrop-blur-xl"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {/* Records */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <History className="h-5 w-5 text-sky-300" />
              سوابق تردد
            </h2>

            <p className="mt-1 text-xs text-slate-400">
              جزئیات ورود، خروج و وضعیت بررسی هر روز
            </p>
          </div>

          <span className="text-xs text-slate-400">
            مجموع: {(data?.total ?? 0).toLocaleString("fa-IR")}
          </span>
        </div>

        {loading ? (
          <div
            role="status"
            className={`${glass} flex min-h-52 flex-col items-center justify-center gap-3`}
          >
            <Loader2 className="h-8 w-8 animate-spin text-sky-300" />
            <p className="text-sm text-slate-400">
              در حال دریافت سوابق...
            </p>
          </div>
        ) : records.length === 0 ? (
          <div className={`${glass} flex min-h-52 flex-col items-center justify-center gap-3 p-6 text-center`}>
            <div className={`${glassInner} flex h-14 w-14 items-center justify-center`}>
              <FileClock className="h-7 w-7 text-slate-400" />
            </div>

            <h3 className="font-medium">
              سابقه‌ای برای نمایش وجود ندارد
            </h3>

            <p className="text-sm text-slate-400">
              پس از ثبت تردد، اطلاعات در این قسمت نمایش داده می‌شود.
            </p>
          </div>
        ) : (
          <div className="grid gap-4">
            {records.map((record) => {
              const sortedEvents = [...record.events].sort(
                (a, b) =>
                  new Date(a.occurredAt).getTime() -
                  new Date(b.occurredAt).getTime()
              );

              return (
                <article
                  key={record.id}
                  className={`${glass} group transition-all duration-300 hover:border-sky-300/20 hover:shadow-[0_16px_50px_rgba(0,0,0,0.2)]`}
                >
                  <GlassShine />

                  <div className="relative p-4 sm:p-5">
                    {/* Record heading */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`${glassInner} flex h-11 w-11 items-center justify-center`}>
                          <CalendarDays className="h-5 w-5 text-sky-300" />
                        </div>

                        <div>
                          <h3 className="font-semibold">
                            {formatDate(record.workDate)}
                          </h3>

                          <p className="mt-1 text-xs text-slate-400">
                            {record.events.length.toLocaleString("fa-IR")} رویداد تردد
                          </p>
                        </div>
                      </div>

                      <StatusBadge status={record.status} />
                    </div>

                    {/* Metrics */}
                    <div className="mt-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
                      <Metric
                        title="کارکرد"
                        value={formatMinutes(record.workedMinutes)}
                        icon={Clock3}
                        tone="blue"
                      />

                      <Metric
                        title="اضافه‌کاری"
                        value={formatMinutes(record.overtimeMinutes)}
                        icon={Activity}
                        tone="green"
                      />

                      <Metric
                        title="تأخیر"
                        value={formatMinutes(record.lateMinutes)}
                        icon={Timer}
                        tone="amber"
                      />

                      <Metric
                        title="تعجیل"
                        value={formatMinutes(record.earlyLeaveMinutes)}
                        icon={ArrowDownLeft}
                        tone="rose"
                      />
                    </div>

                    {/* Details */}
                    <details className="group/details mt-4 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025]">
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          <History className="h-4 w-4 text-sky-300" />
                          جزئیات تردد و درخواست‌های اصلاح
                        </span>

                        <ChevronLeft className="h-4 w-4 text-slate-400 transition-transform group-open/details:-rotate-90" />
                      </summary>

                      <div className="space-y-5 border-t border-white/[0.07] p-4">
                        {/* Events timeline */}
                        <div>
                          <h4 className="mb-4 text-xs font-semibold text-slate-300">
                            رویدادهای ثبت‌شده
                          </h4>

                          {sortedEvents.length === 0 ? (
                            <p className="text-sm text-slate-500">
                              ترددی ثبت نشده است.
                            </p>
                          ) : (
                            <div className="relative mr-3 space-y-4 border-r border-white/10 pr-5">
                              {sortedEvents.map((event) => {
                                const isEntry =
                                  event.eventType === "CHECK_IN" ||
                                  event.eventType === "BREAK_END";

                                return (
                                  <div
                                    key={event.id}
                                    className="relative"
                                  >
                                    <span
                                      className={
                                        "absolute -right-[27px] top-3 h-3 w-3 rounded-full border-[3px] border-[#14213c] " +
                                        (isEntry
                                          ? "bg-emerald-400"
                                          : "bg-sky-400")
                                      }
                                    />

                                    <div className={`${glassInner} flex flex-wrap items-center justify-between gap-3 p-3`}>
                                      <div className="flex items-center gap-3">
                                        <div
                                          className={
                                            "flex h-9 w-9 items-center justify-center rounded-xl " +
                                            (isEntry
                                              ? "bg-emerald-400/10 text-emerald-300"
                                              : "bg-sky-400/10 text-sky-300")
                                          }
                                        >
                                          {isEntry ? (
                                            <ArrowDownLeft className="h-4 w-4" />
                                          ) : (
                                            <ArrowUpRight className="h-4 w-4" />
                                          )}
                                        </div>

                                        <div>
                                          <p className="text-sm font-medium">
                                            {eventLabels[event.eventType] ||
                                              event.eventType}
                                          </p>

                                          <p className="mt-1 text-xs text-slate-500">
                                            {sourceLabels[event.source] ||
                                              event.source}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="text-left">
                                        <p className="text-sm font-semibold tabular-nums text-slate-200">
                                          {formatClock(event.occurredAt)}
                                        </p>

                                        <p className="mt-1 text-xs text-slate-500">
                                          {formatDate(event.occurredAt)}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Corrections */}
                        {record.adjustments.length > 0 && (
                          <div className="border-t border-white/[0.07] pt-4">
                            <h4 className="mb-3 flex items-center gap-2 text-xs font-semibold text-slate-300">
                              <FilePenLine className="h-4 w-4 text-sky-300" />
                              درخواست‌های اصلاح ثبت‌شده
                            </h4>

                            <div className="space-y-3">
                              {record.adjustments.map((adjustment) => (
                                <div
                                  key={adjustment.id}
                                  className={`${glassInner} space-y-3 p-4`}
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="text-xs text-slate-400">
                                      {formatDateTime(
                                        adjustment.createdAt
                                      )}
                                    </span>

                                    <StatusBadge
                                      status={adjustment.status}
                                    />
                                  </div>

                                  <p className="whitespace-pre-wrap text-sm leading-7 text-slate-200">
                                    {adjustment.reason}
                                  </p>

                                  {adjustment.proposedEventType && (
                                    <p className="text-xs text-slate-400">
                                      نوع پیشنهادی:{" "}
                                      {eventLabels[
                                        adjustment.proposedEventType
                                      ] || adjustment.proposedEventType}
                                    </p>
                                  )}

                                  {adjustment.proposedOccurredAt && (
                                    <p className="text-xs text-slate-400">
                                      زمان پیشنهادی:{" "}
                                      {formatDateTime(
                                        adjustment.proposedOccurredAt
                                      )}
                                    </p>
                                  )}

                                  {adjustment.reviewerComment && (
                                    <div className="rounded-xl border border-sky-400/10 bg-sky-400/[0.05] p-3">
                                      <p className="mb-1 text-xs font-medium text-sky-300">
                                        نظر منابع انسانی
                                      </p>

                                      <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                                        {adjustment.reviewerComment}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>

                    {/* Actions */}
                    <div className="mt-4 flex justify-end border-t border-white/[0.07] pt-4">
                      <button
                        type="button"
                        onClick={() => openCorrection(record.id)}
                        className={primaryButton}
                      >
                        <FilePenLine className="h-4 w-4" />
                        درخواست اصلاح تردد
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <nav
          aria-label="صفحه‌بندی سوابق"
          className={`${glass} flex flex-wrap items-center justify-center gap-4 p-3`}
        >
          <button
            type="button"
            disabled={page <= 1 || loading}
            onClick={() => setPage((value) => value - 1)}
            className={secondaryButton}
          >
            <ChevronRight className="h-4 w-4" />
            قبلی
          </button>

          <span className="text-sm text-slate-300">
            صفحه {page.toLocaleString("fa-IR")} از{" "}
            {Math.max(1, data.totalPages).toLocaleString("fa-IR")}
          </span>

          <button
            type="button"
            disabled={page >= data.totalPages || loading}
            onClick={() => setPage((value) => value + 1)}
            className={secondaryButton}
          >
            بعدی
            <ChevronLeft className="h-4 w-4" />
          </button>
        </nav>
      )}

      {/* Correction modal */}
      {current && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#020817]/75 p-3 backdrop-blur-md sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeCorrection();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="correction-dialog-title"
            className={
              glass +
              " my-auto max-h-[90dvh] w-full max-w-xl overflow-y-auto " +
              "border-white/[0.18] bg-[#101d39]/95 " +
              "shadow-[0_30px_100px_rgba(0,0,0,0.55)]"
            }
          >
            <GlassShine />

            <div className="relative">
              {/* Modal header */}
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.09] p-5">
                <div className="flex items-start gap-3">
                  <div className={`${glassInner} flex h-11 w-11 shrink-0 items-center justify-center`}>
                    <FilePenLine className="h-5 w-5 text-sky-300" />
                  </div>

                  <div>
                    <h2
                      id="correction-dialog-title"
                      className="text-lg font-bold"
                    >
                      درخواست اصلاح تردد
                    </h2>

                    <p className="mt-1 text-sm text-slate-400">
                      {formatDate(current.workDate)}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeCorrection}
                  disabled={saving}
                  aria-label="بستن پنجره"
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-400 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form
                onSubmit={(event) => void submit(event)}
                className="space-y-5 p-5"
              >
                {/* Existing event */}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    رویداد موردنظر
                  </span>

                  <select
                    value={eventId}
                    onChange={(event) =>
                      setEventId(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">
                      تردد جاافتاده / بدون رویداد
                    </option>

                    {current.events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {eventLabels[event.eventType] ||
                          event.eventType}{" "}
                        — {formatDateTime(event.occurredAt)}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Event type */}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    نوع تردد پیشنهادی
                  </span>

                  <select
                    value={eventType}
                    onChange={(event) =>
                      setEventType(event.target.value)
                    }
                    className={inputClass}
                  >
                    <option value="">بدون تغییر نوع</option>
                    <option value="CHECK_IN">ورود</option>
                    <option value="CHECK_OUT">خروج</option>
                    <option value="BREAK_START">
                      شروع استراحت
                    </option>
                    <option value="BREAK_END">
                      پایان استراحت
                    </option>
                  </select>
                </label>

                {/* Jalali picker */}
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-200">
                    <CalendarClock className="h-4 w-4 text-sky-300" />
                    زمان پیشنهادی
                  </label>

                  <div className={`${glassInner} p-3`}>
                    <JalaliDateTimePicker
                      date={proposedDate}
                      time={proposedTime}
                      onDateChange={setProposedDate}
                      onTimeChange={setProposedTime}
                    />
                  </div>

                  <p className="text-xs text-slate-500">
                    تاریخ شمسی و ساعت رسمی تهران
                  </p>
                </div>

                {/* Reason */}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-slate-200">
                    توضیح درخواست
                    <span className="mr-2 text-xs text-rose-300">
                      الزامی
                    </span>
                  </span>

                  <textarea
                    required
                    minLength={10}
                    maxLength={2000}
                    rows={4}
                    value={reason}
                    onChange={(event) =>
                      setReason(event.target.value)
                    }
                    className={`${inputClass} resize-y leading-7`}
                    placeholder="علت درخواست اصلاح تردد را به‌صورت واضح توضیح دهید..."
                  />

                  <span className="block text-left text-xs text-slate-500">
                    {reason.length.toLocaleString("fa-IR")} / ۲۰۰۰
                  </span>
                </label>

                {/* Notice */}
                {notice && (
                  <div
                    role={noticeError ? "alert" : "status"}
                    className={
                      "flex items-start gap-2 rounded-xl border p-3 text-sm " +
                      (noticeError
                        ? "border-rose-400/20 bg-rose-400/10 text-rose-200"
                        : "border-emerald-400/20 bg-emerald-400/10 text-emerald-200")
                    }
                  >
                    {noticeError ? (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    )}

                    <span>{notice}</span>
                  </div>
                )}

                {/* Info */}
                <div className="flex items-start gap-2 rounded-xl border border-sky-400/10 bg-sky-400/[0.05] p-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

                  <p className="text-xs leading-6 text-slate-400">
                    درخواست شما پس از ثبت برای بررسی به منابع انسانی
                    ارسال می‌شود. ثبت درخواست به معنی تأیید اصلاح
                    تردد نیست.
                  </p>
                </div>

                {/* Modal actions */}
                <div className="flex flex-col-reverse gap-3 border-t border-white/[0.08] pt-4 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeCorrection}
                    disabled={saving}
                    className={secondaryButton}
                  >
                    انصراف
                  </button>

                  <button
                    type="submit"
                    disabled={saving}
                    className={primaryButton}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        در حال ثبت...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        ثبت درخواست اصلاح
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
