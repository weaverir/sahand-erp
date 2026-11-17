
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  BriefcaseBusiness,
  UserRound,
  Building2,
  CalendarDays,
  X,
} from "lucide-react";

import type {
  Assignment,
  Unit,
  Position,
  Location,
} from "./types";

import {
  api,
  req,
  list,
} from "./api";

import {
  Modal,
  Field,
  input,
  primary,
  secondary,
  ErrorBox,
} from "./ui";

// ==========================================
// TYPES
// ==========================================

type AssignmentRow = Omit<
  Assignment,
  "positionId"
> & {
  positionId: string | null;
  responsibilityTitle?: string | null;
  managerAssignmentId?: string | null;

  managerAssignment?: {
    id: string;
    user?: {
      id: string;
      fullName?: string;
    };
    position?: {
      title: string;
    } | null;
    responsibilityTitle?: string | null;
    organizationUnit?: {
      name: string;
    };
  } | null;
};

type AssignmentKind =
  | "PRIMARY"
  | "SECONDARY"
  | "TEMPORARY"
  | "PROJECT";

type ResponsibilityMode =
  | "OFFICIAL"
  | "CUSTOM";

type FormProps = {
  units: Unit[];
  positions: Position[];
  locations: Location[];
  assignments: AssignmentRow[];
  close: () => void;
  saved: () => void;
};

// ==========================================
// LABELS
// ==========================================

const assignmentLabels: Record<
  AssignmentKind,
  string
> = {
  PRIMARY: "مسئولیت اصلی",
  SECONDARY: "مسئولیت دوم",
  TEMPORARY: "مسئولیت موقت",
  PROJECT: "مسئولیت پروژه‌ای",
};

const statusLabels: Record<string, string> = {
  ACTIVE: "فعال",
  ENDED: "پایان‌یافته",
  SUSPENDED: "معلق",
};

// ==========================================
// HELPERS
// ==========================================

function getAssignmentTitle(
  assignment: AssignmentRow
) {
  return (
    assignment.position?.title ||
    assignment.responsibilityTitle ||
    "بدون عنوان"
  );
}

function getAssignmentManagerTitle(
  assignment: AssignmentRow
) {
  return (
    assignment.managerAssignment?.user?.fullName ||
    assignment.managerAssignment?.position?.title ||
    assignment.managerAssignment?.responsibilityTitle ||
    "—"
  );
}

// ==========================================
// FORM
// ==========================================

