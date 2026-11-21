"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { AlertCircle, BriefcaseBusiness, CheckCircle2, ChevronLeft, ClipboardCheck, FileText, FolderOpen, GraduationCap, HeartPulse, History, IdCard, Loader2, Phone, RefreshCw, Search, ShieldCheck, Sparkles, UserRound, Users, XCircle } from "lucide-react";
type Stage = "INITIAL" | "DOCUMENTS";
type ReviewerType = "HR" | "EXECUTIVE";
type ApplicationSummary = {
  id: string;
  applicationNumber: string;
  firstName: string;
  lastName: string;
  nationalId: string;
  mobilePhone: string;
  gender: string;
  maritalStatus: string;
  initialStatus: string;
  documentsStatus: string;
  initialSubmittedAt: string | null;
  documentsSubmittedAt: string | null;
  createdAt: string;
};
type Approval = {
  reviewerType: ReviewerType;
  decision: string;
  comment: string | null;
  decidedAt: string;
  reviewer: {
    fullName: string;
  };
};
type ApplicationDetail = {
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
  requestedSalary: string | number | null;
  additionalNotes: string | null;
  declarationAccepted: boolean;
  declarationAcceptedAt: string | null;
  declarationTextVersion: string | null;
  initialStatus: string;
  documentsStatus: string;
  initialVersion: number;
  documentsVersion: number;
  user: {
    username: string;
    accessLevel: string;
    isActive: boolean;
  };
  educationRecords: Array<{
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
  }>;
  workExperiences: Array<{
    id: string;
    companyName: string;
    position: string;
    startDate: string;
    endDate: string | null;
    leavingReason: string | null;
    salaryReceived: string | number | null;
  }>;
  skills: Array<{
    id: string;
    specialty: string;
    description: string | null;
  }>;
  references: Array<{
    id: string;
    fullName: string;
    occupation: string;
    workplace: string;
    acquaintanceDuration: string;
    phone: string;
  }>;
  emergencyContact: {
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string;
  } | null;
  sensitiveInfo: {
    hasProlongedIllness: boolean;
    illnessDescription: string | null;
    hasCriminalRecord: boolean;
    convictionDescription: string | null;
  } | null;
  familyMembers: Array<{
    id: string;
    memberType: string;
    firstName: string;
    lastName: string;
    insuranceNumber: string | null;
  }>;
  documents: Array<{
    id: string;
    documentType: string;
    stage: string;
    status: string;
    pageNumber: number | null;
    totalPages: number | null;
    subjectIndex: number | null;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    uploadedAt: string;
    fileUrl: string;
  }>;
};
function statusLabel(status: string) {
  const labels: Record<string, string> = {
    SUBMITTED: "ارسال شده",
    HR_REVIEW: "در انتظار منابع انسانی",
    EXECUTIVE_REVIEW: "در انتظار مدیریت",
    NEEDS_CORRECTION: "نیازمند اصلاح",
    APPROVED: "تأیید شده",
    REJECTED: "رد شده",
    PENDING: "در انتظار ارسال مدارک",
    LOCKED: "قفل شده",
    UPLOADED: "بارگذاری شده",
    UNDER_REVIEW: "در حال بررسی",
  };
  return labels[status] || status;
}
function decisionLabel(decision: string) {
  const labels: Record<string, string> = {
    APPROVED: "تأیید",
    REJECTED: "رد",
    NEEDS_CORRECTION: "درخواست اصلاح",
  };
  return labels[decision] || decision;
}
function documentLabel(type: string) {
  const labels: Record<string, string> = {
    PERSONAL_PHOTO: "عکس پرسنلی",
    SPOUSE_CONSENT: "رضایت‌نامه همسر",
    PARENT_CONSENT: "رضایت‌نامه والدین",
    NATIONAL_CARD: "کارت ملی",
    APPLICANT_BIRTH_CERTIFICATE_PAGE: "صفحه شناسنامه متقاضی",
    EDUCATION_CERTIFICATE: "مدرک تحصیلی",
    INSURANCE_HISTORY: "سوابق بیمه",
    MILITARY_SERVICE: "مدرک نظام وظیفه",
    MARRIAGE_CERTIFICATE: "سند ازدواج",
    SPOUSE_BIRTH_CERTIFICATE_PAGE: "شناسنامه همسر",
    CHILD_BIRTH_CERTIFICATE_PAGE: "شناسنامه فرزند",
    SOCIAL_SECURITY_FORM: "فرم تکمیل‌شده تأمین اجتماعی",
  };
  return labels[type] || type;
}
function formatDate(value: string | null | undefined) {
  if (!value) return "ثبت نشده";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "نامشخص";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", { dateStyle: "medium" }).format(date);
}
function formatBoolean(value: boolean) {
  return value ? "بله" : "خیر";
}


