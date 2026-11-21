"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BriefcaseBusiness, Plus, Pencil, RefreshCw, Search, ShieldCheck, Users, Layers3, X, LoaderCircle, CheckCircle2, CircleOff } from "lucide-react";
import type { Position } from "./types";
import { api, req, list } from "./api";
import { Modal, Field, input, primary, secondary, ErrorBox } from "./ui";

const fa = (n: number) => n.toLocaleString("fa-IR");

function PositionForm({ item, close, saved }: { item?: Position; close: () => void; saved: () => void }) {
  const [code, setCode] = useState(item?.code ?? "");
  const [title, setTitle] = useState(item?.title ?? "");
  const [level, setLevel] = useState(String(item?.level ?? 1));
  const [description, setDescription] = useState(item?.description ?? "");
  const [managerial, setManagerial] = useState(item?.isManagerial ?? false);
  const [active, setActive] = useState(item?.isActive ?? true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const parsedLevel = Number(level);
    if (!code.trim() || !title.trim()) { setError("کد و عنوان سمت را وارد کنید."); return; }
    if (!Number.isInteger(parsedLevel) || parsedLevel < 1 || parsedLevel > 100) { setError("سطح سازمانی باید عددی بین ۱ تا ۱۰۰ باشد."); return; }
    setBusy(true);
    setError("");
    try {
      await api("/api/organization/positions", req(item ? "PATCH" : "POST", {
        ...(item ? { id: item.id } : {}),
        code: code.trim(), title: title.trim(), level: parsedLevel,
        description: description.trim() || null, isManagerial: managerial, isActive: active,
      }));
      saved();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ذخیره سمت انجام نشد.");
    } finally { setBusy(false); }
  }

  return (
    <Modal title={item ? "ویرایش سمت سازمانی" : "تعریف سمت سازمانی جدید"} close={close}>
      <form dir="rtl" onSubmit={submit} className="grid gap-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--primary)]/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><BriefcaseBusiness size={22} /></div>
            <div><p className="font-bold">مشخصات سمت</p><p className="mt-1 text-xs leading-6 text-[var(--muted)]">عنوانی که در چارت سازمانی و انتصاب کارکنان نمایش داده می‌شود را مشخص کنید.</p></div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="عنوان سمت *"><input required maxLength={120} className={input} value={title} onChange={e => setTitle(e.target.value)} placeholder="مثلاً مدیر تولید" disabled={busy} /></Field>
          <Field label="کد سمت *"><input required className={input} dir="ltr" value={code} onChange={e => setCode(e.target.value)} placeholder="مثلاً PROD-MGR" disabled={busy} /></Field>
        </div>
        <Field label="سطح سازمانی (۱ تا ۱۰۰)">
          <input required type="number" min={1} max={100} step={1} className={input} value={level} onChange={e => setLevel(e.target.value)} disabled={busy} />
          <p className="mt-1.5 text-xs text-[var(--muted)]">این عدد برای تعیین سطح سمت در ساختار سازمان استفاده می‌شود.</p>
        </Field>
        <Field label="شرح وظایف و توضیحات"><textarea rows={3} className={input} value={description} onChange={e => setDescription(e.target.value)} placeholder="توضیحات اختیاری درباره این سمت..." disabled={busy} /></Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${managerial ? "border-[var(--primary)] bg-[var(--primary)]/5" : "border-[var(--border)]"}`}>
            <input type="checkbox" checked={managerial} onChange={e => setManagerial(e.target.checked)} disabled={busy} className="size-4 accent-blue-600" />
            <span><span className="block text-sm font-semibold">سمت مدیریتی</span><span className="mt-1 block text-xs text-[var(--muted)]">برای مسئولیت‌های مدیریتی</span></span>
          </label>
          <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-4 transition ${active ? "border-emerald-500/40 bg-emerald-500/5" : "border-[var(--border)]"}`}>
            <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} disabled={busy} className="size-4 accent-emerald-600" />
            <span><span className="block text-sm font-semibold">سمت فعال باشد</span><span className="mt-1 block text-xs text-[var(--muted)]">قابل استفاده در انتصاب‌های جدید</span></span>
          </label>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" className={secondary} onClick={close} disabled={busy}>انصراف</button>
          <button type="submit" className={primary} disabled={busy}>{busy ? <LoaderCircle size={16} className="ml-2 inline animate-spin" /> : <CheckCircle2 size={16} className="ml-2 inline" />}{busy ? "در حال ذخیره..." : item ? "ثبت تغییرات" : "ایجاد سمت"}</button>
        </div>
      </form>
    </Modal>
  );
}