function AssignmentForm({
  units,
  positions,
  locations,
  assignments,
  close,
  saved,
}: FormProps) {
  const [userId, setUserId] = useState("");

  const [unitId, setUnitId] = useState("");

  const [mode, setMode] =
    useState<ResponsibilityMode>("OFFICIAL");

  const [positionId, setPositionId] = useState("");

  const [responsibilityTitle, setResponsibilityTitle] =
    useState("");

  const [locationId, setLocationId] = useState("");

  const [managerAssignmentId, setManagerAssignmentId] =
    useState("");

  const [assignmentType, setAssignmentType] =
    useState<AssignmentKind>("PRIMARY");

  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const [endDate, setEndDate] = useState("");

  const [notes, setNotes] = useState("");

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const availableManagers = useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          assignment.status === "ACTIVE" &&
          assignment.userId !== userId
      ),
    [assignments, userId]
  );

  function changeMode(value: ResponsibilityMode) {
    setMode(value);
    setPositionId("");
    setResponsibilityTitle("");
  }

  async function submit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!userId.trim()) {
      setError("شناسه کارمند را وارد کنید.");
      return;
    }

    if (!unitId) {
      setError("واحد سازمانی را انتخاب کنید.");
      return;
    }

    if (mode === "OFFICIAL" && !positionId) {
      setError("سمت رسمی را انتخاب کنید.");
      return;
    }

    if (
      mode === "CUSTOM" &&
      responsibilityTitle.trim().length < 2
    ) {
      setError("عنوان مسئولیت سفارشی را وارد کنید.");
      return;
    }

    if (!startDate) {
      setError("تاریخ شروع مسئولیت الزامی است.");
      return;
    }

    if (
      endDate &&
      endDate < startDate
    ) {
      setError(
        "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
      );
      return;
    }

    try {
      setLoading(true);

      await api(
        "/api/organization/assignments",
        req("POST", {
          userId: userId.trim(),

          organizationUnitId: unitId,

          positionId:
            mode === "OFFICIAL"
              ? positionId
              : null,

          responsibilityTitle:
            mode === "CUSTOM"
              ? responsibilityTitle.trim()
              : null,

          locationId: locationId || null,

          managerAssignmentId:
            managerAssignmentId || null,

          assignmentType,

          isPrimary:
            assignmentType === "PRIMARY",

          startDate: new Date(
            `${startDate}T00:00:00`
          ).toISOString(),

          endDate: endDate
            ? new Date(
                `${endDate}T23:59:59`
              ).toISOString()
            : null,

          notes: notes.trim() || null,
        })
      );

      saved();
      close();

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ثبت انتصاب انجام نشد."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="ثبت مسئولیت جدید"
      close={close}
    >
      <form
        onSubmit={submit}
        className="grid gap-4"
      >
        <div className="rounded-xl border border-[var(--border)] bg-black/[0.02] p-3 dark:bg-white/[0.03]">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <UserRound size={17} />
            اطلاعات کارمند
          </div>

          <Field label="شناسه کاربری کارمند">
            <input
              required
              className={input}
              value={userId}
              onChange={(event) =>
                setUserId(event.target.value)
              }
              placeholder="شناسه کاربری در سامانه"
            />
          </Field>
        </div>

        <Field label="واحد سازمانی">
          <select
            required
            className={input}
            value={unitId}
            onChange={(event) =>
              setUnitId(event.target.value)
            }
          >
            <option value="">
              انتخاب واحد سازمانی
            </option>

            {units
              .filter((unit) => unit.status === "ACTIVE")
              .map((unit) => (
                <option
                  key={unit.id}
                  value={unit.id}
                >
                  {unit.name}
                </option>
              ))}
          </select>
        </Field>

        <div className="grid gap-2">
          <span className="text-sm font-medium">
            نوع تعریف مسئولیت
          </span>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => changeMode("OFFICIAL")}
              className={`rounded-xl border p-3 text-sm ${
                mode === "OFFICIAL"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                  : "border-[var(--border)]"
              }`}
            >
              <BriefcaseBusiness
                size={18}
                className="mx-auto mb-2"
              />
              سمت رسمی
            </button>

            <button
              type="button"
              onClick={() => changeMode("CUSTOM")}
              className={`rounded-xl border p-3 text-sm ${
                mode === "CUSTOM"
                  ? "border-[var(--primary)] bg-[var(--primary)]/10 font-semibold"
                  : "border-[var(--border)]"
              }`}
            >
              <Plus
                size={18}
                className="mx-auto mb-2"
              />
              مسئولیت سفارشی
            </button>
          </div>
        </div>

        {mode === "OFFICIAL" ? (
          <Field label="سمت سازمانی">
            <select
              required
              className={input}
              value={positionId}
              onChange={(event) =>
                setPositionId(event.target.value)
              }
            >
              <option value="">
                انتخاب سمت
              </option>

              {positions
                .filter((position) => position.isActive)
                .map((position) => (
                  <option
                    key={position.id}
                    value={position.id}
                  >
                    {position.title}
                  </option>
                ))}
            </select>
          </Field>
        ) : (
          <Field label="عنوان مسئولیت سفارشی">
            <input
              required
              maxLength={120}
              className={input}
              value={responsibilityTitle}
              onChange={(event) =>
                setResponsibilityTitle(
                  event.target.value
                )
              }
              placeholder="مثلاً مسئول کنترل کیفیت"
            />
          </Field>
        )}

        <Field label="نوع انتصاب">
          <select
            className={input}
            value={assignmentType}
            onChange={(event) =>
              setAssignmentType(
                event.target.value as AssignmentKind
              )
            }
          >
            {Object.entries(assignmentLabels).map(
              ([value, label]) => (
                <option
                  key={value}
                  value={value}
                >
                  {label}
                </option>
              )
            )}
          </select>
        </Field>

        <Field label="مدیر مستقیم">
          <select
            className={input}
            value={managerAssignmentId}
            onChange={(event) =>
              setManagerAssignmentId(
                event.target.value
              )
            }
          >
            <option value="">
              بدون مدیر مستقیم
            </option>

            {availableManagers.map((manager) => (
              <option
                key={manager.id}
                value={manager.id}
              >
                {manager.user?.fullName ||
                  manager.userId}
                {" — "}
                {getAssignmentTitle(manager)}
                {" — "}
                {manager.organizationUnit?.name || ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="محل خدمت">
          <select
            className={input}
            value={locationId}
            onChange={(event) =>
              setLocationId(event.target.value)
            }
          >
            <option value="">
              بدون محل مشخص
            </option>

            {locations
              .filter(
                (location) =>
                  location.status === "ACTIVE"
              )
              .map((location) => (
                <option
                  key={location.id}
                  value={location.id}
                >
                  {location.name}
                </option>
              ))}
          </select>
        </Field>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="تاریخ شروع">
            <input
              required
              type="date"
              className={input}
              value={startDate}
              onChange={(event) =>
                setStartDate(event.target.value)
              }
            />
          </Field>

          <Field label="تاریخ پایان (اختیاری)">
            <input
              type="date"
              className={input}
              value={endDate}
              min={startDate}
              onChange={(event) =>
                setEndDate(event.target.value)
              }
            />
          </Field>
        </div>

        <Field label="توضیحات">
          <textarea
            rows={3}
            maxLength={2000}
            className={input}
            value={notes}
            onChange={(event) =>
              setNotes(event.target.value)
            }
            placeholder="توضیحات تکمیلی درباره مسئولیت..."
          />
        </Field>

        {assignmentType === "PRIMARY" && (
          <p className="rounded-xl bg-blue-500/10 p-3 text-sm text-blue-600 dark:text-blue-400">
            هر کارمند فقط یک مسئولیت اصلی فعال می‌تواند
            داشته باشد.
          </p>
        )}

        {error && <ErrorBox>{error}</ErrorBox>}

        <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
          <button
            type="button"
            className={secondary}
            onClick={close}
            disabled={loading}
          >
            انصراف
          </button>

          <button
            type="submit"
            className={primary}
            disabled={loading}
          >
            {loading ? (
              "در حال ثبت..."
            ) : (
              <>
                <Plus
                  size={16}
                  className="ml-1 inline"
                />
                ثبت مسئولیت
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function AssignmentsManager({
  units,
  positions,
  locations,
}: {
  units: Unit[];
  positions: Position[];
  locations: Location[];
}) {
  const [rows, setRows] =
    useState<AssignmentRow[]>([]);

  const [open, setOpen] = useState(false);

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  async function load() {
    try {
      setLoading(true);

      const result = await api(
        "/api/organization/assignments"
      );

      setRows(
        list<AssignmentRow>(
          result,
          "assignments"
        )
      );

      setError("");

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "دریافت انتصاب‌ها ناموفق بود."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeCount = rows.filter(
    (row) => row.status === "ACTIVE"
  ).length;

  const primaryCount = rows.filter(
    (row) =>
      row.status === "ACTIVE" &&
      row.isPrimary
  ).length;

  const secondaryCount = rows.filter(
    (row) =>
      row.status === "ACTIVE" &&
      !row.isPrimary
  ).length;

  return (
    <section
      dir="rtl"
      className="grid gap-4"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            انتصاب کارکنان
          </h2>

          <p className="mt-1 text-sm text-[var(--muted)]">
            مدیریت مسئولیت‌های اصلی، دوم، موقت و پروژه‌ای
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            className={secondary}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              size={16}
              className="inline ml-1"
            />
            بروزرسانی
          </button>

          <button
            type="button"
            className={primary}
            onClick={() => setOpen(true)}
          >
            <Plus
              size={16}
              className="inline ml-1"
            />
            انتصاب جدید
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            label: "کل مسئولیت‌های فعال",
            value: activeCount,
            icon: UsersIcon,
          },
          {
            label: "مسئولیت‌های اصلی",
            value: primaryCount,
            icon: BriefcaseBusiness,
          },
          {
            label: "مسئولیت‌های دوم و موقت",
            value: secondaryCount,
            icon: Building2,
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--muted)]">
                {item.label}
              </p>

              <item.icon
                size={19}
                className="text-[var(--primary)]"
              />
            </div>

            <p className="mt-2 text-2xl font-black">
              {item.value.toLocaleString("fa-IR")}
            </p>
          </article>
        ))}
      </div>

      {error && <ErrorBox>{error}</ErrorBox>}

      <div className="overflow-x-auto rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full min-w-[850px] text-right text-sm">
          <thead>
            <tr className="bg-black/[0.04] dark:bg-white/[0.04]">
              <th className="p-3">کارمند</th>
              <th className="p-3">واحد سازمانی</th>
              <th className="p-3">مسئولیت</th>
              <th className="p-3">نوع انتصاب</th>
              <th className="p-3">مدیر مستقیم</th>
              <th className="p-3">وضعیت</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((assignment) => (
              <tr
                key={assignment.id}
                className="border-t border-[var(--border)]"
              >
                <td className="p-3">
                  <div className="font-semibold">
                    {assignment.user?.fullName ||
                      assignment.user?.username ||
                      assignment.userId}
                  </div>

                  <div className="mt-1 text-xs text-[var(--muted)]">
                    {assignment.userId}
                  </div>
                </td>

                <td className="p-3">
                  {assignment.organizationUnit?.name ||
                    units.find(
                      (unit) =>
                        unit.id ===
                        assignment.organizationUnitId
                    )?.name ||
                    "—"}
                </td>

                <td className="p-3">
                  <div className="font-medium">
                    {getAssignmentTitle(assignment)}
                  </div>

                  {!assignment.positionId && (
                    <span className="mt-1 inline-block rounded-md bg-blue-500/10 px-2 py-1 text-xs text-blue-600">
                      سفارشی
                    </span>
                  )}
                </td>

                <td className="p-3">
                  {assignmentLabels[
                    assignment.assignmentType
                  ] || assignment.assignmentType}
                </td>

                <td className="p-3">
                  {getAssignmentManagerTitle(
                    assignment
                  )}
                </td>

                <td className="p-3">
                  <span
                    className={`inline-block rounded-lg px-2.5 py-1 text-xs ${
                      assignment.status === "ACTIVE"
                        ? "bg-green-500/10 text-green-600"
                        : "bg-black/5 text-[var(--muted)]"
                    }`}
                  >
                    {statusLabels[assignment.status] ||
                      assignment.status}
                  </span>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td
                  colSpan={6}
                  className="p-10 text-center text-[var(--muted)]"
                >
                  {loading
                    ? "در حال دریافت اطلاعات..."
                    : "هنوز انتصابی ثبت نشده است."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {open && (
        <AssignmentForm
          units={units}
          positions={positions}
          locations={locations}
          assignments={rows}
          close={() => setOpen(false)}
          saved={() => void load()}
        />
      )}
    </section>
  );
}

function UsersIcon({
  size,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <UserRound
      size={size}
      className={className}
    />
  );
}