const surface = "rounded-3xl border border-slate-200/80 bg-white/90 shadow-[0_14px_45px_-30px_rgba(15,23,42,.3)] backdrop-blur-xl [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#141c36]/90";
const muted = "text-slate-500 [[data-theme=dark]_&]:text-slate-400";
const field = "w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/10 [[data-theme=dark]_&]:border-white/10 [[data-theme=dark]_&]:bg-[#0d1530] [[data-theme=dark]_&]:text-white";
function DetailField({label,value}:{label:string;value:unknown}) {return <div className="min-w-0 border-b border-slate-100 py-3 [[data-theme=dark]_&]:border-white/5"><p className={`text-xs ${muted}`}>{label}</p><p className="mt-1 break-words text-sm font-semibold">{value === null || value === undefined || value === "" ? "ثبت نشده" : String(value)}</p></div>}
function Block({title,icon:Icon,children}:{title:string;icon:typeof Users;children:ReactNode}) {return <section className={`${surface} p-5 sm:p-6`}><h3 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4 text-base font-extrabold [[data-theme=dark]_&]:border-white/10"><span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-600 [[data-theme=dark]_&]:text-indigo-300"><Icon size={18}/></span>{title}</h3>{children}</section>}
function Fields({items}:{items:Array<[string,unknown]>}) {return <div className="grid gap-x-6 sm:grid-cols-2 xl:grid-cols-3">{items.map(([label,value],i)=><DetailField key={`${label}-${i}`} label={label} value={value}/>)}</div>}
function StatePill({value}:{value:string}) {const tone=value==="APPROVED"?"text-emerald-700 bg-emerald-500/10 border-emerald-500/20 [[data-theme=dark]_&]:text-emerald-300":value==="REJECTED"?"text-rose-700 bg-rose-500/10 border-rose-500/20 [[data-theme=dark]_&]:text-rose-300":"text-amber-700 bg-amber-500/10 border-amber-500/20 [[data-theme=dark]_&]:text-amber-300";return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${tone}`}>{statusLabel(value)}</span>}
export default function RecruitmentReviewPage() {
  const [stage, setStage] = useState<Stage>("INITIAL");
  const [reviewerType, setReviewerType] =
    useState<ReviewerType>("HR");
  const [applications, setApplications] =
    useState<ApplicationSummary[]>([]);
  const [selectedId, setSelectedId] =
    useState<string | null>(null);
  const [detail, setDetail] =
    useState<ApplicationDetail | null>(null);
  const [approvals, setApprovals] =
    useState<Approval[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const apiError = async (response: Response) => {
    const body = await response.json().catch(() => ({}));
    return (
      body.message ||
      body.error ||
      "عملیات انجام نشد."
    );
  };
  const loadApplications = useCallback(async () => {
    setLoading(true);
    setError("");
    setSelectedId(null);
    setDetail(null);
    setApprovals([]);
    const query =
      `/api/hr/recruitment/applications` +
      `?stage=${stage}` +
      `&reviewerType=${reviewerType}`;
    try {
      let response = await fetch(query, {
        credentials: "same-origin",
        cache: "no-store",
      });
      // اگر کاربر فقط مجوز جایگاه دیگر را دارد،**
      // همان جایگاه را به‌صورت خودکار انتخاب می‌کنیم.**
      if (response.status === 403) {
        const alternative: ReviewerType =
          reviewerType === "HR" ? "EXECUTIVE" : "HR";
        const alternativeQuery =
          `/api/hr/recruitment/applications` +
          `?stage=${stage}` +
          `&reviewerType=${alternative}`;
        const alternativeResponse = await fetch(
          alternativeQuery,
          {
            credentials: "same-origin",
            cache: "no-store",
          }
        );
        if (alternativeResponse.ok) {
          response = alternativeResponse;
          setReviewerType(alternative);
        }
      }
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      const body = await response.json();
      setApplications(body.data.applications || []);
    } catch (err) {
      setApplications([]);
      setError(
        err instanceof Error
          ? err.message
          : "خطا در دریافت پرونده‌ها."
      );
    } finally {
      setLoading(false);
    }
  }, [stage, reviewerType]);
  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true);
      setError("");
      setNotice("");
      try {
        const response = await fetch(
          `/api/hr/recruitment/applications/${id}` +
          `?stage=${stage}&reviewerType=${reviewerType}`,
          {
            credentials: "same-origin",
            cache: "no-store",
          }
        );
        if (!response.ok) {
          throw new Error(await apiError(response));
        }
        const body = await response.json();
        setDetail(body.data.application);
        setApprovals(body.data.approvals || []);
        setSelectedId(id);
      } catch (err) {
        setDetail(null);
        setError(
          err instanceof Error
            ? err.message
            : "خطا در دریافت پرونده."
        );
      } finally {
        setDetailLoading(false);
      }
    },
    [stage, reviewerType]
  );
  useEffect(() => {
    void loadApplications();
  }, [loadApplications]);
  const submitDecision = async (
    decision: "APPROVED" | "REJECTED" | "NEEDS_CORRECTION"
  ) => {
    if (!selectedId || saving) return;
    if (
      decision !== "APPROVED" &&
      !comment.trim()
    ) {
      setError(
        "برای رد پرونده یا درخواست اصلاح، توضیحات الزامی است."
      );
      return;
    }
    const confirmation = window.confirm(
      decision === "APPROVED"
        ? "آیا از تأیید این پرونده مطمئن هستید؟"
        : decision === "REJECTED"
          ? "آیا از رد این پرونده مطمئن هستید؟"
          : "آیا درخواست اصلاح برای این پرونده ثبت شود؟"
    );
    if (!confirmation) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/hr/recruitment/applications/${selectedId}/decision`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage,
            reviewerType,
            decision,
            comment: comment.trim(),
          }),
        }
      );
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      const body = await response.json();
      setNotice(
        body.data?.message ||
        "تصمیم با موفقیت ثبت شد."
      );
      setComment("");
      setDetail(null);
      setSelectedId(null);
      await loadApplications();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "ثبت تصمیم با خطا مواجه شد."
      );
    } finally {
      setSaving(false);
    }
  };

  const [filter, setFilter] = useState("");
  const visibleApplications = useMemo(() => applications.filter(a => `${a.firstName} ${a.lastName} ${a.applicationNumber} ${a.nationalId}`.includes(filter.trim())), [applications,filter]);
  return (
    <main dir="rtl" className="mx-auto min-h-full max-w-[1600px] space-y-5 p-3 text-slate-900 sm:p-5 lg:p-7 [[data-theme=dark]_&]:text-slate-100">
      <header className={`${surface} relative overflow-hidden p-6 sm:p-8`}>
        <div className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-indigo-500/10 blur-3xl"/>
        <div className="relative flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4"><div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20"><ClipboardCheck size={28}/></div><div><p className="mb-1 text-xs font-bold text-indigo-600 [[data-theme=dark]_&]:text-indigo-300">منابع انسانی / مدیریت جذب و استخدام</p><h1 className="text-2xl font-black sm:text-3xl">مرکز بررسی پرونده‌های استخدامی</h1><p className={`mt-2 text-sm ${muted}`}>صف بررسی، اطلاعات متقاضی و تصمیم نهایی در یک محیط متمرکز</p></div></div>
          <button type="button" onClick={()=>void loadApplications()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-indigo-500/20 bg-indigo-500/10 px-5 py-3 text-sm font-bold text-indigo-700 hover:bg-indigo-500/20 disabled:opacity-50 [[data-theme=dark]_&]:text-indigo-300"><RefreshCw size={17} className={loading?"animate-spin":""}/>بروزرسانی صف</button>
        </div>
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className={`${surface} p-4 sm:p-5`}><p className={`mb-3 text-xs font-bold ${muted}`}>مرحله بررسی</p><div className="grid grid-cols-2 gap-2">{(["INITIAL","DOCUMENTS"] as Stage[]).map(v=><button key={v} type="button" onClick={()=>setStage(v)} className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${stage===v?"bg-indigo-600 text-white shadow-lg shadow-indigo-500/20":"bg-slate-100 text-slate-600 hover:bg-indigo-500/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-300"}`}>{v==="INITIAL"?"۱. ثبت‌نام اولیه":"۲. مدارک تکمیلی"}</button>)}</div></div>
        <div className={`${surface} p-4 sm:p-5`}><p className={`mb-3 text-xs font-bold ${muted}`}>جایگاه بررسی‌کننده</p><div className="grid grid-cols-2 gap-2">{(["HR","EXECUTIVE"] as ReviewerType[]).map(v=><button key={v} type="button" onClick={()=>setReviewerType(v)} className={`rounded-2xl px-3 py-3 text-sm font-bold transition ${reviewerType===v?"bg-indigo-600 text-white shadow-lg shadow-indigo-500/20":"bg-slate-100 text-slate-600 hover:bg-indigo-500/10 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-300"}`}>{v==="HR"?"منابع انسانی":"مدیرعامل / قائم‌مقام"}</button>)}</div></div>
      </div>
      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-700 [[data-theme=dark]_&]:text-rose-300"><AlertCircle size={19}/>{error}</div>}
      {notice && <div role="status" className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-700 [[data-theme=dark]_&]:text-emerald-300">{notice}</div>}
      <div className="grid items-start gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className={`${surface} overflow-hidden xl:sticky xl:top-5`}>
          <div className="border-b border-slate-100 p-5 [[data-theme=dark]_&]:border-white/10"><div className="flex items-center justify-between"><div><h2 className="flex items-center gap-2 font-extrabold"><Users size={19} className="text-indigo-500"/>صف پرونده‌ها</h2><p className={`mt-1 text-xs ${muted}`}>انتخاب متقاضی برای مشاهده جزئیات</p></div><span className="rounded-full bg-indigo-500/10 px-3 py-1 text-sm font-black text-indigo-600 [[data-theme=dark]_&]:text-indigo-300">{applications.length.toLocaleString("fa-IR")}</span></div><div className="relative mt-4"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="جست‌وجوی نام یا شماره پرونده" className={`${field} pr-10`}/></div></div>
          <div className="max-h-[68vh] space-y-2 overflow-y-auto p-3">{loading?<p className={`p-6 text-center text-sm ${muted}`}>در حال دریافت پرونده‌ها...</p>:visibleApplications.length===0?<p className={`p-6 text-center text-sm ${muted}`}>پرونده‌ای در این صف پیدا نشد.</p>:visibleApplications.map(a=><button type="button" key={a.id} onClick={()=>{setComment("");void loadDetail(a.id)}} className={`w-full rounded-2xl border p-4 text-right transition ${selectedId===a.id?"border-indigo-500/40 bg-indigo-500/10":"border-transparent bg-slate-50 hover:border-indigo-500/20 hover:bg-indigo-500/5 [[data-theme=dark]_&]:bg-white/[0.035]"}`}><div className="flex items-center justify-between gap-2"><p className="font-extrabold">{a.firstName} {a.lastName}</p><ChevronLeft size={16} className="text-indigo-500"/></div><p className={`mt-1 text-xs ${muted}`}>شماره {a.applicationNumber}</p><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`text-xs ${muted}`}>{a.nationalId}</span><StatePill value={stage==="INITIAL"?a.initialStatus:a.documentsStatus}/></div></button>)}</div>
        </aside>
        <div className="min-w-0 space-y-5">
          {detailLoading?<div className={`${surface} flex min-h-72 items-center justify-center gap-3 text-sm`}><Loader2 size={22} className="animate-spin text-indigo-500"/>در حال دریافت اطلاعات پرونده...</div>:!detail?<div className={`${surface} flex min-h-[420px] flex-col items-center justify-center p-10 text-center`}><span className="mb-5 rounded-3xl bg-indigo-500/10 p-6 text-indigo-500"><FolderOpen size={48}/></span><h2 className="text-xl font-black">یک پرونده را انتخاب کنید</h2><p className={`mt-3 max-w-sm text-sm leading-7 ${muted}`}>از فهرست سمت راست، متقاضی موردنظر را انتخاب کنید تا مشخصات، مدارک و تاریخچه بررسی نمایش داده شود.</p></div>:<>
            <section className={`${surface} overflow-hidden`}><div className="bg-gradient-to-l from-indigo-600 to-blue-700 p-6 text-white sm:p-7"><div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-4"><span className="flex size-14 items-center justify-center rounded-2xl bg-white/15"><UserRound size={27}/></span><div><p className="text-xs text-indigo-100">پرونده استخدامی / {detail.applicationNumber}</p><h2 className="mt-1 text-2xl font-black">{detail.firstName} {detail.lastName}</h2></div></div><span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold">{stage==="INITIAL"?"بررسی ثبت‌نام اولیه":"بررسی مدارک تکمیلی"}</span></div></div><div className="grid gap-3 p-5 sm:grid-cols-3"><DetailField label="کد ملی" value={detail.nationalId}/><DetailField label="تلفن همراه" value={detail.mobilePhone}/><DetailField label="وضعیت حساب" value={detail.user.isActive?"فعال":"غیرفعال"}/></div></section>
            <Block title="هویت و اطلاعات تماس" icon={IdCard}><Fields items={[["نام",detail.firstName],["نام خانوادگی",detail.lastName],["نام پدر",detail.fatherName],["شماره شناسنامه",detail.birthCertificateNumber],["کد ملی",detail.nationalId],["جنسیت",detail.gender],["وضعیت تأهل",detail.maritalStatus],["ملیت",detail.nationality],["محل تولد",detail.birthPlace],["تاریخ تولد",formatDate(detail.dateOfBirth)],["تلفن ثابت",detail.landlinePhone],["ایمیل",detail.email],["نظام وظیفه",detail.militaryStatus],["آدرس",detail.address]]}/></Block>
            <Block title="اطلاعات استخدام و حساب کاربری" icon={BriefcaseBusiness}><Fields items={[["نام کاربری",detail.user.username],["سطح دسترسی",detail.user.accessLevel],["در حال حاضر شاغل است؟",formatBoolean(detail.currentlyEmployed)],["محل اشتغال فعلی",detail.currentEmployer],["تعهد به مؤسسه دیگر",formatBoolean(detail.hasExternalCommitment)],["سابقه بیمه",formatBoolean(detail.hasInsuranceHistory)],["حداقل مدت همکاری",detail.minimumEmploymentPeriod],["حقوق درخواستی",detail.requestedSalary],["توضیحات تکمیلی",detail.additionalNotes]]}/></Block>
            <Block title="سوابق تحصیلی" icon={GraduationCap}>{detail.educationRecords.length===0?<Empty/>:<div className="grid gap-3 md:grid-cols-2">{detail.educationRecords.map(e=><div key={e.id} className="rounded-2xl border border-slate-200 p-4 [[data-theme=dark]_&]:border-white/10"><h4 className="font-bold">{e.degree} - {e.fieldOfStudy}</h4><p className={`mt-2 text-sm ${muted}`}>{e.institution} {e.city||""}</p><p className={`mt-2 text-xs ${muted}`}>{formatDate(e.startDate)} تا {e.isCurrentlyStudying?"اکنون":formatDate(e.endDate)}</p><Fields items={[["معدل",e.grade],["توضیحات",e.description]]}/></div>)}</div>}</Block>
            <Block title="سوابق شغلی" icon={History}>{detail.workExperiences.length===0?<Empty/>:<div className="grid gap-3 md:grid-cols-2">{detail.workExperiences.map(e=><div key={e.id} className="rounded-2xl border border-slate-200 p-4 [[data-theme=dark]_&]:border-white/10"><h4 className="font-bold">{e.companyName}</h4><Fields items={[["سمت",e.position],["شروع",formatDate(e.startDate)],["پایان",formatDate(e.endDate)],["علت ترک کار",e.leavingReason],["حقوق دریافتی",e.salaryReceived]]}/></div>)}</div>}</Block>
            <Block title="مهارت‌ها و توانمندی‌ها" icon={Sparkles}>{detail.skills.length===0?<Empty/>:<div className="grid gap-3 md:grid-cols-2">{detail.skills.map(e=><div key={e.id} className="rounded-2xl bg-indigo-500/5 p-4"><h4 className="font-bold">{e.specialty}</h4><p className={`mt-2 text-sm ${muted}`}>{e.description||"بدون توضیحات"}</p></div>)}</div>}</Block>
            <Block title="معرف‌ها و تماس اضطراری" icon={Phone}><div className="grid gap-3 md:grid-cols-2">{detail.references.map(e=><div key={e.id} className="rounded-2xl border border-slate-200 p-4 [[data-theme=dark]_&]:border-white/10"><h4 className="font-bold">{e.fullName}</h4><Fields items={[["شغل",e.occupation],["محل کار",e.workplace],["مدت آشنایی",e.acquaintanceDuration],["تلفن",e.phone]]}/></div>)}</div>{detail.references.length===0&&<Empty/>}<h4 className="mt-5 mb-2 font-bold">فرد تماس اضطراری</h4>{detail.emergencyContact?<Fields items={[["نام",detail.emergencyContact.firstName],["نام خانوادگی",detail.emergencyContact.lastName],["نسبت",detail.emergencyContact.relationship],["تلفن",detail.emergencyContact.phone]]}/>:<Empty/>}</Block>
            <Block title="اعضای خانواده" icon={Users}>{detail.familyMembers.length===0?<Empty/>:<div className="grid gap-3 sm:grid-cols-2">{detail.familyMembers.map(e=><div key={e.id} className="rounded-2xl bg-slate-50 p-4 [[data-theme=dark]_&]:bg-white/5"><p className="font-bold">{e.memberType==="SPOUSE"?"همسر":"فرزند"}: {e.firstName} {e.lastName}</p><p className={`mt-2 text-xs ${muted}`}>شماره بیمه: {e.insuranceNumber||"ثبت نشده"}</p></div>)}</div>}</Block>
            <Block title="سوابق بیماری و محکومیت" icon={HeartPulse}>{detail.sensitiveInfo?<Fields items={[["سابقه بیماری ممتد",formatBoolean(detail.sensitiveInfo.hasProlongedIllness)],["شرح بیماری",detail.sensitiveInfo.illnessDescription],["سابقه محکومیت",formatBoolean(detail.sensitiveInfo.hasCriminalRecord)],["شرح محکومیت",detail.sensitiveInfo.convictionDescription]]}/>:<Empty/>}</Block>
            <Block title="مدارک بارگذاری‌شده" icon={FileText}>{detail.documents.length===0?<Empty/>:<div className="grid gap-4 lg:grid-cols-2">{detail.documents.map(d=><article key={d.id} className="overflow-hidden rounded-2xl border border-slate-200 [[data-theme=dark]_&]:border-white/10"><div className="flex items-start justify-between gap-2 p-4"><div className="min-w-0"><p className="font-bold">{documentLabel(d.documentType)}</p><p className={`mt-1 break-all text-xs ${muted}`}>{d.fileName}</p></div><StatePill value={d.status}/></div><div className="flex min-h-32 items-center justify-center bg-slate-100 p-2 [[data-theme=dark]_&]:bg-[#0b1228]">{d.mimeType.startsWith("image/")?<a href={d.fileUrl} target="_blank" rel="noreferrer" className="w-full"><img src={d.fileUrl} alt={documentLabel(d.documentType)} className="max-h-72 w-full object-contain"/></a>:d.mimeType==="application/pdf"?<iframe title={d.fileName} src={d.fileUrl} className="h-72 w-full rounded"/>:<a href={d.fileUrl} target="_blank" rel="noreferrer" className="font-bold text-indigo-600">مشاهده فایل</a>}</div><p className={`p-3 text-xs ${muted}`}>{d.pageNumber?`صفحه ${d.pageNumber}`:"فایل"} · {(d.sizeBytes/1024).toFixed(0)} KB · {formatDate(d.uploadedAt)}</p></article>)}</div>}</Block>
            <Block title="تاریخچه بررسی و تأییدیه‌ها" icon={History}>{approvals.length===0?<Empty/>:<div className="space-y-3">{approvals.map((a,i)=><div key={`${a.reviewerType}-${i}`} className="rounded-2xl border border-slate-200 p-4 [[data-theme=dark]_&]:border-white/10"><div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-bold">{a.reviewerType==="HR"?"منابع انسانی":"مدیرعامل / قائم‌مقام"}</h4><StatePill value={a.decision}/></div><p className={`mt-2 text-sm ${muted}`}>بررسی‌کننده: {a.reviewer.fullName}</p>{a.comment&&<p className="mt-2 text-sm">{a.comment}</p>}<p className={`mt-2 text-xs ${muted}`}>{formatDate(a.decidedAt)}</p></div>)}</div>}</Block>
            <Block title="تعهدنامه متقاضی" icon={ShieldCheck}><Fields items={[["پذیرش تعهدنامه",formatBoolean(detail.declarationAccepted)],["نسخه تعهدنامه",detail.declarationTextVersion],["زمان پذیرش",formatDate(detail.declarationAcceptedAt)]]}/></Block>
            <section className={`${surface} border-indigo-500/20 p-5 sm:p-6`}><h3 className="flex items-center gap-2 text-lg font-black"><ClipboardCheck size={22} className="text-indigo-500"/>ثبت تصمیم بررسی</h3><p className={`mt-2 text-sm ${muted}`}>برای رد پرونده یا درخواست اصلاح، ثبت توضیحات الزامی است.</p><textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={2000} rows={4} placeholder="توضیحات بررسی را وارد کنید..." className={`${field} mt-4 resize-y`}/><p className={`mt-1 text-left text-xs ${muted}`}>{comment.length.toLocaleString("fa-IR")} / ۲۰۰۰</p><div className="mt-5 grid gap-3 sm:grid-cols-3"><button type="button" disabled={saving} onClick={()=>void submitDecision("APPROVED")} className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"><CheckCircle2 size={18}/>{saving?"در حال ثبت...":"تأیید پرونده"}</button><button type="button" disabled={saving} onClick={()=>void submitDecision("NEEDS_CORRECTION")} className="flex items-center justify-center gap-2 rounded-2xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50"><AlertCircle size={18}/>درخواست اصلاح</button><button type="button" disabled={saving} onClick={()=>void submitDecision("REJECTED")} className="flex items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-500 disabled:opacity-50"><XCircle size={18}/>رد پرونده</button></div></section>
          </>}
        </div>
      </div>
    </main>
  );
}
function Empty(){return <p className="rounded-2xl bg-slate-50 p-5 text-sm text-slate-500 [[data-theme=dark]_&]:bg-white/5 [[data-theme=dark]_&]:text-slate-400">اطلاعاتی ثبت نشده است.</p>}
