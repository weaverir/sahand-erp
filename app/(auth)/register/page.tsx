
"use client";

import {
  useState,
  type Dispatch,
  type SetStateAction,
  type ReactNode,
  type FormEvent,
} from "react";

import Link from "next/link";
import {
  ArrowRight,
  ArrowLeft,
  User,
  GraduationCap,
  BriefcaseBusiness,
  ClipboardList,
  FileText,
  Plus,
  Trash2,
  Upload,
  CheckCircle2,
  Loader2,
  Zap,
  Copy,
  ShieldCheck,
  KeyRound,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

type Education = {
  degree: string;
  fieldOfStudy: string;
  institution: string;
  city: string;
  startDate: string;
  endDate: string;
  isCurrentlyStudying: boolean;
  grade: string;
  description: string;
};

type WorkExperience = {
  companyName: string;
  startDate: string;
  endDate: string;
  position: string;
  leavingReason: string;
  salaryReceived: string;
};

type Skill = {
  specialty: string;
  description: string;
};

type Reference = {
  fullName: string;
  occupation: string;
  workplace: string;
  acquaintanceDuration: string;
  phone: string;
};

type PersonalInfo = {
  firstName: string;
  lastName: string;
  fatherName: string;
  birthCertificateNumber: string;
  nationalId: string;
  gender: "MALE" | "FEMALE" | "";
  maritalStatus: "SINGLE" | "MARRIED" | "";
  nationality: string;
  birthPlace: string;
  dateOfBirth: string;
  landlinePhone: string;
  mobilePhone: string;
  email: string;
  address: string;
  militaryStatus:
    | "NOT_APPLICABLE"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "EXEMPTED"
    | "";
};

type OtherInfo = {
  currentlyEmployed: boolean;
  currentEmployer: string;
  hasExternalCommitment: boolean;
  hasInsuranceHistory: boolean;
  hasProlongedIllness: boolean;
  illnessDescription: string;
  minimumEmploymentPeriod: string;
  hasCriminalRecord: boolean;
  convictionDescription: string;
  requestedSalary: string;
  additionalNotes: string;
};

type EmergencyContact = {
  firstName: string;
  lastName: string;
  relationship: string;
  phone: string;
};

type RegistrationResult = {
  applicationNumber: string;
  username: string;
  temporaryPassword: string;
  message?: string;
};

const DECLARATION =
  "بدینوسیله گواهی مینمایم کلیه اطلاعات و پاسخ های داده شده مطابق با واقعیت بوده و چنانچه مخالف اظهارات مندرج در این پرسش نامه ثابت شود کارفرما حق برکناری اینجانب و پیگیری از مراجع قانونی را خواهد داشت.";

const initialPersonal: PersonalInfo = {
  firstName: "",
  lastName: "",
  fatherName: "",
  birthCertificateNumber: "",
  nationalId: "",
  gender: "",
  maritalStatus: "",
  nationality: "ایرانی",
  birthPlace: "",
  dateOfBirth: "",
  landlinePhone: "",
  mobilePhone: "",
  email: "",
  address: "",
  militaryStatus: "",
};

const initialOther: OtherInfo = {
  currentlyEmployed: false,
  currentEmployer: "",
  hasExternalCommitment: false,
  hasInsuranceHistory: false,
  hasProlongedIllness: false,
  illnessDescription: "",
  minimumEmploymentPeriod: "",
  hasCriminalRecord: false,
  convictionDescription: "",
  requestedSalary: "",
  additionalNotes: "",
};

const initialReference = (): Reference => ({
  fullName: "",
  occupation: "",
  workplace: "",
  acquaintanceDuration: "",
  phone: "",
});

const initialEmergency: EmergencyContact = {
  firstName: "",
  lastName: "",
  relationship: "",
  phone: "",
};

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-3 text-sm text-[var(--foreground)] outline-none transition placeholder:text-[var(--muted)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]";

const labelClass =
  "mb-2 block text-sm font-semibold text-[var(--foreground)]";

function Field({
  label,
  children,
  required = false,
  className = "",
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className={labelClass}>
        {label}
        {required && (
          <span className="mr-1 text-[var(--red)]">*</span>
        )}
      </label>
      {children}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  className = "",
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  maxLength?: number;
}) {
  return (
    <Field
      label={label}
      required={required}
      className={className}
    >
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || label}
        maxLength={maxLength}
        className={inputClass}
      />
    </Field>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  required?: boolean;
}) {
  return (
    <Field label={label} required={required}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputClass}
      >
        <option value="">انتخاب کنید</option>
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
          >
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <Field label={label}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className={`${inputClass} resize-y`}
      />
    </Field>
  );
}

function Panel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass overflow-hidden rounded-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--border)] p-5">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--primary-glow)] p-3 text-[var(--primary)]">
          {icon}
        </div>
        <div>
          <h2 className="font-bold text-[var(--foreground)]">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-5 p-5 md:p-6">
        {children}
      </div>
    </section>
  );
}

