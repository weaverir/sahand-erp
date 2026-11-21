"use client";

import { useMemo } from "react";

type JalaliParts = { year: number; month: number; day: number };
const formatter = new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
  timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric",
});
const monthNames = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور", "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];
const numberFa = new Intl.NumberFormat("fa-IR", { useGrouping: false });

function parseJalali(iso: string): JalaliParts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const date = new Date(`${iso}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return null;
  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

function toGregorian(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  // Search Gregorian dates around Nowruz. Intl is the calendar authority,
  // including leap-year behavior; no external date library is required.
  const start = Date.UTC(year + 621, 2, 18);
  for (let offset = 0; offset < 370; offset++) {
    const date = new Date(start + offset * 86400000);
    const iso = date.toISOString().slice(0, 10);
    const p = parseJalali(iso);
    if (p?.year === year && p.month === month && p.day === day) return iso;
  }
  return null;
}

export function JalaliDateField({ value, onChange, disabled, className = "" }: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const current = useMemo(() => parseJalali(value), [value]);
  const fallbackYear = parseJalali(new Date().toISOString().slice(0, 10))?.year ?? 1405;
  const year = current?.year ?? fallbackYear;
  const month = current?.month ?? 1;
  const day = current?.day ?? 1;
  const years = Array.from({ length: 21 }, (_, i) => year - 10 + i);
  function update(y: number, m: number, d: number) {
    // Clamp to the last valid day when switching months/years.
    for (let candidate = d; candidate >= 1; candidate--) {
      const iso = toGregorian(y, m, candidate);
      if (iso) { onChange(iso); return; }
    }
  }
  return (
    <div className="grid grid-cols-[1fr_1.3fr_0.9fr] gap-2" dir="rtl">
      <select aria-label="سال شمسی" disabled={disabled} className={className} value={year}
        onChange={e => update(Number(e.target.value), month, day)}>
        {years.map(y => <option key={y} value={y}>{numberFa.format(y)}</option>)}
      </select>
      <select aria-label="ماه شمسی" disabled={disabled} className={className} value={month}
        onChange={e => update(year, Number(e.target.value), day)}>
        {monthNames.map((name, i) => <option key={name} value={i + 1}>{name}</option>)}
      </select>
      <select aria-label="روز شمسی" disabled={disabled} className={className} value={day}
        onChange={e => update(year, month, Number(e.target.value))}>
        {Array.from({ length: 31 }, (_, i) => i + 1).filter(d => Boolean(toGregorian(year, month, d))).map(d =>
          <option key={d} value={d}>{numberFa.format(d)}</option>)}
      </select>
    </div>
  );
}
