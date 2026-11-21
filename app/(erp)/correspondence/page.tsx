"use client";

import { useCallback, useEffect, useState } from "react";

import type { FormEvent } from "react";

import {

  CheckCheck,

  Clock3,

  FilePlus2,

  FileText,

  Inbox,

  Mail,

  Printer,

  RefreshCw,

  Send,

  ShieldCheck,

  X,

  XCircle,

} from "lucide-react";

type Assignment = {

  id: string;

  responsibilityTitle: string | null;

  organizationUnit: { name: string };

  managerAssignmentId: string | null;

};

type Letter = {

  id: string;

  subject: string;

  priority: "NORMAL" | "URGENT";

  status: string;

  senderUserId: string;

  senderAssignmentId: string;

  currentReviewerAssignmentId: string | null;

  createdAt: string;

};

type LetterDetails = {

  id: string;

  subject: string;

  body: string;

  actions: Array<{

    id: string;

    action: string;

    note: string | null;

    createdAt: string;

  }>;

};

type MailTab = "inbox" | "sent" | "all";

const cardClass =
  "relative overflow-hidden rounded-[24px] border border-white/[0.12] bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-white/[0.025] shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl";

const inputClass =
  "mt-2 w-full min-w-0 rounded-xl border border-white/[0.12] bg-[#07132b]/75 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-slate-400 focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10 disabled:opacity-50";

const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.06] px-4 py-2.5 text-sm font-medium text-slate-200 transition-all hover:border-sky-300/30 hover:bg-white/[0.1] disabled:cursor-not-allowed disabled:opacity-40";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-sky-300/25 bg-gradient-to-r from-blue-600/90 to-sky-500/90 px-5 py-3 text-sm font-semibold text-white shadow-[0_6px_22px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] transition-all hover:from-blue-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-40";

const dateFormatter = new Intl.DateTimeFormat(

  "fa-IR-u-ca-persian",

  {

    dateStyle: "medium",

    timeZone: "Asia/Tehran",

  }

);

const dateTimeFormatter = new Intl.DateTimeFormat(

  "fa-IR-u-ca-persian",

  {

    dateStyle: "medium",

    timeStyle: "short",

    timeZone: "Asia/Tehran",

  }

);

function formatDate(value: string) {

  const date = new Date(value);

  return Number.isNaN(date.getTime())

    ? "—"

    : dateFormatter.format(date);

}

function formatDateTime(value: string) {

  const date = new Date(value);

  return Number.isNaN(date.getTime())

    ? "—"

    : dateTimeFormatter.format(date);

}

function statusText(value: string) {

  const labels: Record<string, string> = {

    PENDING: "در انتظار بررسی",

    APPROVED: "تأییدشده",

    REJECTED: "ردشده",

    CLOSED: "مختومه",

    COMPLETED: "تکمیل‌شده",

    CANCELLED: "لغوشده",

  };

  return labels[value] ?? value;

}

function statusClass(value: string) {

  if (value === "PENDING") {

    return "border-amber-400/20 bg-amber-500/10 text-amber-300 ";

  }

  if (value === "REJECTED") {

    return "border-rose-400/20 bg-rose-500/10 text-rose-300 ";

  }

  return "border-emerald-400/20 bg-emerald-500/10 text-emerald-300 ";

}

function escapeHtml(value: string) {

  return value.replace(/[&<>"']/g, (char) => {

    const entities: Record<string, string> = {

      "&": "&amp;",

      "<": "&lt;",

      ">": "&gt;",

      '"': "&quot;",

      "'": "&#39;",

    };

    return entities[char] ?? char;

  });

}

