
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DocumentsStepForm from "./documents-step-form";
import {
  UserRound,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  LogOut,
  RefreshCw,
  ShieldCheck,
  LockKeyhole,
} from "lucide-react";

type Approval = {
  id: string;
  stage: "INITIAL" | "DOCUMENTS";
  reviewerType: "HR" | "EXECUTIVE";
  decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION";
  comment: string | null;
  applicationVersion: number;
  decidedAt: string;
  reviewer: {
    fullName: string;
  };
};

type Application = {
  id: string;
  applicationNumber: string;
  initialStatus: string;
  initialVersion: number;
  documentsStatus: string;
  documentsVersion: number;
  createdAt: string;
  updatedAt: string;
  approvals: Approval[];
  documents: {
    id: string;
    documentType: string;
    status: string;
    fileName: string;
  }[];
};

type Workflow = {
  initial: {
    status: string;
    version: number;
    approvals: Approval[];
  };
  documents: {
    status: string;
    version: number;
    approvals: Approval[];
  };
};

type CandidateData = {
  user: {
    id: string;
    username: string;
    fullName: string;
  };
  application: Application;
  workflow: Workflow;
};

function getDecision(approval?: Approval) {
  if (!approval) {
    return {
      label: "در انتظار بررسی",
      color: "bg-slate-100 text-slate-600",
      icon: Clock,
    };
  }

  switch (approval.decision) {
    case "APPROVED":
      return {
        label: "تأیید شده",
        color: "bg-emerald-50 text-emerald-700",
        icon: CheckCircle2,
      };

    case "NEEDS_CORRECTION":
      return {
        label: "نیازمند اصلاح",
        color: "bg-amber-50 text-amber-700",
        icon: AlertCircle,
      };

    case "REJECTED":
      return {
        label: "رد شده",
        color: "bg-red-50 text-red-700",
        icon: AlertCircle,
      };
  }
}

