
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  UploadCloud,
} from "lucide-react";

type ApplicationInfo = {
  gender: "MALE" | "FEMALE";
  maritalStatus: "SINGLE" | "MARRIED";
  hasInsuranceHistory: boolean;
  insuranceNumber: string | null;
  bankSinaIban: string | null;
  childrenCount: number;
  documentsStatus: string;
};

type ExistingDocument = {
  id: string;
  documentType: string;
  status: string;
  fileName: string;
};

type UploadItem = {
  key: string;
  documentType: string;
  label: string;
  file: File | null;
  subjectIndex?: number;
};

const FORM_DOWNLOAD_URL =
  "/forms/social-security-registration.pdf";

function makeKey() {
  return `doc_${Math.random().toString(36).slice(2, 12)}`;
}

function formatDocumentStatus(status: string) {
  const labels: Record<string, string> = {
    PENDING: "در انتظار تکمیل",
    SUBMITTED: "ارسال‌شده برای بررسی",
    HR_REVIEW: "در حال بررسی منابع انسانی",
    EXECUTIVE_REVIEW: "در انتظار تأیید مدیرعامل / قائم‌مقام",
    NEEDS_CORRECTION: "نیازمند اصلاح",
    REJECTED: "رد شده",
    APPROVED: "تأیید نهایی شده",
    UPLOADED: "بارگذاری شده",
    UNDER_REVIEW: "در حال بررسی",
    APPROVED_DOCUMENT: "تأیید شده",
  };

  return labels[status] || status;
}

