
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
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  Factory,
  FilePenLine,
  Layers3,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
} from "lucide-react";

import { JalaliDateField } from "@/modules/shifts/jalali-date-field";

import { buildTehranShiftInterval } from "@/modules/attendance/weekly-shift-time";
import {
  validateWeeklyDraftSegments,
  type EditableWeeklySegment,
} from "@/modules/attendance/weekly-schedule-editor-policy";

type WeeklySchedule = {
  id: string;
  status: string;
  employee?: { fullName: string };
  weekStartDate: string;
  version: number;
  notes?: string | null;
  segments: EditableWeeklySegment[];
};

type Shift = {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  days: {
    dayOfWeek: number;
    isWorkingDay: boolean;
    startMinute: number | null;
    endMinute: number | null;
  }[];
};

type Assignment = {
  id: string;
  targetType: string;
  shift?: { name: string };
  employeeAssignment?: {
    user?: { fullName: string };
  };
};

type Target = {
  id: string;
  user: { id: string; fullName: string };
  organizationUnit: { name: string };
};

type Unit = {
  id: string;
  name: string;
};

const week = [
  "شنبه",
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
];

const glass =
  "relative overflow-hidden rounded-[24px] border border-slate-300/90 dark:border-white/[0.12] " +
  "bg-gradient-to-br from-white via-slate-50 to-slate-100/90 dark:from-white/[0.12] dark:via-white/[0.055] dark:to-white/[0.025] " +
  "shadow-[0_8px_28px_rgba(15,23,42,0.08)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.16),inset_0_1px_0_rgba(255,255,255,0.12)] " +
  "backdrop-blur-2xl";

const glassInner =
  "rounded-2xl border border-slate-300/80 dark:border-white/[0.08] " +
  "bg-white/90 dark:from-white/[0.075] dark:to-white/[0.025] dark:bg-gradient-to-br " +
  "shadow-[inset_0_1px_0_rgba(255,255,255,0.055)]";

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-300/90 dark:border-white/[0.12] " +
  "bg-white dark:bg-[#07132b]/75 px-4 py-3 text-sm text-slate-900 dark:text-white " +
  "outline-none transition-all duration-200 " +
  "placeholder:text-slate-500 dark:placeholder:text-slate-500 " +
  "focus:border-sky-400/50 focus:ring-4 focus:ring-sky-400/10 " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl " +
  "border border-slate-300/90 dark:border-white/[0.12] bg-white/90 dark:bg-white/[0.06] " +
  "px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 " +
  "transition-all hover:border-sky-300/30 hover:bg-slate-100 dark:bg-white/[0.1] " +
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

function time(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours > 23 || minutes > 59) return null;

  return hours * 60 + minutes;
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function formatClock(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("fa-IR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tehran",
  }).format(date);
}

function scheduleStatus(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "پیش‌نویس",
    SUBMITTED: "در انتظار تأیید",
    APPROVED: "تأییدشده",
    REJECTED: "ردشده",
  };

  return labels[status] ?? status;
}

function statusClass(status: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300";

    case "SUBMITTED":
      return "border-amber-400/20 bg-amber-400/10 text-amber-700 dark:text-amber-300";

    case "REJECTED":
      return "border-rose-400/20 bg-rose-400/10 text-rose-700 dark:text-rose-300";

    default:
      return "border-sky-400/20 bg-sky-400/10 text-sky-700 dark:text-sky-300";
  }
}

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

