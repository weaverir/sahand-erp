"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
type Education = {
  id: string;
  degree: string;
  fieldOfStudy: string;
  institution: string;
  city: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrentlyStudying: boolean;
  grade: string | null;
  description: string | null;
};
type WorkExperience = {
  id: string;
  companyName: string;
  position: string;
  startDate: string;
  endDate: string | null;
  leavingReason: string | null;
  salaryReceived: string | number | null;
};
type Employee = {
  id: string;
  userId: string;
  candidateApplicationId: string;
  personnelCode: string | null;
  employmentStatus: string;
  hireDate: string;
  terminationDate: string | null;
  terminationReason: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    username: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    isActive: boolean;
    accessLevel: string;
    lastLoginAt: string | null;
    createdAt: string;
  };
  candidateApplication: {
    id: string;
    applicationNumber: string;
    firstName: string;
    lastName: string;
    fatherName: string;
    birthCertificateNumber: string;
    nationalId: string;
    gender: string;
    maritalStatus: string;
    nationality: string;
    birthPlace: string;
    dateOfBirth: string;
    landlinePhone: string | null;
    mobilePhone: string;
    email: string | null;
    address: string;
    militaryStatus: string | null;
    currentlyEmployed: boolean;
    currentEmployer: string | null;
    hasExternalCommitment: boolean;
    hasInsuranceHistory: boolean;
    minimumEmploymentPeriod: string | null;
    childrenCount: number;
    requestedSalary: string | number | null;
    additionalNotes: string | null;
    insuranceNumber: string | null;
    bankSinaIban: string | null;
    initialStatus: string;
    initialSubmittedAt: string | null;
    initialApprovedAt: string | null;
    documentsStatus: string;
    documentsSubmittedAt: string | null;
    documentsApprovedAt: string | null;
    declarationAccepted: boolean;
    declarationAcceptedAt: string | null;
    createdAt: string;
    updatedAt: string;
    educationRecords: Education[];
    workExperiences: WorkExperience[];
  };
};
type PersonnelDocument = {
  id: string;
  documentType: string;
  stage: string;
  status: string;
  pageNumber: number | null;
  totalPages: number | null;
  subjectIndex: number | null;
  stageVersion: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksum?: string | null;
  isCurrent: boolean;
  uploadedAt: string;
  createdAt: string;
};
type DocumentsResponse = {
  employee: {
    id: string;
    fullName: string;
  };
  application: {
    applicationNumber: string;
    documentsStatus: string;
    documentsVersion: number;
    documentsSubmittedAt: string | null;
    documentsApprovedAt: string | null;
    insuranceNumber: string | null;
    bankSinaIban: string | null;
    hasInsuranceHistory: boolean;
  };
  documents: PersonnelDocument[];
  summary: {
    total: number;
    current: number;
    previous: number;
  };
};
function formatDate(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "long",
  }).format(date);
}
function formatDateTime(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامعتبر";
  return new Intl.DateTimeFormat("fa-IR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} بایت`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} کیلوبایت`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} مگابایت`;
}
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ACTIVE: "فعال",
    ON_LEAVE: "در مرخصی",
    SUSPENDED: "معلق",
    TERMINATED: "قطع همکاری",
    APPROVED: "تأیید شده",
    UPLOADED: "بارگذاری شده",
    UNDER_REVIEW: "در حال بررسی",
    PENDING: "در انتظار",
    LOCKED: "قفل شده",
    SUBMITTED: "ارسال شده",
    HR_REVIEW: "در انتظار منابع انسانی",
    EXECUTIVE_REVIEW: "در انتظار مدیریت",
    NEEDS_CORRECTION: "نیازمند اصلاح",
    REJECTED: "رد شده",
  };
  return labels[status] || status || "نامشخص";
}
function documentTypeLabel(type: string) {
  const labels: Record<string, string> = {
    NATIONAL_CARD: "کارت ملی",
    APPLICANT_BIRTH_CERTIFICATE_PAGE: "صفحات شناسنامه متقاضی",
    EDUCATION_CERTIFICATE: "مدرک تحصیلی",
    INSURANCE_HISTORY: "سوابق بیمه",
    MILITARY_SERVICE: "مدرک نظام وظیفه",
    MARRIAGE_CERTIFICATE: "سند ازدواج",
    SPOUSE_BIRTH_CERTIFICATE_PAGE: "شناسنامه همسر",
    CHILD_BIRTH_CERTIFICATE_PAGE: "شناسنامه فرزند",
    PERSONAL_PHOTO: "عکس پرسنلی",
    SPOUSE_CONSENT: "رضایت‌نامه همسر",
  };
  return labels[type] || type;
}
function enumLabel(value: string) {
  const labels: Record<string, string> = {
    MALE: "مرد",
    FEMALE: "زن",
    SINGLE: "مجرد",
    MARRIED: "متأهل",
    DIVORCED: "مطلقه",
    WIDOWED: "همسر فوت‌شده",
    ERP: "کاربر سامانه",
    ADMIN: "مدیر سامانه",
    SUPER_ADMIN: "مدیر ارشد سامانه",
    COMPLETED: "پایان‌یافته",
    EXEMPT: "معاف",
    EXEMPTION: "معاف",
    SERVED: "پایان خدمت",
    IN_PROGRESS: "در حال انجام",
    PENDING: "در انتظار",
    DIPLOMA: "دیپلم",
    ASSOCIATE: "کاردانی",
    BACHELOR: "کارشناسی",
    MASTER: "کارشناسی ارشد",
    DOCTORATE: "دکتری",
    PRIMARY: "ابتدایی",
    SECONDARY: "متوسطه",
  };
  return labels[value] || value;
}
function Field({
  label,
  value,
}: {
  label: string;
  value: unknown;
}) {
  const display =
    value === null || value === undefined || value === ""
      ? "ثبت نشده"
      : typeof value === "boolean"
        ? value
          ? "بله"
          : "خیر"
        : enumLabel(String(value));
  return (
    <div className="rounded-xl border border-slate-200/80 [[data-theme=dark]_&]:border-slate-700/70 bg-slate-50/90 [[data-theme=dark]_&]:bg-slate-800/50 p-4">
      <p className="mb-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">{label}</p>
      <p className="break-words text-sm font-semibold text-slate-900 [[data-theme=dark]_&]:text-slate-100">
        {display}
      </p>
    </div>
  );
}
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 [[data-theme=dark]_&]:border-slate-700/70 bg-white/90 [[data-theme=dark]_&]:bg-slate-900/75 p-5 shadow-lg">
      <h2 className="mb-5 border-b border-slate-200 [[data-theme=dark]_&]:border-slate-700 pb-3 text-base font-bold text-slate-900 [[data-theme=dark]_&]:text-white">
        {title}
      </h2>
      {children}
    </section>
  );
}
function StatusBadge({ status }: { status: string }) {
  const color =
    status === "ACTIVE" || status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-300"
      : status === "TERMINATED" ||
          status === "REJECTED"
        ? "border-red-500/30 bg-red-500/10 text-red-700 [[data-theme=dark]_&]:text-red-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300";
  return (
    <span
      className={`inline-flex rounded-lg border px-3 py-1.5 text-xs font-bold ${color}`}
    >
      {statusLabel(status)}
    </span>
  );
}
function DocumentStatusBadge({ status }: { status: string }) {
  const color =
    status === "APPROVED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 [[data-theme=dark]_&]:text-emerald-300"
      : status === "REJECTED"
        ? "border-red-500/30 bg-red-500/10 text-red-700 [[data-theme=dark]_&]:text-red-300"
        : "border-amber-500/30 bg-amber-500/10 text-amber-700 [[data-theme=dark]_&]:text-amber-300";
  return (
    <span
      className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${color}`}
    >
      {statusLabel(status)}
    </span>
  );
}
function DocumentCard({
  type,
  items,
  employeeId,
}: {
  type: string;
  items: PersonnelDocument[];
  employeeId: string;
}) {
  const sortedItems = [...items].sort(
    (a, b) =>
      Number(b.isCurrent) - Number(a.isCurrent) ||
      b.stageVersion - a.stageVersion ||
      (a.pageNumber ?? 0) - (b.pageNumber ?? 0)
  );
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-100/90 [[data-theme=dark]_&]:bg-slate-800/70 px-4 py-3">
        <h3 className="font-bold text-slate-900 [[data-theme=dark]_&]:text-white">
          {documentTypeLabel(type)}
        </h3>
        <span className="rounded-lg bg-slate-100 [[data-theme=dark]_&]:bg-slate-700 px-3 py-1 text-xs text-slate-700 [[data-theme=dark]_&]:text-slate-300">
          {items.length.toLocaleString("fa-IR")} فایل
        </span>
      </div>
      <div className="divide-y divide-slate-200 [[data-theme=dark]_&]:divide-slate-800">
        {sortedItems.map((document) => (
          <div
            key={document.id}
            className="flex flex-wrap items-center justify-between gap-4 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="break-all text-sm font-semibold text-slate-800 [[data-theme=dark]_&]:text-slate-200">
                {document.fileName}
              </p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                <span>
                  نسخه {document.stageVersion.toLocaleString("fa-IR")}
                </span>
                {document.pageNumber !== null && (
                  <span>
                    صفحه {document.pageNumber.toLocaleString("fa-IR")}
                    {document.totalPages !== null &&
                      ` از ${document.totalPages.toLocaleString("fa-IR")}`}
                  </span>
                )}
                <span>{formatFileSize(document.sizeBytes)}</span>
                <span>{formatDateTime(document.uploadedAt)}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <DocumentStatusBadge status={document.status} />
                {document.isCurrent ? (
                  <span className="rounded-lg bg-blue-500/10 px-2.5 py-1 text-xs text-blue-700 [[data-theme=dark]_&]:text-blue-300">
                    نسخه جاری
                  </span>
                ) : (
                  <span className="rounded-lg bg-slate-100 [[data-theme=dark]_&]:bg-slate-700 px-2.5 py-1 text-xs text-slate-700 [[data-theme=dark]_&]:text-slate-300">
                    نسخه قبلی
                  </span>
                )}
              </div>
            </div>
            <a
              href={`/api/hr/personnel/${encodeURIComponent(employeeId)}/documents/${encodeURIComponent(document.id)}/download`}
              className="shrink-0 rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2.5 text-xs font-bold text-blue-700 [[data-theme=dark]_&]:text-blue-300 transition hover:bg-blue-500/20"
            >
              دانلود فایل
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
function PersonnelDocuments({
  employeeId,
  documents,
  loading,
  error,
  onRetry,
}: {
  employeeId: string;
  documents: DocumentsResponse | null;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  if (loading) {
    return (
      <Section title="مدارک و مستندات استخدامی">
        <div className="py-8 text-center text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
          در حال دریافت مدارک...
        </div>
      </Section>
    );
  }
  if (error) {
    return (
      <Section title="مدارک و مستندات استخدامی">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
          <p className="text-sm text-red-700 [[data-theme=dark]_&]:text-red-300">{error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 rounded-lg bg-slate-100 [[data-theme=dark]_&]:bg-slate-700 px-4 py-2 text-xs font-bold text-white hover:bg-slate-600"
          >
            تلاش مجدد
          </button>
        </div>
      </Section>
    );
  }
  if (!documents) {
    return (
      <Section title="مدارک و مستندات استخدامی">
        <p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
          اطلاعات مدارک در دسترس نیست.
        </p>
      </Section>
    );
  }
  const groups = documents.documents.reduce<
    Record<string, PersonnelDocument[]>
  >((result, document) => {
    if (!result[document.documentType]) {
      result[document.documentType] = [];
    }
    result[document.documentType].push(document);
    return result;
  }, {});
  return (
    <Section title="مدارک و مستندات استخدامی">
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-50/90 [[data-theme=dark]_&]:bg-slate-800/50 p-4">
            <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">کل فایل‌ها</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 [[data-theme=dark]_&]:text-white">
              {documents.summary.total.toLocaleString("fa-IR")}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">نسخه‌های جاری</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700 [[data-theme=dark]_&]:text-emerald-300">
              {documents.summary.current.toLocaleString("fa-IR")}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-50/90 [[data-theme=dark]_&]:bg-slate-800/50 p-4">
            <p className="text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">نسخه‌های قبلی</p>
            <p className="mt-2 text-2xl font-bold text-slate-700 [[data-theme=dark]_&]:text-slate-300">
              {documents.summary.previous.toLocaleString("fa-IR")}
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="وضعیت مدارک مرحله دوم"
            value={statusLabel(documents.application.documentsStatus)}
          />
          <Field
            label="شماره نسخه مدارک"
            value={documents.application.documentsVersion}
          />
          <Field
            label="تاریخ ارسال مدارک"
            value={formatDateTime(
              documents.application.documentsSubmittedAt
            )}
          />
          <Field
            label="تاریخ تأیید مدارک"
            value={formatDateTime(
              documents.application.documentsApprovedAt
            )}
          />
        </div>
        {documents.documents.length === 0 ? (
          <div className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-50/80 [[data-theme=dark]_&]:bg-slate-800/40 p-6 text-center">
            <p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
              هنوز مدرکی در مرحله دوم ثبت نشده است.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groups).map(([type, items]) => (
              <DocumentCard
                key={type}
                type={type}
                items={items}
                employeeId={employeeId}
              />
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
export default function EmployeePersonnelPage() {
  const params = useParams<{ employeeId: string }>();
  const router = useRouter();
  const employeeId = params.employeeId;
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [documents, setDocuments] =
    useState<DocumentsResponse | null>(null);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const loadEmployee = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/hr/personnel/${encodeURIComponent(employeeId)}`,
        {
          credentials: "same-origin",
          cache: "no-store",
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          body.message ||
            body.error ||
            "دریافت اطلاعات پرونده با خطا مواجه شد."
        );
      }
      const result = body.data?.employee;
      if (!result) {
        throw new Error(
          "اطلاعات پرونده در پاسخ سرور وجود ندارد."
        );
      }
      setEmployee(result);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت اطلاعات کارمند."
      );
    } finally {
      setLoading(false);
    }
  }, [employeeId]);
  const loadDocuments = useCallback(async () => {
    if (!employeeId) return;
    setDocumentsLoading(true);
    setDocumentsError("");
    try {
      const response = await fetch(
        `/api/hr/personnel/${encodeURIComponent(employeeId)}/documents`,
        {
          credentials: "same-origin",
          cache: "no-store",
        }
      );
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          body.message ||
            body.error ||
            "دریافت مدارک با خطا مواجه شد."
        );
      }
      if (!body.data) {
        throw new Error(
          "اطلاعات مدارک در پاسخ سرور وجود ندارد."
        );
      }
      setDocuments(body.data);
    } catch (err) {
      setDocumentsError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت مدارک."
      );
    } finally {
      setDocumentsLoading(false);
    }
  }, [employeeId]);
  useEffect(() => {
    void loadEmployee();
    void loadDocuments();
  }, [loadEmployee, loadDocuments]);
  if (loading) {
    return (
      <div
        dir="rtl"
        className="flex min-h-96 items-center justify-center text-slate-700 [[data-theme=dark]_&]:text-slate-300"
      >
        در حال دریافت پرونده پرسنلی...
      </div>
    );
  }
  if (error || !employee) {
    return (
      <div dir="rtl" className="space-y-4 p-6">
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 [[data-theme=dark]_&]:text-red-300">
          {error || "پرونده موردنظر پیدا نشد."}
        </div>
        <button
          onClick={() => router.push("/hr/personnel")}
          className="rounded-xl bg-slate-100 [[data-theme=dark]_&]:bg-slate-700 px-5 py-2.5 text-sm text-slate-900 [[data-theme=dark]_&]:text-white hover:bg-slate-600"
        >
          بازگشت به پرونده‌های پرسنلی
        </button>
      </div>
    );
  }
  const application = employee.candidateApplication;
  return (
    <div
      dir="rtl"
      className="min-h-full space-y-5 p-4 text-slate-900 [[data-theme=dark]_&]:text-slate-100 md:p-6 lg:p-7 print-page"
    >
      <style>{`
        @page {
          size: A4 portrait;
          margin: 12mm;
        }
        @media print {
          html, body {
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden;
          }
          .print-page, .print-page * {
            visibility: visible;
          }
          /* مهم: عنصر اصلی نباید absolute باشد؛ در غیر این صورت صفحه‌بندی چندصفحه‌ای مختل می‌شود. */
          .print-page {
            position: relative !important;
            inset: auto !important;
            display: block !important;
            width: auto !important;
            max-width: none !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
            padding: 0 !important;
            margin: 0 !important;
            color: #111827 !important;
            background: #ffffff !important;
          }
          /* اجازه می‌دهیم بخش‌ها در صورت نیاز بین صفحات ادامه پیدا کنند. */
          .print-page section,
          .print-page section > div,
          .print-page .rounded-2xl,
          .print-page .rounded-xl,
          .print-page .grid,
          .print-page .space-y-3,
          .print-page .space-y-4,
          .print-page .space-y-5 {
            break-inside: auto !important;
            page-break-inside: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            color: #111827 !important;
            border-color: #d1d5db !important;
            box-shadow: none !important;
          }
          .print-page h1, .print-page h2, .print-page h3,
          .print-page p, .print-page span, .print-page div {
            color: #111827 !important;
          }
          .print-page button,
          .print-page a,
          .print-page .print-hidden {
            display: none !important;
          }
          .print-page section {
            margin-bottom: 7mm !important;
          }
          .print-page h2,
          .print-page h3 {
            break-after: avoid-page;
            page-break-after: avoid;
          }
          .print-page p,
          .print-page span {
            orphans: 2;
            widows: 2;
          }
        }
      `}</style>
      {/* HEADER */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="mb-2 text-xs text-slate-500 [[data-theme=dark]_&]:text-slate-400">
            منابع انسانی / پرونده پرسنلی
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900 [[data-theme=dark]_&]:text-white">
            پرونده {application.firstName} {application.lastName}
          </h1>
          <p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
            مشاهده اطلاعات و سوابق پرسنلی کارمند
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-500"
          >
            چاپ پرونده / ذخیره PDF
          </button>
          <button
            onClick={() => router.push("/hr/personnel")}
            className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-white [[data-theme=dark]_&]:bg-slate-800 px-4 py-2.5 text-sm hover:bg-slate-700"
          >
            بازگشت به فهرست
          </button>
          <button
            onClick={() => {
              void loadEmployee();
              void loadDocuments();
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-500"
          >
            بروزرسانی
          </button>
        </div>
      </div>
      {/* PROFILE HEADER */}
      <div className="rounded-2xl border border-slate-200/80 [[data-theme=dark]_&]:border-slate-700/70 bg-gradient-to-l from-white [[data-theme=dark]_&]:from-slate-800 to-slate-100 [[data-theme=dark]_&]:to-slate-900 p-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-extrabold text-slate-900 [[data-theme=dark]_&]:text-white">
              {employee.user.fullName}
            </h2>
            <p className="mt-2 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
              کد پرسنلی: {employee.personnelCode || "تخصیص داده نشده"}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              شماره درخواست: {application.applicationNumber}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={employee.employmentStatus} />
            <StatusBadge
              status={employee.user.isActive ? "ACTIVE" : "SUSPENDED"}
            />
          </div>
        </div>
      </div>
      {/* PERSONNEL INFORMATION */}
      <Section title="اطلاعات پرونده پرسنلی">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="کد پرسنلی" value={employee.personnelCode} />
          <Field
            label="وضعیت همکاری"
            value={statusLabel(employee.employmentStatus)}
          />
          <Field
            label="تاریخ شروع همکاری"
            value={formatDate(employee.hireDate)}
          />
          <Field
            label="تاریخ قطع همکاری"
            value={formatDate(employee.terminationDate)}
          />
          <Field
            label="علت قطع همکاری"
            value={employee.terminationReason}
          />
          <Field
            label="تاریخ ایجاد پرونده"
            value={formatDate(employee.createdAt)}
          />
        </div>
      </Section>
      {/* ACCOUNT */}
      <Section title="اطلاعات حساب کاربری">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="نام کاربری" value={employee.user.username} />
          <Field label="نام کامل" value={employee.user.fullName} />
          <Field label="سطح دسترسی" value={employee.user.accessLevel} />
          <Field
            label="وضعیت حساب"
            value={employee.user.isActive ? "فعال" : "غیرفعال"}
          />
          <Field label="ایمیل حساب" value={employee.user.email} />
          <Field label="تلفن حساب" value={employee.user.phone} />
          <Field
            label="آخرین ورود"
            value={formatDateTime(employee.user.lastLoginAt)}
          />
        </div>
      </Section>
      {/* PERSONAL INFORMATION */}
      <Section title="مشخصات هویتی و فردی">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="نام" value={application.firstName} />
          <Field label="نام خانوادگی" value={application.lastName} />
          <Field label="نام پدر" value={application.fatherName} />
          <Field
            label="شماره شناسنامه"
            value={application.birthCertificateNumber}
          />
          <Field label="کد ملی" value={application.nationalId} />
          <Field label="جنسیت" value={application.gender} />
          <Field label="وضعیت تأهل" value={application.maritalStatus} />
          <Field label="ملیت" value={application.nationality} />
          <Field label="محل تولد" value={application.birthPlace} />
          <Field
            label="تاریخ تولد"
            value={formatDate(application.dateOfBirth)}
          />
          <Field
            label="وضعیت نظام وظیفه"
            value={application.militaryStatus}
          />
          <Field
            label="تعداد فرزندان"
            value={application.childrenCount}
          />
        </div>
      </Section>
      {/* CONTACT */}
      <Section title="اطلاعات تماس و نشانی">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="تلفن همراه" value={application.mobilePhone} />
          <Field label="تلفن ثابت" value={application.landlinePhone} />
          <Field label="ایمیل" value={application.email} />
          <Field label="آدرس" value={application.address} />
        </div>
      </Section>
      {/* EMPLOYMENT INFORMATION */}
      <Section title="اطلاعات استخدام و بیمه">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="در حال حاضر شاغل بوده است"
            value={application.currentlyEmployed}
          />
          <Field
            label="محل اشتغال قبلی"
            value={application.currentEmployer}
          />
          <Field
            label="تعهد به مؤسسه دیگر"
            value={application.hasExternalCommitment}
          />
          <Field
            label="دارای سابقه بیمه"
            value={application.hasInsuranceHistory}
          />
          <Field
            label="شماره بیمه تأمین اجتماعی"
            value={application.insuranceNumber}
          />
          <Field
            label="شماره شبای بانک سینا"
            value={application.bankSinaIban}
          />
          <Field
            label="حداقل مدت همکاری"
            value={application.minimumEmploymentPeriod}
          />
          <Field
            label="حقوق درخواستی"
            value={application.requestedSalary}
          />
        </div>
      </Section>
      {/* EDUCATION */}
      <Section title="سوابق تحصیلی">
        {application.educationRecords.length === 0 ? (
          <p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
            سابقه تحصیلی ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {application.educationRecords.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-50/90 [[data-theme=dark]_&]:bg-slate-800/50 p-4"
              >
                <h3 className="font-bold text-slate-900 [[data-theme=dark]_&]:text-white">
                  {item.degree} - {item.fieldOfStudy}
                </h3>
                <div className="mt-2 grid gap-2 text-sm text-slate-700 [[data-theme=dark]_&]:text-slate-300 sm:grid-cols-2">
                  <p>مرکز آموزشی: {item.institution}</p>
                  <p>شهر: {item.city || "ثبت نشده"}</p>
                  <p>شروع: {formatDate(item.startDate)}</p>
                  <p>
                    پایان:{" "}
                    {item.isCurrentlyStudying
                      ? "در حال تحصیل"
                      : formatDate(item.endDate)}
                  </p>
                  <p>معدل: {item.grade || "ثبت نشده"}</p>
                </div>
                {item.description && (
                  <p className="mt-3 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                    {item.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
      {/* WORK EXPERIENCE */}
      <Section title="سوابق شغلی">
        {application.workExperiences.length === 0 ? (
          <p className="text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
            سابقه شغلی ثبت نشده است.
          </p>
        ) : (
          <div className="space-y-3">
            {application.workExperiences.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 [[data-theme=dark]_&]:border-slate-700 bg-slate-50/90 [[data-theme=dark]_&]:bg-slate-800/50 p-4"
              >
                <h3 className="font-bold text-slate-900 [[data-theme=dark]_&]:text-white">
                  {item.companyName}
                </h3>
                <div className="mt-2 grid gap-2 text-sm text-slate-700 [[data-theme=dark]_&]:text-slate-300 sm:grid-cols-2">
                  <p>سمت: {item.position}</p>
                  <p>
                    حقوق دریافتی: {item.salaryReceived ?? "ثبت نشده"}
                  </p>
                  <p>تاریخ شروع: {formatDate(item.startDate)}</p>
                  <p>تاریخ پایان: {formatDate(item.endDate)}</p>
                </div>
                <p className="mt-3 text-sm text-slate-500 [[data-theme=dark]_&]:text-slate-400">
                  علت ترک کار: {item.leavingReason || "ثبت نشده"}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>
      {/* PERSONNEL DOCUMENTS */}
      <PersonnelDocuments
        employeeId={employeeId}
        documents={documents}
        loading={documentsLoading}
        error={documentsError}
        onRetry={() => void loadDocuments()}
      />
      {/* APPROVAL STATUS */}
      <Section title="وضعیت مراحل ثبت‌نام">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field
            label="وضعیت تأیید مرحله اول"
            value={statusLabel(application.initialStatus)}
          />
          <Field
            label="تاریخ ارسال مرحله اول"
            value={formatDateTime(application.initialSubmittedAt)}
          />
          <Field
            label="تاریخ تأیید مرحله اول"
            value={formatDateTime(application.initialApprovedAt)}
          />
          <Field
            label="وضعیت مدارک مرحله دوم"
            value={statusLabel(application.documentsStatus)}
          />
          <Field
            label="تاریخ ارسال مدارک"
            value={formatDateTime(application.documentsSubmittedAt)}
          />
          <Field
            label="تاریخ تأیید مدارک"
            value={formatDateTime(application.documentsApprovedAt)}
          />
          <Field
            label="تأیید تعهدنامه"
            value={application.declarationAccepted}
          />
          <Field
            label="تاریخ پذیرش تعهدنامه"
            value={formatDateTime(application.declarationAcceptedAt)}
          />
        </div>
      </Section>
      {/* NOTES */}
      <Section title="توضیحات و یادداشت‌ها">
        <p className="whitespace-pre-wrap text-sm leading-8 text-slate-700 [[data-theme=dark]_&]:text-slate-300">
          {application.additionalNotes || "یادداشتی ثبت نشده است."}
        </p>
      </Section>
    </div>
  );
}
