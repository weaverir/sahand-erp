

"use client";

import {

  useCallback,

  useEffect,

  useMemo,

  useState,

} from "react";

import { useThemeStore } from "@/stores/theme.store";

import {

  AlertCircle,

  CalendarDays,

  Check,

  CheckCircle2,

  ChevronLeft,

  Clock3,

  FileText,

  Loader2,

  RefreshCw,

  ShieldCheck,

  UserRound,

  XCircle,

} from "lucide-react";

type ApprovalStep = {

  stepOrder: number;

  requiredRole: string;

  decision: string | null;

  note: string | null;

};

type LeaveRequest = {

  id: string;

  employee: {

    fullName: string;

  };

  leaveTypeKey: string;

  requestedMinutes: number;

  startAt: string;

  endAt: string;

  status: string;

  approvalSteps: ApprovalStep[];

};

type Filter = "ALL" | "PENDING" | "APPROVED" | "REJECTED";

const leaveTypes: Record<string, string> = {

  annual: "استحقاقی",

  hourly: "ساعتی",

  unpaid: "بدون حقوق",

  sick: "استعلاجی",

  maternity: "زایمان",

  marriage: "ازدواج",

  bereavement: "فوت بستگان",

};

const roleLabels: Record<string, string> = {

  hr_manager: "مدیر منابع انسانی",

  ceo: "مدیرعامل",

  ceo_deputy: "قائم‌مقام مدیرعامل",

  department_manager: "مدیر واحد",

  unit_manager: "مدیر واحد",

  supervisor: "سرپرست",

  system_admin: "مدیر سیستم",

};

const statusLabels: Record<string, string> = {

  DRAFT: "پیش‌نویس",

  PENDING: "در انتظار بررسی",

  PARTIALLY_APPROVED: "تأیید مرحله‌ای",

  APPROVED: "تأییدشده",

  REJECTED: "ردشده",

  CANCELLED: "لغوشده",

};

const statusStyles: Record<string, string> = {

  DRAFT: "border-slate-400/20 bg-slate-400/10 text-slate-700 dark:text-slate-300",

  PENDING: "border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-300",

  PARTIALLY_APPROVED:

    "border-sky-400/20 bg-sky-400/10 text-sky-700 dark:text-sky-300",

  APPROVED:

    "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",

  REJECTED:

    "border-rose-400/20 bg-rose-400/10 text-rose-700 dark:text-rose-300",

  CANCELLED:

    "border-slate-400/20 bg-slate-400/10 text-slate-600 dark:text-slate-400",

};

const glass =

  "relative overflow-hidden rounded-[24px] border border-slate-300/65 dark:border-white/[0.12] " +

  "bg-gradient-to-br from-white/95 via-white/95 to-slate-50/90 dark:from-white/[0.12] dark:via-white/[0.055] dark:to-white/[0.025] " +

  "shadow-[0_12px_40px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.75)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] " +

  "backdrop-blur-2xl";

const glassInner =

  "rounded-2xl border border-slate-200/90 dark:border-white/[0.08] " +

  "bg-gradient-to-br from-white/95 to-slate-50/90 dark:from-white/[0.075] dark:to-white/[0.025] " +

  "shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]";

const buttonClass =

  "inline-flex items-center justify-center gap-2 rounded-xl " +

  "border border-slate-300/65 dark:border-white/[0.12] bg-white/95 dark:bg-white/[0.06] " +

  "px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 " +

  "transition-all hover:border-sky-300/30 hover:bg-white/[0.1] " +

  "disabled:cursor-not-allowed disabled:opacity-40";

const textareaClass =

  "w-full resize-y rounded-xl border border-slate-300/65 dark:border-white/[0.12] " +

  "!bg-white dark:!bg-[#07132b]/65 px-4 py-3 text-sm leading-7 text-slate-900 dark:text-slate-100 " +

  "outline-none transition-all duration-200 placeholder:text-slate-500 dark:placeholder:text-slate-500 " +

  "focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10 " +

  "disabled:cursor-not-allowed disabled:opacity-50";

