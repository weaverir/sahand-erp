"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

const MONTHS = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];
const DAY_MS = 86_400_000;
const baseButton = "rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--primary)]/10 disabled:cursor-not-allowed disabled:opacity-35";
const panel = "rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-2xl";

const persianFormatter = new Intl.DateTimeFormat("en-US-u-ca-persian", {
  year: "numeric", month: "numeric", day: "numeric", timeZone: "UTC",
});

function persianParts(date: Date) {
  const parts = persianFormatter.formatToParts(date);
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: read("year"), month: read("month"), day: read("day") };
}

function isoFromUtc(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function getTehranTodayIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Tehran",
  }).formatToParts(new Date());
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return `${read("year")}-${read("month")}-${read("day")}`;
}

/** Converts a Gregorian calendar date and Tehran wall-clock time to an ISO timestamp. */
export function tehranDateTimeToIso(date: string, time: string, endOfDay = false) {
  if (!date) return null;
  const safeTime = time || (endOfDay ? "23:59:59" : "00:00:00");
  return new Date(`${date}T${safeTime.length === 5 ? `${safeTime}:00` : safeTime}+03:30`).toISOString();
}

function monthStart(year: number, month: number): Date | null {
  const scanStart = Date.UTC(year + 620, 2, 1);
  for (let offset = 0; offset < 750; offset += 1) {
    const candidate = new Date(scanStart + offset * DAY_MS);
    const parts = persianParts(candidate);
    if (parts.year === year && parts.month === month && parts.day === 1) return candidate;
  }
  return null;
}

function normalizeIso(value: string) {
  if (!value) return "";
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? "";
}

export function formatJalaliDate(value?: string | null, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric", month: "long", day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    timeZone: "Asia/Tehran",
  }).format(date);
}

type DatePickerProps = {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  disabled?: boolean;
  placeholder?: string;
};

export function JalaliDatePicker({ value, onChange, min, disabled, placeholder = "انتخاب تاریخ شمسی" }: DatePickerProps) {
  const normalized = normalizeIso(value);
  const selectedParts = normalized ? persianParts(new Date(`${normalized}T00:00:00Z`)) : null;
  const initialParts = persianParts(new Date(`${normalized || getTehranTodayIso()}T00:00:00Z`));
  const [view, setView] = useState({ year: initialParts.year, month: initialParts.month });
  const [open, setOpen] = useState(false);
  const start = useMemo(() => monthStart(view.year, view.month), [view.year, view.month]);
  const next = view.month === 12 ? { year: view.year + 1, month: 1 } : { year: view.year, month: view.month + 1 };
  const end = useMemo(() => monthStart(next.year, next.month), [next.year, next.month]);
  const length = start && end ? Math.round((end.getTime() - start.getTime()) / DAY_MS) : 0;
  const offset = start ? (start.getUTCDay() + 1) % 7 : 0;

  function shiftMonth(delta: number) {
    setView((current) => {
      const total = current.year * 12 + current.month - 1 + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 + 1 };
    });
  }

  function choose(iso: string) {
    if (min && iso < min) return;
    onChange(iso);
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      <button type="button" disabled={disabled} aria-expanded={open} onClick={() => setOpen((old) => !old)} className="flex w-full items-center justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-right text-sm transition hover:border-[var(--primary)]/50 disabled:opacity-50">
        <span className={normalized ? "text-[var(--foreground)]" : "text-[var(--muted)]"}>
          {selectedParts ? `${selectedParts.day.toLocaleString("fa-IR")} ${MONTHS[selectedParts.month - 1]} ${selectedParts.year.toLocaleString("fa-IR")}` : placeholder}
        </span>
        <CalendarDays size={17} className="shrink-0 text-[var(--primary)]" />
      </button>
      {open && <div className={`${panel} absolute right-0 top-full z-[130] mt-2 w-[min(330px,calc(100vw-2.5rem))]`}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="ماه قبل" className={baseButton} onClick={() => shiftMonth(-1)}><ChevronRight size={16}/></button>
          <strong className="text-sm">{MONTHS[view.month - 1]} {view.year.toLocaleString("fa-IR")}</strong>
          <button type="button" aria-label="ماه بعد" className={baseButton} onClick={() => shiftMonth(1)}><ChevronLeft size={16}/></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((day) => <span key={day} className="py-2 text-xs text-[var(--muted)]">{day}</span>)}
          {Array.from({ length: offset }, (_, index) => <span key={`empty-${index}`} />)}
          {Array.from({ length }, (_, index) => {
            const dayDate = new Date((start?.getTime() ?? 0) + index * DAY_MS);
            const iso = isoFromUtc(dayDate);
            const isSelected = iso === normalized;
            const isDisabled = Boolean(min && iso < min);
            return <button key={iso} type="button" disabled={isDisabled} aria-pressed={isSelected} onClick={() => choose(iso)} className={`aspect-square rounded-lg text-sm transition ${isSelected ? "bg-[var(--primary)] font-bold text-white" : "hover:bg-[var(--primary)]/10"} disabled:opacity-25`}>{(index + 1).toLocaleString("fa-IR")}</button>;
          })}
        </div>
        <div className="mt-3 flex justify-between border-t border-[var(--border)] pt-3">
          <button type="button" className={baseButton} onClick={() => { const today = getTehranTodayIso(); if (!min || today >= min) choose(today); const p = persianParts(new Date(`${today}T00:00:00Z`)); setView({ year: p.year, month: p.month }); }}>امروز</button>
          <button type="button" className={baseButton} onClick={() => setOpen(false)}>بستن</button>
        </div>
      </div>}
    </div>
  );
}

type DateTimePickerProps = {
  date: string;
  time: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

export function JalaliDateTimePicker({ date, time, onDateChange, onTimeChange }: DateTimePickerProps) {
  return <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_130px]">
    <JalaliDatePicker value={date} onChange={onDateChange} placeholder="انتخاب تاریخ انقضا" />
    <label className="block space-y-1.5"><span className="flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)]"><Clock3 size={14}/> ساعت</span><input type="time" dir="ltr" value={time} onChange={(event) => onTimeChange(event.target.value)} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]" /></label>
  </div>;
}
