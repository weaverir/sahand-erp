"use client";



import { useCallback, useEffect, useState } from "react";



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

  };



  return labels[type] || type;

}



function formatDate(value: string | null | undefined) {

  if (!value) return "ثبت نشده";



  return new Intl.DateTimeFormat("fa-IR", {

    dateStyle: "medium",

  }).format(new Date(value));

}



function formatBoolean(value: boolean) {

  return value ? "بله" : "خیر";

}



function Info({

  label,

  value,

}: {

  label: string;

  value: unknown;

}) {

  return (

    <div className="rounded-xl border border-slate-700/70 bg-slate-800/65 p-4 transition-colors hover:border-slate-600">

      <div className="mb-1.5 text-xs font-medium text-slate-400">

        {label}

      </div>

      <div className="break-words text-sm font-medium text-slate-100">

        {value === null || value === undefined || value === ""

          ? "ثبت نشده"

          : String(value)}

      </div>

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

    <section className="mb-5 rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-lg shadow-black/10">

      <h3 className="mb-4 flex items-center gap-2 border-b border-slate-700/70 pb-3 text-base font-bold text-slate-100">

        {title}

      </h3>

      {children}

    </section>

  );

}



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



      // اگر کاربر فقط مجوز جایگاه دیگر را دارد،*

      // همان جایگاه را به‌صورت خودکار انتخاب می‌کنیم.*

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



  return (

    <div dir="rtl" className="min-h-full space-y-5 p-4 text-slate-100 md:p-6 lg:p-7">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">

            بررسی پرونده‌های استخدامی

          </h1>

          <p className="mt-2 text-sm leading-7 text-slate-400">

            مدیریت بررسی و تأیید دو مرحله‌ای متقاضیان

          </p>

        </div>



        <button

          type="button"

          onClick={() => void loadApplications()}

          disabled={loading}

          className="rounded-lg border border-slate-700/70 bg-slate-900/80 px-4 py-2 text-sm hover:bg-slate-800/70 disabled:opacity-50"

        >

          {loading ? "در حال دریافت..." : "بروزرسانی"}

        </button>

      </div>



      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10">
          <p className="text-xs font-medium text-slate-400">پرونده‌های موجود در صف انتخاب‌شده</p>
          <p className="mt-2 text-2xl font-extrabold tabular-nums text-white">{applications.length}</p>
        </div>
        <div className="rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4">
          <p className="text-xs font-medium text-blue-200/80">مرحله فعال</p>
          <p className="mt-2 text-lg font-bold text-blue-100">{stage === "INITIAL" ? "ثبت‌نام اولیه" : "مدارک تکمیلی"}</p>
        </div>
        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/65 p-4 shadow-lg shadow-black/10">
          <p className="text-xs font-medium text-slate-400">جایگاه بررسی</p>
          <p className="mt-2 text-lg font-bold text-white">{reviewerType === "HR" ? "منابع انسانی" : "مدیرعامل / قائم‌مقام"}</p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">

        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">

          <div className="mb-3 text-sm font-bold text-slate-200">

            مرحله بررسی

          </div>



          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              onClick={() => setStage("INITIAL")}

              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${

                stage === "INITIAL"

                  ? "bg-blue-600 text-white"

                  : "border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"

              }`}

            >

              ثبت‌نام اولیه

            </button>



            <button

              type="button"

              onClick={() => setStage("DOCUMENTS")}

              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${

                stage === "DOCUMENTS"

                  ? "bg-blue-600 text-white"

                  : "border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"

              }`}

            >

              مدارک تکمیلی

            </button>

          </div>

        </div>



        <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">

          <div className="mb-3 text-sm font-bold text-slate-200">

            جایگاه بررسی

          </div>



          <div className="flex flex-wrap gap-2">

            <button

              type="button"

              onClick={() => setReviewerType("HR")}

              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${

                reviewerType === "HR"

                  ? "bg-blue-600 text-white"

                  : "border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"

              }`}

            >

              منابع انسانی

            </button>



            <button

              type="button"

              onClick={() => setReviewerType("EXECUTIVE")}

              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${

                reviewerType === "EXECUTIVE"

                  ? "bg-blue-600 text-white"

                  : "border border-slate-700/70 bg-slate-800/70 text-slate-300 hover:border-slate-500 hover:bg-slate-800"

              }`}

            >

              مدیرعامل / قائم‌مقام

            </button>

          </div>

        </div>

      </div>



      {error && (

        <div

          role="alert"

          className="rounded-lg border border-slate-700/70 border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"

        >

          {error}

        </div>

      )}



      {notice && (

        <div

          role="status"

          className="rounded-lg border border-slate-700/70 border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"

        >

          {notice}

        </div>

      )}



      <div className="grid items-start gap-5 2xl:grid-cols-[350px_minmax(0,1fr)]">

        <aside className="overflow-hidden rounded-2xl border border-slate-700/70 bg-slate-900/75 shadow-xl shadow-black/15 backdrop-blur-xl">

          <div className="flex items-center justify-between border-b border-slate-700/70 bg-slate-800/60 p-4">

            <h2 className="font-bold text-slate-100">

              پرونده‌های در انتظار

            </h2>



            <span className="rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5 text-xs font-bold tabular-nums text-blue-200">

              {applications.length}

            </span>

          </div>



          {loading ? (

            <p className="p-6 text-center text-sm leading-7 text-slate-400">

              در حال دریافت پرونده‌ها...

            </p>

          ) : applications.length === 0 ? (

            <p className="p-6 text-center text-sm leading-7 text-slate-400">

              پرونده‌ای در صف بررسی شما وجود ندارد.

            </p>

          ) : (

            <div className="divide-y divide-slate-800">

              {applications.map((item) => (

                <button

                  type="button"

                  key={item.id}

                  onClick={() => void loadDetail(item.id)}

                  className={`block w-full p-4 text-right hover:bg-slate-800/70 ${

                    selectedId === item.id

                      ? "bg-blue-500/10"

                      : ""

                  }`}

                >

                  <div className="font-bold text-slate-100">

                    {item.firstName} {item.lastName}

                  </div>



                  <div className="mt-1.5 text-xs text-slate-400">

                    {item.applicationNumber}

                  </div>



                  <div className="mt-2 flex flex-wrap gap-2 text-xs">

                    <span className="rounded-lg border border-slate-700/70 bg-slate-800 px-2.5 py-1.5 text-slate-300">

                      {item.nationalId}

                    </span>



                    <span className="rounded-lg border border-blue-400/20 bg-blue-500/10 px-2.5 py-1.5 font-semibold text-blue-200">

                      {statusLabel(

                        stage === "INITIAL"

                          ? item.initialStatus

                          : item.documentsStatus

                      )}

                    </span>

                  </div>

                </button>

              ))}

            </div>

          )}

        </aside>



        <main className="min-w-0">

          {detailLoading ? (

            <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-10 text-center text-slate-300">

              در حال دریافت جزئیات پرونده...

            </div>

          ) : !detail ? (

            <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/55 p-14 text-center text-sm leading-7 text-slate-400">

              برای مشاهده مشخصات، یک پرونده را انتخاب کن.

            </div>

          ) : (

            <div className="space-y-4">

              <div className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">

                <div className="flex flex-wrap items-center justify-between gap-3">

                  <div>

                    <h2 className="text-xl font-extrabold text-white md:text-2xl">

                      {detail.firstName} {detail.lastName}

                    </h2>

                    <p className="mt-1.5 text-xs text-slate-400">

                      شماره پرونده: {detail.applicationNumber}

                    </p>

                  </div>



                  <span className="rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-200">

                    {stage === "INITIAL"

                      ? "بررسی ثبت‌نام اولیه"

                      : "بررسی مدارک تکمیلی"}

                  </span>

                </div>

              </div>



              <Section title="اطلاعات حساب کاربری">

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  <Info

                    label="نام کاربری"

                    value={detail.user.username}

                  />

                  <Info

                    label="سطح دسترسی"

                    value={detail.user.accessLevel}

                  />

                  <Info

                    label="وضعیت حساب"

                    value={

                      detail.user.isActive

                        ? "فعال"

                        : "غیرفعال"

                    }

                  />

                </div>

              </Section>



              <Section title="مشخصات فردی">

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  <Info label="نام" value={detail.firstName} />

                  <Info label="نام خانوادگی" value={detail.lastName} />

                  <Info label="نام پدر" value={detail.fatherName} />

                  <Info label="شماره شناسنامه" value={detail.birthCertificateNumber} />

                  <Info label="کد ملی" value={detail.nationalId} />

                  <Info label="جنسیت" value={detail.gender} />

                  <Info label="وضعیت تأهل" value={detail.maritalStatus} />

                  <Info label="ملیت" value={detail.nationality} />

                  <Info label="محل تولد" value={detail.birthPlace} />

                  <Info label="تاریخ تولد" value={formatDate(detail.dateOfBirth)} />

                  <Info label="تلفن همراه" value={detail.mobilePhone} />

                  <Info label="تلفن ثابت" value={detail.landlinePhone} />

                  <Info label="ایمیل" value={detail.email} />

                  <Info label="نظام وظیفه" value={detail.militaryStatus} />

                  <Info label="آدرس" value={detail.address} />

                </div>

              </Section>



              <Section title="اطلاعات شغلی و استخدامی">

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  <Info

                    label="در حال حاضر شاغل است؟"

                    value={formatBoolean(detail.currentlyEmployed)}

                  />

                  <Info

                    label="محل اشتغال فعلی"

                    value={detail.currentEmployer}

                  />

                  <Info

                    label="تعهد به مؤسسه دیگر"

                    value={formatBoolean(detail.hasExternalCommitment)}

                  />

                  <Info

                    label="سابقه بیمه"

                    value={formatBoolean(detail.hasInsuranceHistory)}

                  />

                  <Info

                    label="حداقل مدت همکاری"

                    value={detail.minimumEmploymentPeriod}

                  />

                  <Info

                    label="حقوق درخواستی"

                    value={detail.requestedSalary}

                  />

                </div>

              </Section>



              <Section title="سوابق تحصیلی">

                {detail.educationRecords.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    سابقه تحصیلی ثبت نشده است.

                  </p>

                ) : (

                  <div className="space-y-3">

                    {detail.educationRecords.map((item) => (

                      <div

                        key={item.id}

                        className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4"

                      >

                        <div className="font-bold text-slate-100">

                          {item.degree} - {item.fieldOfStudy}

                        </div>

                        <p className="mt-1 text-sm text-slate-300">

                          {item.institution}

                        </p>

                        <p className="mt-1.5 text-xs text-slate-400">

                          {formatDate(item.startDate)} تا{" "}

                          {item.isCurrentlyStudying

                            ? "اکنون"

                            : formatDate(item.endDate)}

                        </p>

                        <p className="mt-1 text-sm">

                          معدل: {item.grade || "ثبت نشده"}

                        </p>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="سوابق شغلی">

                {detail.workExperiences.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    سابقه شغلی ثبت نشده است.

                  </p>

                ) : (

                  <div className="space-y-3">

                    {detail.workExperiences.map((item) => (

                      <div

                        key={item.id}

                        className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4"

                      >

                        <div className="font-bold text-slate-100">

                          {item.companyName}

                        </div>

                        <p className="mt-1 text-sm">

                          سمت: {item.position}

                        </p>

                        <p className="mt-1.5 text-xs text-slate-400">

                          {formatDate(item.startDate)} تا{" "}

                          {formatDate(item.endDate)}

                        </p>

                        <p className="mt-1 text-sm">

                          علت قطع همکاری: {item.leavingReason || "ثبت نشده"}

                        </p>

                        <p className="mt-1 text-sm">

                          حقوق دریافتی: {item.salaryReceived || "ثبت نشده"}

                        </p>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="مهارت‌ها">

                {detail.skills.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    مهارتی ثبت نشده است.

                  </p>

                ) : (

                  <div className="grid gap-3 sm:grid-cols-2">

                    {detail.skills.map((item) => (

                      <div

                        key={item.id}

                        className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4"

                      >

                        <div className="font-bold text-slate-100">

                          {item.specialty}

                        </div>

                        <p className="mt-1 text-sm text-slate-300">

                          {item.description || "بدون توضیحات"}

                        </p>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="معرف‌ها">

                <div className="grid gap-4 xl:grid-cols-2">

                  {detail.references.map((item) => (

                    <div

                      key={item.id}

                      className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4"

                    >

                      <div className="font-bold text-slate-100">

                        {item.fullName}

                      </div>

                      <p className="mt-1 text-sm">

                        {item.occupation} - {item.workplace}

                      </p>

                      <p className="mt-1 text-sm">

                        مدت آشنایی: {item.acquaintanceDuration}

                      </p>

                      <p className="mt-1 text-sm">

                        تلفن: {item.phone}

                      </p>

                    </div>

                  ))}

                </div>

              </Section>



              <Section title="فرد تماس اضطراری">

                {detail.emergencyContact ? (

                  <div className="grid gap-3 sm:grid-cols-2">

                    <Info

                      label="نام"

                      value={detail.emergencyContact.firstName}

                    />

                    <Info

                      label="نام خانوادگی"

                      value={detail.emergencyContact.lastName}

                    />

                    <Info

                      label="نسبت"

                      value={detail.emergencyContact.relationship}

                    />

                    <Info

                      label="شماره تماس"

                      value={detail.emergencyContact.phone}

                    />

                  </div>

                ) : (

                  <p className="text-sm text-slate-400">

                    اطلاعات ثبت نشده است.

                  </p>

                )}

              </Section>



              <Section title="سوابق بیماری و محکومیت">

                {detail.sensitiveInfo ? (

                  <div className="grid gap-3 sm:grid-cols-2">

                    <Info

                      label="سابقه بیماری ممتد"

                      value={formatBoolean(

                        detail.sensitiveInfo.hasProlongedIllness

                      )}

                    />

                    <Info

                      label="شرح بیماری"

                      value={detail.sensitiveInfo.illnessDescription}

                    />

                    <Info

                      label="سابقه محکومیت"

                      value={formatBoolean(

                        detail.sensitiveInfo.hasCriminalRecord

                      )}

                    />

                    <Info

                      label="شرح محکومیت"

                      value={detail.sensitiveInfo.convictionDescription}

                    />

                  </div>

                ) : (

                  <p className="text-sm text-slate-400">

                    اطلاعات ثبت نشده است.

                  </p>

                )}

              </Section>



              <Section title="اعضای خانواده">

                {detail.familyMembers.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    اطلاعات اعضای خانواده ثبت نشده است.

                  </p>

                ) : (

                  <div className="space-y-2">

                    {detail.familyMembers.map((item) => (

                      <div

                        key={item.id}

                        className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4 text-sm text-slate-200"

                      >

                        {item.memberType === "SPOUSE"

                          ? "همسر"

                          : "فرزند"}:{" "}

                        {item.firstName} {item.lastName}

                        <span className="mr-3 text-slate-400">

                          بیمه: {item.insuranceNumber || "ثبت نشده"}

                        </span>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="مدارک بارگذاری‌شده">

                {detail.documents.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    مدرکی در این مرحله بارگذاری نشده است.

                  </p>

                ) : (

                  <div className="grid gap-4 md:grid-cols-2">

                    {detail.documents.map((document) => (

                      <div

                        key={document.id}

                        className="overflow-hidden rounded-xl border border-slate-700/70 bg-slate-800/45"

                      >

                        <div className="flex items-center justify-between gap-2 border-b border-slate-700/70 bg-slate-800/70 p-4">

                          <div className="min-w-0">

                            <div className="font-bold text-sm">

                              {documentLabel(document.documentType)}

                            </div>

                            <div className="mt-1.5 text-xs text-slate-400">

                              {document.fileName}

                            </div>

                          </div>



                          <span className="shrink-0 rounded bg-slate-800 px-2 py-1 text-xs">

                            {statusLabel(document.status)}

                          </span>

                        </div>



                        <div className="bg-slate-800/70 p-2">

                          {document.mimeType.startsWith("image/") ? (

                            <a

                              href={document.fileUrl}

                              target="_blank"

                              rel="noreferrer"

                            >

                              <img

                                src={document.fileUrl}

                                alt={documentLabel(document.documentType)}

                                className="max-h-72 w-full rounded object-contain"

                              />

                            </a>

                          ) : document.mimeType === "application/pdf" ? (

                            <iframe

                              src={document.fileUrl}

                              title={document.fileName}

                              className="h-80 w-full rounded bg-slate-900/80"

                            />

                          ) : (

                            <a

                              href={document.fileUrl}

                              target="_blank"

                              rel="noreferrer"

                              className="text-sm text-blue-300 underline"

                            >

                              مشاهده فایل

                            </a>

                          )}

                        </div>



                        <div className="border-t border-slate-700/70 p-3 text-xs text-slate-400">

                          {document.pageNumber

                            ? `صفحه ${document.pageNumber}`

                            : "فایل"}

                          {" · "}

                          {(document.sizeBytes / 1024).toFixed(0)} KB

                          {" · "}

                          {formatDate(document.uploadedAt)}

                        </div>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="تأییدیه‌ها و تاریخچه بررسی">

                {approvals.length === 0 ? (

                  <p className="text-sm text-slate-400">

                    هنوز تصمیمی ثبت نشده است.

                  </p>

                ) : (

                  <div className="space-y-3">

                    {approvals.map((item, index) => (

                      <div

                        key={`${item.reviewerType}-${index}`}

                        className="rounded-xl border border-slate-700/70 bg-slate-800/55 p-4"

                      >

                        <div className="flex flex-wrap justify-between gap-2">

                          <strong className="text-sm">

                            {item.reviewerType === "HR"

                              ? "منابع انسانی"

                              : "مدیرعامل / قائم‌مقام"}

                          </strong>



                          <span className="text-xs">

                            {decisionLabel(item.decision)}

                          </span>

                        </div>



                        <p className="mt-2 text-sm">

                          بررسی‌کننده: {item.reviewer.fullName}

                        </p>



                        {item.comment && (

                          <p className="mt-2 text-sm text-slate-300">

                            توضیحات: {item.comment}

                          </p>

                        )}



                        <p className="mt-2 text-xs text-slate-500">

                          {formatDate(item.decidedAt)}

                        </p>

                      </div>

                    ))}

                  </div>

                )}

              </Section>



              <Section title="تعهدنامه متقاضی">

                <div className="space-y-2 text-sm">

                  <Info

                    label="تأیید تعهدنامه"

                    value={formatBoolean(detail.declarationAccepted)}

                  />

                  <Info

                    label="نسخه تعهدنامه"

                    value={detail.declarationTextVersion}

                  />

                  <Info

                    label="زمان پذیرش"

                    value={formatDate(detail.declarationAcceptedAt)}

                  />

                </div>

              </Section>



              <section className="rounded-2xl border border-slate-700/70 bg-slate-900/75 p-5 shadow-xl shadow-black/10 backdrop-blur-xl">

                <h3 className="mb-3 font-bold">

                  ثبت تصمیم بررسی

                </h3>



                <label className="mb-2 block text-sm font-medium">

                  توضیحات بررسی

                </label>



                <textarea

                  value={comment}

                  onChange={(event) =>

                    setComment(event.target.value)

                  }

                  maxLength={2000}

                  rows={4}

                  placeholder="در صورت رد یا درخواست اصلاح، دلیل را بنویسید..."

                  className="w-full rounded-lg border border-slate-700/70 p-3 text-sm outline-none focus:border-b border-slate-700/70lue-400"

                />



                <div className="mt-2 text-left text-xs text-slate-500">

                  {comment.length} / 2000

                </div>



                <div className="mt-4 flex flex-wrap gap-2">

                  <button

                    type="button"

                    disabled={saving}

                    onClick={() =>

                      void submitDecision("APPROVED")

                    }

                    className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    {saving ? "در حال ثبت..." : "تأیید پرونده"}

                  </button>



                  <button

                    type="button"

                    disabled={saving}

                    onClick={() =>

                      void submitDecision("NEEDS_CORRECTION")

                    }

                    className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-950/20 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    درخواست اصلاح

                  </button>



                  <button

                    type="button"

                    disabled={saving}

                    onClick={() =>

                      void submitDecision("REJECTED")

                    }

                    className="rounded-xl bg-red-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-red-950/30 transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"

                  >

                    رد پرونده

                  </button>

                </div>

              </section>

            </div>

          )}

        </main>

      </div>

    </div>

  );

}
