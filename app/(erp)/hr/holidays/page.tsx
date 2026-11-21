
"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  AlertCircle,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  FilePenLine,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Settings2,
  Sun,
} from "lucide-react";

import {
  prepareHolidayDay,
  upsertHolidayDay,
  type HolidayEditorDay,
} from "@/modules/attendance/holiday-editor-policy";

type Calendar = {
  id: string;
  jalaliYear: number;
  name: string;
  isActive: boolean;
  days: HolidayEditorDay[];
};

type Draft = {
  name: string;
  isActive: boolean;
  days: HolidayEditorDay[];
};

const kinds: HolidayEditorDay["holidayType"][] = [
  "OFFICIAL",
  "NATIONAL",
  "RELIGIOUS",
  "COMPANY",
  "OTHER",
];

const labels: Record<HolidayEditorDay["holidayType"], string> = {
  OFFICIAL: "رسمی",
  NATIONAL: "ملی",
  RELIGIOUS: "مذهبی",
  COMPANY: "شرکتی",
  OTHER: "سایر",
};

const emptyDay = (): Omit<HolidayEditorDay, "date"> => ({
  jalaliDate: "",
  title: "",
  holidayType: "COMPANY",
  isHoliday: true,
  isWorkingDayOverride: null,
});

const emptyDraft = (): Draft => ({
  name: "",
  isActive: true,
  days: [],
});

const glass =
  "relative overflow-hidden rounded-[24px] border border-white/[0.12] " +
  "bg-gradient-to-br from-white/[0.12] via-white/[0.055] to-white/[0.025] " +
  "shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] " +
  "backdrop-blur-2xl";

const glassInner =
  "rounded-2xl border border-white/[0.08] " +
  "bg-gradient-to-br from-white/[0.075] to-white/[0.025] " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]";

const inputClass =
  "w-full min-w-0 rounded-xl border border-white/[0.12] " +
  "bg-[#07132b]/75 px-4 py-3 text-sm text-white " +
  "outline-none transition-all duration-200 " +
  "placeholder:text-slate-500 " +
  "focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-white/[0.12] bg-white/[0.06] " +
  "px-4 py-2.5 text-sm font-medium text-slate-200 " +
  "transition-all hover:border-sky-300/30 hover:bg-white/[0.1] " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-sky-300/25 " +
  "bg-gradient-to-r from-blue-600/90 to-sky-500/90 " +
  "px-5 py-2.5 text-sm font-semibold text-white " +
  "shadow-[0_6px_22px_rgba(37,99,235,0.22),inset_0_1px_0_rgba(255,255,255,0.2)] " +
  "transition-all hover:from-blue-500 hover:to-sky-400 " +
  "disabled:cursor-not-allowed disabled:opacity-40";

const fmt = new Intl.NumberFormat("fa-IR");

function GlassShine() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
    >
      <div className="absolute -left-24 -top-32 h-64 w-64 rounded-full bg-sky-400/[0.07] blur-3xl" />
      <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
    </div>
  );
}