function formatDate(value: string) {

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {

    return "تاریخ نامعتبر";

  }

  return new Intl.DateTimeFormat("fa-IR", {

    year: "numeric",

    month: "long",

    day: "numeric",

    hour: "2-digit",

    minute: "2-digit",

    timeZone: "Asia/Tehran",

  }).format(date);

}

function formatDuration(minutes: number) {

  if (!Number.isFinite(minutes) || minutes < 0) {

    return "نامشخص";

  }

  const hours = Math.floor(minutes / 60);

  const remainingMinutes = minutes % 60;

  if (hours === 0) {

    return `${remainingMinutes.toLocaleString("fa-IR")} دقیقه`;

  }

  if (remainingMinutes === 0) {

    return `${hours.toLocaleString("fa-IR")} ساعت`;

  }

  return `${hours.toLocaleString("fa-IR")} ساعت و ${remainingMinutes.toLocaleString("fa-IR")} دقیقه`;

}

function getLeaveType(key: string) {

  return leaveTypes[key.toLowerCase()] ?? key;

}

function getRoleLabel(role: string) {

  return roleLabels[role.toLowerCase()] ?? role;

}

function getStatusLabel(status: string) {

  return statusLabels[status] ?? status;

}

function getStepLabel(decision: string | null) {

  if (decision === "APPROVED") return "تأییدشده";

  if (decision === "REJECTED") return "ردشده";

  return "در انتظار";

}

