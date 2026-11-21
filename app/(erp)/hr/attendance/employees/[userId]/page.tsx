"use client";

import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { currentJalaliMonthRange, gregorianToJalali } from "@/modules/attendance/jalali-date";

type EventItem = { id: string; eventType: string; occurredAt: string; source: string };
type Adjustment = { id: string; status: string; reason: string; createdAt: string; reviewedAt: string | null };
type RecordItem = {
  id: string; workDate: string; timeZone: string; status: string; employeeAssignmentId: string;
  scheduledStartAt: string | null; scheduledEndAt: string | null; requiredMinutes: number;
  firstCheckInAt: string | null; lastCheckOutAt: string | null; workedMinutes: number;
  breakMinutes: number; overtimeMinutes: number; lateMinutes: number; earlyLeaveMinutes: number;
  approvedAt: string | null; events: EventItem[]; adjustments: Adjustment[];
};
type Result = {
  employee: { userId: string; fullName: string; personnelCode: string | null; employmentStatus: string };
  from: string; to: string; records: RecordItem[];
  pagination: { page: number; pageSize: number; total: number; pages: number };
  note: string; error?: string;
};
const panel = "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#151c38]";
const button = "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold hover:border-blue-500 disabled:opacity-40 [[data-theme=dark]_&]:border-white/20";
const nf = new Intl.NumberFormat("fa-IR");
function duration(value: number) { return `${nf.format(Math.floor(value / 60))} ساعت و ${nf.format(value % 60)} دقیقه`; }
function jalali(value: string) { return gregorianToJalali(value) ?? value; }
function dateTime(value: string | null, timeZone: string) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
  } catch { return "—"; }
}
export default function HrEmployeeAttendanceDetails() {
  const params = useParams<{ userId: string }>();
  const query = useSearchParams();
  const defaults = currentJalaliMonthRange();
  const from = query.get("from") ?? defaults.from;
  const to = query.get("to") ?? defaults.to;
  const validRange = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  useEffect(() => { setPage(1); }, [from, to, params.userId]);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true); setError("");
      if (!validRange) { setError("بازه تاریخ ورودی معتبر نیست."); setLoading(false); return; }
      try {
        const qs = new URLSearchParams({ from, to, page: String(page) });
        const response = await fetch(`/api/attendance/hr/employees/${encodeURIComponent(params.userId)}/records?${qs}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const body = await response.json() as Result;
        if (!response.ok) throw new Error(body.error || "دریافت سوابق ناموفق بود.");
        if (!Array.isArray(body.records) || !body.pagination || !body.employee) throw new Error("پاسخ سرور معتبر نیست.");
        if (!controller.signal.aborted) setResult(body);
      } catch (e) {
        if (!controller.signal.aborted) { setResult(null); setError(e instanceof Error ? e.message : "خطای ناشناخته"); }
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [params.userId, from, to, page, revision, validRange]);
  return <main dir="rtl" className="mx-auto max-w-6xl space-y-4 p-3 text-slate-900 sm:p-6 [[data-theme=dark]_&]:text-slate-100">
    <header className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/hr/attendance" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"><ArrowRight size={16}/> بازگشت به داشبورد</Link>
          <h1 className="mt-3 text-xl font-black">جزئیات تردد {result?.employee.fullName ?? "کارمند"}</h1>
          <p className="mt-2 text-sm text-slate-500">کد پرسنلی: {result?.employee.personnelCode ?? "—"} | بازه: {jalali(from)} تا {jalali(to)}</p>
        </div>
        <button className={button} onClick={() => setRevision((v) => v + 1)} disabled={loading}><RefreshCw size={16} className={loading ? "animate-spin" : ""}/> به‌روزرسانی</button>
      </div>
    </header>
    <section className={`${panel} text-sm leading-7`}><strong>توجه:</strong> مقادیر کارکرد، تأخیر و اضافه‌کاری این صفحه از رکوردهای ثبت‌شده خوانده می‌شوند و تا زمان نهایی‌سازی، مبنای قطعی حقوق و دستمزد نیستند. رکوردهای چند سمت سازمانی مستقل نمایش داده می‌شوند و جمع نمی‌شوند.</section>
    {error && <p role="alert" className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:bg-rose-950/30 [[data-theme=dark]_&]:text-rose-200">{error}</p>}
    {loading && <p role="status" className={panel}>در حال دریافت سوابق...</p>}
    {!loading && result && result.records.length === 0 && <p className={panel}>در این بازه رکورد ترددی ثبت نشده است.</p>}
    {!loading && result && result.records.map((record) => <article key={record.id} className={panel}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-black">{jalali(record.workDate)}</h2><p className="mt-1 text-xs text-slate-500">وضعیت: {record.status} | شناسه انتساب: {record.employeeAssignmentId}</p></div>
        <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.status === "OPEN" || !record.lastCheckOutAt ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"}`}>{record.status === "OPEN" || !record.lastCheckOutAt ? "نیازمند بررسی" : "ثبت خروج دارد"}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["اولین ورود", dateTime(record.firstCheckInAt, record.timeZone)], ["آخرین خروج", dateTime(record.lastCheckOutAt, record.timeZone)], ["کارکرد ثبت‌شده", duration(record.workedMinutes)], ["کارکرد موردنیاز", duration(record.requiredMinutes)], ["تأخیر", duration(record.lateMinutes)], ["تعجیل", duration(record.earlyLeaveMinutes)], ["اضافه‌کاری ثبت‌شده", duration(record.overtimeMinutes)], ["استراحت", duration(record.breakMinutes)]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 [[data-theme=dark]_&]:bg-white/5"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>)}
      </div>
      <button type="button" className={`${button} mt-4`} aria-expanded={expanded === record.id} onClick={() => setExpanded(expanded === record.id ? null : record.id)}>{expanded === record.id ? "بستن جزئیات" : `نمایش رویدادها و اصلاحات (${nf.format(record.events.length)} / ${nf.format(record.adjustments.length)})`}</button>
      {expanded === record.id && <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section><h3 className="mb-2 font-bold">رویدادهای ثبت‌شده</h3>{record.events.length === 0 ? <p className="text-sm text-slate-500">رویدادی ثبت نشده است.</p> : <ul className="space-y-2">{record.events.map((event) => <li key={event.id} className="rounded-xl border border-slate-200 p-3 text-sm [[data-theme=dark]_&]:border-white/10"><strong>{event.eventType}</strong><p>{dateTime(event.occurredAt, record.timeZone)}</p><p className="text-xs text-slate-500">منبع: {event.source}</p></li>)}</ul>}</section>
        <section><h3 className="mb-2 font-bold">درخواست‌های اصلاح</h3>{record.adjustments.length === 0 ? <p className="text-sm text-slate-500">درخواست اصلاحی ثبت نشده است.</p> : <ul className="space-y-2">{record.adjustments.map((item) => <li key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm [[data-theme=dark]_&]:border-white/10"><strong>{item.status}</strong><p className="mt-1">{item.reason}</p><p className="text-xs text-slate-500">ثبت: {dateTime(item.createdAt, record.timeZone)}</p></li>)}</ul>}</section>
      </div>}
    </article>)}
    {!loading && result && <div className={`${panel} flex flex-wrap items-center justify-between gap-3`}><p className="text-sm">صفحه {nf.format(result.pagination.page)} از {nf.format(Math.max(1, result.pagination.pages))} — {nf.format(result.pagination.total)} رکورد</p><div className="flex gap-2"><button className={button} disabled={page <= 1} onClick={() => { setPage((p) => p - 1); setExpanded(null); }}><ChevronRight size={16}/> قبلی</button><button className={button} disabled={page >= result.pagination.pages} onClick={() => { setPage((p) => p + 1); setExpanded(null); }}>بعدی <ChevronLeft size={16}/></button></div></div>}
  </main>;
}