function ReviewerCard({
  title,
  description,
  approval,
  waiting,
}: {
  title: string;
  description: string;
  approval?: Approval;
  waiting: boolean;
}) {
  const status = getDecision(approval);
  const Icon = status.icon;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-800">
            {title}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {description}
          </p>
        </div>

        <Icon size={23} className="shrink-0 text-indigo-600" />
      </div>

      <div className="mt-4">
        <span
          className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${status.color}`}
        >
          {waiting && !approval
            ? "هنوز نوبت بررسی نرسیده"
            : status.label}
        </span>
      </div>

      {approval && (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div className="text-sm">
            <span className="text-slate-400">
              بررسی‌کننده:
            </span>
            <span className="mr-2 font-semibold text-slate-700">
              {approval.reviewer.fullName}
            </span>
          </div>

          <div className="text-sm text-slate-500">
            زمان تصمیم:{" "}
            {new Date(approval.decidedAt).toLocaleString("fa-IR")}
          </div>

          {approval.comment && (
            <div className="rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700">
              <strong>توضیحات بررسی‌کننده:</strong>
              <p className="mt-1">{approval.comment}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function CandidatePortalPage() {
  const router = useRouter();

  const [data, setData] = useState<CandidateData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/recruitment/candidate-me",
        {
          credentials: "include",
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        router.replace("/");
        return;
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || "دریافت اطلاعات پرونده ناموفق بود."
        );
      }

      setData(result.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت اطلاعات"
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function logout() {
    try {
      setLoggingOut(true);

      const response = await fetch(
        "/api/recruitment/candidate-logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("خروج انجام نشد.");
      }

      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "خطا در خروج"
      );
      setLoggingOut(false);
    }
  }

  if (loading) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50"
      >
        <RefreshCw className="animate-spin text-indigo-600" />
        <span className="mr-3 text-slate-600">
          در حال دریافت پرونده...
        </span>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main
        dir="rtl"
        className="flex min-h-screen items-center justify-center bg-slate-50 p-5"
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-7 text-center shadow">
          <AlertCircle className="mx-auto mb-4 text-amber-600" size={35} />
          <h2 className="font-bold">دریافت اطلاعات ناموفق بود</h2>
          <p className="mt-3 text-sm text-slate-500">{error}</p>
          <button
            onClick={() => void loadData()}
            className="mt-5 rounded-xl bg-slate-900 px-5 py-3 text-white"
          >
            تلاش مجدد
          </button>
        </div>
      </main>
    );
  }

  const { application, workflow } = data;

  const initialHR = workflow.initial.approvals.find(
    (item) => item.reviewerType === "HR"
  );

  const initialExecutive = workflow.initial.approvals.find(
    (item) => item.reviewerType === "EXECUTIVE"
  );

  const hrApproved = initialHR?.decision === "APPROVED";

  const executiveWaiting =
    workflow.initial.status === "EXECUTIVE_REVIEW" ||
    workflow.initial.status === "APPROVED" ||
    Boolean(initialExecutive);

  const initialApproved =
    workflow.initial.status === "APPROVED";

  return (
    <main
      dir="rtl"
      className="min-h-screen bg-slate-50 text-slate-800"
    >
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="text-indigo-600" size={27} />
            <div>
              <h1 className="text-lg font-black">
                پنل متقاضی استخدام سهند
              </h1>
              <p className="text-xs text-slate-400">
                پیگیری پرونده استخدامی
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            disabled={loggingOut}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm hover:bg-slate-50"
          >
            <LogOut size={17} />
            {loggingOut ? "در حال خروج..." : "خروج"}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-7 px-5 py-8">
        <section className="rounded-2xl bg-gradient-to-l from-slate-900 to-indigo-950 p-6 text-white shadow-lg">
          <p className="text-sm text-slate-300">خوش آمدید</p>

          <h2 className="mt-2 text-2xl font-black">
            {data.user.fullName}
          </h2>

          <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-300">
            <span>
              شماره پرونده: {application.applicationNumber}
            </span>
            <span>
              نام کاربری: {data.user.username}
            </span>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold">
              روند تأیید پرونده
            </h2>

            <button
              onClick={() => void loadData()}
              className="flex items-center gap-2 text-sm text-indigo-700"
            >
              <RefreshCw size={16} />
              بروزرسانی
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <ReviewerCard
              title="تأیید منابع انسانی"
              description="بررسی اطلاعات شخصی، سوابق شغلی و تحصیلی"
              approval={initialHR}
              waiting={false}
            />

            <ReviewerCard
              title="تأیید مدیرعامل / قائم‌مقام"
              description="بررسی نهایی و تأیید مرحله اول استخدام"
              approval={initialExecutive}
              waiting={!executiveWaiting}
            />
          </div>
        </section>

        <section>
          <h2 className="mb-4 text-lg font-bold">
            مراحل استخدام
          </h2>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                <FileText className="text-indigo-600" />
                <h3 className="font-bold">مرحله اول: اطلاعات اولیه</h3>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                وضعیت: {application.initialStatus}
              </p>

              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                {initialApproved
                  ? "مرحله اول با موفقیت تأیید شده است."
                  : "پرونده در فرایند بررسی و تأیید قرار دارد."}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-3">
                {initialApproved ? (
                  <FileText className="text-indigo-600" />
                ) : (
                  <LockKeyhole className="text-slate-400" />
                )}

                <h3 className="font-bold">مرحله دوم: مدارک استخدامی</h3>
              </div>

              <p className="mt-3 text-sm text-slate-500">
                وضعیت: {application.documentsStatus}
              </p>

              <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
                {initialApproved
                  ? "مرحله اول تأیید شده است؛ وضعیت دسترسی مرحله دوم را بررسی کنید."
                  : "پس از تأیید هر دو مرجع، امکان تکمیل مدارک فراهم می‌شود."}
              </div>
            </div>
          </div>
        </section>

        <DocumentsStepForm enabled={initialApproved} />

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-3">
            <UserRound className="text-indigo-600" />
            <h2 className="font-bold">مدارک بارگذاری‌شده</h2>
          </div>

          {application.documents.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              مدرکی ثبت نشده است.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {application.documents.map((document) => (
                <div
                  key={document.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 p-4"
                >
                  <div>
                    <p className="text-sm font-semibold">
                      {document.documentType}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {document.fileName}
                    </p>
                  </div>

                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
                    {document.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-400">
          آخرین بروزرسانی:{" "}
          {new Date(application.updatedAt).toLocaleString("fa-IR")}
        </p>
      </div>
    </main>
  );
}