function DayTypeBadge({
  kind,
}: {
  kind: HolidayEditorDay["holidayType"];
}) {
  const styles: Record<HolidayEditorDay["holidayType"], string> = {
    OFFICIAL:
      "border-sky-400/20 bg-sky-400/10 text-sky-300",
    NATIONAL:
      "border-violet-400/20 bg-violet-400/10 text-violet-300",
    RELIGIOUS:
      "border-amber-400/20 bg-amber-400/10 text-amber-300",
    COMPANY:
      "border-cyan-400/20 bg-cyan-400/10 text-cyan-300",
    OTHER:
      "border-slate-400/20 bg-slate-400/10 text-slate-300",
  };

  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs ${styles[kind]}`}
    >
      {labels[kind]}
    </span>
  );
}

export default function HolidaysPage() {
  const [year, setYear] = useState(() =>
    String(
      Number(
        new Intl.DateTimeFormat("en-US-u-ca-persian-nu-latn", {
          year: "numeric",
          timeZone: "Asia/Tehran",
        }).format(new Date())
      )
    )
  );

  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedId, setSelectedId] = useState("new");
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [day, setDay] = useState(emptyDay);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(
      `/api/attendance/holidays?year=${encodeURIComponent(year)}`,
      {
        cache: "no-store",
        credentials: "same-origin",
      }
    );

    const result = await response.json();

    if (!response.ok) {
      throw new Error(
        result.error ?? "خطا در دریافت تقویم‌ها"
      );
    }

    setCalendars((result.data ?? result).calendars ?? []);
  }, [year]);

  useEffect(() => {
    if (!/^\d{4}$/.test(year)) return;

    let active = true;

    async function fetchCalendars() {
      setLoading(true);
      setError("");

      try {
        await load();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "خطا در دریافت تقویم‌ها"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void fetchCalendars();

    return () => {
      active = false;
    };
  }, [load, year]);

  const stats = useMemo(() => {
    return {
      calendars: calendars.length,
      active: calendars.filter((calendar) => calendar.isActive)
        .length,
      days: draft.days.length,
      holidays: draft.days.filter((item) => item.isHoliday)
        .length,
    };
  }, [calendars, draft.days]);

  function select(id: string) {
    setSelectedId(id);
    setDay(emptyDay());
    setError("");
    setMessage("");

    const calendar = calendars.find(
      (item) => item.id === id
    );

    setDraft(
      calendar
        ? {
            name: calendar.name,
            isActive: calendar.isActive,
            days: calendar.days.map((item) => ({
              date: item.date.slice(0, 10),
              jalaliDate: item.jalaliDate,
              title: item.title,
              holidayType: item.holidayType,
              isHoliday: item.isHoliday,
              isWorkingDayOverride: item.isWorkingDayOverride,
            })),
          }
        : emptyDraft()
    );
  }

  function addDay() {
    try {
      setDraft((previous) => ({
        ...previous,
        days: upsertHolidayDay(
          previous.days,
          prepareHolidayDay(day, Number(year))
        ),
      }));

      setDay(emptyDay());
      setError("");
      setMessage("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "اطلاعات روز نامعتبر است."
      );
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    setError("");
    setMessage("");

    if (!draft.name.trim()) {
      setError("نام تقویم الزامی است.");
      return;
    }

    if (selectedId === "new" && !draft.days.length) {
      setError(
        "برای تقویم جدید حداقل یک روز ثبت کنید."
      );
      return;
    }

    setBusy(true);

    try {
      const isNew = selectedId === "new";

      const response = await fetch(
        isNew
          ? "/api/attendance/holidays"
          : `/api/attendance/holidays/${encodeURIComponent(selectedId)}`,
        {
          method: isNew ? "POST" : "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            isNew
              ? {
                  jalaliYear: Number(year),
                  ...draft,
                }
              : draft
          ),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ?? "ذخیره انجام نشد."
        );
      }

      setMessage("تغییرات با موفقیت ذخیره شد.");
      await load();

      if (isNew) {
        setSelectedId("new");
        setDraft(emptyDraft());
        setDay(emptyDay());
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطای ناشناخته"
      );
    } finally {
      setBusy(false);
    }
  }

  async function reload() {
    setLoading(true);
    setError("");

    try {
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در به‌روزرسانی اطلاعات"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative isolate min-h-full space-y-6 overflow-hidden p-4 text-slate-100 sm:p-6"
    >
      {/* Ambient lighting */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -right-40 top-0 h-[420px] w-[420px] rounded-full bg-blue-500/[0.07] blur-[110px]" />
        <div className="absolute -left-40 top-[450px] h-[450px] w-[450px] rounded-full bg-cyan-500/[0.05] blur-[120px]" />
      </div>

      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-400">
            <span>منابع انسانی</span>
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="text-sky-300">
              تعطیلات و روزهای کاری
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`${glassInner} flex h-12 w-12 items-center justify-center`}>
              <CalendarDays className="h-6 w-6 text-sky-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                مدیریت تعطیلات و روزهای کاری
              </h1>

              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                مدیریت تقویم‌های شمسی، مناسبت‌ها و استثناهای روز کاری
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={loading || busy}
          onClick={() => void reload()}
          className={buttonClass}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
          />
          به‌روزرسانی
        </button>
      </header>

      {/* Statistics */}
      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          {
            label: "تقویم‌های سال",
            value: stats.calendars,
            icon: CalendarDays,
          },
          {
            label: "تقویم‌های فعال",
            value: stats.active,
            icon: CheckCircle2,
          },
          {
            label: "روزهای تقویم انتخابی",
            value: stats.days,
            icon: CalendarCheck2,
          },
          {
            label: "تعطیلات تقویم انتخابی",
            value: stats.holidays,
            icon: Sun,
          },
        ].map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className={`${glass} p-4`}>
              <GlassShine />

              <div className="relative flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-400">
                    {stat.label}
                  </p>

                  <p className="mt-3 text-2xl font-bold">
                    {fmt.format(stat.value)}
                  </p>
                </div>

                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10">
                  <Icon className="h-5 w-5 text-sky-300" />
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Alerts */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {message && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
          <p className="text-sm text-emerald-200">
            {message}
          </p>
        </div>
      )}

      {/* Calendar selection */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <div className="relative mb-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Settings2 className="h-5 w-5 text-sky-300" />
            انتخاب تقویم
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            تقویم‌ها و مناسبت‌ها مستقیماً از دیتابیس خوانده می‌شوند.
          </p>
        </div>

        <div className="relative grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm text-slate-300">
            سال شمسی
            <input
              type="number"
              min="1300"
              max="1600"
              disabled={busy}
              value={year}
              onChange={(event) => {
                setYear(event.target.value);
                setSelectedId("new");
                setDraft(emptyDraft());
                setDay(emptyDay());
              }}
              className={inputClass}
            />
          </label>

          <label className="grid gap-2 text-sm text-slate-300">
            تقویم
            <select
              disabled={busy || loading}
              value={selectedId}
              onChange={(event) => select(event.target.value)}
              className={inputClass}
            >
              <option value="new">
                + ایجاد تقویم جدید
              </option>

              {calendars.map((calendar) => (
                <option
                  key={calendar.id}
                  value={calendar.id}
                >
                  {calendar.name} (
                  {calendar.isActive ? "فعال" : "غیرفعال"})
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading && (
          <div
            role="status"
            className="relative mt-4 flex items-center gap-2 text-xs text-slate-400"
          >
            <Loader2 className="h-4 w-4 animate-spin text-sky-300" />
            در حال دریافت تقویم‌ها...
          </div>
        )}
      </section>

      {/* Calendar editor */}
      <form
        onSubmit={(event) => void save(event)}
        className={`${glass} p-4 sm:p-5`}
      >
        <GlassShine />

        <div className="relative mb-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <FilePenLine className="h-5 w-5 text-sky-300" />
            {selectedId === "new"
              ? "ایجاد تقویم جدید"
              : "ویرایش تقویم"}
          </h2>

          <p className="mt-1 text-xs text-slate-400">
            مشخصات تقویم و روزهای ثبت‌شده را مدیریت کنید.
          </p>
        </div>

        <div className="relative space-y-5">
          {/* Calendar details */}
          <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label className="grid gap-2 text-sm text-slate-300">
              نام تقویم
              <input
                required
                maxLength={150}
                disabled={busy}
                value={draft.name}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    name: event.target.value,
                  }))
                }
                placeholder="مثلاً تقویم کاری شرکت"
                className={inputClass}
              />
            </label>

            <label
              className={`${glassInner} flex min-h-[48px] cursor-pointer items-center gap-3 px-4`}
            >
              <input
                type="checkbox"
                checked={draft.isActive}
                disabled={busy}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    isActive: event.target.checked,
                  }))
                }
                className="h-4 w-4 accent-sky-500"
              />

              <span className="text-sm text-slate-200">
                تقویم فعال باشد
              </span>
            </label>
          </div>

          {/* Day editor */}
          <section className={`${glassInner} space-y-4 p-4`}>
            <div>
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Plus className="h-4 w-4 text-sky-300" />
                افزودن یا اصلاح روز
              </h3>

              <p className="mt-2 text-xs text-slate-400">
                برای ویرایش یک روز موجود، آن را از فهرست پایین انتخاب کنید.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-300">
                تاریخ شمسی
                <input
                  disabled={busy}
                  value={day.jalaliDate}
                  onChange={(event) =>
                    setDay((previous) => ({
                      ...previous,
                      jalaliDate: event.target.value,
                    }))
                  }
                  placeholder={`${year}/09/01`}
                  className={inputClass}
                  dir="ltr"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                عنوان مناسبت
                <input
                  disabled={busy}
                  maxLength={200}
                  value={day.title}
                  onChange={(event) =>
                    setDay((previous) => ({
                      ...previous,
                      title: event.target.value,
                    }))
                  }
                  placeholder="عنوان روز یا مناسبت"
                  className={inputClass}
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                نوع مناسبت
                <select
                  disabled={busy}
                  value={day.holidayType}
                  onChange={(event) =>
                    setDay((previous) => ({
                      ...previous,
                      holidayType: event.target.value as HolidayEditorDay["holidayType"],
                    }))
                  }
                  className={inputClass}
                >
                  {kinds.map((kind) => (
                    <option key={kind} value={kind}>
                      {labels[kind]}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                وضعیت روز
                <select
                  disabled={busy}
                  value={day.isHoliday ? "holiday" : "normal"}
                  onChange={(event) =>
                    setDay((previous) => ({
                      ...previous,
                      isHoliday: event.target.value === "holiday",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="holiday">تعطیل</option>
                  <option value="normal">غیرتعطیل</option>
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-300">
                استثنای روز کاری
                <select
                  disabled={busy}
                  value={
                    day.isWorkingDayOverride === null
                      ? "none"
                      : String(day.isWorkingDayOverride)
                  }
                  onChange={(event) =>
                    setDay((previous) => ({
                      ...previous,
                      isWorkingDayOverride:
                        event.target.value === "none"
                          ? null
                          : event.target.value === "true",
                    }))
                  }
                  className={inputClass}
                >
                  <option value="none">بدون استثنا</option>
                  <option value="true">حتماً روز کاری</option>
                  <option value="false">حتماً غیرکاری</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setDay(emptyDay())}
                className={buttonClass}
              >
                پاک‌کردن فرم روز
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={addDay}
                className={primaryButton}
              >
                <Plus className="h-4 w-4" />
                افزودن / به‌روزرسانی روز
              </button>
            </div>
          </section>

          {/* Days list */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <CalendarCheck2 className="h-4 w-4 text-sky-300" />
                روزهای ثبت‌شده
              </h3>

              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300">
                {fmt.format(draft.days.length)} روز
              </span>
            </div>

            {draft.days.length === 0 ? (
              <div className={`${glassInner} flex min-h-32 flex-col items-center justify-center gap-2 p-5 text-center`}>
                <CalendarDays className="h-7 w-7 text-slate-500" />
                <p className="text-sm text-slate-400">
                  هنوز روزی برای این تقویم ثبت نشده است.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-2">
                {draft.days.map((item) => (
                  <article
                    key={item.date}
                    className={`${glassInner} flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between`}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-slate-100">
                          {item.jalaliDate}
                        </span>

                        <DayTypeBadge kind={item.holidayType} />

                        <span
                          className={
                            "rounded-lg border px-2.5 py-1 text-xs " +
                            (item.isHoliday
                              ? "border-rose-400/20 bg-rose-400/10 text-rose-300"
                              : "border-emerald-400/20 bg-emerald-400/10 text-emerald-300")
                          }
                        >
                          {item.isHoliday ? "تعطیل" : "غیرتعطیل"}
                        </span>
                      </div>

                      <p className="mt-3 text-sm text-slate-300">
                        {item.title}
                      </p>

                      {item.isWorkingDayOverride !== null && (
                        <p className="mt-2 text-xs text-amber-300">
                          {item.isWorkingDayOverride
                            ? "استثنا: حتماً روز کاری"
                            : "استثنا: حتماً غیرکاری"}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setDay({
                          jalaliDate: item.jalaliDate,
                          title: item.title,
                          holidayType: item.holidayType,
                          isHoliday: item.isHoliday,
                          isWorkingDayOverride:
                            item.isWorkingDayOverride,
                        });
                      }}
                      className={buttonClass}
                    >
                      <Pencil className="h-4 w-4" />
                      ویرایش
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <div className="flex items-start gap-3 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />

            <p className="text-xs leading-7 text-slate-300">
              برای اصلاح روز موجود، «ویرایش» را انتخاب کنید و
              پس از تغییر اطلاعات، دکمه «افزودن / به‌روزرسانی روز»
              را بزنید. این فرم روزهای ثبت‌شده را حذف نمی‌کند.
            </p>
          </div>

          <div className="flex justify-end border-t border-white/[0.08] pt-5">
            <button
              type="submit"
              disabled={busy || loading}
              className={primaryButton}
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ذخیره...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  ذخیره تغییرات تقویم
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </main>
  );
}
