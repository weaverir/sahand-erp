"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronLeft, Building2, Pencil, ArrowRightLeft, Plus, Users } from "lucide-react";
import type { Unit } from "./types";

type Props = {
  units: Unit[];
  selected?: string;
  onSelect: (u: Unit) => void;
  onEdit: (u: Unit) => void;
  onMove: (u: Unit) => void;
  onAdd: (u: Unit) => void;
};

export default function OrganizationTree({ units, selected, onSelect, onEdit, onMove, onAdd }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(units.map(x => x.id)));
  const roots = useMemo(() => units.filter(x => !x.parentId).sort((a,b) => a.sortOrder-b.sortOrder), [units]);

  function toggle(id: string) {
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(unit: Unit, depth = 0): React.ReactNode {
    const children = (unit.children || []).slice().sort((a,b) => a.sortOrder-b.sortOrder);
    const isOpen = expanded.has(unit.id);
    const isSelected = selected === unit.id;
    const count = unit.assignments?.length ?? 0;

    return (
      <li key={unit.id} className="org-tree-node flex flex-col items-center">
        <article
          className={`relative z-10 w-[245px] max-w-[80vw] rounded-2xl border bg-[var(--surface)] p-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
            isSelected ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20" : "border-[var(--border)]"
          }`}
        >
          <button className="block w-full text-right" onClick={() => onSelect(unit)} aria-pressed={isSelected}>
            <span className="flex items-center gap-2">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)]/10 text-[var(--primary)]">
                <Building2 size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{unit.name}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-[var(--muted)]">{unit.code}</span>
              </span>
              <span className={`rounded-full px-2 py-1 text-[10px] ${unit.status === "ACTIVE" ? "bg-emerald-500/10 text-emerald-600" : "bg-slate-500/10 text-slate-500"}`}>
                {unit.status === "ACTIVE" ? "فعال" : "غیرفعال"}
              </span>
            </span>
            <span className="mt-3 flex items-center justify-between border-t border-[var(--border)] pt-2 text-[11px] text-[var(--muted)]">
              <span className="flex items-center gap-1"><Users size={12}/>{count} انتصاب</span>
              <span>{children.length} زیرواحد</span>
            </span>
          </button>
          <div className="mt-2 flex items-center justify-end gap-1 border-t border-[var(--border)] pt-2">
            <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/5" title="افزودن زیرواحد" onClick={() => onAdd(unit)}><Plus size={15}/></button>
            <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/5" title="ویرایش واحد" onClick={() => onEdit(unit)}><Pencil size={14}/></button>
            <button className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-black/5" title="انتقال واحد" onClick={() => onMove(unit)}><ArrowRightLeft size={14}/></button>
            {children.length > 0 && (
              <button className="mr-auto flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-[var(--primary)] hover:bg-[var(--primary)]/10" onClick={() => toggle(unit.id)}>
                {isOpen ? <ChevronDown size={14}/> : <ChevronLeft size={14}/>}
                {isOpen ? "بستن" : "نمایش"}
              </button>
            )}
          </div>
        </article>

        {children.length > 0 && isOpen && (
          <div className="relative flex flex-col items-center pt-8">
            <span className="absolute top-0 h-8 w-px bg-[var(--border)]" />
            <ul className="org-tree-children relative flex items-start justify-center gap-5 border-t border-[var(--border)] px-3">
              {children.map(child => (
                <li key={child.id} className="relative flex flex-col items-center pt-7">
                  <span className="absolute top-0 h-7 w-px bg-[var(--border)]" />
                  {renderNode(child, depth + 1)}
                </li>
              ))}
            </ul>
          </div>
        )}
      </li>
    );
  }

  if (roots.length === 0) {
    return <div className="rounded-2xl border border-dashed border-[var(--border)] p-12 text-center text-sm text-[var(--muted)]">هنوز واحدی برای نمایش در ساختار سازمان ثبت نشده است.</div>;
  }

  return (
    <section className="w-full overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">درخت سلسله‌مراتب واحدهای سازمان</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">برای مشاهده جزئیات روی کارت کلیک کنید؛ با دکمه نمایش، زیرواحدها باز و بسته می‌شوند.</p>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs" onClick={() => setExpanded(new Set(units.map(x => x.id)))}>باز کردن همه</button>
          <button className="rounded-lg border border-[var(--border)] px-3 py-2 text-xs" onClick={() => setExpanded(new Set())}>بستن همه</button>
        </div>
      </div>
      <ul className="flex min-w-max items-start justify-center gap-12 pb-5">
        {roots.map(root => renderNode(root))}
      </ul>
    </section>
  );
}