function SectionTitle({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof CalendarDays;
  title: string;
  description?: string;
}) {
  return (
    <div className="relative mb-5">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <Icon className="h-5 w-5 text-sky-700 dark:text-sky-300" />
        {title}
      </h2>

      {description && (
        <p className="mt-2 text-xs leading-6 text-slate-600 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
}: {
  title: string;
  value: number;
  icon: typeof Users;
}) {
  return (
    <div className={`${glass} p-4`}>
      <GlassShine />

      <div className="relative flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400">{title}</p>
          <p className="mt-3 text-2xl font-bold">
            {fmt.format(value)}
          </p>
        </div>

        <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10 text-sky-700 dark:text-sky-300">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function Shifts() {
  const [schedules, setSchedules] = useState<WeeklySchedule[]>([]);
  const [scheduleEmployee, setScheduleEmployee] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [workDay, setWorkDay] = useState("");
  const [weekFrom, setWeekFrom] = useState("07:00");
  const [weekTo, setWeekTo] = useState("15:00");

  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [error, setError] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<WeeklySchedule | null>(null);
  const [editSegments, setEditSegments] = useState<EditableWeeklySegment[]>([]);
  const [editNotes, setEditNotes] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editFrom, setEditFrom] = useState("07:00");
  const [editTo, setEditTo] = useState("15:00");

  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [start, setStart] = useState("07:00");
  const [end, setEnd] = useState("15:00");
  const [selectedDays, setSelectedDays] = useState([
    0, 1, 2, 3, 4, 5,
  ]);

  const [shiftId, setShiftId] = useState("");
  const [targetType, setTargetType] = useState("EMPLOYEE");
  const [targetId, setTargetId] = useState("");
  const [validFrom, setValidFrom] = useState("");
  const [shiftEligibility, setShiftEligibility] = useState<Record<string, { shiftName: string; workDate: string; overlapMinutes: number }>>({});
  const [eligibilityLoading, setEligibilityLoading] = useState(false);
  const [eligibilityError, setEligibilityError] = useState("");

  useEffect(() => {
    if (targetType !== "EMPLOYEE" || !shiftId || !validFrom) {
      setShiftEligibility({});
      setEligibilityError("");
      setEligibilityLoading(false);
      return;
    }
    const controller = new AbortController();
    setEligibilityLoading(true);
    setEligibilityError("");
    setShiftEligibility({});
    void (async () => {
      try {
        const query = new URLSearchParams({ shiftId, validFrom });
        const response = await fetch(`/api/attendance/hr/shift-eligibility?${query}`, {
          credentials: "same-origin", cache: "no-store", signal: controller.signal,
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "بررسی تداخل ناموفق بود.");
        if (!controller.signal.aborted) setShiftEligibility(result.unavailable ?? {});
      } catch (error) {
        if (!controller.signal.aborted) setEligibilityError(error instanceof Error ? error.message : "بررسی تداخل ناموفق بود.");
      } finally {
        if (!controller.signal.aborted) setEligibilityLoading(false);
      }
    })();
    return () => controller.abort();
  }, [shiftId, validFrom, targetType]);

  const load = useCallback(async () => {
    const urls = [
      "/api/attendance/shifts",
      "/api/attendance/shift-assignments?pageSize=100",
      "/api/attendance/hr/shift-targets",
      "/api/attendance/weekly-schedules",
    ];

    const results = await Promise.all(
      urls.map(async (url) => {
        const response = await fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(
            body.error || "دریافت اطلاعات ناموفق بود"
          );
        }

        return body.data ?? body;
      })
    );

    setShifts(results[0].shifts ?? []);
    setAssignments(results[1].assignments ?? []);
    setTargets(results[2].employees ?? []);
    setUnits(results[2].units ?? []);
    setSchedules(results[3].schedules ?? []);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);

      try {
        await load();
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "خطا در دریافت اطلاعات"
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [load]);

  const uniqueEmployees = useMemo(() => {
    return [
      ...new Map(
        targets.map((target) => [target.user.id, target])
      ).values(),
    ];
  }, [targets]);

  const stats = useMemo(
    () => ({
      shifts: shifts.length,
      activeShifts: shifts.filter((shift) => shift.isActive).length,
      assignments: assignments.length,
      pendingSchedules: schedules.filter(
        (schedule) => schedule.status === "SUBMITTED"
      ).length,
    }),
    [shifts, assignments, schedules]
  );

  async function reload() {
    setLoading(true);
    setError("");

    try {
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطا در دریافت اطلاعات"
      );
    } finally {
      setLoading(false);
    }
  }

  async function post(url: string, payload: object) {
    setBusy(true);
    setError("");
    setOk("");

    try {
      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error || "ثبت انجام نشد");
      }

      setOk("اطلاعات با موفقیت ثبت شد.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطا در ثبت اطلاعات"
      );
    } finally {
      setBusy(false);
    }
  }

  function createShift(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    const fromMinute = time(start);
    const toMinute = time(end);

    if (
      fromMinute === null ||
      toMinute === null ||
      toMinute <= fromMinute
    ) {
      setError("ساعت پایان باید پس از ساعت شروع باشد.");
      return;
    }

    void post("/api/attendance/shifts", {
      code,
      name,
      isDefault: false,
      days: Array.from({ length: 7 }, (_, dayOfWeek) => {
        const working = selectedDays.includes(dayOfWeek);

        return {
          dayOfWeek,
          segmentOrder: 1,
          dayType: "NORMAL",
          isWorkingDay: working,
          startMinute: working ? fromMinute : null,
          endMinute: working ? toMinute : null,
          requiredMinutes: working
            ? toMinute - fromMinute
            : 0,
        };
      }),
    });
  }

  function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;
    if (targetType === "EMPLOYEE" && (eligibilityLoading || eligibilityError || !shiftId || !validFrom || shiftEligibility[targetId])) {
      setError("ابتدا تداخل شیفت کارمند را بررسی کنید یا کارمند دیگری انتخاب کنید.");
      return;
    }

    if (
      !shiftId ||
      !validFrom ||
      (targetType !== "COMPANY" && !targetId)
    ) {
      setError("شیفت، مقصد و تاریخ شروع را انتخاب کنید.");
      return;
    }

    void post("/api/attendance/shift-assignments", {
      shiftId,
      targetType,
      employeeAssignmentId:
        targetType === "EMPLOYEE" ? targetId : null,
      organizationUnitId:
        targetType === "UNIT" ? targetId : null,
      validFrom,
      validTo: null,
      notes: null,
    });
  }

  function weekly(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (busy) return;

    if (!scheduleEmployee || !weekStart || !workDay) {
      setError("پرسنل و تاریخ‌ها را وارد کنید.");
      return;
    }

    let interval: ReturnType<typeof buildTehranShiftInterval>;

    try {
      interval = buildTehranShiftInterval(
        workDay,
        weekFrom,
        weekTo
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "بازه زمانی نامعتبر است."
      );
      return;
    }

    void post("/api/attendance/weekly-schedules", {
      employeeUserId: scheduleEmployee,
      weekStartDate: weekStart,
      notes: null,
      segments: [
        {
          workDate: workDay,
          segmentOrder: 1,
          startsAt: interval.startsAt,
          endsAt: interval.endsAt,
          requiredMinutes: interval.requiredMinutes,
          workShiftId: null,
          notes: null,
        },
      ],
    });
  }

  function startEditing(schedule: WeeklySchedule) {
    setEditing(schedule);

    setEditSegments(
      schedule.segments.map(
        ({
          workDate,
          segmentOrder,
          startsAt,
          endsAt,
          requiredMinutes,
          workShiftId,
          notes,
        }) => ({
          workDate: workDate.slice(0, 10),
          segmentOrder,
          startsAt,
          endsAt,
          requiredMinutes,
          workShiftId,
          notes,
        })
      )
    );

    setEditNotes(schedule.notes ?? "");
    setEditDate("");
    setError("");
    setOk("");
  }

  function addEditSegment() {
    if (!editing) return;

    try {
      const interval = buildTehranShiftInterval(
        editDate,
        editFrom,
        editTo
      );

      const order =
        1 +
        Math.max(
          0,
          ...editSegments
            .filter((segment) => segment.workDate === editDate)
            .map((segment) => segment.segmentOrder)
        );

      const segment: EditableWeeklySegment = {
        workDate: editDate,
        segmentOrder: order,
        startsAt: interval.startsAt,
        endsAt: interval.endsAt,
        requiredMinutes: interval.requiredMinutes,
        workShiftId: null,
        notes: null,
      };

      setEditSegments((previous) =>
        validateWeeklyDraftSegments(
          [...previous, segment],
          editing.weekStartDate.slice(0, 10)
        )
      );

      setError("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "بازه زمانی معتبر نیست."
      );
    }
  }

  async function saveEditing() {
    if (!editing || busy) return;

    setBusy(true);
    setError("");
    setOk("");

    try {
      const segments = validateWeeklyDraftSegments(
        editSegments,
        editing.weekStartDate.slice(0, 10)
      );

      const response = await fetch(
        `/api/attendance/weekly-schedules/${editing.id}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            notes: editNotes || null,
            segments,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "ویرایش انجام نشد."
        );
      }

      setEditing(null);
      setOk("پیش‌نویس برنامه با موفقیت ویرایش شد.");
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ویرایش برنامه"
      );
    } finally {
      setBusy(false);
    }
  }

  async function scheduleAction(
    id: string,
    kind: "submit" | "APPROVE" | "REJECT"
  ) {
    if (busy) return;

    setBusy(true);
    setError("");
    setOk("");

    try {
      const url =
        kind === "submit"
          ? `/api/attendance/weekly-schedules/${id}/submit`
          : `/api/attendance/weekly-schedules/${id}/review`;

      const response = await fetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          kind === "submit"
            ? {}
            : {
                action: kind,
                comment: "",
              }
        ),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(
          body.error || "خطا در تغییر وضعیت"
        );
      }

      setOk(
        kind === "submit"
          ? "برنامه برای تأیید ارسال شد."
          : kind === "APPROVE"
            ? "برنامه با موفقیت تأیید شد."
            : "برنامه رد شد."
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در تغییر وضعیت"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative isolate min-h-full space-y-6 overflow-hidden p-4 text-slate-900 dark:text-slate-100 sm:p-6"
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
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>منابع انسانی</span>
            <span>/</span>
            <span className="text-sky-700 dark:text-sky-300">
              مدیریت شیفت‌ها
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`${glassInner} flex h-12 w-12 items-center justify-center`}>
              <CalendarClock className="h-6 w-6 text-sky-700 dark:text-sky-300" />
            </div>

            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                مدیریت شیفت و تخصیص کارکنان
              </h1>

              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 sm:text-sm">
                تعریف الگوی شیفت، تخصیص کارکنان و مدیریت برنامه‌های هفتگی
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

      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4"
        >
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-700 dark:text-rose-300" />
          <p className="text-sm text-rose-200">{error}</p>
        </div>
      )}

      {ok && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4"
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
          <p className="text-sm text-emerald-200">{ok}</p>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Metric
          title="الگوهای شیفت"
          value={stats.shifts}
          icon={Layers3}
        />
        <Metric
          title="شیفت‌های فعال"
          value={stats.activeShifts}
          icon={Clock3}
        />
        <Metric
          title="تخصیص‌های ثبت‌شده"
          value={stats.assignments}
          icon={Users}
        />
        <Metric
          title="برنامه‌های در انتظار تأیید"
          value={stats.pendingSchedules}
          icon={ClipboardCheck}
        />
      </section>

      {loading && (
        <div
          role="status"
          className={`${glass} flex min-h-24 items-center justify-center gap-3 text-sm text-slate-600 dark:text-slate-400`}
        >
          <Loader2 className="h-5 w-5 animate-spin text-sky-700 dark:text-sky-300" />
          در حال دریافت اطلاعات...
        </div>
      )}

      {/* Shift definition */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <SectionTitle
          icon={Clock3}
          title="تعریف الگوی شیفت"
          description="ساعات شروع و پایان و روزهای کاری یک الگوی شیفت را مشخص کنید."
        />

        <form
          onSubmit={createShift}
          className="relative space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              کد شیفت
              <input
                required
                disabled={busy}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className={inputClass}
                placeholder="SHIFT-01"
                dir="ltr"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              نام شیفت
              <input
                required
                disabled={busy}
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={inputClass}
                placeholder="مثلاً شیفت صبح"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              ساعت شروع
              <input
                required
                type="time"
                disabled={busy}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              ساعت پایان
              <input
                required
                type="time"
                disabled={busy}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </label>
          </div>

          <div>
            <p className="mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">
              روزهای کاری
            </p>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
              {week.map((day, index) => {
                const checked = selectedDays.includes(index);

                return (
                  <label
                    key={day}
                    className={
                      "flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs transition-all " +
                      (checked
                        ? "border-sky-400/30 bg-sky-400/10 text-sky-200"
                        : "border-slate-300/80 dark:border-white/[0.09] bg-white/90 dark:bg-white/[0.035] text-slate-600 dark:text-slate-400")
                    }
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={busy}
                      onChange={(event) =>
                        setSelectedDays((previous) =>
                          event.target.checked
                            ? [...previous, index]
                            : previous.filter((value) => value !== index)
                        )
                      }
                      className="h-4 w-4 accent-sky-500"
                    />

                    {day}
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end border-t border-slate-300/80 dark:border-white/[0.08] pt-4">
            <button
              type="submit"
              disabled={busy}
              className={primaryButton}
            >
              <Plus className="h-4 w-4" />
              ثبت الگوی شیفت
            </button>
          </div>
        </form>
      </section>

      {/* Assignment */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <SectionTitle
          icon={Users}
          title="تخصیص شیفت"
          description="شیفت را به یک کارمند، واحد سازمانی یا کل شرکت تخصیص دهید."
        />

        <form
          onSubmit={assign}
          className="relative space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              شیفت
              <select
                required
                disabled={busy}
                value={shiftId}
                onChange={(event) => setShiftId(event.target.value)}
                className={inputClass}
              >
                <option value="">انتخاب شیفت</option>

                {shifts
                  .filter((shift) => shift.isActive)
                  .map((shift) => (
                    <option key={shift.id} value={shift.id}>
                      {shift.name}
                    </option>
                  ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              نوع تخصیص
              <select
                disabled={busy}
                value={targetType}
                onChange={(event) => {
                  setTargetType(event.target.value);
                  setTargetId("");
                }}
                className={inputClass}
              >
                <option value="EMPLOYEE">پرسنل</option>
                <option value="UNIT">واحد سازمانی</option>
                <option value="COMPANY">کل شرکت</option>
              </select>
            </label>

            {targetType !== "COMPANY" && (
              <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                مقصد
                <select
                  required
                  disabled={busy}
                  value={targetId}
                  onChange={(event) => setTargetId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">انتخاب مقصد</option>

                  {targetType === "EMPLOYEE"
                    ? targets.map((target) => (
                        <option key={target.id} value={target.id} disabled={Boolean(shiftEligibility[target.id])}>
                          {target.user.fullName} —{" "}
                          {target.organizationUnit.name}
                          {shiftEligibility[target.id] ? ` — غیرقابل انتخاب: تداخل با ${shiftEligibility[target.id].shiftName} (${shiftEligibility[target.id].overlapMinutes} دقیقه)` : ""}
                        </option>
                      ))
                    : units.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.name}
                        </option>
                      ))}
                </select>
              </label>
            )}

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              تاریخ شروع تخصیص (شمسی)
              <JalaliDateField disabled={busy} value={validFrom} onChange={setValidFrom} className={inputClass} />
            </label>
          </div>

          {targetType === "EMPLOYEE" && eligibilityLoading && <p className="text-xs text-sky-700 dark:text-sky-300">در حال بررسی تداخل شیفت کارکنان...</p>}
          {targetType === "EMPLOYEE" && eligibilityError && <p className="text-xs text-rose-700 dark:text-rose-300">{eligibilityError}</p>}
          {targetType === "EMPLOYEE" && shiftEligibility[targetId] && <p className="text-xs text-rose-700 dark:text-rose-300">این کارمند با شیفت {shiftEligibility[targetId].shiftName} تداخل دارد.</p>}
          <div className="flex justify-end border-t border-slate-300/80 dark:border-white/[0.08] pt-4">
            <button
              type="submit"
              disabled={busy || (targetType === "EMPLOYEE" && (eligibilityLoading || Boolean(eligibilityError) || Boolean(shiftEligibility[targetId])))}
              className={primaryButton}
            >
              <ShieldCheck className="h-4 w-4" />
              ثبت تخصیص
            </button>
          </div>
        </form>
      </section>

      {/* Weekly schedule */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <SectionTitle
          icon={CalendarDays}
          title="برنامه هفتگی پرسنل"
          description="برای هفته انتخابی یک بازه کاری ثبت کنید. هفته باید از شنبه شروع شود. در شیفت شب، ساعت پایان می‌تواند در روز بعد قرار گیرد."
        />

        <form
          onSubmit={weekly}
          className="relative space-y-5"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              پرسنل
              <select
                required
                disabled={busy}
                value={scheduleEmployee}
                onChange={(event) =>
                  setScheduleEmployee(event.target.value)
                }
                className={inputClass}
              >
                <option value="">انتخاب پرسنل</option>

                {uniqueEmployees.map((employee) => (
                  <option
                    key={employee.user.id}
                    value={employee.user.id}
                  >
                    {employee.user.fullName}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              شروع هفته (شنبه)
              <JalaliDateField disabled={busy} value={weekStart} onChange={setWeekStart} className={inputClass} />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              تاریخ روز کاری
              <JalaliDateField disabled={busy} value={workDay} onChange={setWorkDay} className={inputClass} />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              ساعت شروع
              <input
                required
                type="time"
                disabled={busy}
                value={weekFrom}
                onChange={(event) => setWeekFrom(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </label>

            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              ساعت پایان
              <input
                required
                type="time"
                disabled={busy}
                value={weekTo}
                onChange={(event) => setWeekTo(event.target.value)}
                className={inputClass}
                dir="ltr"
              />
            </label>
          </div>

          <div className="flex justify-end border-t border-slate-300/80 dark:border-white/[0.08] pt-4">
            <button
              type="submit"
              disabled={busy}
              className={primaryButton}
            >
              <FilePenLine className="h-4 w-4" />
              ثبت پیش‌نویس برنامه
            </button>
          </div>
        </form>
      </section>

      {/* Schedules */}
      <section className={`${glass} p-4 sm:p-5`}>
        <GlassShine />

        <SectionTitle
          icon={ClipboardCheck}
          title="برنامه‌های هفتگی ثبت‌شده"
          description="پیش‌نویس‌ها قابل ویرایش هستند و برنامه‌های ارسال‌شده برای بررسی منابع انسانی نمایش داده می‌شوند."
        />

        <div className="relative space-y-3">
          {schedules.length === 0 ? (
            <div className={`${glassInner} p-6 text-center text-sm text-slate-600 dark:text-slate-400`}>
              برنامه هفتگی ثبت نشده است.
            </div>
          ) : (
            schedules.map((schedule) => (
              <article
                key={schedule.id}
                className={`${glassInner} p-4`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10">
                      <CalendarDays className="h-5 w-5 text-sky-700 dark:text-sky-300" />
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold">
                        {schedule.employee?.fullName ?? "پرسنل نامشخص"}
                      </h3>

                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                        شروع هفته:{" "}
                        {formatDate(schedule.weekStartDate)}
                      </p>

                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                        نسخه {fmt.format(schedule.version)}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={
                        "rounded-full border px-3 py-1.5 text-xs " +
                        statusClass(schedule.status)
                      }
                    >
                      {scheduleStatus(schedule.status)}
                    </span>

                    {schedule.status === "DRAFT" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className={buttonClass}
                          onClick={() => startEditing(schedule)}
                        >
                          <Pencil className="h-4 w-4" />
                          ویرایش
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          className={primaryButton}
                          onClick={() =>
                            void scheduleAction(schedule.id, "submit")
                          }
                        >
                          <Send className="h-4 w-4" />
                          ارسال برای تأیید
                        </button>
                      </>
                    )}

                    {schedule.status === "SUBMITTED" && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-2.5 text-sm text-emerald-700 dark:text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-40"
                          onClick={() =>
                            void scheduleAction(schedule.id, "APPROVE")
                          }
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          تأیید HR
                        </button>

                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-2.5 text-sm text-rose-700 dark:text-rose-300 transition hover:bg-rose-400/20 disabled:opacity-40"
                          onClick={() =>
                            void scheduleAction(schedule.id, "REJECT")
                          }
                        >
                          <XCircle className="h-4 w-4" />
                          رد HR
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      {/* Draft editing */}
      {editing && (
        <section className={`${glass} p-4 sm:p-5`}>
          <GlassShine />

          <SectionTitle
            icon={FilePenLine}
            title={`ویرایش پیش‌نویس — ${
              editing.employee?.fullName ?? "پرسنل"
            }`}
            description="فقط پیش‌نویس توسط ایجادکننده مجاز قابل ویرایش است. برنامه‌های ارسال‌شده یا تأییدشده تغییر نمی‌کنند."
          />

          <div className="relative space-y-5">
            <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
              توضیحات برنامه
              <input
                value={editNotes}
                disabled={busy}
                onChange={(event) => setEditNotes(event.target.value)}
                maxLength={2000}
                className={inputClass}
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                روز کاری
                <JalaliDateField disabled={busy} value={editDate} onChange={setEditDate} className={inputClass} />
              </label>

              <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                ساعت شروع
                <input
                  type="time"
                  disabled={busy}
                  value={editFrom}
                  onChange={(event) => setEditFrom(event.target.value)}
                  className={inputClass}
                  dir="ltr"
                />
              </label>

              <label className="grid gap-2 text-sm text-slate-700 dark:text-slate-300">
                ساعت پایان
                <input
                  type="time"
                  disabled={busy}
                  value={editTo}
                  onChange={(event) => setEditTo(event.target.value)}
                  className={inputClass}
                  dir="ltr"
                />
              </label>
            </div>

            <button
              type="button"
              disabled={busy}
              className={buttonClass}
              onClick={addEditSegment}
            >
              <Plus className="h-4 w-4" />
              افزودن بازه کاری
            </button>

            <div className="space-y-2">
              {editSegments.map((segment, index) => (
                <div
                  key={`${segment.workDate}-${segment.segmentOrder}`}
                  className={`${glassInner} flex flex-wrap items-center justify-between gap-3 p-3`}
                >
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-700 dark:text-slate-300">
                    <span>{formatDate(segment.workDate)}</span>

                    <span className="text-sky-700 dark:text-sky-300">
                      {formatClock(segment.startsAt)}
                      {" تا "}
                      {formatClock(segment.endsAt)}
                    </span>

                    <span>
                      {fmt.format(segment.requiredMinutes)} دقیقه
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-lg border border-rose-400/15 bg-rose-400/10 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 disabled:opacity-40"
                    onClick={() =>
                      setEditSegments((previous) =>
                        previous.filter((_, i) => i !== index)
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    حذف بازه
                  </button>
                </div>
              ))}

              {editSegments.length === 0 && (
                <div className={`${glassInner} p-4 text-center text-xs text-slate-600 dark:text-slate-400`}>
                  بازه کاری در پیش‌نویس وجود ندارد.
                </div>
              )}
            </div>

            <div className="flex flex-wrap justify-end gap-3 border-t border-slate-300/80 dark:border-white/[0.08] pt-4">
              <button
                type="button"
                disabled={busy}
                className={buttonClass}
                onClick={() => setEditing(null)}
              >
                <X className="h-4 w-4" />
                انصراف
              </button>

              <button
                type="button"
                disabled={busy}
                className={primaryButton}
                onClick={() => void saveEditing()}
              >
                <Save className="h-4 w-4" />
                ذخیره تغییرات
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Existing shifts */}
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={`${glass} p-4 sm:p-5`}>
          <GlassShine />

          <SectionTitle
            icon={Factory}
            title="شیفت‌های ثبت‌شده"
          />

          <div className="relative space-y-2">
            {shifts.length ? (
              shifts.map((shift) => (
                <div
                  key={shift.id}
                  className={`${glassInner} flex items-center justify-between gap-3 p-3`}
                >
                  <div>
                    <p className="text-sm font-medium">
                      {shift.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400" dir="ltr">
                      {shift.code}
                    </p>
                  </div>

                  <span
                    className={
                      "rounded-full border px-3 py-1.5 text-xs " +
                      (shift.isActive
                        ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-400/20 bg-slate-400/10 text-slate-600 dark:text-slate-400")
                    }
                  >
                    {shift.isActive ? "فعال" : "غیرفعال"}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                شیفتی ثبت نشده است.
              </p>
            )}
          </div>
        </section>

        {/* Existing assignments */}
        <section className={`${glass} p-4 sm:p-5`}>
          <GlassShine />

          <SectionTitle
            icon={Users}
            title="تخصیص‌های ثبت‌شده"
          />

          <div className="relative space-y-2">
            {assignments.length ? (
              assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className={`${glassInner} flex items-center gap-3 p-3`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400/15 bg-sky-400/10">
                    <Users className="h-4 w-4 text-sky-700 dark:text-sky-300" />
                  </div>

                  <div>
                    <p className="text-sm font-medium">
                      {assignment.shift?.name ?? "شیفت"}
                    </p>

                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                      {assignment.employeeAssignment?.user?.fullName ??
                        (assignment.targetType === "COMPANY"
                          ? "کل شرکت"
                          : assignment.targetType === "UNIT"
                            ? "واحد سازمانی"
                            : assignment.targetType)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-400">
                تخصیصی ثبت نشده است.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