function printLetter(

  letter: LetterDetails,

  metadata?: Letter,

  popup?: Window | null

) {

  const printWindow =

    popup ?? window.open("", "_blank", "width=900,height=1100");

  if (!printWindow) return false;

  const safeSubject = escapeHtml(letter.subject);

  const safeBody = escapeHtml(letter.body).replace(/\r?\n/g, "<br>");

  const safeId = escapeHtml(letter.id);

  const createdAt = metadata

    ? formatDate(metadata.createdAt)

    : "—";

  const priority =

    metadata?.priority === "URGENT" ? "فوری" : "عادی";

  const logoUrl = escapeHtml(new URL("/logo.png", window.location.origin).href);

  const html = `

<!DOCTYPE html>

<html lang="fa" dir="rtl">

<head>

<meta charset="UTF-8">

<meta name="viewport" content="width=device-width, initial-scale=1">

<title>${safeSubject}</title>

<style>

@page { size: A4; margin: 18mm; }

* { box-sizing: border-box; }

body {

  margin: 0;

  background: #fff;

  color: #172033;

  font-family: Tahoma, Arial, sans-serif;

  font-size: 12px;

  line-height: 2.1;

}

.letter { width: 100%; }

.header {

  display: flex;

  justify-content: space-between;

  align-items: flex-start;

  gap: 20px;

  border-bottom: 2px solid #1d4ed8;

  padding-bottom: 18px;

}

.brand { display: flex; align-items: center; gap: 14px; }
.brand img { width: 90px; height: 70px; object-fit: contain; }
.company-name { font-size: 17px; font-weight: 800; color: #17376b; line-height: 1.8; }

.subtitle { font-size: 11px; color: #64748b; }

.meta { font-size: 11px; line-height: 2.2; text-align: left; }

.title { margin-top: 28px; font-size: 14px; font-weight: bold; }

.body {

  min-height: 350px;

  margin-top: 28px;

  font-size: 13px;

  line-height: 2.7;

  overflow-wrap: anywhere;

}

.footer {

  margin-top: 55px;

  padding-top: 18px;

  border-top: 1px solid #cbd5e1;

  font-size: 10px;

  color: #64748b;

}

@media screen {

  body { padding: 40px; background: #e2e8f0; }

  .letter {

    max-width: 794px;

    min-height: 1123px;

    margin: auto;

    padding: 55px;

    background: white;

    box-shadow: 0 10px 40px #0002;

  }

}

</style>

</head>

<body>

<article class="letter">

  <header class="header">

    <div>

      <div class="brand">
        <img id="company-logo" src="${logoUrl}" alt="لوگوی شرکت سهند پیشرو ارتباطات کیان">
        <div>
          <div class="company-name">شرکت سهند پیشرو ارتباطات کیان</div>
          <div class="subtitle">مکاتبات اداری و سازمانی</div>
        </div>
      </div>

    </div>

    <div class="meta">

      <div>تاریخ: ${escapeHtml(createdAt)}</div>

      <div>شناسه نامه: ${safeId}</div>

      <div>اولویت: ${priority}</div>

    </div>

  </header>

  <div class="title">موضوع: ${safeSubject}</div>

  <div class="body">${safeBody}</div>

  <footer class="footer">

    این نامه از سامانه مکاتبات سازمانی شرکت سهند پیشرو ارتباطات کیان صادر شده است.

  </footer>

</article>

<script>

window.addEventListener("load", function () {
  var logo = document.getElementById("company-logo");
  var printOnce = function () { setTimeout(function () { window.print(); }, 200); };
  if (logo && !logo.complete) {
    logo.addEventListener("load", printOnce, { once: true });
    logo.addEventListener("error", printOnce, { once: true });
  } else { printOnce(); }
});

</script>

</body>

</html>`;

  printWindow.document.open();

  printWindow.document.write(html);

  printWindow.document.close();

  return true;

}

