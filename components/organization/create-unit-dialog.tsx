
"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, X, LoaderCircle } from "lucide-react";

type UnitOption = {
  id: string;
  name: string;
  code?: string;
};

type LocationOption = {
  id: string;
  name: string;
  status?: string;
};

type Props = {
  units: UnitOption[];
  onCreated: () => void | Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default function CreateUnitDialog({
  units,
  onCreated,
}: Props) {
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

        const response = await fetch(
          "/api/organization/locations",
          {
            credentials: "same-origin",
            cache: "no-store",
          }
        );

        const result: unknown = await response.json();

        if (!response.ok) {
          throw new Error("دریافت محل‌های سازمانی ناموفق بود.");
        }

        if (!isRecord(result) || !isRecord(result.data)) {
          throw new Error("ساختار پاسخ محل‌های سازمانی معتبر نیست.");
        }

        const records = result.data.locations;

        if (!Array.isArray(records)) {
          throw new Error("فهرست محل‌های سازمانی معتبر نیست.");
        }

        if (!cancelled) {
          setLocations(
            records.filter(
              (item): item is LocationOption =>
                isRecord(item) &&
                typeof item.id === "string" &&
                typeof item.name === "string" &&
                item.status !== "INACTIVE"
            )
          );
        }
      } catch (err) {
        if (!cancelled) {
          setLocationError(
            err instanceof Error
              ? err.message
              : "خطا در دریافت محل‌ها."
          );
        }
      }
    }

    void loadLocations();

    return () => {
      cancelled = true;
    };
  }, [open]);

  function resetForm() {
    setCode("");
    setName("");
    setDescription("");
    setParentId("");
    setLocationId("");
    setSortOrder("0");
    setStatus("ACTIVE");
    setError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) return;

    setError("");

    if (!code.trim() || !name.trim()) {
      setError("کد و نام واحد الزامی هستند.");
      return;
    }

    const order = Number(sortOrder);

    if (!Number.isSafeInteger(order) || order < 0) {
      setError("ترتیب نمایش معتبر نیست.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/organization/units", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
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
        const message =
          isRecord(result) && typeof result.message === "string"
            ? result.message
            : "ثبت واحد سازمانی ناموفق بود.";

        throw new Error(message);
      }

      resetForm();
      setOpen(false);

      await onCreated();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ثبت واحد سازمانی."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <Plus size={17} />
        ایجاد واحد جدید
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onMouseDown={event => {
            if (event.target === event.currentTarget && !loading) {
              setOpen(false);
            }
          }}
        >
          <section
            dir="rtl"
            className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-700 bg-[#111827] p-6 text-white shadow-2xl"
          >
            <header className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold">
                  ایجاد واحد سازمانی
                </h2>
                <p className="mt-1 text-xs text-gray-400">
                  اطلاعات واحد جدید را وارد کنید.
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm">
                    کد واحد *
                  </label>
                  <input
                    required
                    value={code}
                    onChange={event => setCode(event.target.value)}
                    placeholder="مثلاً HR"
                    dir="ltr"
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm">
                    نام واحد *
                  </label>
                  <input
                    required
                    value={name}
                    onChange={event => setName(event.target.value)}
                    placeholder="مثلاً منابع انسانی"
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  واحد بالادستی
                </label>

                <select
                  value={parentId}
                  onChange={event => setParentId(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">واحد اصلی سازمان (بدون والد)</option>

                  {units.map(unit => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name} {unit.code ? `(${unit.code})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  محل سازمانی
                </label>

                <select
                  value={locationId}
                  onChange={event => setLocationId(event.target.value)}
                  className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">بدون محل مشخص</option>

                  {locations.map(location => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>

                {locationError && (
                  <p className="mt-2 text-xs text-amber-400">
                    {locationError}
                  </p>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm">
                  توضیحات
                </label>
                <textarea
                  value={description}
                  onChange={event => setDescription(event.target.value)}
                  rows={3}
                  placeholder="توضیحات اختیاری واحد..."
                  className="w-full resize-none rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm">
                    ترتیب نمایش
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={sortOrder}
                    onChange={event => setSortOrder(event.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm">
                    وضعیت
                  </label>
                  <select
                    value={status}
                    onChange={event => setStatus(event.target.value)}
                    className="w-full rounded-xl border border-gray-700 bg-gray-900 px-3 py-3 text-sm outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">فعال</option>
                    <option value="INACTIVE">غیرفعال</option>
                  </select>
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}

              <footer className="flex flex-wrap justify-end gap-3 border-t border-gray-700 pt-5">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-gray-700 px-5 py-2.5 text-sm hover:bg-white/5"
                >
                  انصراف
                </button>

                <button
                  type="submit"
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading && (
                    <LoaderCircle size={16} className="animate-spin" />
                  )}
                  ثبت واحد
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