function Grid({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {children}
    </div>
  );
}

function BooleanField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm ${
            value
              ? "border-[var(--primary)] bg-[var(--primary-glow)] font-bold text-[var(--primary)]"
              : "border-[var(--border)]"
          }`}
        >
          بله
        </button>

        <button
          type="button"
          onClick={() => onChange(false)}
          className={`flex-1 rounded-xl border px-4 py-3 text-sm ${
            !value
              ? "border-[var(--primary)] bg-[var(--primary-glow)] font-bold text-[var(--primary)]"
              : "border-[var(--border)]"
          }`}
        >
          خیر
        </button>
      </div>
    </Field>
  );
}

function patchList<T>(
  setter: Dispatch<SetStateAction<T[]>>,
  index: number,
  patch: Partial<T>
) {
  setter((items) =>
    items.map((item, i) =>
      i === index ? { ...item, ...patch } : item
    )
  );
}

const steps = [
  { title: "مشخصات فردی", icon: <User size={18} /> },
  { title: "سوابق و مهارت‌ها", icon: <GraduationCap size={18} /> },
  { title: "اطلاعات تکمیلی", icon: <ClipboardList size={18} /> },
  { title: "عکس و ثبت نهایی", icon: <FileText size={18} /> },
];

export default function RegisterPage() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);

  const [personal, setPersonal] =
    useState<PersonalInfo>(initialPersonal);

  const [educationRecords, setEducationRecords] =
    useState<Education[]>([]);

  const [workExperiences, setWorkExperiences] =
    useState<WorkExperience[]>([]);

  const [skills, setSkills] = useState<Skill[]>([]);

  const [references, setReferences] = useState<Reference[]>([
    initialReference(),
    initialReference(),
  ]);

  const [other, setOther] =
    useState<OtherInfo>(initialOther);

  const [emergencyContact, setEmergencyContact] =
    useState<EmergencyContact>(initialEmergency);

  const [personalPhoto, setPersonalPhoto] =
    useState<File | null>(null);

  const [declarationAccepted, setDeclarationAccepted] =
    useState(false);

  const [registrationResult, setRegistrationResult] =
    useState<RegistrationResult | null>(null);

  const [error, setError] = useState("");

  function updatePersonal<K extends keyof PersonalInfo>(
    key: K,
    value: PersonalInfo[K]
  ) {
    setPersonal((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function updateOther<K extends keyof OtherInfo>(
    key: K,
    value: OtherInfo[K]
  ) {
    setOther((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function validateCurrentStep(): boolean {
    setError("");

    if (step === 0) {
      const requiredFields = [
        personal.firstName,
        personal.lastName,
        personal.fatherName,
        personal.birthCertificateNumber,
        personal.nationalId,
        personal.gender,
        personal.maritalStatus,
        personal.nationality,
        personal.birthPlace,
        personal.dateOfBirth,
        personal.mobilePhone,
        personal.address,
      ];

      if (requiredFields.some((value) => !String(value).trim())) {
        setError("لطفاً تمام مشخصات فردی الزامی را تکمیل کنید.");
        return false;
      }

      if (!/^\d{10}$/.test(personal.nationalId)) {
        setError("کد ملی باید دقیقاً ۱۰ رقم باشد.");
        return false;
      }

      if (!/^09\d{9}$/.test(personal.mobilePhone)) {
        setError("شماره همراه باید با 09 شروع شده و ۱۱ رقم باشد.");
        return false;
      }

      if (
        personal.gender === "MALE" &&
        !personal.militaryStatus
      ) {
        setError("وضعیت نظام وظیفه را انتخاب کنید.");
        return false;
      }

      if (
        personal.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personal.email)
      ) {
        setError("آدرس ایمیل معتبر نیست.");
        return false;
      }
    }

    if (step === 1) {
      for (const item of educationRecords) {
        if (
          !item.degree.trim() ||
          !item.fieldOfStudy.trim() ||
          !item.institution.trim()
        ) {
          setError("اطلاعات سوابق تحصیلی ناقص است.");
          return false;
        }
      }

      for (const item of workExperiences) {
        if (
          !item.companyName.trim() ||
          !item.position.trim() ||
          !item.startDate
        ) {
          setError("اطلاعات سوابق شغلی ناقص است.");
          return false;
        }
      }

      if (skills.some((item) => !item.specialty.trim())) {
        setError("نوع تخصص تمام مهارت‌ها باید وارد شود.");
        return false;
      }
    }

    if (step === 2) {
      if (
        references.length !== 2 ||
        references.some(
          (item) =>
            !item.fullName.trim() ||
            !item.occupation.trim() ||
            !item.workplace.trim() ||
            !item.acquaintanceDuration.trim() ||
            !item.phone.trim()
        )
      ) {
        setError("مشخصات کامل دو معرف را وارد کنید.");
        return false;
      }

      if (
        !emergencyContact.firstName.trim() ||
        !emergencyContact.lastName.trim() ||
        !emergencyContact.relationship.trim() ||
        !emergencyContact.phone.trim()
      ) {
        setError("اطلاعات فرد تماس اضطراری الزامی است.");
        return false;
      }

      if (
        other.currentlyEmployed &&
        !other.currentEmployer.trim()
      ) {
        setError("نام محل اشتغال فعلی را وارد کنید.");
        return false;
      }

      if (
        other.hasProlongedIllness &&
        !other.illnessDescription.trim()
      ) {
        setError("نام بیماری را وارد کنید.");
        return false;
      }

      if (
        other.hasCriminalRecord &&
        !other.convictionDescription.trim()
      ) {
        setError("نوع محکومیت را وارد کنید.");
        return false;
      }
    }

    if (step === 3) {
      if (!personalPhoto) {
        setError("عکس پرسنلی الزامی است.");
        return false;
      }

      if (!declarationAccepted) {
        setError("برای ثبت درخواست باید تعهدنامه را تأیید کنید.");
        return false;
      }

      const photoTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
      ];

      if (!photoTypes.includes(personalPhoto.type)) {
        setError("فرمت عکس پرسنلی باید JPG، PNG یا WEBP باشد.");
        return false;
      }

      if (personalPhoto.size <= 0) {
        setError("فایل عکس پرسنلی خالی است.");
        return false;
      }
    }

    return true;
  }

  function nextStep() {
    if (!validateCurrentStep()) return;
    setStep((current) => Math.min(current + 1, 3));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function previousStep() {
    setError("");
    setStep((current) => Math.max(current - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (step !== 3 || loading || completed || !validateCurrentStep()) {
      return;
    }

    const application = {
      ...personal,
      militaryStatus:
        personal.gender === "MALE"
          ? personal.militaryStatus
          : undefined,

      currentlyEmployed: other.currentlyEmployed,
      currentEmployer: other.currentlyEmployed
        ? other.currentEmployer.trim()
        : null,

      hasExternalCommitment: other.hasExternalCommitment,
      hasInsuranceHistory: other.hasInsuranceHistory,

      minimumEmploymentPeriod:
        other.minimumEmploymentPeriod.trim() || null,

      requestedSalary:
        other.requestedSalary.trim() || null,

      additionalNotes:
        other.additionalNotes.trim() || null,

      declarationAccepted,

      educationRecords: educationRecords.map((item) => ({
        ...item,
        city: item.city || null,
        startDate: item.startDate || null,
        endDate: item.isCurrentlyStudying
          ? null
          : item.endDate || null,
        grade: item.grade || null,
        description: item.description || null,
      })),

      workExperiences: workExperiences.map((item) => ({
        ...item,
        endDate: item.endDate || null,
        leavingReason: item.leavingReason || null,
        salaryReceived: item.salaryReceived || null,
      })),

      skills: skills.map((item) => ({
        specialty: item.specialty.trim(),
        description: item.description || null,
      })),

      references,

      emergencyContact,

      sensitiveInfo: {
        hasProlongedIllness: other.hasProlongedIllness,
        illnessDescription: other.hasProlongedIllness
          ? other.illnessDescription.trim()
          : null,

        hasCriminalRecord: other.hasCriminalRecord,
        convictionDescription: other.hasCriminalRecord
          ? other.convictionDescription.trim()
          : null,
      },
    };

    const formData = new FormData();

    formData.append(
      "application",
      JSON.stringify(application)
    );

    formData.append("personalPhoto", personalPhoto!);

    try {
      setLoading(true);
      setError("");

      const response = await fetch(
        "/api/recruitment/register",
        {
          method: "POST",
          credentials: "same-origin",
          body: formData,
        }
      );

      const result = await response.json().catch(() => null);

      if (!response.ok || result?.success === false) {
        const details = Array.isArray(result?.errors)
          ? result.errors.join(" ")
          : Array.isArray(result?.details)
            ? result.details.join(" ")
            : "";

        const message =
          result?.error ||
          result?.message ||
          details ||
          "ثبت درخواست با خطا مواجه شد.";

        throw new Error(message);
      }

      const payload = result?.data ?? result;

      if (
        !payload?.applicationNumber ||
        !payload?.username ||
        !payload?.temporaryPassword
      ) {
        throw new Error(
          "درخواست ثبت شد، اما اطلاعات حساب در پاسخ سرور موجود نیست. برای جلوگیری از ثبت تکراری، با واحد منابع انسانی تماس بگیرید."
        );
      }

      setRegistrationResult({
        applicationNumber: payload.applicationNumber,
        username: payload.username,
        temporaryPassword: payload.temporaryPassword,
        message: payload.message,
      });

      setCompleted(true);
      toast.success("درخواست استخدام با موفقیت ثبت شد.");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "ارتباط با سرور برقرار نشد.";

      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }

  async function copyValue(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} کپی شد.`);
    } catch {
      toast.error("کپی خودکار امکان‌پذیر نیست؛ متن را دستی انتخاب کنید.");
    }
  }

  if (completed && registrationResult) {
    return (
      <main className="auth-page !block !px-3 !py-8 md:!px-6">
        <div className="mx-auto w-full max-w-3xl">
          <section className="glass rounded-3xl p-6 text-center md:p-9">
            <div className="auth-brand !mb-7">
              <div className="brand-mark">
                <Zap size={25} />
              </div>
              <div className="text-right">
                <h1>SAHAND ERP</h1>
                <span>ENTERPRISE MANAGEMENT</span>
              </div>
            </div>

            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--green)]/30 bg-[var(--green)]/10 text-[var(--green)]">
              <CheckCircle2 size={34} />
            </div>

            <h1 className="text-2xl font-extrabold text-[var(--foreground)]">
              درخواست شما با موفقیت ثبت شد
            </h1>

            <p className="mx-auto mt-3 max-w-xl text-sm leading-8 text-[var(--muted)]">
              پرونده شما برای بررسی مرحله‌ای منابع انسانی و مدیرعامل یا قائم‌مقام ثبت شد.
              حساب کاربری تا پایان تأییدهای سازمانی غیرفعال می‌ماند.
            </p>

            <div className="mt-7 rounded-2xl border border-[var(--primary)]/30 bg-[var(--primary-glow)] p-4 text-right">
              <div className="mb-3 flex items-center gap-2 font-bold text-[var(--primary)]">
                <ShieldCheck size={19} />
                اطلاعات حساب ایجادشده
              </div>

              <p className="mb-4 text-xs leading-7 text-[var(--muted)]">
                این اطلاعات را اکنون یادداشت یا کپی کنید. رمز موقت فقط در همین مرحله نمایش داده می‌شود.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <Hash size={15} />
                    شماره پرونده
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code dir="ltr" className="break-all text-sm font-bold text-[var(--foreground)]">
                      {registrationResult.applicationNumber}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(registrationResult.applicationNumber, "شماره پرونده")}
                      className="rounded-lg p-2 text-[var(--primary)] transition hover:bg-[var(--primary-glow)]"
                      aria-label="کپی شماره پرونده"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <User size={15} />
                    نام کاربری
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code dir="ltr" className="break-all text-sm font-bold text-[var(--foreground)]">
                      {registrationResult.username}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(registrationResult.username, "نام کاربری")}
                      className="rounded-lg p-2 text-[var(--primary)] transition hover:bg-[var(--primary-glow)]"
                      aria-label="کپی نام کاربری"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 sm:col-span-2">
                  <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                    <KeyRound size={15} />
                    رمز عبور موقت
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code dir="ltr" className="break-all text-sm font-bold tracking-wide text-[var(--foreground)]">
                      {registrationResult.temporaryPassword}
                    </code>
                    <button
                      type="button"
                      onClick={() => copyValue(registrationResult.temporaryPassword, "رمز عبور موقت")}
                      className="rounded-lg p-2 text-[var(--primary)] transition hover:bg-[var(--primary-glow)]"
                      aria-label="کپی رمز عبور موقت"
                    >
                      <Copy size={16} />
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  copyValue(
                    `شماره پرونده: ${registrationResult.applicationNumber}\\nنام کاربری: ${registrationResult.username}\\nرمز عبور موقت: ${registrationResult.temporaryPassword}`,
                    "اطلاعات حساب"
                  )
                }
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white transition hover:brightness-110"
              >
                <Copy size={17} />
                کپی همه اطلاعات
              </button>
            </div>

            <div className="mt-5 rounded-xl border border-[var(--orange)]/30 bg-[var(--surface)] p-4 text-right text-sm leading-8 text-[var(--foreground)]">
              <strong className="text-[var(--orange)]">توجه:</strong>
              <p className="mt-1 text-[var(--muted)]">
                تا زمان تأیید مستقل منابع انسانی و مدیرعامل یا قائم‌مقام، امکان ورود به سامانه فعال نیست.
                مدارک مرحله دوم، از جمله رضایت‌نامه در موارد لازم، پس از باز شدن مرحله دوم دریافت می‌شود.
              </p>
            </div>

            <Link
              href="/"
              className="auth-submit auth-link-button mt-6"
            >
              بازگشت به صفحه ورود
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page !block !px-3 !py-6 md:!px-6 md:!py-10">
      <div className="mx-auto w-full max-w-6xl">
        <header className="glass mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5 md:p-6">
          <div className="flex items-center gap-4">
            <div className="brand-mark">
              <Zap size={25} />
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-[var(--primary)]">
                SAHAND ERP
              </div>
              <h1 className="mt-1 text-xl font-extrabold text-[var(--foreground)] md:text-2xl">
                فرم درخواست همکاری
              </h1>
              <p className="mt-1 text-xs text-[var(--muted)]">
                ثبت اطلاعات اولیه متقاضی استخدام
              </p>
            </div>
          </div>

          <Link
            href="/"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)]"
          >
            بازگشت به ورود
          </Link>
        </header>

        <div className="glass mb-6 rounded-2xl p-4 md:p-5">
          <div className="mb-4 flex items-center justify-between text-sm">
            <span className="font-bold text-[var(--foreground)]">
              مراحل تکمیل فرم
            </span>
            <span className="text-[var(--muted)]">
              {step + 1} از 4
            </span>
          </div>

          <div className="mb-5 h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all"
              style={{
                width: `${((step + 1) / 4) * 100}%`,
              }}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            {steps.map((item, index) => (
              <button
                type="button"
                key={item.title}
                onClick={() => {
                  if (index < step) setStep(index);
                }}
                className={`flex flex-col items-center gap-2 rounded-xl p-2 text-center text-xs transition md:flex-row md:justify-center md:text-sm ${
                  index === step
                    ? "bg-[var(--primary-glow)] font-bold text-[var(--primary)]"
                    : index < step
                      ? "text-[var(--green)]"
                      : "text-[var(--muted)]"
                }`}
              >
                {item.icon}
                <span>{item.title}</span>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="glass mb-5 rounded-xl border border-[var(--red)] p-4 text-sm leading-7 text-[var(--red)]"
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {step === 0 && (
            <Panel
              title="مشخصات فردی"
              description="اطلاعات هویتی و راه‌های ارتباطی"
              icon={<User size={22} />}
            >
              <Grid>
                <TextField
                  label="نام"
                  required
                  value={personal.firstName}
                  onChange={(v) => updatePersonal("firstName", v)}
                />

                <TextField
                  label="نام خانوادگی"
                  required
                  value={personal.lastName}
                  onChange={(v) => updatePersonal("lastName", v)}
                />

                <TextField
                  label="نام پدر"
                  required
                  value={personal.fatherName}
                  onChange={(v) => updatePersonal("fatherName", v)}
                />

                <TextField
                  label="شماره شناسنامه"
                  required
                  value={personal.birthCertificateNumber}
                  onChange={(v) =>
                    updatePersonal("birthCertificateNumber", v)
                  }
                />

                <TextField
                  label="کد ملی"
                  required
                  value={personal.nationalId}
                  maxLength={10}
                  onChange={(v) =>
                    updatePersonal(
                      "nationalId",
                      v.replace(/\D/g, "").slice(0, 10)
                    )
                  }
                />

                <SelectField
                  label="جنسیت"
                  required
                  value={personal.gender}
                  onChange={(v) =>
                    updatePersonal(
                      "gender",
                      v as PersonalInfo["gender"]
                    )
                  }
                  options={[
                    { label: "مرد", value: "MALE" },
                    { label: "زن", value: "FEMALE" },
                  ]}
                />

                <SelectField
                  label="وضعیت تأهل"
                  required
                  value={personal.maritalStatus}
                  onChange={(v) =>
                    updatePersonal(
                      "maritalStatus",
                      v as PersonalInfo["maritalStatus"]
                    )
                  }
                  options={[
                    { label: "مجرد", value: "SINGLE" },
                    { label: "متأهل", value: "MARRIED" },
                  ]}
                />

                <TextField
                  label="ملیت"
                  required
                  value={personal.nationality}
                  onChange={(v) => updatePersonal("nationality", v)}
                />

                <TextField
                  label="محل تولد"
                  required
                  value={personal.birthPlace}
                  onChange={(v) => updatePersonal("birthPlace", v)}
                />

                <TextField
                  label="تاریخ تولد"
                  type="date"
                  required
                  value={personal.dateOfBirth}
                  onChange={(v) => updatePersonal("dateOfBirth", v)}
                />

                <TextField
                  label="شماره همراه"
                  required
                  value={personal.mobilePhone}
                  maxLength={11}
                  onChange={(v) =>
                    updatePersonal(
                      "mobilePhone",
                      v.replace(/\D/g, "").slice(0, 11)
                    )
                  }
                />

                <TextField
                  label="تلفن ثابت"
                  value={personal.landlinePhone}
                  onChange={(v) => updatePersonal("landlinePhone", v)}
                />

                <TextField
                  label="ایمیل"
                  type="email"
                  value={personal.email}
                  onChange={(v) => updatePersonal("email", v)}
                />
              </Grid>

              <TextAreaField
                label="آدرس محل سکونت"
                value={personal.address}
                onChange={(v) => updatePersonal("address", v)}
                rows={3}
              />

              {personal.gender === "MALE" && (
                <SelectField
                  label="وضعیت نظام وظیفه"
                  required
                  value={personal.militaryStatus}
                  onChange={(v) =>
                    updatePersonal(
                      "militaryStatus",
                      v as PersonalInfo["militaryStatus"]
                    )
                  }
                  options={[
                    { label: "در حال انجام", value: "IN_PROGRESS" },
                    { label: "شامل نظام وظیفه نمی‌شود", value: "NOT_APPLICABLE" },
                    { label: "پایان خدمت", value: "COMPLETED" },
                    { label: "معاف", value: "EXEMPTED" },
                  ]}
                />
              )}
            </Panel>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <Panel
                title="سوابق تحصیلی"
                description="امکان ثبت چندین سابقه تحصیلی"
                icon={<GraduationCap size={22} />}
              >
                {educationRecords.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <strong className="text-sm">
                        سابقه تحصیلی {index + 1}
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          setEducationRecords((items) =>
                            items.filter((_, i) => i !== index)
                          )
                        }
                        className="text-[var(--red)]"
                        aria-label="حذف سابقه تحصیلی"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <Grid>
                      <TextField
                        label="مقطع تحصیلی"
                        required
                        value={item.degree}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            degree: v,
                          })
                        }
                      />

                      <TextField
                        label="رشته تحصیلی"
                        required
                        value={item.fieldOfStudy}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            fieldOfStudy: v,
                          })
                        }
                      />

                      <TextField
                        label="نام دانشگاه یا مؤسسه"
                        required
                        value={item.institution}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            institution: v,
                          })
                        }
                      />

                      <TextField
                        label="شهر"
                        value={item.city}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            city: v,
                          })
                        }
                      />

                      <TextField
                        label="تاریخ شروع"
                        type="date"
                        value={item.startDate}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            startDate: v,
                          })
                        }
                      />

                      {!item.isCurrentlyStudying && (
                        <TextField
                          label="تاریخ پایان"
                          type="date"
                          value={item.endDate}
                          onChange={(v) =>
                            patchList(setEducationRecords, index, {
                              endDate: v,
                            })
                          }
                        />
                      )}

                      <TextField
                        label="معدل"
                        value={item.grade}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            grade: v,
                          })
                        }
                      />
                    </Grid>

                    <label className="mt-4 flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={item.isCurrentlyStudying}
                        onChange={(e) =>
                          patchList(setEducationRecords, index, {
                            isCurrentlyStudying: e.target.checked,
                            endDate: "",
                          })
                        }
                      />
                      در حال تحصیل هستم
                    </label>

                    <div className="mt-4">
                      <TextAreaField
                        label="توضیحات"
                        value={item.description}
                        onChange={(v) =>
                          patchList(setEducationRecords, index, {
                            description: v,
                          })
                        }
                      />
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setEducationRecords((items) => [
                      ...items,
                      {
                        degree: "",
                        fieldOfStudy: "",
                        institution: "",
                        city: "",
                        startDate: "",
                        endDate: "",
                        isCurrentlyStudying: false,
                        grade: "",
                        description: "",
                      },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--primary)] p-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-glow)]"
                >
                  <Plus size={18} />
                  افزودن سابقه تحصیلی
                </button>
              </Panel>

              <Panel
                title="سوابق شغلی"
                description="سوابق همکاری با شرکت‌ها و مؤسسات قبلی"
                icon={<BriefcaseBusiness size={22} />}
              >
                {workExperiences.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <strong className="text-sm">
                        سابقه شغلی {index + 1}
                      </strong>

                      <button
                        type="button"
                        onClick={() =>
                          setWorkExperiences((items) =>
                            items.filter((_, i) => i !== index)
                          )
                        }
                        className="text-[var(--red)]"
                        aria-label="حذف سابقه شغلی"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    <Grid>
                      <TextField
                        label="نام شرکت یا مؤسسه"
                        required
                        value={item.companyName}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            companyName: v,
                          })
                        }
                      />

                      <TextField
                        label="سمت"
                        required
                        value={item.position}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            position: v,
                          })
                        }
                      />

                      <TextField
                        label="تاریخ شروع"
                        type="date"
                        required
                        value={item.startDate}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            startDate: v,
                          })
                        }
                      />

                      <TextField
                        label="تاریخ پایان"
                        type="date"
                        value={item.endDate}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            endDate: v,
                          })
                        }
                      />

                      <TextField
                        label="میزان حقوق دریافتی"
                        value={item.salaryReceived}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            salaryReceived: v,
                          })
                        }
                      />

                      <TextField
                        label="علت قطع همکاری"
                        value={item.leavingReason}
                        onChange={(v) =>
                          patchList(setWorkExperiences, index, {
                            leavingReason: v,
                          })
                        }
                      />
                    </Grid>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setWorkExperiences((items) => [
                      ...items,
                      {
                        companyName: "",
                        startDate: "",
                        endDate: "",
                        position: "",
                        leavingReason: "",
                        salaryReceived: "",
                      },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--primary)] p-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-glow)]"
                >
                  <Plus size={18} />
                  افزودن سابقه شغلی
                </button>
              </Panel>

              <Panel
                title="مهارت‌ها و تخصص‌ها"
                description="مهارت‌های فنی و تخصصی خود را ثبت کنید"
                icon={<ClipboardList size={22} />}
              >
                {skills.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-3"
                  >
                    <div className="flex-1 space-y-3">
                      <TextField
                        label={`نوع تخصص ${index + 1}`}
                        required
                        value={item.specialty}
                        onChange={(v) =>
                          patchList(setSkills, index, {
                            specialty: v,
                          })
                        }
                      />

                      <TextAreaField
                        label="توضیحات تخصص"
                        value={item.description}
                        onChange={(v) =>
                          patchList(setSkills, index, {
                            description: v,
                          })
                        }
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setSkills((items) =>
                          items.filter((_, i) => i !== index)
                        )
                      }
                      className="mt-8 rounded-lg p-2 text-[var(--red)] hover:bg-[var(--surface)]"
                      aria-label="حذف مهارت"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setSkills((items) => [
                      ...items,
                      { specialty: "", description: "" },
                    ])
                  }
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--primary)] p-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--primary-glow)]"
                >
                  <Plus size={18} />
                  افزودن مهارت
                </button>
              </Panel>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <Panel
                title="سایر اطلاعات"
                description="پاسخ به پرسش‌های تکمیلی استخدام"
                icon={<ClipboardList size={22} />}
              >
                <Grid>
                  <BooleanField
                    label="در حال حاضر شاغل هستید؟"
                    value={other.currentlyEmployed}
                    onChange={(v) =>
                      updateOther("currentlyEmployed", v)
                    }
                  />

                  <BooleanField
                    label="به شرکت یا مؤسسه دیگری تعهد دارید؟"
                    value={other.hasExternalCommitment}
                    onChange={(v) =>
                      updateOther("hasExternalCommitment", v)
                    }
                  />

                  <BooleanField
                    label="سابقه بیمه دارید؟"
                    value={other.hasInsuranceHistory}
                    onChange={(v) =>
                      updateOther("hasInsuranceHistory", v)
                    }
                  />

                  <BooleanField
                    label="سابقه بیماری ممتد داشته‌اید؟"
                    value={other.hasProlongedIllness}
                    onChange={(v) =>
                      updateOther("hasProlongedIllness", v)
                    }
                  />

                  <BooleanField
                    label="سابقه محکومیت داشته‌اید؟"
                    value={other.hasCriminalRecord}
                    onChange={(v) =>
                      updateOther("hasCriminalRecord", v)
                    }
                  />
                </Grid>

                {other.currentlyEmployed && (
                  <TextField
                    label="نام شرکت یا مؤسسه محل اشتغال"
                    value={other.currentEmployer}
                    onChange={(v) =>
                      updateOther("currentEmployer", v)
                    }
                  />
                )}

                {other.hasProlongedIllness && (
                  <TextAreaField
                    label="نام و توضیحات بیماری"
                    value={other.illnessDescription}
                    onChange={(v) =>
                      updateOther("illnessDescription", v)
                    }
                  />
                )}

                {other.hasCriminalRecord && (
                  <TextAreaField
                    label="نوع محکومیت"
                    value={other.convictionDescription}
                    onChange={(v) =>
                      updateOther("convictionDescription", v)
                    }
                  />
                )}

                <Grid>
                  <TextField
                    label="حداقل مدت موردنظر برای همکاری"
                    value={other.minimumEmploymentPeriod}
                    onChange={(v) =>
                      updateOther("minimumEmploymentPeriod", v)
                    }
                    placeholder="مثلاً حداقل ۲ سال"
                  />

                  <TextField
                    label="میزان حقوق درخواستی"
                    value={other.requestedSalary}
                    onChange={(v) =>
                      updateOther("requestedSalary", v)
                    }
                    placeholder="مبلغ به تومان"
                  />
                </Grid>

                <TextAreaField
                  label="توضیحات و اطلاعات اضافی"
                  value={other.additionalNotes}
                  onChange={(v) =>
                    updateOther("additionalNotes", v)
                  }
                  rows={4}
                />
              </Panel>

              <Panel
                title="معرف‌ها"
                description="اطلاعات دو نفر که شما را می‌شناسند"
                icon={<User size={22} />}
              >
                {references.map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
                  >
                    <h3 className="mb-4 font-bold">
                      معرف شماره {index + 1}
                    </h3>

                    <Grid>
                      <TextField
                        label="نام و نام خانوادگی"
                        required
                        value={item.fullName}
                        onChange={(v) =>
                          patchList(setReferences, index, {
                            fullName: v,
                          })
                        }
                      />

                      <TextField
                        label="شغل"
                        required
                        value={item.occupation}
                        onChange={(v) =>
                          patchList(setReferences, index, {
                            occupation: v,
                          })
                        }
                      />

                      <TextField
                        label="محل کار"
                        required
                        value={item.workplace}
                        onChange={(v) =>
                          patchList(setReferences, index, {
                            workplace: v,
                          })
                        }
                      />

                      <TextField
                        label="مدت سابقه آشنایی"
                        required
                        value={item.acquaintanceDuration}
                        onChange={(v) =>
                          patchList(setReferences, index, {
                            acquaintanceDuration: v,
                          })
                        }
                      />

                      <TextField
                        label="شماره تماس"
                        required
                        value={item.phone}
                        onChange={(v) =>
                          patchList(setReferences, index, {
                            phone: v,
                          })
                        }
                      />
                    </Grid>
                  </div>
                ))}
              </Panel>

              <Panel
                title="فرد تماس اضطراری"
                description="در صورت بروز حادثه با این شخص تماس گرفته می‌شود"
                icon={<User size={22} />}
              >
                <Grid>
                  <TextField
                    label="نام"
                    required
                    value={emergencyContact.firstName}
                    onChange={(v) =>
                      setEmergencyContact((item) => ({
                        ...item,
                        firstName: v,
                      }))
                    }
                  />

                  <TextField
                    label="نام خانوادگی"
                    required
                    value={emergencyContact.lastName}
                    onChange={(v) =>
                      setEmergencyContact((item) => ({
                        ...item,
                        lastName: v,
                      }))
                    }
                  />

                  <TextField
                    label="نسبت"
                    required
                    value={emergencyContact.relationship}
                    onChange={(v) =>
                      setEmergencyContact((item) => ({
                        ...item,
                        relationship: v,
                      }))
                    }
                  />

                  <TextField
                    label="شماره تماس"
                    required
                    value={emergencyContact.phone}
                    onChange={(v) =>
                      setEmergencyContact((item) => ({
                        ...item,
                        phone: v,
                      }))
                    }
                  />
                </Grid>
              </Panel>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <Panel
                title="عکس پرسنلی و ثبت نهایی"
                description="در این مرحله فقط عکس پرسنلی دریافت می‌شود؛ مدارک تکمیلی در مرحله دوم بارگذاری خواهند شد."
                icon={<Upload size={22} />}
              >
                <Field label="عکس پرسنلی ۳ در ۴" required>
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface)] p-7 text-center transition hover:border-[var(--primary)] hover:bg-[var(--primary-glow)]">
                    <Upload
                      size={28}
                      className="mb-3 text-[var(--primary)]"
                    />
                    <span className="text-sm font-bold">
                      انتخاب عکس پرسنلی
                    </span>
                    <span className="mt-2 text-xs text-[var(--muted)]">
                      JPG، PNG یا WEBP
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={(e) =>
                        setPersonalPhoto(
                          e.target.files?.[0] || null
                        )
                      }
                    />
                  </label>

                  {personalPhoto && (
                    <p className="mt-2 text-sm text-[var(--green)]">
                      {personalPhoto.name}
                    </p>
                  )}
                </Field>

                <div className="rounded-xl border border-[var(--primary)]/25 bg-[var(--primary-glow)] p-4 text-sm leading-8 text-[var(--muted)]">
                  رضایت‌نامه همسر برای بانوان متأهل، در صورت نیاز، همراه با سایر مدارک پس از تأیید مرحله اول و در مرحله دوم از طریق پنل متقاضی دریافت می‌شود.
                </div>
              </Panel>

              <Panel
                title="تعهدنامه صحت اطلاعات"
                description="مطالعه و تأیید متن زیر برای ارسال درخواست الزامی است"
                icon={<FileText size={22} />}
              >
                <div className="rounded-xl border border-[var(--orange)] bg-[var(--surface)] p-5 text-sm leading-9 text-[var(--foreground)]">
                  {DECLARATION}
                </div>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
                  <input
                    type="checkbox"
                    checked={declarationAccepted}
                    onChange={(e) =>
                      setDeclarationAccepted(e.target.checked)
                    }
                    className="mt-1 h-5 w-5 accent-[var(--primary)]"
                  />

                  <span className="text-sm leading-7">
                    متن تعهدنامه را مطالعه کرده‌ام و صحت
                    تمام اطلاعات و پاسخ‌های ارائه‌شده را
                    تأیید می‌کنم.
                  </span>
                </label>
              </Panel>
            </div>
          )}

          <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
            <button
              type="button"
              onClick={previousStep}
              disabled={step === 0 || loading}
              className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight size={17} />
              مرحله قبل
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={nextStep}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110"
              >
                مرحله بعد
                <ArrowLeft size={17} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-6 py-3 text-sm font-bold text-white transition hover:brightness-110 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={18}
                      className="animate-spin"
                    />
                    در حال ثبت درخواست...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} />
                    ثبت نهایی درخواست
                  </>
                )}
              </button>
            )}
          </div>
        </form>

        <footer className="mt-8 text-center text-xs text-[var(--muted)]">
          SAHAND ERP · سامانه مدیریت یکپارچه سازمان
        </footer>
      </div>
    </main>
  );
}