export default function DocumentsStepForm({
  enabled,
}: {
  enabled: boolean;
}) {
  const [application, setApplication] =
    useState<ApplicationInfo | null>(null);

  const [existing, setExisting] =
    useState<ExistingDocument[]>([]);

  const [iban, setIban] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [items, setItems] = useState<UploadItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    let active = true;

    fetch("/api/recruitment/documents", {
      credentials: "include",
      cache: "no-store",
    })
      .then(async (response) => {
        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(
            result.message ||
              "دریافت اطلاعات مرحله دوم ناموفق بود."
          );
        }

        if (!active) return;

        const app =
          result.data.application as ApplicationInfo;

        setApplication(app);
        setExisting(result.data.documents || []);
        setIban(app.bankSinaIban || "");
        setInsuranceNumber(app.insuranceNumber || "");
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "خطا در دریافت مدارک"
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  // ==========================================
  // REQUIRED DOCUMENTS
  // ==========================================

  const requiredItems = useMemo(() => {
    if (!application) {
      return [] as Omit<UploadItem, "key" | "file">[];
    }

    const list: Omit<UploadItem, "key" | "file">[] = [
      {
        documentType: "NATIONAL_CARD",
        label: "تصویر کارت ملی",
      },
      {
        documentType: "APPLICANT_BIRTH_CERTIFICATE_PAGE",
        label: "تمام صفحات شناسنامه متقاضی (ترجیحاً یک PDF)",
      },
      {
        documentType: "EDUCATION_CERTIFICATE",
        label: "مدرک تحصیلی",
      },
      {
        documentType: "SOCIAL_SECURITY_FORM",
        label: "فرم تکمیل‌شده تأمین اجتماعی",
      },
    ];

    if (application.hasInsuranceHistory) {
      list.push({
        documentType: "INSURANCE_HISTORY",
        label: "سوابق بیمه",
      });
    }

    if (application.gender === "MALE") {
      list.push({
        documentType: "MILITARY_SERVICE",
        label: "مدرک وضعیت نظام وظیفه",
      });
    }

    if (application.maritalStatus === "MARRIED") {
      list.push(
        {
          documentType: "MARRIAGE_CERTIFICATE",
          label: "سند ازدواج",
        },
        {
          documentType: "SPOUSE_BIRTH_CERTIFICATE_PAGE",
          label: "صفحه اول شناسنامه همسر",
        }
      );

      // رضایت همسر فقط برای خانم متأهل
      if (application.gender === "FEMALE") {
        list.push({
          documentType: "SPOUSE_CONSENT",
          label: "رضایت‌نامه کتبی همسر",
        });
      }
    }

    // رضایت‌نامه والدین برای هیچ گروهی درخواست نمی‌شود.

    for (
      let index = 1;
      index <= application.childrenCount;
      index++
    ) {
      list.push({
        documentType: "CHILD_BIRTH_CERTIFICATE_PAGE",
        label: `صفحه اول شناسنامه فرزند ${index}`,
        subjectIndex: index,
      });
    }

    return list;
  }, [application]);

  useEffect(() => {
    if (!requiredItems.length) return;

    setItems((current) =>
      requiredItems.map((required) => {
        const old = current.find(
          (item) =>
            item.documentType === required.documentType &&
            item.subjectIndex === required.subjectIndex
        );

        return (
          old || {
            ...required,
            key: makeKey(),
            file: null,
          }
        );
      })
    );
  }, [requiredItems]);

  function updateFile(
    key: string,
    file: File | null
  ) {
    setItems((current) =>
      current.map((item) =>
        item.key === key
          ? { ...item, file }
          : item
      )
    );
  }

  // ==========================================
  // SUBMIT DOCUMENTS
  // ==========================================

  async function submit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    if (
      !/^IR[0-9]{24}$/i.test(
        iban.replace(/\s/g, "")
      )
    ) {
      setError(
        "شماره شبای بانک سینا باید با IR و ۲۴ رقم وارد شود."
      );
      return;
    }

    if (
      application?.hasInsuranceHistory &&
      !/^[a-zA-Z0-9-]{3,30}$/.test(
        insuranceNumber.trim()
      )
    ) {
      setError("شماره بیمه معتبر نیست.");
      return;
    }

    const missing = items.filter(
      (item) => !item.file
    );

    if (missing.length) {
      setError(
        `لطفاً این مدارک را بارگذاری کنید: ${missing
          .map((item) => item.label)
          .join("، ")}`
      );
      return;
    }

    const form = new FormData();

    const payload = {
      bankSinaIban: iban
        .replace(/\s/g, "")
        .toUpperCase(),

      insuranceNumber:
        application?.hasInsuranceHistory
          ? insuranceNumber.trim()
          : "",

      documents: items.map(
        ({ key, documentType, subjectIndex }) => ({
          key,
          documentType,
          ...(subjectIndex
            ? { subjectIndex }
            : {}),
        })
      ),
    };

    form.append(
      "payload",
      JSON.stringify(payload)
    );

    for (const item of items) {
      if (item.file) {
        form.append(
          `file_${item.key}`,
          item.file
        );
      }
    }

    try {
      setSubmitting(true);

      const response = await fetch(
        "/api/recruitment/documents",
        {
          method: "POST",
          credentials: "include",
          body: form,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message ||
            "ارسال مدارک ناموفق بود."
        );
      }

      setSuccess(
        "مدارک مرحله دوم با موفقیت ارسال شد و برای بررسی منابع انسانی قرار گرفت."
      );

      setExisting(
        items.map((item, index) => ({
          id: `new-${index}`,
          documentType: item.documentType,
          status: "UPLOADED",
          fileName: item.file?.name || "",
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در ارسال مدارک"
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!enabled) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
        در حال بارگذاری فرم مرحله دوم...
      </div>
    );
  }

  if (!application) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {error ||
          "اطلاعات مرحله دوم در دسترس نیست."}
      </div>
    );
  }

  const editable =
    application.documentsStatus === "PENDING" ||
    application.documentsStatus === "NEEDS_CORRECTION";

  return (
    <section className="space-y-5 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm md:p-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">
            مرحله دوم: تکمیل مدارک استخدامی
          </h2>

          <p className="mt-2 text-sm leading-7 text-slate-500">
            مدارک زیر بر اساس اطلاعات ثبت‌شده در مرحله اول نمایش داده شده‌اند.
            نیازی به ورود مجدد اطلاعات هویتی، جنسیت یا وضعیت تأهل نیست.
          </p>
        </div>

        <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
          {formatDocumentStatus(
            application.documentsStatus
          )}
        </span>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 font-bold text-slate-800">
          <FileText size={18} />
          فرم خام تأمین اجتماعی
        </div>

        <p className="mt-2 text-sm leading-7 text-slate-600">
          فایل دوصفحه‌ای را دانلود و چاپ کنید، اطلاعات لازم را تکمیل و امضا کنید و سپس نسخه اسکن‌شده را در قسمت مدارک بارگذاری کنید.
        </p>

        <a
          href={FORM_DOWNLOAD_URL}
          download
          className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
        >
          <Download size={17} />
          دانلود فرم خام و چاپ
        </a>
      </div>

      {existing.length > 0 && (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="mb-2 flex items-center gap-2 font-bold text-emerald-800">
            <CheckCircle2 size={17} />
            مدارک ثبت‌شده قبلی
          </div>

          <div className="space-y-1 text-xs text-emerald-800">
            {existing.map((doc) => (
              <p key={doc.id}>
                {doc.fileName} —{" "}
                {formatDocumentStatus(doc.status)}
              </p>
            ))}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm leading-7 text-red-700">
          <AlertCircle
            className="ml-2 inline"
            size={17}
          />
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm leading-7 text-emerald-800">
          <CheckCircle2
            className="ml-2 inline"
            size={17}
          />
          {success}
        </div>
      )}

      {editable ? (
        <form
          onSubmit={submit}
          className="space-y-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-700">
              شماره شبای بانک سینا

              <input
                value={iban}
                onChange={(e) =>
                  setIban(e.target.value)
                }
                dir="ltr"
                maxLength={26}
                placeholder="IR000000000000000000000000"
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-left outline-none focus:border-indigo-500"
              />
            </label>

            {application.hasInsuranceHistory && (
              <label className="block text-sm font-semibold text-slate-700">
                شماره بیمه

                <input
                  value={insuranceNumber}
                  onChange={(e) =>
                    setInsuranceNumber(e.target.value)
                  }
                  dir="ltr"
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 text-left outline-none focus:border-indigo-500"
                />
              </label>
            )}
          </div>

          <div className="space-y-3">
            <h3 className="font-bold text-slate-900">
              بارگذاری مدارک
            </h3>

            {items.map((item) => (
              <label
                key={item.key}
                className="block rounded-xl border border-slate-200 p-4 hover:border-indigo-300"
              >
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  {item.label}{" "}
                  <span className="text-red-500">*</span>
                </span>

                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  onChange={(e) =>
                    updateFile(
                      item.key,
                      e.target.files?.[0] || null
                    )
                  }
                  className="block w-full text-sm text-slate-600 file:ml-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:font-semibold file:text-indigo-700"
                />

                {item.file && (
                  <span className="mt-2 block text-xs text-emerald-700">
                    فایل انتخاب‌شده: {item.file.name}
                  </span>
                )}
              </label>
            ))}
          </div>

          <div className="rounded-xl bg-amber-50 p-4 text-sm leading-7 text-amber-900">
            اصل مدارک بارگذاری‌شده باید هنگام شروع به کار همراه متقاضی باشد.
            تصاویر باید خوانا، کامل و بدون برش باشند.
            حجم هر فایل حداکثر ۱۰ مگابایت و مجموع فایل‌ها حداکثر ۴۰ مگابایت است.
          </div>

          <button
            type="submit"
            disabled={
              submitting || items.length === 0
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3.5 font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2
                  size={18}
                  className="animate-spin"
                />
                در حال ارسال مدارک...
              </>
            ) : (
              <>
                <UploadCloud size={18} />
                ثبت و ارسال مدارک مرحله دوم
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-600">
          در حال حاضر امکان ویرایش مدارک وجود ندارد.
          وضعیت فعلی پرونده:{" "}
          <strong>
            {formatDocumentStatus(
              application.documentsStatus
            )}
          </strong>
        </div>
      )}
    </section>
  );
}