export default function CorrespondencePage() {

  const [assignments, setAssignments] =

    useState<Assignment[]>([]);

  const [letters, setLetters] = useState<Letter[]>([]);

  const [assignmentId, setAssignmentId] = useState("");

  const [subject, setSubject] = useState("");

  const [body, setBody] = useState("");

  const [priority, setPriority] =

    useState<"NORMAL" | "URGENT">("NORMAL");

  const [error, setError] = useState("");

  const [busy, setBusy] = useState(false);

  const [filter, setFilter] = useState<MailTab>("inbox");

  const [selected, setSelected] =

    useState<LetterDetails | null>(null);

  const [composeOpen, setComposeOpen] = useState(false);

  const [loadingLetter, setLoadingLetter] = useState(false);

  const [printingId, setPrintingId] =

    useState<string | null>(null);

  const reload = useCallback(async () => {

    try {

      const [a, l] = await Promise.all([

        fetch("/api/correspondence/assignments", {

          cache: "no-store",

        }),

        fetch("/api/correspondence", {

          cache: "no-store",

        }),

      ]);

      if (!a.ok || !l.ok) {

        setError("دریافت اطلاعات کارتابل ناموفق بود.");

        return;

      }

      const aa = await a.json();

      const ll = await l.json();

      setAssignments(aa.data);

      setLetters(ll.data);

      setAssignmentId((old) => old || aa.data[0]?.id || "");

    } catch {

      setError("دریافت اطلاعات کارتابل ناموفق بود.");

    }

  }, []);

  useEffect(() => {

    void reload();

  }, [reload]);

  useEffect(() => {

    if (!composeOpen) return;

    const onEscape = (event: KeyboardEvent) => {

      if (event.key === "Escape" && !busy) {

        setComposeOpen(false);

      }

    };

    const oldOverflow = document.body.style.overflow;

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", onEscape);

    return () => {

      document.body.style.overflow = oldOverflow;

      window.removeEventListener("keydown", onEscape);

    };

  }, [composeOpen, busy]);

  async function openLetter(id: string) {

    setError("");

    setLoadingLetter(true);

    try {

      const response = await fetch(

        `/api/correspondence/${encodeURIComponent(id)}`,

        { cache: "no-store" }

      );

      const payload = await response.json();

      if (!response.ok) {

        throw new Error(

          payload.error || "نمایش نامه ناموفق بود."

        );

      }

      setSelected(payload.data);

    } catch (err) {

      setError(

        err instanceof Error

          ? err.message

          : "نمایش نامه ناموفق بود."

      );

    } finally {

      setLoadingLetter(false);

    }

  }

  async function send(e: FormEvent<HTMLFormElement>) {

    e.preventDefault();

    setBusy(true);

    setError("");

    try {

      const response = await fetch("/api/correspondence", {

        method: "POST",

        headers: { "Content-Type": "application/json" },

        body: JSON.stringify({

          assignmentId,

          subject,

          body,

          priority,

        }),

      });

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "ثبت نامه ناموفق بود.");

      }

      setSubject("");

      setBody("");

      setPriority("NORMAL");

      setComposeOpen(false);

      setFilter("sent");

      await reload();

    } catch (err) {

      setError(err instanceof Error ? err.message : "خطا");

    } finally {

      setBusy(false);

    }

  }

  async function decide(letter: Letter, decision: string) {

    const selectedAssignment = assignments.find(

      (a) => a.id === letter.currentReviewerAssignmentId

    );

    if (!selectedAssignment) return;

    const noteInput = window.prompt(

      "توضیح اقدام (اختیاری):"

    );

    if (noteInput === null) return;

    setBusy(true);

    setError("");

    try {

      const response = await fetch(

        `/api/correspondence/${encodeURIComponent(

          letter.id

        )}/decision`,

        {

          method: "POST",

          headers: { "Content-Type": "application/json" },

          body: JSON.stringify({

            assignmentId: selectedAssignment.id,

            decision,

            note: noteInput,

          }),

        }

      );

      const data = await response.json();

      if (!response.ok) {

        throw new Error(data.error || "اقدام ناموفق بود.");

      }

      await reload();

      if (selected?.id === letter.id) {

        await openLetter(letter.id);

      }

    } catch (err) {

      setError(err instanceof Error ? err.message : "خطا");

    } finally {

      setBusy(false);

    }

  }

  async function handlePrint(letterId: string) {

    if (printingId) return;

    setError("");

    setPrintingId(letterId);

    // Open synchronously to avoid popup blockers.*

    const popup = window.open(

      "",

      "_blank",

      "width=900,height=1100"

    );

    if (!popup) {

      setError("مرورگر پنجره چاپ را مسدود کرده است.");

      setPrintingId(null);

      return;

    }

    try {

      const response = await fetch(

        `/api/correspondence/${encodeURIComponent(letterId)}`,

        { cache: "no-store" }

      );

      const payload = await response.json();

      if (!response.ok) {

        throw new Error(

          payload.error || "دریافت نامه برای چاپ ناموفق بود."

        );

      }

      const details = payload.data as LetterDetails;

      const metadata = letters.find(

        (letter) => letter.id === letterId

      );

      printLetter(details, metadata, popup);

    } catch (err) {

      popup.close();

      setError(

        err instanceof Error ? err.message : "خطا در چاپ نامه"

      );

    } finally {

      setPrintingId(null);

    }

  }

  const inboxLetters = letters.filter((letter) =>

    assignments.some(

      (a) => a.id === letter.currentReviewerAssignmentId

    )

  );

  const sentLetters = letters.filter((letter) =>

    assignments.some(

      (a) => a.id === letter.senderAssignmentId

    )

  );

  const visibleLetters =

    filter === "inbox"

      ? inboxLetters

      : filter === "sent"

        ? sentLetters

        : letters;

  const tabs = [

    {

      value: "inbox" as const,

      label: "نامه‌های دریافتی",

      count: inboxLetters.length,

      icon: Inbox,

    },

    {

      value: "sent" as const,

      label: "نامه‌های ارسالی",

      count: sentLetters.length,

      icon: Send,

    },

    {

      value: "all" as const,

      label: "همه نامه‌ها",

      count: letters.length,

      icon: Mail,

    },

  ];

  return (

    <main

      dir="rtl"

      className="relative isolate mx-auto min-h-full max-w-6xl space-y-6 overflow-hidden p-4 text-slate-100 sm:p-6"

    >

      {/* Header */}

      <header className={`${cardClass} relative overflow-hidden p-5 sm:p-7`}>

        <div

          aria-hidden="true"

          className="pointer-events-none absolute -left-16 -top-20 size-64 rounded-full bg-sky-500/[0.10] blur-3xl"

        />

        <div className="relative flex flex-wrap items-center justify-between gap-5">

          <div className="flex items-center gap-4">

            <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-sky-400/20 bg-sky-400/10 text-sky-300">

              <Mail size={27} />

            </div>

            <div>

              <p className="mb-1 text-xs font-semibold text-sky-300">

                مدیریت مکاتبات داخلی

              </p>

              <h1 className="text-2xl font-black sm:text-3xl">

                نامه‌نگاری سازمانی

              </h1>

              <p className="mt-2 text-sm text-slate-400">

                ثبت، پیگیری، ارجاع و چاپ مکاتبات سازمان

              </p>

            </div>

          </div>

          <button

            type="button"

            onClick={() => {

              setError("");

              setComposeOpen(true);

            }}

            className={primaryButton}

          >

            <FilePlus2 size={19} />

            نامه جدید

          </button>

        </div>

      </header>

      {error && (

        <p

          role="alert"

          className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-300"

        >

          {error}

        </p>

      )}

      {/* Mailbox */}

      <section

        className={`${cardClass} overflow-hidden`}

        aria-label="کارتابل نامه‌ها"

      >

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.10] p-5 ">

          <div className="flex items-center gap-3">

            <Inbox size={21} className="text-sky-300" />

            <h2 className="text-lg font-bold">کارتابل من</h2>

          </div>

          <button

            type="button"

            disabled={busy}

            onClick={() => void reload()}

            className={secondaryButton}

          >

            <RefreshCw size={16} />

            به‌روزرسانی

          </button>

        </div>

        {/* Separate tabs */}

        <div

          role="tablist"

          aria-label="دسته‌بندی نامه‌ها"

          className="flex gap-1 overflow-x-auto border-b border-white/[0.10] bg-white/[0.025] px-3 pt-3 sm:px-5  "

        >

          {tabs.map((tab) => {

            const Icon = tab.icon;

            const active = filter === tab.value;

            return (

              <button

                key={tab.value}

                type="button"

                role="tab"

                id={`correspondence-tab-${tab.value}`}

                aria-selected={active}

                aria-controls="correspondence-panel"

                onClick={() => setFilter(tab.value)}

                className={[

                  "relative flex shrink-0 items-center gap-2 rounded-t-xl border border-b-0 px-4 py-3 text-sm font-semibold transition-all duration-300 sm:px-5",

                  active

                    ? "border-white/[0.10] bg-white/[0.09] text-sky-300 shadow-sm   "

                    : "border-transparent text-slate-400 hover:bg-sky-400/10 hover:text-sky-300  ",

                ].join(" ")}

              >

                <Icon size={17} />

                <span>{tab.label}</span>

                <span

                  className={[

                    "rounded-full px-2 py-0.5 text-xs",

                    active

                      ? "bg-blue-500/10 text-sky-300 "

                      : "bg-white/10 text-slate-400  ",

                  ].join(" ")}

                >

                  {tab.count}

                </span>

                {active && (

                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-500" />

                )}

              </button>

            );

          })}

        </div>

        {/* Tab content */}

        <div

          id="correspondence-panel"

          role="tabpanel"

          aria-labelledby={`correspondence-tab-${filter}`}

          className="space-y-3 p-4 sm:p-5"

        >

          {visibleLetters.map((letter) => {

            const mine = assignments.some(

              (a) => a.id === letter.currentReviewerAssignmentId

            );

            return (

              <article

                key={letter.id}

                className="rounded-2xl border border-white/[0.10] bg-white/[0.035] p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-400/30 hover:bg-sky-400/10   "

              >

                <div className="flex flex-wrap items-start justify-between gap-3">

                  <div className="flex min-w-0 items-start gap-3">

                    <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-sky-300 ">

                      <FileText size={19} />

                    </div>

                    <div className="min-w-0">

                      <button

                        type="button"

                        onClick={() => void openLetter(letter.id)}

                        className="break-words text-right text-sm font-bold hover:text-sky-300 "

                      >

                        {letter.subject}

                      </button>

                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-400 ">

                        <Clock3 size={13} />

                        {formatDate(letter.createdAt)}

                      </p>

                    </div>

                  </div>

                  <div className="flex flex-wrap gap-2">

                    <span

                      className={[

                        "rounded-full border px-3 py-1.5 text-xs font-semibold",

                        letter.priority === "URGENT"

                          ? "border-rose-400/20 bg-rose-500/10 text-rose-300 "

                          : "border-blue-400/20 bg-blue-500/10 text-sky-300 ",

                      ].join(" ")}

                    >

                      {letter.priority === "URGENT" ? "فوری" : "عادی"}

                    </span>

                    <span

                      className={[

                        "rounded-full border px-3 py-1.5 text-xs font-semibold",

                        statusClass(letter.status),

                      ].join(" ")}

                    >

                      {statusText(letter.status)}

                    </span>

                  </div>

                </div>

                <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.08] pt-4 ">

                  <button

                    type="button"

                    onClick={() => void openLetter(letter.id)}

                    className={secondaryButton}

                  >

                    <FileText size={15} />

                    مشاهده نامه

                  </button>

                  <button

                    type="button"

                    disabled={printingId !== null}

                    onClick={() => void handlePrint(letter.id)}

                    className={secondaryButton}

                  >

                    <Printer size={15} />

                    {printingId === letter.id

                      ? "آماده‌سازی..."

                      : "چاپ نامه"}

                  </button>

                  {mine && letter.status === "PENDING" && (

                    <>

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() =>

                          void decide(letter, "APPROVE_AND_FORWARD")

                        }

                        className={secondaryButton}

                      >

                        <CheckCheck size={15} className="text-emerald-500" />

                        تأیید و ارجاع

                      </button>

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() =>

                          void decide(letter, "CLOSE_AT_TOP")

                        }

                        className={secondaryButton}

                      >

                        <ShieldCheck size={15} className="text-sky-300" />

                        خاتمه در رأس

                      </button>

                      <button

                        type="button"

                        disabled={busy}

                        onClick={() => void decide(letter, "REJECT")}

                        className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5 text-sm font-medium text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-50 "

                      >

                        <XCircle size={15} />

                        رد نامه

                      </button>

                    </>

                  )}

                </div>

              </article>

            );

          })}

          {visibleLetters.length === 0 && (

            <div className="rounded-2xl border border-dashed border-white/[0.10] bg-white/[0.025] p-10 text-center  ">

              <Inbox size={32} className="mx-auto mb-3 text-slate-400" />

              <p className="text-sm text-slate-400 ">

                نامه‌ای در این بخش وجود ندارد.

              </p>

            </div>

          )}

        </div>

      </section>

      {/* Letter details */}

      {selected && (

        <section

          className={`${cardClass} space-y-5 p-5 sm:p-6`}

          aria-label="متن و تاریخچه نامه"

        >

          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.10] pb-4 ">

            <h2 className="break-words text-lg font-bold">

              {selected.subject}

            </h2>

            <div className="flex flex-wrap gap-2">

              <button

                type="button"

                disabled={printingId !== null}

                onClick={() => void handlePrint(selected.id)}

                className={primaryButton}

              >

                <Printer size={16} />

                چاپ نامه

              </button>

              <button

                type="button"

                onClick={() => setSelected(null)}

                className={secondaryButton}

              >

                <X size={16} />

                بستن

              </button>

            </div>

          </div>

          <p className="whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-[#07132b]/65 p-5 text-sm leading-9 text-slate-200   ">

            {selected.body}

          </p>

          <h3 className="flex items-center gap-2 font-bold">

            <Clock3 size={18} className="text-sky-300" />

            تاریخچه گردش

          </h3>

          <ol className="space-y-3">

            {selected.actions.map((action) => (

              <li

                key={action.id}

                className="rounded-xl border border-white/[0.10] bg-white/[0.035] p-4 text-sm  "

              >

                <div className="flex flex-wrap items-center justify-between gap-2">

                  <span className="font-semibold">

                    {action.action}

                  </span>

                  <span className="text-xs text-slate-400 ">

                    {formatDateTime(action.createdAt)}

                  </span>

                </div>

                {action.note && (

                  <p className="mt-3 whitespace-pre-wrap break-words border-r-2 border-blue-400 bg-blue-500/5 px-3 py-2 leading-7">

                    {action.note}

                  </p>

                )}

              </li>

            ))}

          </ol>

        </section>

      )}

      {/* Compose modal */}

      {composeOpen && (

        <div

          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/75 p-3 backdrop-blur-sm sm:p-5"

          onMouseDown={(event) => {

            if (event.target === event.currentTarget && !busy) {

              setComposeOpen(false);

            }

          }}

        >

          <section

            role="dialog"

            aria-modal="true"

            aria-labelledby="compose-letter-title"

            className="max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/[0.10] bg-[#101c38]/95 p-5 text-slate-100 backdrop-blur-2xl shadow-[0_30px_100px_rgba(0,0,0,0.35)] sm:p-7   "

          >

            <div className="flex items-center justify-between gap-3 border-b border-white/[0.10] pb-5 ">

              <div className="flex items-center gap-3">

                <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-sky-300 ">

                  <FilePlus2 size={22} />

                </div>

                <div>

                  <p className="mb-1 text-xs text-sky-300 ">

                    ایجاد مکاتبه

                  </p>

                  <h2

                    id="compose-letter-title"

                    className="text-lg font-black"

                  >

                    نامه جدید

                  </h2>

                </div>

              </div>

              <button

                type="button"

                disabled={busy}

                onClick={() => setComposeOpen(false)}

                className={secondaryButton}

                aria-label="بستن پنجره نامه جدید"

              >

                <X size={18} />

              </button>

            </div>

            <form onSubmit={send} className="mt-5 space-y-5">

              <label className="block text-sm font-medium">

                مسئولیت فرستنده

                <select

                  className={inputClass}

                  value={assignmentId}

                  onChange={(event) =>

                    setAssignmentId(event.target.value)

                  }

                  required

                >

                  {assignments.map((assignment) => (

                    <option

                      key={assignment.id}

                      value={assignment.id}

                    >

                      {assignment.organizationUnit.name} -{" "}

                      {assignment.responsibilityTitle ||

                        "مسئولیت سازمانی"}

                    </option>

                  ))}

                </select>

              </label>

              <label className="block text-sm font-medium">

                موضوع

                <input

                  className={inputClass}

                  value={subject}

                  maxLength={200}

                  onChange={(event) =>

                    setSubject(event.target.value)

                  }

                  required

                />

              </label>

              <label className="block text-sm font-medium">

                متن نامه

                <textarea

                  className={`${inputClass} min-h-44 resize-y leading-8`}

                  value={body}

                  maxLength={20000}

                  onChange={(event) =>

                    setBody(event.target.value)

                  }

                  required

                />

              </label>

              <label className="block text-sm font-medium">

                اولویت

                <select

                  className={inputClass}

                  value={priority}

                  onChange={(event) =>

                    setPriority(

                      event.target.value as "NORMAL" | "URGENT"

                    )

                  }

                >

                  <option value="NORMAL">عادی</option>

                  <option value="URGENT">

                    فوری (حداکثر ۲ نامه در ماه شمسی)

                  </option>

                </select>

              </label>

              <div className="flex flex-wrap justify-end gap-3 border-t border-white/[0.10] pt-5 ">

                <button

                  type="button"

                  disabled={busy}

                  onClick={() => setComposeOpen(false)}

                  className={secondaryButton}

                >

                  انصراف

                </button>

                <button

                  type="submit"

                  disabled={busy || !assignmentId}

                  className={primaryButton}

                >

                  <Send size={17} />

                  {busy ? "در حال ارسال..." : "ارسال به مدیر مستقیم"}

                </button>

              </div>

            </form>

          </section>

        </div>

      )}

      {loadingLetter && (

        <div

          role="status"

          className="fixed bottom-5 left-5 z-[120] flex items-center gap-2 rounded-xl border border-sky-400/20 bg-[#101c38] px-4 py-3 text-sm text-slate-200 shadow-xl"

        >

          <RefreshCw size={16} className="animate-spin" />

          در حال دریافت نامه...

        </div>

      )}

    </main>

  );

}
