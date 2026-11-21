"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowRightLeft,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronsDown,
  ChevronsUp,
  FolderTree,
  Pencil,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import type { Unit } from "./types";

type Props = {
  units: Unit[];
  selected?: string;
  onSelect: (u: Unit) => void;
  onEdit: (u: Unit) => void;
  onMove: (u: Unit) => void;
  onAdd: (u: Unit) => void;
};

function sortedChildren(unit: Unit): Unit[] {
  return [...(unit.children ?? [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
  );
}

function collectIds(units: Unit[]): Set<string> {
  const ids = new Set<string>();
  const visit = (unit: Unit) => {
    if (ids.has(unit.id)) return;
    ids.add(unit.id);
    sortedChildren(unit).forEach(visit);
  };
  units.forEach(visit);
  return ids;
}

function matchesQuery(unit: Unit, query: string): boolean {
  return `${unit.name} ${unit.code ?? ""}`.toLocaleLowerCase("fa-IR").includes(query);
}

export default function OrganizationTree({
  units,
  selected,
  onSelect,
  onEdit,
  onMove,
  onAdd,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => collectIds(units));
  const [query, setQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  const roots = useMemo(() => {
    const allIds = collectIds(units);
    return [...units]
      .filter((unit) => !unit.parentId || !allIds.has(unit.parentId))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [units]);

  const allIds = useMemo(() => collectIds(roots), [roots]);

  const knownIds = useRef(new Set(allIds));

  useEffect(() => {
    setExpanded((current) => {
      const next = new Set(current);
      // Newly created units should be visible without resetting existing collapsed branches.
      for (const id of allIds) {
        if (!next.has(id) && !knownIds.current.has(id)) next.add(id);
      }
      knownIds.current = new Set(allIds);
      return next;
    });
  }, [allIds]);

  const normalizedQuery = query.trim().toLocaleLowerCase("fa-IR");
  const matchingIds = useMemo(() => {
    const result = new Set<string>();
    const visit = (unit: Unit, ancestors: string[]) => {
      if (matchesQuery(unit, normalizedQuery)) {
        result.add(unit.id);
        ancestors.forEach((id) => result.add(id));
      }
      sortedChildren(unit).forEach((child) => visit(child, [...ancestors, unit.id]));
    };
    if (normalizedQuery) roots.forEach((root) => visit(root, []));
    return result;
  }, [roots, normalizedQuery]);

  const totalUnits = allIds.size;
  const activeUnits = useMemo(() => {
    let count = 0;
    const seen = new Set<string>();
    const visit = (unit: Unit) => {
      if (seen.has(unit.id)) return;
      seen.add(unit.id);
      if (unit.status === "ACTIVE") count += 1;
      sortedChildren(unit).forEach(visit);
    };
    roots.forEach(visit);
    return count;
  }, [roots]);

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(unit: Unit, depth: number, ancestors: Set<string>): ReactNode {
    if (ancestors.has(unit.id)) return null;
    if (!showInactive && unit.status !== "ACTIVE") return null;
    if (normalizedQuery && !matchingIds.has(unit.id)) return null;

    const children = sortedChildren(unit).filter(
      (child) =>
        (showInactive || child.status === "ACTIVE") &&
        (!normalizedQuery || matchingIds.has(child.id))
    );
    const open = normalizedQuery ? true : expanded.has(unit.id);
    const isSelected = selected === unit.id;
    const directAssignments = unit.assignments?.length ?? 0;
    const nextAncestors = new Set(ancestors);
    nextAncestors.add(unit.id);

    return (
      <li key={unit.id} className="relative min-w-0 list-none">
        <div className="group relative flex min-w-0 items-start gap-2 sm:gap-3">
          {depth > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-4 top-7 h-px w-4 bg-[var(--border)] sm:-right-6 sm:w-6"
            />
          )}
          <article
            className={`min-w-0 flex-1 overflow-hidden rounded-2xl border bg-[var(--surface)] shadow-sm transition-all duration-200 hover:shadow-md ${
              isSelected
                ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/20"
                : "border-[var(--border)] hover:border-[var(--primary)]/40"
            }`}
          >
            <div className="flex min-w-0 items-center gap-2 p-3 sm:gap-3 sm:p-4">
              {children.length > 0 ? (
                <button
                  type="button"
                  aria-label={open ? `بستن زیرواحدهای ${unit.name}` : `نمایش زیرواحدهای ${unit.name}`}
                  aria-expanded={open}
                  onClick={() => toggle(unit.id)}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted)] transition hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]"
                >
                  {open ? <ChevronDown size={17} /> : <ChevronLeft size={17} />}
                </button>
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)]/10 text-[var(--primary)]">
                  <Building2 size={16} />
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelect(unit)}
                aria-pressed={isSelected}
                className="flex min-w-0 flex-1 items-center gap-3 text-right"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-[var(--foreground)] sm:text-base">
                    {unit.name}
                  </span>
                  <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                    {unit.code ? `کد واحد: ${unit.code}` : "بدون کد"}
                  </span>
                </span>
              </button>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold sm:text-xs ${
                  unit.status === "ACTIVE"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-500/10 text-[var(--muted)]"
                }`}
              >
                {unit.status === "ACTIVE" ? "فعال" : "غیرفعال"}
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] px-3 py-2 sm:px-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                <span className="inline-flex items-center gap-1">
                  <Users size={13} />
                  {directAssignments.toLocaleString("fa-IR")} انتصاب
                </span>
                <span>{children.length.toLocaleString("fa-IR")} زیرواحد</span>
                <span>سطح {(depth + 1).toLocaleString("fa-IR")}</span>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" title="افزودن زیرواحد" aria-label={`افزودن زیرواحد به ${unit.name}`} onClick={() => onAdd(unit)} className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]">
                  <Plus size={16} />
                </button>
                <button type="button" title="ویرایش واحد" aria-label={`ویرایش ${unit.name}`} onClick={() => onEdit(unit)} className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]">
                  <Pencil size={15} />
                </button>
                <button type="button" title="جابجایی واحد" aria-label={`جابجایی ${unit.name}`} onClick={() => onMove(unit)} className="rounded-lg p-2 text-[var(--muted)] transition hover:bg-[var(--primary)]/10 hover:text-[var(--primary)]">
                  <ArrowRightLeft size={15} />
                </button>
              </div>
            </div>
          </article>
        </div>
        {children.length > 0 && open && (
          <ul className="relative mr-4 mt-3 grid min-w-0 gap-3 border-r-2 border-[var(--border)] pr-4 sm:mr-6 sm:pr-6">
            {children.map((child) => renderNode(child, depth + 1, nextAncestors))}
          </ul>
        )}
      </li>
    );
  }

  return (
    <section dir="rtl" className="min-w-0 overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <header className="border-b border-[var(--border)] bg-gradient-to-l from-[var(--primary)]/10 via-[var(--surface)] to-[var(--surface)] p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)]/10 text-[var(--primary)]">
              <FolderTree size={23} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold">ساختار سازمانی</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                واحدها و زیرواحدها را در هر تعداد سطح مشاهده و مدیریت کنید.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
              {totalUnits.toLocaleString("fa-IR")} واحد
            </span>
            <span className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
              {activeUnits.toLocaleString("fa-IR")} فعال
            </span>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 focus-within:border-[var(--primary)] sm:max-w-sm">
            <Search size={17} className="shrink-0 text-[var(--muted)]" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="جست‌وجوی نام یا کد واحد..."
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
            />
            {query && (
              <button type="button" onClick={() => setQuery("")} aria-label="پاک کردن جست‌وجو" className="text-[var(--muted)]">
                <X size={16} />
              </button>
            )}
          </label>
          <button type="button" onClick={() => setExpanded(new Set(allIds))} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs font-semibold transition hover:bg-[var(--primary)]/10">
            <ChevronsDown size={16} /> باز کردن همه
          </button>
          <button type="button" onClick={() => setExpanded(new Set())} className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs font-semibold transition hover:bg-[var(--primary)]/10">
            <ChevronsUp size={16} /> بستن همه
          </button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs">
            <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="accent-[var(--primary)]" />
            نمایش غیرفعال‌ها
          </label>
        </div>
      </header>
      <div className="p-3 sm:p-6">
        {roots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
            هنوز واحدی برای نمایش ثبت نشده است.
          </div>
        ) : normalizedQuery && matchingIds.size === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--border)] p-10 text-center text-sm text-[var(--muted)]">
            واحدی با این نام یا کد پیدا نشد.
          </div>
        ) : (
          <ul className="grid min-w-0 gap-4">
            {roots.map((root) => renderNode(root, 0, new Set<string>()))}
          </ul>
        )}
      </div>
    </section>
  );
}
