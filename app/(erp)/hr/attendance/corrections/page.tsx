
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  FileText,
  RefreshCw,
  ShieldCheck,
  X,
  XCircle,
} from "lucide-react";

type Event = {
  id: string;
  eventType: string;
  occurredAt: string;
  source: string;
};

type RequestItem = {
  id: string;
  status: string;
  reason: string;
  proposedEventType: string | null;
  proposedOccurredAt: string | null;
  attendanceEventId: string | null;
  requestedByUserId: string;
  reviewedByUserId: string | null;
  reviewerComment: string | null;
  createdAt: string;
  attendanceRecord: {
    workDate: string;
    status: string;
    workedMinutes: number;
    employeeAssignmentId: string;
    events: Event[];
  };
};

type ResponseData = {
  requests: RequestItem[];
  pagination: {
    page: number;
    pages: number;
    total: number;
  };
  error?: string;
};

type StatusFilter =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "ALL";

const statusLabel: Record<string, string> = {
  PENDING: "در انتظار",
  APPROVED: "تأییدشده",
  REJECTED: "ردشده",
  CANCELLED: "لغوشده",
};

const eventLabel: Record<string, string> = {
  CHECK_IN: "ورود",
  CHECK_OUT: "خروج",
  BREAK_START: "شروع استراحت",
  BREAK_END: "پایان استراحت",
  AUTO_CHECK_OUT: "خروج خودکار",
};

const date = (value: string) => {
  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime())
    ? "—"
    : new Intl.DateTimeFormat("fa-IR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Tehran",
      }).format(parsed);
};

/*
 * Theme styling uses the existing ERP
 * html[data-theme="dark"] mechanism.
 */

const panel =
  "rounded-2xl border border-slate-200/80 bg-white/85 shadow-lg shadow-slate-900/5 backdrop-blur-xl transition-colors duration-300 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]/85 [[data-theme=dark]_&]:shadow-black/20";

const secondaryButton =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/40 hover:bg-blue-500/10 hover:text-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.06] [[data-theme=dark]_&]:text-slate-200 [[data-theme=dark]_&]:hover:text-blue-200";

const field =
  "mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm text-slate-900 outline-none transition-all duration-300 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430] [[data-theme=dark]_&]:text-white [[data-theme=dark]_&]:focus:border-blue-400";

const statusFilters: Array<{
  value: StatusFilter;
  label: string;
}> = [
  { value: "PENDING", label: "در انتظار" },
  { value: "APPROVED", label: "تأییدشده" },
  { value: "REJECTED", label: "ردشده" },
  { value: "CANCELLED", label: "لغوشده" },
  { value: "ALL", label: "همه درخواست‌ها" },
];

function statusStyle(value: string) {
  switch (value) {
    case "APPROVED":
      return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-300";

    case "REJECTED":
      return "border-rose-500/20 bg-rose-500/10 text-rose-700 [[data-theme=dark]_&]:text-rose-300";

    case "CANCELLED":
      return "border-slate-400/20 bg-slate-500/10 text-slate-600 [[data-theme=dark]_&]:text-slate-300";

    default:
      return "border-amber-500/20 bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300";
  }
}