function isPending(status: string) {

  return status === "PENDING" || status === "PARTIALLY_APPROVED";

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

export default function HrLeaveRequests() {

  const theme = useThemeStore((state) => state.theme);

  const [items, setItems] = useState<LeaveRequest[]>([]);

  const [error, setError] = useState("");

  const [busy, setBusy] = useState("");

  const [loading, setLoading] = useState(true);

  const [notes, setNotes] = useState<Record<string, string>>({});

  const [filter, setFilter] = useState<Filter>("ALL");

  const refresh = useCallback(async () => {

    setError("");

    setLoading(true);

    try {

      const response = await fetch(

        "/api/attendance/hr/leave/requests",

        {

          cache: "no-store",

          credentials: "same-origin",

        }

      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "خطا در دریافت درخواست‌ها");

      }

      setItems(data.requests ?? []);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "خطا در ارتباط با سرور"

      );

    } finally {

      setLoading(false);

    }

  }, []);

  useEffect(() => {

    void refresh();

  }, [refresh]);

  const stats = useMemo(() => {

    return {

      all: items.length,

      pending: items.filter((item) => isPending(item.status)).length,

      approved: items.filter(

        (item) => item.status === "APPROVED"

      ).length,

      rejected: items.filter(

        (item) => item.status === "REJECTED"

      ).length,

    };

  }, [items]);

  const filteredItems = useMemo(() => {

    const result = items.filter((item) => {

      if (filter === "ALL") return true;

      if (filter === "PENDING") return isPending(item.status);

      return item.status === filter;

    });

    return [...result].sort((a, b) => {

      const aPending = isPending(a.status) ? 0 : 1;

      const bPending = isPending(b.status) ? 0 : 1;

      if (aPending !== bPending) {

        return aPending - bPending;

      }

      return (

        new Date(b.startAt).getTime() -

        new Date(a.startAt).getTime()

      );

    });

  }, [items, filter]);

  async function decide(

    id: string,

    decision: "APPROVED" | "REJECTED"

  ) {

    if (busy) return;

    const confirmed = window.confirm(

      decision === "APPROVED"

        ? "آیا از تأیید این مرحله اطمینان دارید؟"

        : "آیا از رد این درخواست اطمینان دارید؟"

    );

    if (!confirmed) return;

    setBusy(id);

    setError("");

    try {

      const response = await fetch(

        `/api/attendance/hr/leave/requests/${encodeURIComponent(id)}/decision`,

        {

          method: "POST",

          credentials: "same-origin",

          headers: {

            "Content-Type": "application/json",

          },

          body: JSON.stringify({

            decision,

            note: notes[id] ?? "",

          }),

        }

      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "خطا در ثبت تصمیم");

      }

      setNotes((previous) => ({

        ...previous,

        [id]: "",

      }));

      await refresh();

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "خطا در ثبت تصمیم"

      );

    } finally {

      setBusy("");

    }

  }

  const filters: {

    key: Filter;

    label: string;

    count: number;

  }[] = [

    { key: "ALL", label: "همه درخواست‌ها", count: stats.all },

    { key: "PENDING", label: "در انتظار", count: stats.pending },

    {

      key: "APPROVED",

      label: "تأییدشده",

      count: stats.approved,

    },

    { key: "REJECTED", label: "ردشده", count: stats.rejected },

  ];

  return (

    <div className={theme === "dark" ? "dark" : ""}>
    <main

      dir="rtl"

      className="relative isolate min-h-full space-y-6 overflow-hidden p-4 text-slate-900 dark:text-slate-100 sm:p-6"

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

          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">

            <span>منابع انسانی</span>

            <ChevronLeft className="h-3.5 w-3.5" />

            <span className="text-sky-700 dark:text-sky-300">

              بررسی درخواست‌های مرخصی

            </span>

          </div>

          <div className="flex items-center gap-3">

            <div

              className={`${glassInner} flex h-12 w-12 items-center justify-center`}

            >

              <CalendarDays className="h-6 w-6 text-sky-700 dark:text-sky-300" />

            </div>

            <div>

              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">

                بررسی درخواست‌های مرخصی

              </h1>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">

                مدیریت، بررسی و ثبت تصمیم درخواست‌های کارکنان

              </p>

            </div>

          </div>

        </div>

        <button

          type="button"

          onClick={() => void refresh()}

          disabled={loading || Boolean(busy)}

          className={buttonClass}

        >

          <RefreshCw

            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}

          />

          به‌روزرسانی

        </button>

      </header>

      {/* Statistics */}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">

        {[

          {

            title: "کل درخواست‌ها",

            value: stats.all,

            icon: FileText,

            color: "text-sky-700 dark:text-sky-300",

            background: "bg-sky-400/10",

          },

          {

            title: "در انتظار بررسی",

            value: stats.pending,

            icon: Clock3,

            color: "text-amber-700 dark:text-amber-300",

            background: "bg-amber-400/10",

          },

          {

            title: "تأییدشده",

            value: stats.approved,

            icon: CheckCircle2,

            color: "text-emerald-700 dark:text-emerald-300",

            background: "bg-emerald-400/10",

          },

          {

            title: "ردشده",

            value: stats.rejected,

            icon: XCircle,

            color: "text-rose-700 dark:text-rose-300",

            background: "bg-rose-400/10",

          },

        ].map((stat) => {

          const Icon = stat.icon;

          return (

            <div key={stat.title} className={`${glass} p-4 sm:p-5`}>

              <GlassShine />

              <div className="relative flex items-center justify-between gap-3">

                <div>

                  <p className="text-xs text-slate-600 dark:text-slate-400 sm:text-sm">

                    {stat.title}

                  </p>

                  <p className="mt-3 text-2xl font-bold tabular-nums">

                    {stat.value.toLocaleString("fa-IR")}

                  </p>

                </div>

                <div

                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 dark:border-white/[0.08] ${stat.background}`}

                >

                  <Icon className={`h-5 w-5 ${stat.color}`} />

                </div>

              </div>

            </div>

          );

        })}

      </section>

      {/* Requests panel */}

      <section className={glass}>

        <GlassShine />

        <div className="relative border-b border-slate-200/90 dark:border-white/[0.08] p-4 sm:p-5">

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

            <div>

              <h2 className="flex items-center gap-2 text-base font-semibold">

                <FileText className="h-5 w-5 text-sky-700 dark:text-sky-300" />

                فهرست درخواست‌ها

              </h2>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">

                درخواست‌ها بر اساس وضعیت و تاریخ مرتب شده‌اند.

              </p>

            </div>

            <div className="flex flex-wrap gap-2">

              {filters.map((option) => (

                <button

                  key={option.key}

                  type="button"

                  onClick={() => setFilter(option.key)}

                  aria-pressed={filter === option.key}

                  className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition sm:text-sm ${

                    filter === option.key

                      ? "border-sky-400/30 bg-sky-400/15 text-sky-800 dark:text-sky-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]"

                      : "border-slate-300/70 dark:border-white/[0.1] bg-white/90 dark:bg-white/[0.035] text-slate-600 dark:text-slate-400 hover:bg-sky-50/90 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-slate-200"

                  }`}

                >

                  {option.label}

                  <span className="rounded-md bg-slate-200/70 dark:bg-white/10 px-1.5 py-0.5 text-xs tabular-nums">

                    {option.count.toLocaleString("fa-IR")}

                  </span>

                </button>

              ))}

            </div>

          </div>

        </div>

        {error && (

          <div

            role="alert"

            className="relative mx-4 mt-4 flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-800 dark:text-rose-200"

          >

            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />

            <p>{error}</p>

          </div>

        )}

        {loading ? (

          <div

            role="status"

            className="relative flex min-h-64 flex-col items-center justify-center gap-3 text-slate-600 dark:text-slate-400"

          >

            <Loader2 className="h-7 w-7 animate-spin text-sky-600 dark:text-sky-400" />

            <p className="text-sm">

              در حال دریافت درخواست‌ها...

            </p>

          </div>

        ) : filteredItems.length === 0 ? (

          <div className="relative flex min-h-64 flex-col items-center justify-center gap-3 px-4 text-center">

            <div className={`${glassInner} flex h-14 w-14 items-center justify-center`}>

              <FileText className="h-7 w-7 text-slate-600 dark:text-slate-400" />

            </div>

            <h3 className="font-medium text-slate-800 dark:text-slate-200">

              درخواستی برای نمایش وجود ندارد

            </h3>

            <p className="text-sm text-slate-500 dark:text-slate-500">

              در حال حاضر در این بخش درخواستی ثبت نشده است.

            </p>

          </div>

        ) : (

          <div className="relative space-y-4 p-3 sm:p-5">

            {filteredItems.map((request) => {

              const pending = isPending(request.status);

              const requestBusy = busy === request.id;

              const steps = [...request.approvalSteps].sort(

                (a, b) => a.stepOrder - b.stepOrder

              );

              return (

                <article

                  key={request.id}

                  className={`${glassInner} overflow-hidden transition-colors hover:border-sky-400/20`}

                >

                  {/* Request header */}

                  <div className="flex flex-col gap-4 border-b border-slate-200/90 dark:border-white/[0.07] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">

                    <div className="flex items-center gap-3">

                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-slate-100/75 dark:bg-white/5">

                        <UserRound className="h-5 w-5 text-slate-700 dark:text-slate-300" />

                      </div>

                      <div className="min-w-0">

                        <h3 className="truncate text-sm font-semibold sm:text-base">

                          {request.employee?.fullName || "کارمند نامشخص"}

                        </h3>

                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">

                          مرخصی {getLeaveType(request.leaveTypeKey)}

                        </p>

                      </div>

                    </div>

                    <span

                      className={`inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium ${

                        statusStyles[request.status] ??

                        statusStyles.DRAFT

                      }`}

                    >

                      <span className="h-1.5 w-1.5 rounded-full bg-current" />

                      {getStatusLabel(request.status)}

                    </span>

                  </div>

                  {/* Request details */}

                  <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-3 sm:p-5">

                    <div className={`${glassInner} p-3`}>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">

                        <CalendarDays className="h-4 w-4" />

                        شروع مرخصی

                      </div>

                      <p className="mt-2 text-sm font-medium">

                        {formatDate(request.startAt)}

                      </p>

                    </div>

                    <div className={`${glassInner} p-3`}>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">

                        <CalendarDays className="h-4 w-4" />

                        پایان مرخصی

                      </div>

                      <p className="mt-2 text-sm font-medium">

                        {formatDate(request.endAt)}

                      </p>

                    </div>

                    <div className={`${glassInner} p-3`}>

                      <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">

                        <Clock3 className="h-4 w-4" />

                        مدت درخواست

                      </div>

                      <p className="mt-2 text-sm font-medium text-sky-800 dark:text-sky-200">

                        {formatDuration(request.requestedMinutes)}

                      </p>

                    </div>

                  </div>

                  {/* Approval workflow */}

                  {steps.length > 0 && (

                    <div className="border-t border-slate-200/90 dark:border-white/[0.07] px-4 py-4 sm:px-5">

                      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">

                        <ShieldCheck className="h-4 w-4 text-sky-700 dark:text-sky-300" />

                        مراحل بررسی و تأیید

                      </div>

                      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">

                        {steps.map((step) => {

                          const approved =

                            step.decision === "APPROVED";

                          const rejected =

                            step.decision === "REJECTED";

                          return (

                            <div

                              key={`${step.stepOrder}-${step.requiredRole}`}

                              className={`${glassInner} p-3`}

                            >

                              <div className="flex items-center justify-between gap-2">

                                <div className="flex min-w-0 items-center gap-2">

                                  <span

                                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${

                                      approved

                                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"

                                        : rejected

                                          ? "bg-rose-500/10 text-rose-700 dark:text-rose-300"

                                          : "bg-amber-500/10 text-amber-700 dark:text-amber-300"

                                    }`}

                                  >

                                    {approved ? (

                                      <Check className="h-4 w-4" />

                                    ) : rejected ? (

                                      <XCircle className="h-4 w-4" />

                                    ) : (

                                      <Clock3 className="h-4 w-4" />

                                    )}

                                  </span>

                                  <span className="truncate text-xs font-medium text-slate-800 dark:text-slate-200">

                                    {getRoleLabel(step.requiredRole)}

                                  </span>

                                </div>

                                <span

                                  className={`shrink-0 text-xs ${

                                    approved

                                      ? "text-emerald-700 dark:text-emerald-300"

                                      : rejected

                                        ? "text-rose-700 dark:text-rose-300"

                                        : "text-amber-700 dark:text-amber-300"

                                  }`}

                                >

                                  {getStepLabel(step.decision)}

                                </span>

                              </div>

                              {step.note && (

                                <p className="mt-3 border-t border-white/[0.06] pt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">

                                  {step.note}

                                </p>

                              )}

                            </div>

                          );

                        })}

                      </div>

                    </div>

                  )}

                  {/* Decision actions */}

                  {pending && (

                    <div className="space-y-3 border-t border-slate-200/90 dark:border-white/[0.07] bg-slate-50/55 dark:bg-white/[0.015] p-4 sm:p-5">

                      <label

                        htmlFor={`note-${request.id}`}

                        className="block text-sm font-medium text-slate-700 dark:text-slate-300"

                      >

                        توضیحات تصمیم

                        <span className="mr-2 text-xs font-normal text-slate-500 dark:text-slate-500">

                          اختیاری

                        </span>

                      </label>

                      <textarea

                        id={`note-${request.id}`}

                        rows={2}

                        maxLength={1000}

                        disabled={Boolean(busy)}

                        value={notes[request.id] ?? ""}

                        onChange={(event) =>

                          setNotes((previous) => ({

                            ...previous,

                            [request.id]: event.target.value,

                          }))

                        }

                        placeholder="توضیحات مربوط به تأیید یا رد درخواست را وارد کنید..."

                        className={textareaClass}

                      />

                      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">

                        <button

                          type="button"

                          disabled={Boolean(busy)}

                          onClick={() =>

                            void decide(request.id, "APPROVED")

                          }

                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-600/90 to-teal-600/90 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_6px_20px_rgba(16,185,129,0.12)] transition hover:from-emerald-500 hover:to-teal-500 disabled:cursor-not-allowed disabled:opacity-50"

                        >

                          {requestBusy ? (

                            <Loader2 className="h-4 w-4 animate-spin" />

                          ) : (

                            <CheckCircle2 className="h-4 w-4" />

                          )}

                          تأیید مرحله

                        </button>

                        <button

                          type="button"

                          disabled={Boolean(busy)}

                          onClick={() =>

                            void decide(request.id, "REJECTED")

                          }

                          className="inline-flex items-center justify-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-5 py-2.5 text-sm font-medium text-rose-700 dark:text-rose-300 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"

                        >

                          <XCircle className="h-4 w-4" />

                          رد درخواست

                        </button>

                      </div>

                    </div>

                  )}

                </article>

              );

            })}

          </div>

        )}

      </section>

    </main>
    </div>

  );

}
