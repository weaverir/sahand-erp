"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, ArrowLeftRight, CalendarClock, ChevronLeft, ChevronRight,
  ClipboardList, Eye, Filter, History, LoaderCircle,
  RefreshCw, Search, ShieldCheck, UserRound, X, ChevronDown,
} from "lucide-react";
import { api } from "./api";
import { ErrorBox } from "./ui";

type Log = {
  id: string;
  actorUserId: string;
  entityType: string;
  entityId: string;
  action: string;
  ipAddress?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  createdAt: string;
};

const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-sm";
const muted = "text-[var(--muted)]";
const inputStyle = "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/10";

const entityNames: Record<string, string> = {
  OrganizationUnit: "واحد سازمانی", OrganizationPosition: "سمت سازمانی",
  OrganizationLocation: "محل سازمانی", EmployeeAssignment: "انتصاب کارمند",
  OrganizationRelationship: "رابطه سازمانی", AssignmentAccess: "دسترسی انتصاب",
  User: "کاربر", Role: "نقش", Permission: "مجوز",
  organization_unit: "واحد سازمانی", organization_position: "سمت سازمانی",
  employee_assignment: "انتصاب کارمند", assignment_access: "دسترسی انتصاب",
};
const actionNames: Record<string, string> = {
  CREATE: "ایجاد", CREATED: "ایجاد", ADD: "افزودن",
  UPDATE: "ویرایش", UPDATED: "ویرایش", EDIT: "ویرایش",
  DELETE: "حذف", DELETED: "حذف", REMOVE: "حذف",
  MOVE: "انتقال", MOVED: "انتقال", ASSIGN: "انتصاب",
  REVOKE: "لغو دسترسی", GRANT: "اعطای دسترسی",
  ACTIVATE: "فعال‌سازی", DEACTIVATE: "غیرفعال‌سازی",
};
function entityLabel(value: string) { return entityNames[value] || value.replace(/_/g, " "); }
function actionLabel(value: string) { return actionNames[value.toUpperCase()] || value; }
function actionStyle(value: string) {
  const action = value.toUpperCase();
  if (/DELETE|REMOVE|REVOKE|DEACTIVATE/.test(action)) return "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400";
  if (/CREATE|ADD|GRANT|ACTIVATE/.test(action)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
  if (/UPDATE|EDIT|MOVE/.test(action)) return "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400";
  return "border-[var(--border)] bg-black/5 text-[var(--foreground)] dark:bg-white/5";
}
function dateLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(date);
}
const fieldNames: Record<string, string> = {
  id: "شناسه", name: "نام", title: "عنوان", code: "کد", description: "توضیحات",
  status: "وضعیت", isActive: "فعال بودن", isPrimary: "مسئولیت اصلی",
  userId: "کارمند", actorUserId: "کاربر ثبت‌کننده", organizationUnitId: "واحد سازمانی",
  parentId: "واحد بالادستی", positionId: "سمت سازمانی", locationId: "محل خدمت",
  managerAssignmentId: "مدیر مستقیم", assignmentType: "نوع مسئولیت",
  responsibilityTitle: "عنوان مسئولیت", startDate: "تاریخ شروع", endDate: "تاریخ پایان",
  createdAt: "زمان ثبت", updatedAt: "زمان آخرین ویرایش", expiresAt: "تاریخ انقضا",
  notes: "یادداشت", fullName: "نام و نام خانوادگی", username: "نام کاربری",
  email: "رایانامه", phone: "شماره تماس", roleId: "نقش", permissionId: "مجوز",
  permissionIds: "مجوزها", isAllowed: "مجاز بودن", scope: "محدوده دسترسی",
  oldParentId: "واحد بالادستی قبلی", newParentId: "واحد بالادستی جدید",
};
const valueNames: Record<string, string> = {
  ACTIVE: "فعال", INACTIVE: "غیرفعال", SUSPENDED: "معلق", ENDED: "پایان‌یافته",
  DRAFT: "پیش‌نویس", APPROVED: "تأییدشده", REJECTED: "ردشده",
  PRIMARY: "مسئولیت اصلی", SECONDARY: "مسئولیت دوم", TEMPORARY: "مسئولیت موقت",
  PROJECT: "مسئولیت پروژه‌ای", OWN: "فقط اطلاعات شخصی", UNIT: "واحد مربوطه",
  SUBTREE: "واحد و زیرمجموعه‌ها", ALL: "تمام اطلاعات", ASSIGNED: "موارد اختصاص‌یافته",
  DEPARTMENT: "کل دپارتمان",
};
function friendlyField(key: string) {
  return fieldNames[key] || key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/_/g, " ");
}
function friendlyValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "ثبت نشده";
  if (typeof value === "boolean") return value ? "بله" : "خیر";
  if (typeof value === "number") return value.toLocaleString("fa-IR");
  if (typeof value === "string") {
    if (valueNames[value]) return valueNames[value];
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return dateLabel(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(friendlyValue).join("، ") || "موردی ندارد";
  return "اطلاعات تکمیلی";
}
function flattenData(value: unknown, prefix = "", depth = 0): { label: string; value: string }[] {
  if (value === null || value === undefined) return [];
  if (typeof value !== "object") return [{ label: prefix || "مقدار", value: friendlyValue(value) }];
  if (depth > 3) return [{ label: prefix || "اطلاعات", value: "جزئیات بیشتر در نمایش فنی" }];
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => flattenData(item, `${prefix} - مورد ${(index + 1).toLocaleString("fa-IR")}`, depth + 1));
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => {
    const label = prefix ? `${prefix} / ${friendlyField(key)}` : friendlyField(key);
    if (item !== null && typeof item === "object") return flattenData(item, label, depth + 1);
    return [{ label, value: friendlyValue(item) }];
  });
}
function jsonText(value: unknown) {
  if (value === undefined || value === null) return "اطلاعاتی ثبت نشده است.";
  try { return JSON.stringify(value, null, 2) ?? String(value); }
  catch { return String(value); }
}
function DataPreview({ value, title }: { value: unknown; title: string }) {
  const [technical, setTechnical] = useState(false);
  const entries = useMemo(() => flattenData(value), [value]);
  return <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--border)]">
    <div className="border-b border-[var(--border)] px-4 py-3"><h4 className="text-sm font-bold">{title}</h4></div>
    {entries.length ? <div className="max-h-[380px] divide-y divide-[var(--border)] overflow-y-auto">
      {entries.map((entry, index) => <div key={`${entry.label}-${index}`} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] sm:gap-3">
        <span className="text-xs text-[var(--muted)]">{entry.label}</span><span className="break-words text-sm font-medium" dir="auto">{entry.value}</span>
      </div>)}
    </div> : <p className="p-5 text-sm text-[var(--muted)]">اطلاعاتی برای این بخش ثبت نشده است.</p>}
    <div className="border-t border-[var(--border)] px-4 py-3">
      <button type="button" onClick={() => setTechnical(x => !x)} className="inline-flex items-center gap-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]">
        <ChevronDown size={14} className={technical ? "rotate-180" : ""} /> {technical ? "پنهان کردن اطلاعات فنی" : "نمایش اطلاعات فنی (ویژه پشتیبانی)"}
      </button>
      {technical && <pre dir="ltr" className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-black/5 p-3 text-left font-mono text-xs dark:bg-white/5">{jsonText(value)}</pre>}
    </div>
  </section>;
}
function Metric({ title, value, icon: Icon, tone }: {
  title: string; value: number; icon: typeof History; tone: string;
}) {
  return <div className={`${panel} flex items-center gap-3 p-4 sm:p-5`}>
    <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl ${tone}`}><Icon size={21} /></div>
    <div className="min-w-0"><p className={`text-xs sm:text-sm ${muted}`}>{title}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{value.toLocaleString("fa-IR")}</p></div>
  </div>;
}

export default function AuditLogPanel() {
  const [rows, setRows] = useState<Log[]>([]);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Log | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [showTechnical, setShowTechnical] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ logs?: Log[]; pages?: number }>(
        `/api/organization/audit-logs?page=${page}&limit=30`
      );
      setRows(Array.isArray(data.logs) ? data.logs : []);
      setPages(Math.max(1, Number(data.pages) || 1));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت گزارش حسابرسی ناموفق بود.");
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const actionOptions = useMemo(() => Array.from(new Set(rows.map(x => x.action))).sort(), [rows]);
  const entityOptions = useMemo(() => Array.from(new Set(rows.map(x => x.entityType))).sort(), [rows]);
  const visible = useMemo(() => rows.filter(row => {
    const term = search.trim().toLocaleLowerCase();
    const text = [row.actorUserId, row.entityType, entityLabel(row.entityType), row.entityId,
      row.action, actionLabel(row.action), row.ipAddress || ""].join(" ").toLocaleLowerCase();
    return (!term || text.includes(term)) &&
      (actionFilter === "ALL" || row.action === actionFilter) &&
      (entityFilter === "ALL" || row.entityType === entityFilter);
  }), [rows, search, actionFilter, entityFilter]);
  const uniqueActors = useMemo(() => new Set(rows.map(x => x.actorUserId)).size, [rows]);
  const changes = useMemo(() => rows.filter(x => x.beforeData != null && x.afterData != null).length, [rows]);

  return <section dir="rtl" className="space-y-5 text-[var(--foreground)]">
    <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
      <div className="flex items-start gap-3">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><History size={24} /></div>
        <div><div className={`mb-1 flex items-center gap-2 text-xs ${muted}`}><ShieldCheck size={14} /> نظارت و امنیت سازمان</div>
          <h2 className="text-xl font-black tracking-tight sm:text-2xl">سابقه تغییرات سازمانی</h2>
          <p className={`mt-1 text-sm leading-6 ${muted}`}>ببینید چه تغییری، چه زمانی و توسط کدام کاربر ثبت شده است.</p></div>
      </div>
      <button type="button" onClick={() => void load()} disabled={loading}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> بروزرسانی گزارش
      </button>
    </header>

    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Metric title="تغییرات این صفحه" value={rows.length} icon={ClipboardList} tone="bg-blue-500/10 text-blue-600" />
      <Metric title="کاربران انجام‌دهنده" value={uniqueActors} icon={UserRound} tone="bg-violet-500/10 text-violet-600" />
      <Metric title="تغییرات قابل مقایسه" value={changes} icon={ArrowLeftRight} tone="bg-emerald-500/10 text-emerald-600" />
      <Metric title="تعداد صفحات سوابق" value={pages} icon={Activity} tone="bg-amber-500/10 text-amber-600" />
    </div>

    {error && <ErrorBox>{error}</ErrorBox>}

    <div className={`${panel} overflow-hidden`}>
      <div className="border-b border-[var(--border)] p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="font-bold">فهرست تغییرات</h3>
            <p className={`mt-1 text-xs ${muted}`}>جست‌وجو و فیلتر روی {rows.length.toLocaleString("fa-IR")} تغییر دریافت‌شده در همین صفحه</p></div>
          <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs">{visible.length.toLocaleString("fa-IR")} نتیجه</span>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_210px_210px]">
          <div className="relative"><Search size={17} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`} />
            <input className={`${inputStyle} pr-10`} value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی کاربر، نوع تغییر یا موضوع..." /></div>
          <div className="relative"><Filter size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 ${muted}`} />
            <select className={`${inputStyle} pr-9`} value={actionFilter} onChange={e => setActionFilter(e.target.value)}>
              <option value="ALL">همه نوع تغییرها</option>{actionOptions.map(x => <option key={x} value={x}>{actionLabel(x)}</option>)}
            </select></div>
          <select className={inputStyle} value={entityFilter} onChange={e => setEntityFilter(e.target.value)}>
            <option value="ALL">همه بخش‌های سازمان</option>{entityOptions.map(x => <option key={x} value={x}>{entityLabel(x)}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-right text-sm">
          <thead className="bg-black/[0.035] text-xs text-[var(--muted)] dark:bg-white/[0.04]"><tr>
            <th className="px-5 py-4 font-semibold">زمان تغییر</th><th className="px-4 py-4 font-semibold">کاربر</th>
            <th className="px-4 py-4 font-semibold">بخش تغییرکرده</th><th className="px-4 py-4 font-semibold">نوع تغییر</th>
            
            <th className="px-4 py-4 font-semibold">جزئیات</th>
          </tr></thead>
          <tbody className="divide-y divide-[var(--border)]">
            {visible.map(row => <tr key={row.id} className="transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]">
              <td className="whitespace-nowrap px-5 py-4"><span className="inline-flex items-center gap-2"><CalendarClock size={15} className="text-blue-500" />{dateLabel(row.createdAt)}</span></td>
              <td className="px-4 py-4"><span className="inline-flex items-center gap-2"><UserRound size={15} className={muted} /><span dir="ltr" className="max-w-[150px] truncate font-mono text-xs" title={row.actorUserId}>{row.actorUserId}</span></span></td>
              <td className="px-4 py-4 font-medium">{entityLabel(row.entityType)}</td>
              <td className="px-4 py-4"><span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-semibold ${actionStyle(row.action)}`}>{actionLabel(row.action)}</span></td>
              
              <td className="px-4 py-4"><button type="button" onClick={() => { setShowTechnical(false); setSelected(row); }} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-blue-500/10 dark:text-blue-400"><Eye size={15} /> مشاهده</button></td>
            </tr>)}
            {loading && rows.length === 0 && <tr><td colSpan={5} className="py-16 text-center"><LoaderCircle size={28} className="mx-auto mb-3 animate-spin text-blue-500" /><span className={muted}>در حال دریافت گزارش...</span></td></tr>}
            {!loading && visible.length === 0 && <tr><td colSpan={5} className="px-4 py-16 text-center"><Search size={30} className={`mx-auto mb-3 ${muted}`} /><p className="font-semibold">تغییری پیدا نشد</p><p className={`mt-1 text-xs ${muted}`}>فیلترها را تغییر دهید یا صفحه دیگری را بررسی کنید.</p></td></tr>}
          </tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] p-4 text-sm">
        <p className={muted}>صفحه {page.toLocaleString("fa-IR")} از {pages.toLocaleString("fa-IR")}</p>
        <div className="flex items-center gap-2">
          <button type="button" disabled={loading || page <= 1} onClick={() => setPage(p => p - 1)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-40"><ChevronRight size={16} /> قبلی</button>
          <button type="button" disabled={loading || page >= pages} onClick={() => setPage(p => p + 1)} className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)] px-3 py-2 disabled:opacity-40">بعدی <ChevronLeft size={16} /></button>
        </div>
      </footer>
    </div>

    {selected && <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5" onMouseDown={e => { if (e.target === e.currentTarget) setSelected(null); }}>
      <div role="dialog" aria-modal="true" aria-label="جزئیات تغییر ثبت‌شده" className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5 sm:p-6">
          <div className="flex items-start gap-3"><div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600"><History size={22} /></div>
            <div><h3 className="text-lg font-black">جزئیات تغییر ثبت‌شده</h3><p className={`mt-1 text-xs ${muted}`}>{dateLabel(selected.createdAt)}</p></div></div>
          <button type="button" aria-label="بستن" onClick={() => setSelected(null)} className="rounded-xl border border-[var(--border)] p-2 hover:bg-black/5 dark:hover:bg-white/5"><X size={19} /></button>
        </header>
        <div className="space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["نوع تغییر", actionLabel(selected.action)], ["بخش تغییرکرده", entityLabel(selected.entityType)],
              ["کاربر ثبت‌کننده", selected.actorUserId], ["زمان ثبت", dateLabel(selected.createdAt)],
            ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-[var(--border)] bg-black/[0.025] p-3 dark:bg-white/[0.03]"><p className={`text-xs ${muted}`}>{label}</p><p className="mt-1 break-all text-sm font-semibold">{value}</p></div>)}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <DataPreview key={`${selected.id}-before`} value={selected.beforeData} title="وضعیت قبل از تغییر" />
            <DataPreview key={`${selected.id}-after`} value={selected.afterData} title="وضعیت بعد از تغییر" />
          </div>
          <div className="rounded-xl border border-[var(--border)] p-3">
            <button type="button" onClick={() => setShowTechnical(x => !x)} className="inline-flex items-center gap-2 text-xs text-[var(--muted)]"><ChevronDown size={14} /> {showTechnical ? "بستن مشخصات فنی" : "مشخصات فنی (ویژه پشتیبانی)"}</button>
            {showTechnical && <div className="mt-3 grid gap-2 text-xs"><p>شناسه تغییر: <span dir="ltr" className="break-all">{selected.id}</span></p><p>شناسه اطلاعات: <span dir="ltr" className="break-all">{selected.entityId}</span></p><p>نشانی اتصال: <span dir="ltr">{selected.ipAddress || "ثبت نشده"}</span></p></div>}
          </div>
          <p className={`text-xs leading-6 ${muted}`}>این اطلاعات از سوابق ثبت‌شده در سیستم نمایش داده می‌شوند و در این صفحه قابل ویرایش نیستند.</p>
        </div>
        <footer className="flex justify-end border-t border-[var(--border)] p-4"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold">بستن</button></footer>
      </div>
    </div>}
  </section>;
}
