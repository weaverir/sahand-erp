"use client";

import { useMemo, useState } from "react";
import { ArrowLeftRight, Building2, Check, ChevronLeft, LoaderCircle, Move, X } from "lucide-react";
import type { Unit } from "./types";
import { api, req } from "./api";
import { Modal, ErrorBox } from "./ui";

function descendants(unit: Unit): Set<string> {
  const ids = new Set<string>();
  const walk = (current: Unit) => {
    for (const child of current.children || []) {
      if (!ids.has(child.id)) {
        ids.add(child.id);
        walk(child);
      }
    }
  };
  walk(unit);
  return ids;
}

export default function MoveUnitDialog({
  unit,
  units,
  close,
  saved,
}: {
  unit: Unit;
  units: Unit[];
  close: () => void;
  saved: () => void;
}) {
  const [parent, setParent] = useState(unit.parentId || "");
  const [order, setOrder] = useState(String(unit.sortOrder ?? 0));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const blocked = useMemo(() => descendants(unit), [unit]);
  const eligibleUnits = useMemo(
    () => units.filter((candidate) => candidate.id !== unit.id && !blocked.has(candidate.id) && candidate.status === "ACTIVE"),
    [units, unit.id, blocked],
  );
  const currentParent = units.find((candidate) => candidate.id === unit.parentId);
  const nextParent = units.find((candidate) => candidate.id === parent);
  const parsedOrder = Number(order);
  const validOrder = order.trim() !== "" && Number.isSafeInteger(parsedOrder) && parsedOrder >= 0;
  const changed = parent !== (unit.parentId || "") || (validOrder && parsedOrder !== (unit.sortOrder ?? 0));

  async function move() {
    if (busy) return;
    if (!validOrder || parent === unit.id || blocked.has(parent) || (parent && !eligibleUnits.some((candidate) => candidate.id === parent))) {
      setError("واحد بالادستی یا ترتیب نمایش معتبر نیست.");
      return;
    }
    if (!changed) {
      setError("هنوز تغییری برای ثبت انتخاب نشده است.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/organization/units/${encodeURIComponent(unit.id)}/move`, req("PATCH", { parentId: parent || null, sortOrder: parsedOrder }));
      saved();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : "انتقال واحد سازمانی انجام نشد.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="تغییر جایگاه واحد سازمانی" close={busy ? () => undefined : close}>
      <div dir="rtl" className="space-y-5 text-[var(--foreground)]">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-700 via-blue-700 to-sky-700 p-5 text-white shadow-lg shadow-indigo-950/10">
          <div className="absolute -left-8 -top-10 size-36 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/15"><Move size={23} /></div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-blue-100">جابجایی در ساختار سازمان</p>
              <h3 className="mt-1 break-words text-xl font-extrabold">{unit.name}</h3>
              <p className="mt-2 text-sm leading-6 text-blue-100">واحد موردنظر را زیرمجموعه بخش دیگری قرار دهید یا به سطح اصلی سازمان منتقل کنید.</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-stretch">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <p className="mb-2 text-xs text-[var(--muted)]">جایگاه فعلی</p>
            <div className="flex items-center gap-2 font-semibold"><Building2 size={17} className="shrink-0 text-slate-500" /><span className="break-words">{currentParent?.name || "سطح اصلی سازمان"}</span></div>
          </div>
          <div className="flex items-center justify-center text-[var(--muted)]"><ChevronLeft size={20} className="rotate-[-90deg] sm:rotate-0" /></div>
          <div className="rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] p-4">
            <p className="mb-2 text-xs text-[var(--muted)]">جایگاه جدید</p>
            <div className="flex items-center gap-2 font-semibold"><Building2 size={17} className="shrink-0 text-blue-600" /><span className="break-words">{nextParent?.name || "سطح اصلی سازمان"}</span></div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
            <ArrowLeftRight size={18} className="text-blue-600" />
            <h4 className="font-bold">تنظیم جایگاه جدید</h4>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">واحد بالادستی جدید</span>
            <select value={parent} disabled={busy} onChange={(event) => { setParent(event.target.value); setError(""); }} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50">
              <option value="">سطح اصلی سازمان (بدون واحد بالادستی)</option>
              {eligibleUnits.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}
            </select>
            <span className="block text-xs leading-5 text-[var(--muted)]">برای جلوگیری از ایجاد چرخه، خود این واحد و زیرمجموعه‌های آن در فهرست نمایش داده نمی‌شوند.</span>
          </label>
          <label className="block space-y-2">
            <span className="text-sm font-semibold">ترتیب نمایش در واحد بالادستی</span>
            <input type="number" min="0" step="1" inputMode="numeric" value={order} disabled={busy} onChange={(event) => { setOrder(event.target.value); setError(""); }} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 disabled:opacity-50" />
            <span className="block text-xs text-[var(--muted)]">عدد کوچک‌تر یعنی نمایش زودتر در فهرست واحدهای هم‌سطح.</span>
          </label>
        </div>

        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] p-3 text-xs leading-6 text-[var(--foreground)]">
          <Check size={16} className="mt-1 shrink-0 text-amber-600" />
          <p>این عملیات جایگاه واحد را تغییر می‌دهد؛ خود واحد و اطلاعات آن حذف نمی‌شوند.</p>
        </div>
        {error && <ErrorBox>{error}</ErrorBox>}
        <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-4 sm:flex-row sm:justify-end">
          <button type="button" disabled={busy} onClick={close} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] px-5 py-3 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"><X size={16} />انصراف</button>
          <button type="button" disabled={busy || !changed || !validOrder} onClick={() => void move()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}{busy ? "در حال ثبت تغییر..." : "ثبت جایگاه جدید"}</button>
        </div>
      </div>
    </Modal>
  );
}
