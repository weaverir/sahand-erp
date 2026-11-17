
import {
  CandidateGender,
  CandidateMaritalStatus,
  CandidateMilitaryStatus,
} from "@/generated/prisma/client";

export type EducationInput = {
  degree: string;
  fieldOfStudy: string;
  institution: string;
  city?: string;
  startDate?: string;
  endDate?: string;
  isCurrentlyStudying: boolean;
  grade?: string;
  description?: string;
};

export type WorkExperienceInput = {
  companyName: string;
  startDate: string;
  endDate?: string;
  position: string;
  leavingReason?: string;
  salaryReceived?: string;
};

export type SkillInput = {
  specialty: string;
  description?: string;
};

export type ReferenceInput = {
  fullName: string;
  occupation: string;
  workplace: string;
  acquaintanceDuration: string;
  phone: string;
};

export type InitialApplicationInput = {
  firstName: string;
  lastName: string;
  fatherName: string;
  birthCertificateNumber: string;
  nationalId: string;

  gender: CandidateGender;
  maritalStatus: CandidateMaritalStatus;

  nationality: string;
  birthPlace: string;
  dateOfBirth: string;

  landlinePhone?: string;
  mobilePhone: string;
  email?: string;
  address: string;

  militaryStatus: CandidateMilitaryStatus | null;

  currentlyEmployed: boolean;
  currentEmployer?: string;

  hasExternalCommitment: boolean;
  hasInsuranceHistory: boolean;

  minimumEmploymentPeriod: string;
  requestedSalary: string;
  additionalNotes?: string;

  educationRecords: EducationInput[];
  workExperiences: WorkExperienceInput[];
  skills: SkillInput[];

  references: ReferenceInput[];

  emergencyContact: {
    firstName: string;
    lastName: string;
    relationship: string;
    phone: string;
  };

  sensitiveInfo: {
    hasProlongedIllness: boolean;
    illnessDescription?: string;
    hasCriminalRecord: boolean;
    convictionDescription?: string;
  };

  declarationAccepted: true;
};

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function text(
  value: unknown,
  field: string,
  errors: string[],
  required = true,
  maxLength = 500
): string {
  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${field} الزامی است.`);
    }

    return "";
  }

  if (typeof value !== "string") {
    errors.push(`${field} باید متن باشد.`);
    return "";
  }

  const result = value.trim();

  if (required && !result) {
    errors.push(`${field} الزامی است.`);
  }

  if (result.length > maxLength) {
    errors.push(`${field} بیش از حد مجاز طولانی است.`);
  }

  return result;
}

function booleanValue(
  value: unknown,
  field: string,
  errors: string[]
): boolean {
  if (typeof value !== "boolean") {
    errors.push(`${field} باید بله یا خیر باشد.`);
    return false;
  }

  return value;
}

function dateValue(
  value: unknown,
  field: string,
  errors: string[],
  required = true
): string | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      errors.push(`${field} الزامی است.`);
    }

    return undefined;
  }

  if (typeof value !== "string") {
    errors.push(`${field} معتبر نیست.`);
    return undefined;
  }

  const valueDate = new Date(
    `${value}T00:00:00.000Z`
  );

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(valueDate.getTime()) ||
    valueDate.toISOString().slice(0, 10) !== value
  ) {
    errors.push(`${field} باید تاریخ معتبر با فرمت YYYY-MM-DD باشد.`);
    return undefined;
  }

  return value;
}

function phoneValue(
  value: unknown,
  field: string,
  errors: string[]
): string {
  const result = text(value, field, errors, true, 30)
    .replace(/[\s()-]/g, "");

  if (!/^\+?\d{8,15}$/.test(result)) {
    errors.push(`${field} معتبر نیست.`);
  }

  return result;
}

function decimalValue(
  value: unknown,
  field: string,
  errors: string[],
  required = false
): string | undefined {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    if (required) {
      errors.push(`${field} الزامی است.`);
    }

    return undefined;
  }

  const result = String(value).trim();

  if (
    !/^\d{1,16}(\.\d{1,2})?$/.test(result) ||
    Number(result) <= 0
  ) {
    errors.push(`${field} باید عدد مثبت معتبر باشد.`);
    return undefined;
  }

  return result;
}

function parseEducation(
  value: unknown,
  errors: string[],
  index: number
): EducationInput | null {
  if (!isObject(value)) {
    errors.push(`سابقه تحصیلی شماره ${index + 1} معتبر نیست.`);
    return null;
  }

  const prefix = `سابقه تحصیلی ${index + 1}`;

  const startDate = dateValue(
    value.startDate,
    `${prefix} - تاریخ شروع`,
    errors,
    false
  );

  const endDate = dateValue(
    value.endDate,
    `${prefix} - تاریخ پایان`,
    errors,
    false
  );

  const isCurrentlyStudying = value.isCurrentlyStudying === true;

  if (
    startDate &&
    endDate &&
    endDate < startDate
  ) {
    errors.push(`${prefix}: تاریخ پایان قبل از شروع است.`);
  }

  if (isCurrentlyStudying && endDate) {
    errors.push(`${prefix}: برای تحصیل جاری، تاریخ پایان نباید ثبت شود.`);
  }

  return {
    degree: text(value.degree, `${prefix} - مقطع`, errors),
    fieldOfStudy: text(
      value.fieldOfStudy,
      `${prefix} - رشته`,
      errors
    ),
    institution: text(
      value.institution,
      `${prefix} - محل تحصیل`,
      errors
    ),
    city: text(value.city, `${prefix} - شهر`, errors, false),
    startDate,
    endDate,
    isCurrentlyStudying,
    grade: text(value.grade, `${prefix} - معدل`, errors, false),
    description: text(
      value.description,
      `${prefix} - توضیحات`,
      errors,
      false
    ),
  };
}

function parseWorkExperience(
  value: unknown,
  errors: string[],
  index: number
): WorkExperienceInput | null {
  if (!isObject(value)) {
    errors.push(`سابقه شغلی شماره ${index + 1} معتبر نیست.`);
    return null;
  }

  const prefix = `سابقه شغلی ${index + 1}`;

  const startDate = dateValue(
    value.startDate,
    `${prefix} - تاریخ شروع`,
    errors
  )!;

  const endDate = dateValue(
    value.endDate,
    `${prefix} - تاریخ پایان`,
    errors,
    false
  );

  if (endDate && startDate && endDate < startDate) {
    errors.push(`${prefix}: تاریخ پایان قبل از شروع است.`);
  }

  return {
    companyName: text(
      value.companyName,
      `${prefix} - نام شرکت`,
      errors
    ),
    startDate,
    endDate,
    position: text(
      value.position,
      `${prefix} - سمت`,
      errors
    ),
    leavingReason: text(
      value.leavingReason,
      `${prefix} - علت قطع همکاری`,
      errors,
      false
    ),
    salaryReceived: decimalValue(
      value.salaryReceived,
      `${prefix} - حقوق دریافتی`,
      errors
    ),
  };
}

function parseSkill(
  value: unknown,
  errors: string[],
  index: number
): SkillInput | null {
  if (!isObject(value)) {
    errors.push(`مهارت شماره ${index + 1} معتبر نیست.`);
    return null;
  }

  return {
    specialty: text(
      value.specialty,
      `تخصص شماره ${index + 1}`,
      errors
    ),
    description: text(
      value.description,
      `توضیحات مهارت شماره ${index + 1}`,
      errors,
      false
    ),
  };
}

function parseReference(
  value: unknown,
  errors: string[],
  index: number
): ReferenceInput | null {
  if (!isObject(value)) {
    errors.push(`معرف شماره ${index + 1} معتبر نیست.`);
    return null;
  }

  return {
    fullName: text(
      value.fullName,
      `نام معرف ${index + 1}`,
      errors
    ),
    occupation: text(
      value.occupation,
      `شغل معرف ${index + 1}`,
      errors
    ),
    workplace: text(
      value.workplace,
      `محل کار معرف ${index + 1}`,
      errors
    ),
    acquaintanceDuration: text(
      value.acquaintanceDuration,
      `مدت آشنایی معرف ${index + 1}`,
      errors
    ),
    phone: phoneValue(
      value.phone,
      `تلفن معرف ${index + 1}`,
      errors
    ),
  };
}

function parseArray<T>(
  value: unknown,
  field: string,
  errors: string[],
  parser: (
    item: unknown,
    errors: string[],
    index: number
  ) => T | null,
  required = false
): T[] {
  if (value === undefined || value === null) {
    if (required) {
      errors.push(`${field} الزامی است.`);
    }

    return [];
  }

  if (!Array.isArray(value)) {
    errors.push(`${field} باید آرایه باشد.`);
    return [];
  }

  if (value.length > 50) {
    errors.push(`${field} بیش از ۵۰ مورد نمی‌تواند داشته باشد.`);
    return [];
  }

  return value
    .map((item, index) => parser(item, errors, index))
    .filter((item): item is T => item !== null);
}

export function validateInitialApplication(
  data: unknown
) {
  const errors: string[] = [];

  if (!isObject(data)) {
    return {
      success: false as const,
      errors: ["اطلاعات ارسالی معتبر نیست."],
    };
  }

  const firstName = text(data.firstName, "نام", errors);
  const lastName = text(data.lastName, "نام خانوادگی", errors);
  const fatherName = text(data.fatherName, "نام پدر", errors);

  const birthCertificateNumber = text(
    data.birthCertificateNumber,
    "شماره شناسنامه",
    errors
  );

  const nationalId = text(
    data.nationalId,
    "کد ملی",
    errors,
    true,
    30
  );

  if (!/^[a-zA-Z0-9-]{5,30}$/.test(nationalId)) {
    errors.push("کد ملی معتبر نیست.");
  }

  const gender = data.gender;
  const maritalStatus = data.maritalStatus;

  if (
    !Object.values(CandidateGender).includes(
      gender as CandidateGender
    )
  ) {
    errors.push("جنسیت معتبر نیست.");
  }

  if (
    !Object.values(CandidateMaritalStatus).includes(
      maritalStatus as CandidateMaritalStatus
    )
  ) {
    errors.push("وضعیت تأهل معتبر نیست.");
  }

  const nationality = text(
    data.nationality,
    "ملیت",
    errors
  );

  const birthPlace = text(
    data.birthPlace,
    "محل تولد",
    errors
  );

  const dateOfBirth = dateValue(
    data.dateOfBirth,
    "تاریخ تولد",
    errors
  )!;

  if (
    dateOfBirth &&
    dateOfBirth > new Date().toISOString().slice(0, 10)
  ) {
    errors.push("تاریخ تولد نمی‌تواند در آینده باشد.");
  }

  const mobilePhone = phoneValue(
    data.mobilePhone,
    "شماره همراه",
    errors
  );

  const landlinePhone = text(
    data.landlinePhone,
    "تلفن ثابت",
    errors,
    false
  );

  const email = text(
    data.email,
    "ایمیل",
    errors,
    false,
    254
  );

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    errors.push("آدرس ایمیل معتبر نیست.");
  }

  const address = text(
    data.address,
    "آدرس",
    errors,
    true,
    2000
  );

  let militaryStatus: CandidateMilitaryStatus | null = null;

  if (gender === CandidateGender.MALE) {
    if (
      !Object.values(CandidateMilitaryStatus).includes(
        data.militaryStatus as CandidateMilitaryStatus
      ) ||
      data.militaryStatus === CandidateMilitaryStatus.NOT_APPLICABLE
    ) {
      errors.push("وضعیت نظام وظیفه برای آقایان الزامی است.");
    } else {
      militaryStatus = data.militaryStatus as CandidateMilitaryStatus;
    }
  }

  const currentlyEmployed = booleanValue(
    data.currentlyEmployed,
    "وضعیت اشتغال فعلی",
    errors
  );

  const currentEmployer = text(
    data.currentEmployer,
    "نام محل اشتغال فعلی",
    errors,
    false
  );

  if (currentlyEmployed && !currentEmployer) {
    errors.push("در صورت اشتغال، نام محل کار فعلی الزامی است.");
  }

  const hasExternalCommitment = booleanValue(
    data.hasExternalCommitment,
    "تعهد به مؤسسه دیگر",
    errors
  );

  const hasInsuranceHistory = booleanValue(
    data.hasInsuranceHistory,
    "سابقه بیمه",
    errors
  );

  const minimumEmploymentPeriod = text(
    data.minimumEmploymentPeriod,
    "حداقل مدت همکاری",
    errors
  );

  const requestedSalary = decimalValue(
    data.requestedSalary,
    "حقوق درخواستی",
    errors,
    true
  ) ?? "";

  const additionalNotes = text(
    data.additionalNotes,
    "توضیحات",
    errors,
    false,
    5000
  );

  const educationRecords = parseArray(
    data.educationRecords,
    "سوابق تحصیلی",
    errors,
    parseEducation
  );

  const workExperiences = parseArray(
    data.workExperiences,
    "سوابق شغلی",
    errors,
    parseWorkExperience
  );

  const skills = parseArray(
    data.skills,
    "مهارت‌ها",
    errors,
    parseSkill
  );

  const references = parseArray(
    data.references,
    "معرف‌ها",
    errors,
    parseReference,
    true
  );

  if (references.length !== 2) {
    errors.push("ثبت دقیقاً دو معرف الزامی است.");
  }

  let emergencyContact: InitialApplicationInput["emergencyContact"] = {
    firstName: "",
    lastName: "",
    relationship: "",
    phone: "",
  };

  if (!isObject(data.emergencyContact)) {
    errors.push("اطلاعات فرد تماس اضطراری الزامی است.");
  } else {
    emergencyContact = {
      firstName: text(
        data.emergencyContact.firstName,
        "نام فرد تماس اضطراری",
        errors
      ),
      lastName: text(
        data.emergencyContact.lastName,
        "نام خانوادگی فرد تماس اضطراری",
        errors
      ),
      relationship: text(
        data.emergencyContact.relationship,
        "نسبت فرد تماس اضطراری",
        errors
      ),
      phone: phoneValue(
        data.emergencyContact.phone,
        "تلفن فرد تماس اضطراری",
        errors
      ),
    };
  }

  let sensitiveInfo: InitialApplicationInput["sensitiveInfo"] = {
    hasProlongedIllness: false,
    hasCriminalRecord: false,
  };

  if (!isObject(data.sensitiveInfo)) {
    errors.push("اطلاعات سوابق بیماری و محکومیت الزامی است.");
  } else {
    const hasProlongedIllness = booleanValue(
      data.sensitiveInfo.hasProlongedIllness,
      "سابقه بیماری ممتد",
      errors
    );

    const illnessDescription = text(
      data.sensitiveInfo.illnessDescription,
      "شرح بیماری",
      errors,
      false,
      2000
    );

    if (hasProlongedIllness && !illnessDescription) {
      errors.push("در صورت داشتن سابقه بیماری، شرح آن الزامی است.");
    }

    const hasCriminalRecord = booleanValue(
      data.sensitiveInfo.hasCriminalRecord,
      "سابقه محکومیت",
      errors
    );

    const convictionDescription = text(
      data.sensitiveInfo.convictionDescription,
      "شرح محکومیت",
      errors,
      false,
      2000
    );

    if (hasCriminalRecord && !convictionDescription) {
      errors.push("در صورت داشتن سابقه محکومیت، شرح آن الزامی است.");
    }

    sensitiveInfo = {
      hasProlongedIllness,
      illnessDescription,
      hasCriminalRecord,
      convictionDescription,
    };
  }

  if (data.declarationAccepted !== true) {
    errors.push("تأیید تعهدنامه الزامی است.");
  }

  if (errors.length > 0) {
    return {
      success: false as const,
      errors,
    };
  }

  return {
    success: true as const,
    data: {
      firstName,
      lastName,
      fatherName,
      birthCertificateNumber,
      nationalId,

      gender: gender as CandidateGender,
      maritalStatus: maritalStatus as CandidateMaritalStatus,

      nationality,
      birthPlace,
      dateOfBirth,

      landlinePhone: landlinePhone || undefined,
      mobilePhone,
      email: email || undefined,
      address,

      militaryStatus,

      currentlyEmployed,
      currentEmployer: currentEmployer || undefined,

      hasExternalCommitment,
      hasInsuranceHistory,

      minimumEmploymentPeriod,
      requestedSalary,
      additionalNotes: additionalNotes || undefined,

      educationRecords,
      workExperiences,
      skills,
      references,

      emergencyContact,
      sensitiveInfo,

      declarationAccepted: true,
    } satisfies InitialApplicationInput,
  };
}