export default function PositionsManager() {
  const [rows, setRows] = useState<Position[]>([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<Position | undefined>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE" | "MANAGERIAL">("ALL");

  async function load() {
    setLoading(true);
    try {
      setRows(list<Position>(await api("/api/organization/positions"), "positions"));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "دریافت سمت‌های سازمانی انجام نشد.");
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("fa-IR");
    return rows.filter(item => {
      if (filter === "ACTIVE" && !item.isActive) return false;
      if (filter === "INACTIVE" && item.isActive) return false;
      if (filter === "MANAGERIAL" && !item.isManagerial) return false;
      return !q || `${item.title} ${item.code} ${item.description ?? ""}`.toLocaleLowerCase("fa-IR").includes(q);
    }).sort((a, b) => a.level - b.level || a.title.localeCompare(b.title, "fa"));
  }, [rows, search, filter]);
  const managerialCount = rows.filter(x => x.isManagerial).length;
  const activeCount = rows.filter(x => x.isActive).length;
  const stats = [
    { title: "کل سمت‌های تعریف‌شده", value: rows.length, icon: BriefcaseBusiness },
    { title: "سمت‌های فعال", value: activeCount, icon: ShieldCheck },
    { title: "سمت‌های مدیریتی", value: managerialCount, icon: Users },
    { title: "سطوح ثبت‌شده", value: new Set(rows.map(x => x.level)).size, icon: Layers3 },
  ];
  const filters = [{ id: "ALL", label: "همه سمت‌ها" }, { id: "ACTIVE", label: "فعال" }, { id: "INACTIVE", label: "غیرفعال" }, { id: "MANAGERIAL", label: "مدیریتی" }] as const;

  return (
    <section dir="rtl" className="grid gap-5 text-[var(--foreground)]">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-slate-900 via-indigo-950 to-slate-900 p-5 text-white shadow-lg sm:p-7">
        <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-indigo-400/15 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-start gap-4"><span className="flex size-14 shrink-0 items-center justify-center rounded-2xl border border-white/15 bg-white/10"><BriefcaseBusiness size={27} /></span><div><h2 className="text-xl font-black sm:text-2xl">مدیریت سمت‌های سازمانی</h2><p className="mt-2 max-w-xl text-sm leading-7 text-indigo-100/80">سمت‌های مورد نیاز سازمان را تعریف، دسته‌بندی و ویرایش کنید. هر سمت می‌تواند در انتصاب کارکنان استفاده شود.</p></div></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-medium transition hover:bg-white/20 disabled:opacity-50"><RefreshCw size={16} className={loading ? "animate-spin" : ""} />بروزرسانی</button><button type="button" onClick={() => { setEdit(undefined); setOpen(true); }} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-indigo-950 transition hover:bg-indigo-50"><Plus size={17} />تعریف سمت جدید</button></div>
        </div>
      </header>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map(({ title, value, icon: Icon }) => <article key={title} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-xs leading-5 text-[var(--muted)] sm:text-sm">{title}</span><Icon size={18} className="shrink-0 text-[var(--primary)]" /></div><p className="mt-3 text-2xl font-black tabular-nums">{fa(value)}</p></article>)}</div>
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <div className="flex flex-col gap-4 border-b border-[var(--border)] p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><h3 className="font-bold">فهرست سمت‌ها</h3><p className="mt-1 text-xs text-[var(--muted)]">{fa(filtered.length)} سمت مطابق جست‌وجو و فیلتر</p></div>
          <div className="relative w-full lg:max-w-xs"><Search size={17} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" /><input className={`${input} w-full pr-10`} value={search} onChange={e => setSearch(e.target.value)} placeholder="جست‌وجوی نام، کد یا توضیحات..." aria-label="جست‌وجوی سمت‌ها" />{search && <button type="button" onClick={() => setSearch("")} title="پاک کردن جست‌وجو" className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]"><X size={16} /></button>}</div>
        </div>
        <div className="flex flex-wrap gap-2 border-b border-[var(--border)] px-4 py-3 sm:px-5">{filters.map(f => <button key={f.id} type="button" onClick={() => setFilter(f.id)} className={`rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${filter === f.id ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]" : "border-[var(--border)] text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5"}`}>{f.label}</button>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-right text-sm"><thead className="bg-black/[0.035] text-xs text-[var(--muted)] dark:bg-white/[0.035]"><tr><th className="px-5 py-4 font-semibold">سمت سازمانی</th><th className="px-4 py-4 font-semibold">سطح</th><th className="px-4 py-4 font-semibold">نوع مسئولیت</th><th className="px-4 py-4 font-semibold">وضعیت</th><th className="px-5 py-4 text-left font-semibold">عملیات</th></tr></thead><tbody>
          {filtered.map(item => <tr key={item.id} className="border-t border-[var(--border)] transition hover:bg-black/[0.025] dark:hover:bg-white/[0.035]"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]"><BriefcaseBusiness size={19} /></div><div className="min-w-0"><div className="font-bold">{item.title}</div><div className="mt-1 text-xs text-[var(--muted)]"><span dir="ltr" className="inline-block font-mono">{item.code}</span>{item.description ? <span className="mr-2 inline-block max-w-64 truncate align-bottom">· {item.description}</span> : null}</div></div></div></td><td className="px-4 py-4 font-semibold tabular-nums">{fa(item.level)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${item.isManagerial ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "bg-slate-500/10 text-[var(--muted)]"}`}>{item.isManagerial ? "مدیریتی" : "غیرمدیریتی"}</span></td><td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold ${item.isActive ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400" : "bg-slate-500/10 text-[var(--muted)]"}`}>{item.isActive ? <CheckCircle2 size={13} /> : <CircleOff size={13} />}{item.isActive ? "فعال" : "غیرفعال"}</span></td><td className="px-5 py-4 text-left"><button type="button" onClick={() => { setEdit(item); setOpen(true); }} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold transition hover:border-[var(--primary)] hover:text-[var(--primary)]"><Pencil size={14} />ویرایش</button></td></tr>)}
          {!filtered.length && <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-[var(--muted)]">{loading ? "در حال دریافت سمت‌های سازمانی..." : rows.length ? "سمتی با این مشخصات پیدا نشد." : "هنوز سمتی تعریف نشده است."}</td></tr>}
        </tbody></table></div>
        <div className="border-t border-[var(--border)] px-5 py-3 text-xs text-[var(--muted)]">{fa(filtered.length)} مورد نمایش داده می‌شود</div>
      </div>
      {open && <PositionForm item={edit} close={() => setOpen(false)} saved={() => void load()} />}
    </section>
  );
}