export default function HrCorrectionsPage() {
  const [status, setStatus] =
    useState<StatusFilter>("PENDING");
  const [page, setPage] = useState(1);
  const [data, setData] =
    useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] =
    useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/attendance/hr/corrections?status=${encodeURIComponent(
          status
        )}&page=${page}`,
        {
          cache: "no-store",
          credentials: "same-origin",
        }
      );

      const body =
        (await response.json()) as ResponseData;

      if (!response.ok) {
        throw new Error(
          body.error ||
            "دریافت درخواست‌ها ناموفق بود."
        );
      }

      setData(body);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "خطای ناشناخته"
      );
    } finally {
      setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selected) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setSelected(null);
      }
    };

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      handleEscape
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleEscape
      );
    };
  }, [selected, saving]);

  const current = data?.requests.find(
    (request) => request.id === selected
  );

  async function review(
    decision: "APPROVED" | "REJECTED"
  ) {
    if (!current || saving) return;

    if (comment.trim().length < 5) {
      setNotice(
        "توضیح بررسی باید حداقل ۵ نویسه باشد."
      );
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const response = await fetch(
        `/api/attendance/hr/corrections/${encodeURIComponent(
          current.id
        )}/review`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            comment: comment.trim(),
          }),
        }
      );

      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.error || "ثبت تصمیم ناموفق بود."
        );
      }

      setSelected(null);
      setComment("");

      await load();
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "خطا در ثبت تصمیم"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="mx-auto max-w-6xl space-y-6 p-3 text-slate-900 sm:p-4 md:p-6 [[data-theme=dark]_&]:text-slate-100"
    >
      {/* Header */}

      <header
        className={`${panel} relative overflow-hidden p-5 sm:p-6`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-blue-500/10 blur-3xl [[data-theme=dark]_&]:bg-blue-500/20"
        />

        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
              <ClipboardCheck size={27} />
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-blue-600 [[data-theme=dark]_&]:text-blue-300">
                مدیریت منابع انسانی
              </p>

              <h1 className="text-xl font-black tracking-tight sm:text-2xl">
                بررسی اصلاحات حضور و غیاب
              </h1>

              <p className="mt-2 text-sm leading-7 text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                صندوق درخواست‌های کارکنان – منابع انسانی
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void load()}
            className={secondaryButton}
          >
            <RefreshCw size={16} />
            به‌روزرسانی
          </button>
        </div>
      </header>

      {/* Status Tabs */}

      <section
        className={`${panel} overflow-hidden`}
        aria-label="فیلتر وضعیت درخواست‌ها"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-5 py-4 [[data-theme=dark]_&]:border-white/10">
          <div className="flex items-center gap-2">
            <ShieldCheck
              size={19}
              className="text-blue-500"
            />

            <h2 className="text-sm font-bold">
              وضعیت درخواست‌ها
            </h2>
          </div>

          {data && (
            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-700 [[data-theme=dark]_&]:text-blue-300">
              {data.pagination.total} درخواست
            </span>
          )}
        </div>

        <div
          role="tablist"
          aria-label="وضعیت"
          className="flex gap-1 overflow-x-auto border-b border-slate-200/80 bg-slate-50/50 px-3 pt-3 sm:px-5 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.025]"
        >
          {statusFilters.map((item) => {
            const active = status === item.value;

            return (
              <button
                key={item.value}
                type="button"
                role="tab"
                id={`hr-correction-tab-${item.value}`}
                aria-selected={active}
                aria-controls="hr-correction-panel"
                onClick={() => {
                  setStatus(item.value);
                  setPage(1);
                }}
                className={[
                  "relative shrink-0 rounded-t-xl border border-b-0 px-4 py-3 text-sm font-semibold transition-all duration-300",
                  active
                    ? "border-slate-200 bg-white text-blue-700 shadow-sm [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38] [[data-theme=dark]_&]:text-blue-300"
                    : "border-transparent text-slate-500 hover:bg-blue-500/5 hover:text-blue-600 [[data-theme=dark]_&]:text-slate-400 [[data-theme=dark]_&]:hover:text-blue-300",
                ].join(" ")}
              >
                {item.label}

                {active && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Requests */}

        <div
          id="hr-correction-panel"
          role="tabpanel"
          aria-labelledby={`hr-correction-tab-${status}`}
          className="space-y-3 p-4 sm:p-5"
        >
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm leading-7 text-rose-700 [[data-theme=dark]_&]:text-rose-300"
            >
              {error}
            </p>
          )}

          {loading && (
            <div
              role="status"
              className="flex items-center justify-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/50 p-8 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.03]"
            >
              <RefreshCw
                size={19}
                className="animate-spin text-blue-500 motion-reduce:animate-none"
              />

              <span className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-300">
                در حال دریافت درخواست‌ها...
              </span>
            </div>
          )}

          {!loading &&
            !data?.requests.length &&
            !error && (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-5 py-12 text-center [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.025]">
                <ClipboardCheck
                  size={34}
                  className="mx-auto mb-4 text-slate-400"
                />

                <p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                  درخواستی در این وضعیت وجود ندارد.
                </p>
              </div>
            )}

          {data?.requests.map((request) => (
            <section
              key={request.id}
              className="group rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-blue-500/5 sm:p-5 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.035] [[data-theme=dark]_&]:hover:bg-white/[0.06]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300">
                    <CalendarDays size={19} />
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                      روز کاری
                    </p>

                    <strong className="text-sm font-bold">
                      {date(
                        request.attendanceRecord
                          .workDate
                      )}
                    </strong>
                  </div>
                </div>

                <span
                  className={[
                    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold",
                    statusStyle(request.status),
                  ].join(" ")}
                >
                  <span className="size-1.5 rounded-full bg-current opacity-70" />
                  {statusLabel[request.status] ||
                    request.status}
                </span>
              </div>

              <p className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-slate-200/70 bg-white/70 p-3 text-sm leading-7 text-slate-700 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430]/60 [[data-theme=dark]_&]:text-slate-200">
                {request.reason}
              </p>

              <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-3 [[data-theme=dark]_&]:text-slate-400">
                <div className="flex items-center gap-2">
                  <Clock3
                    size={15}
                    className="shrink-0 text-blue-500"
                  />

                  <span>
                    تاریخ درخواست:{" "}
                    {date(request.createdAt)}
                  </span>
                </div>

                <div className="flex min-w-0 items-center gap-2">
                  <FileText
                    size={15}
                    className="shrink-0 text-blue-500"
                  />

                  <span className="min-w-0 break-all">
                    شناسه انتساب:{" "}
                    {
                      request.attendanceRecord
                        .employeeAssignmentId
                    }
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Clock3
                    size={15}
                    className="shrink-0 text-blue-500"
                  />

                  <span>
                    کارکرد:{" "}
                    {
                      request.attendanceRecord
                        .workedMinutes
                    }{" "}
                    دقیقه
                  </span>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200/80 pt-4 [[data-theme=dark]_&]:border-white/10">
                <button
                  type="button"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-400/20 bg-gradient-to-l from-blue-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-500/20 transition-all duration-300 hover:-translate-y-0.5 hover:from-blue-500 hover:to-indigo-500"
                  onClick={() => {
                    setSelected(request.id);
                    setComment("");
                    setNotice("");
                  }}
                >
                  <ClipboardCheck size={17} />

                  مشاهده جزئیات{" "}
                  {request.status === "PENDING"
                    ? "و بررسی"
                    : ""}
                </button>
              </div>
            </section>
          ))}
        </div>

        {/* Pagination */}

        {data && (
          <nav
            aria-label="صفحه‌بندی"
            className="flex flex-wrap items-center justify-center gap-4 border-t border-slate-200/80 p-4 [[data-theme=dark]_&]:border-white/10"
          >
            <button
              type="button"
              className={secondaryButton}
              disabled={page <= 1}
              onClick={() =>
                setPage((p) => p - 1)
              }
            >
              <ChevronRight size={16} />
              قبلی
            </button>

            <span className="rounded-xl bg-slate-100/80 px-4 py-2.5 text-sm font-semibold text-slate-700 [[data-theme=dark]_&]:bg-white/[0.06] [[data-theme=dark]_&]:text-slate-200">
              صفحه {page} از{" "}
              {Math.max(1, data.pagination.pages)}
            </span>

            <button
              type="button"
              className={secondaryButton}
              disabled={
                page >= data.pagination.pages
              }
              onClick={() =>
                setPage((p) => p + 1)
              }
            >
              بعدی
              <ChevronLeft size={16} />
            </button>
          </nav>
        )}
      </section>

      {/* Review Modal */}

      {current && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !saving
            ) {
              setSelected(null);
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="hr-review-title"
            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200/80 bg-white p-5 text-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-6 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38] [[data-theme=dark]_&]:text-slate-100"
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-5 [[data-theme=dark]_&]:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 [[data-theme=dark]_&]:text-blue-300">
                  <ClipboardCheck size={22} />
                </div>

                <div>
                  <p className="mb-1 text-xs font-medium text-blue-600 [[data-theme=dark]_&]:text-blue-300">
                    بررسی منابع انسانی
                  </p>

                  <h2
                    id="hr-review-title"
                    className="text-lg font-black"
                  >
                    جزئیات درخواست اصلاح
                  </h2>
                </div>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() => setSelected(null)}
                className={secondaryButton}
                aria-label="بستن پنجره بررسی"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              {/* Reason */}

              <div>
                <h3 className="mb-2 text-sm font-bold">
                  توضیح درخواست کارمند
                </h3>

                <p className="whitespace-pre-wrap break-words rounded-xl border border-slate-200/70 bg-slate-50/80 p-4 text-sm leading-8 text-slate-700 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0c1430]/70 [[data-theme=dark]_&]:text-slate-200">
                  {current.reason}
                </p>
              </div>

              {/* Proposed Changes */}

              <div className="rounded-xl border border-slate-200/70 bg-slate-50/70 p-4 text-sm [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.04]">
                <h3 className="mb-4 font-bold">
                  اطلاعات اصلاح پیشنهادی
                </h3>

                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="mb-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                      روز کاری
                    </dt>

                    <dd className="font-semibold">
                      {date(
                        current.attendanceRecord
                          .workDate
                      )}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                      نوع پیشنهادی
                    </dt>

                    <dd className="font-semibold">
                      {current.proposedEventType
                        ? eventLabel[
                            current.proposedEventType
                          ] ||
                          current.proposedEventType
                        : "بدون تغییر"}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                      زمان پیشنهادی
                    </dt>

                    <dd className="font-semibold">
                      {current.proposedOccurredAt
                        ? date(
                            current.proposedOccurredAt
                          )
                        : "ثبت نشده"}
                    </dd>
                  </div>

                  <div>
                    <dt className="mb-1 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                      رویداد هدف
                    </dt>

                    <dd className="break-all font-semibold">
                      {current.attendanceEventId ||
                        "تردد جاافتاده"}
                    </dd>
                  </div>
                </dl>
              </div>

              {/* Original Events */}

              <div>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
                  <Clock3
                    size={17}
                    className="text-blue-500"
                  />

                  ترددهای اصلی
                </h3>

                <div className="space-y-2">
                  {current.attendanceRecord.events.map(
                    (event) => (
                      <div
                        key={event.id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3 text-sm [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-white/[0.04]"
                      >
                        <span className="font-semibold">
                          {eventLabel[
                            event.eventType
                          ] || event.eventType}
                        </span>

                        <span className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                          {date(event.occurredAt)}
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* Previous Review */}

              {current.reviewerComment && (
                <p className="whitespace-pre-wrap break-words rounded-xl border-r-2 border-blue-400 bg-blue-500/5 p-4 text-sm leading-7 text-slate-700 [[data-theme=dark]_&]:text-slate-200">
                  <span className="font-bold">
                    نظر ثبت‌شده:
                  </span>{" "}
                  {current.reviewerComment}
                </p>
              )}

              {/* Review Actions */}

              {current.status === "PENDING" && (
                <div className="space-y-4 border-t border-slate-200/80 pt-5 [[data-theme=dark]_&]:border-white/10">
                  <label className="block text-sm font-semibold">
                    توضیح تصمیم

                    <textarea
                      rows={3}
                      minLength={5}
                      maxLength={2000}
                      className={`${field} resize-y`}
                      value={comment}
                      onChange={(event) =>
                        setComment(event.target.value)
                      }
                      placeholder="دلیل تأیید یا رد را بنویسید"
                    />
                  </label>

                  {notice && (
                    <p
                      role="alert"
                      className="rounded-xl border border-rose-400/20 bg-rose-500/10 p-3 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300"
                    >
                      {notice}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void review("APPROVED")
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckCheck size={18} />
                      {saving
                        ? "در حال ثبت..."
                        : "تأیید درخواست"}
                    </button>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() =>
                        void review("REJECTED")
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <XCircle size={18} />
                      رد درخواست
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
