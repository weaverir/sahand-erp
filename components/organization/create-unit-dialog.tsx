"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Plus, X, LoaderCircle, Building2, MapPin, GitBranch,
  AlignRight, Hash, ListOrdered, CheckCircle2, Info,
} from "lucide-react";

type UnitOption = { id: string; name: string; code?: string };
type LocationOption = { id: string; name: string; status?: string };
type Props = {
  units: UnitOption[];
  onCreated: () => void | Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const fieldClass =
  "w-full min-h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15 disabled:opacity-60";

function FieldLabel({ children, required = false }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="mb-2 block text-sm font-semibold text-[var(--foreground)]">
      {children} {required && <span className="text-rose-500">*</span>}
    </label>
  );
}

export default function CreateUnitDialog({ units, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [locationError, setLocationError] = useState("");
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [status, setStatus] = useState("ACTIVE");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function loadLocations() {
      try {
        setLocationError("");
        const response = await fetch("/api/organization/locations", {
          credentials: "same-origin",
          cache: "no-store",
        });
        const result: unknown = await response.json();
        if (!response.ok) throw new Error("دریافت محل‌های سازمانی ناموفق بود.");
        if (!isRecord(result) || !isRecord(result.data)) {
          throw new Error("ساختار پاسخ محل‌های سازمانی معتبر نیست.");
        }
        const records = result.data.locations;
        if (!Array.isArray(records)) throw new Error("فهرست محل‌های سازمانی معتبر نیست.");
        if (!cancelled) {
          setLocations(records.filter((item): item is LocationOption =>
            isRecord(item) && typeof item.id === "string" &&
            typeof item.name === "string" && item.status !== "INACTIVE"
          ));
        }
      } catch (err) {
        if (!cancelled) setLocationError(err instanceof Error ? err.message : "خطا در دریافت محل‌ها.");
      }
    }
    void loadLocations();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, loading]);

  function resetForm() {
    setCode(""); setName(""); setDescription(""); setParentId("");
    setLocationId(""); setSortOrder("0"); setStatus("ACTIVE"); setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");
    if (!code.trim() || !name.trim()) {
      setError("کد و نام واحد الزامی هستند."); return;
    }
    const order = Number(sortOrder);
    if (!Number.isSafeInteger(order) || order < 0) {
      setError("ترتیب نمایش باید یک عدد صحیح صفر یا بزرگ‌تر باشد."); return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/organization/units", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          description: description.trim() || null,
          parentId: parentId || null,
          locationId: locationId || null,
          sortOrder: order,
          status,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        const message = isRecord(result) && typeof result.message === "string"
          ? result.message : "ثبت واحد سازمانی ناموفق بود.";
        throw new Error(message);
      }
      resetForm();
      setOpen(false);
      await onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "خطا در ثبت واحد سازمانی.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:opacity-90"
      >
        <Plus size={18} /> ایجاد واحد جدید
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !loading) setOpen(false);
          }}
        >
          <section
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-unit-title"
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[26px] border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-2xl"
          >
            <header className="relative shrink-0 overflow-hidden border-b border-[var(--border)] bg-[var(--primary)]/5 px-5 py-5 sm:px-7">
              <div className="pointer-events-none absolute -left-10 -top-16 size-48 rounded-full bg-[var(--primary)]/10 blur-3xl" />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-md">
                    <Building2 size={24} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-[var(--muted)]">مدیریت ساختار سازمانی</p>
                    <h2 id="create-unit-title" className="text-xl font-black sm:text-2xl">ایجاد واحد سازمانی</h2>
                    <p className="mt-1 text-xs leading-6 text-[var(--muted)] sm:text-sm">
                      مشخصات و جایگاه واحد جدید را در سازمان تعیین کنید.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="بستن پنجره"
                  title="بستن"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2.5 transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-7">
                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                    <Hash size={17} className="text-[var(--primary)]" />
                    <h3 className="font-bold">مشخصات واحد</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel required>نام واحد</FieldLabel>
                      <input required autoFocus maxLength={150} value={name}
                        onChange={(event) => setName(event.target.value)}
                        placeholder="مثلاً منابع انسانی" className={fieldClass} />
                    </div>
                    <div>
                      <FieldLabel required>کد شناسایی واحد</FieldLabel>
                      <input required dir="ltr" maxLength={60} value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="مثلاً HR" className={`${fieldClass} text-left font-mono`} />
                      <p className="mt-1.5 text-xs text-[var(--muted)]">کدی کوتاه و یکتا برای شناسایی واحد</p>
                    </div>
                  </div>
                  <div>
                    <FieldLabel>توضیحات واحد</FieldLabel>
                    <textarea rows={3} maxLength={2000} value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="وظایف و حوزه فعالیت این واحد را بنویسید..."
                      className={`${fieldClass} resize-y`} />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                    <GitBranch size={17} className="text-[var(--primary)]" />
                    <h3 className="font-bold">جایگاه در سازمان</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>واحد بالادستی</FieldLabel>
                      <select value={parentId} onChange={(event) => setParentId(event.target.value)} className={fieldClass}>
                        <option value="">واحد اصلی (بدون بالادستی)</option>
                        {units.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {unit.name}{unit.code ? ` (${unit.code})` : ""}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-xs text-[var(--muted)]">برای ایجاد واحد مستقل، گزینه اصلی را نگه دارید.</p>
                    </div>
                    <div>
                      <FieldLabel><span className="inline-flex items-center gap-1"><MapPin size={14} /> محل استقرار</span></FieldLabel>
                      <select value={locationId} onChange={(event) => setLocationId(event.target.value)} className={fieldClass}>
                        <option value="">بدون محل مشخص</option>
                        {locations.map((location) => (
                          <option key={location.id} value={location.id}>{location.name}</option>
                        ))}
                      </select>
                      {locationError && <p role="alert" className="mt-2 text-xs text-amber-600 dark:text-amber-400">{locationError}</p>}
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2 border-b border-[var(--border)] pb-3">
                    <ListOrdered size={17} className="text-[var(--primary)]" />
                    <h3 className="font-bold">نمایش و وضعیت</h3>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <FieldLabel>ترتیب نمایش</FieldLabel>
                      <input type="number" min="0" step="1" value={sortOrder}
                        onChange={(event) => setSortOrder(event.target.value)}
                        className={fieldClass} />
                      <p className="mt-1.5 text-xs text-[var(--muted)]">عدد کوچک‌تر، اولویت نمایش بالاتر</p>
                    </div>
                    <div>
                      <FieldLabel>وضعیت واحد</FieldLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { value: "ACTIVE", label: "فعال" },
                          { value: "INACTIVE", label: "غیرفعال" },
                        ] as const).map((item) => (
                          <button key={item.value} type="button" onClick={() => setStatus(item.value)}
                            aria-pressed={status === item.value}
                            className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl border px-2 text-sm font-semibold transition ${
                              status === item.value
                                ? "border-[var(--primary)] bg-[var(--primary)]/10 text-[var(--primary)]"
                                : "border-[var(--border)] text-[var(--muted)] hover:bg-black/5 dark:hover:bg-white/5"
                            }`}>
                            {status === item.value && <CheckCircle2 size={15} />}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2 rounded-xl border border-[var(--border)] bg-black/[0.025] p-3 text-xs leading-6 text-[var(--muted)] dark:bg-white/[0.025]">
                  <Info size={17} className="mt-0.5 shrink-0 text-[var(--primary)]" />
                  واحد جدید پس از ثبت در ساختار سازمانی نمایش داده می‌شود. می‌توانید بعداً سمت‌ها و کارکنان را به آن اختصاص دهید.
                </div>
                {error && (
                  <div role="alert" className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-3 text-sm text-rose-600 dark:text-rose-400">
                    {error}
                  </div>
                )}
              </div>

              <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-5 py-4 sm:px-7">
                <button type="button" disabled={loading} onClick={() => setOpen(false)}
                  className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-sm font-semibold transition hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/5">
                  انصراف
                </button>
                <button type="submit" disabled={loading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-wait disabled:opacity-60">
                  {loading ? <LoaderCircle size={17} className="animate-spin" /> : <Plus size={17} />}
                  {loading ? "در حال ثبت..." : "ثبت واحد سازمانی"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
