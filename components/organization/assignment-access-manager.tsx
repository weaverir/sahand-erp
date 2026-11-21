
"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldBan, KeyRound, UsersRound, ChevronDown, ChevronUp, CheckCheck, X, RefreshCw, Clock3, LockKeyhole, Trash2, Save, LoaderCircle } from "lucide-react";

import type { Assignment } from "./types";

import { api, req } from "./api";
import { JalaliDateTimePicker, formatJalaliDate, tehranDateTimeToIso } from "./jalali-date-picker";

import {
  Modal,
  ErrorBox,
} from "./ui";

type Catalog = {
  roles: {
    id: string;
    key: string;
    name: string;
  }[];

  modules: {
    id: string;
    key: string;
    name: string;
    sortOrder: number;
  }[];

  permissions: {
    id: string;
    key: string;
    name: string;
    description?: string | null;
    resource: string;
    action: string;
    module: {
      id: string;
      key: string;
      name: string;
    };
  }[];
};

type Grant = {
  id: string;
  isActive: boolean;
  isAllowed?: boolean;
  scope?: string;
  expiresAt?: string | null;

  role?: {
    name: string;
    key: string;
  };

  permission?: {
    name: string;
    key: string;
  };
};

const MODULE_LABELS: Record<string, string> = {
  hr: "منابع انسانی",
  personnel: "پرونده پرسنلی",
  recruitment: "استخدام و جذب نیرو",
  organization: "ساختار سازمانی",
  production: "تولید",
  warehouse: "انبار",
  inventory: "مدیریت موجودی",
  sales: "فروش",
  accounting: "حسابداری",
  payroll: "حقوق و دستمزد",
  letters: "نامه‌نگاری",
  correspondence: "مکاتبات",
  attendance: "حضور و غیاب",
  items: "کالاها و خدمات",
  dashboard: "داشبورد",
  reports: "گزارش‌ها",
  system: "مدیریت سیستم",
};

const RESOURCE_LABELS: Record<string, string> = {
  personnel: "پرونده پرسنلی",
  employee: "کارکنان",
  employees: "کارکنان",
  application: "درخواست استخدام",
  applications: "درخواست‌های استخدام",
  documents: "مدارک",
  attendance: "حضور و غیاب",
  shifts: "شیفت‌ها",
  payroll: "حقوق و دستمزد",
  salary: "حقوق",
  item: "کالا",
  items: "کالاها",
  inventory: "موجودی",
  warehouse: "انبار",
  invoice: "فاکتور",
  invoices: "فاکتورها",
  sales: "فروش",
  organization: "ساختار سازمانی",
  assignment: "انتصاب",
  assignments: "انتصابات",
  letter: "نامه",
  letters: "نامه‌ها",
  reports: "گزارش‌ها",
  role: "نقش",
  permission: "مجوز",
  user: "کاربر",
  users: "کاربران",
};

const ACTION_LABELS: Record<string, string> = {
  view: "مشاهده",
  read: "مشاهده",
  create: "ایجاد",
  add: "افزودن",
  update: "ویرایش",
  edit: "ویرایش",
  delete: "حذف",
  remove: "حذف",
  manage: "مدیریت",
  approve: "تأیید",
  reject: "رد درخواست",
  export: "خروجی گرفتن",
  import: "ورود اطلاعات",
  download: "دانلود",
  upload: "بارگذاری",
  assign: "اختصاص",
  revoke: "لغو دسترسی",
  print: "چاپ",
};

const SCOPE_LABELS: Record<string, string> = {
  OWN: "فقط اطلاعات شخصی",
  UNIT: "واحد مربوطه",
  SUBTREE: "واحد و زیرمجموعه‌ها",
  DEPARTMENT: "کل دپارتمان",
  ASSIGNED: "موارد اختصاص‌یافته",
  ALL: "تمام اطلاعات",
};

function moduleLabel(key: string, fallback: string) {
  const normalized = key.toLowerCase().split(".")[0];

  return MODULE_LABELS[normalized] || fallback || normalized;
}

function permissionLabel(permission: Catalog["permissions"][number]) {
  const exactLabels: Record<string, string> = {
    "hr.personnel.view": "مشاهده پرونده پرسنلی",
    "hr.personnel.create": "ایجاد پرونده پرسنلی",
    "hr.personnel.update": "ویرایش پرونده پرسنلی",
    "hr.personnel.delete": "حذف پرونده پرسنلی",
    "organization.access.view": "مشاهده مجوزهای دسترسی",
    "organization.access.manage": "مدیریت مجوزهای دسترسی",
  };

  if (exactLabels[permission.key]) {
    return exactLabels[permission.key];
  }

  const resource =
    RESOURCE_LABELS[permission.resource.toLowerCase()] ||
    permission.resource;

  const action =
    ACTION_LABELS[permission.action.toLowerCase()] ||
    permission.action;

  return `${action} ${resource}`;
}

export default function AssignmentAccessManager({
  assignment,
  close,
}: {
  assignment: Assignment;
  close: () => void;
}) {
  const [catalog, setCatalog] = useState<Catalog>({
    roles: [],
    modules: [],
    permissions: [],
  });

  const [roles, setRoles] = useState<Grant[]>([]);
  const [perms, setPerms] = useState<Grant[]>([]);

  const [kind, setKind] = useState<"permission" | "role">(
    "permission"
  );

  const [roleId, setRoleId] = useState("");

  const [selectedPermissions, setSelectedPermissions] =
    useState<string[]>([]);

  const [allowed, setAllowed] = useState(true);
  const [scope, setScope] = useState("OWN");
  const [expiresDate, setExpiresDate] = useState("");
  const [expiresTime, setExpiresTime] = useState("23:59");

  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [cat, grants] = await Promise.all([
        api<Catalog>("/api/organization/access-catalog"),

        api<any>(
          `/api/organization/assignments/${assignment.id}/access`
        ),
      ]);

      setCatalog({
        roles: cat.roles || [],
        modules: cat.modules || [],
        permissions: cat.permissions || [],
      });

      setRoles(grants.roles || []);
      setPerms(grants.permissions || []);

      setErr("");
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "دریافت اطلاعات دسترسی‌ها ناموفق بود."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [assignment.id]);

  const groupedPermissions = catalog.permissions.reduce<
    Record<string, Catalog["permissions"]>
  >((groups, permission) => {
    const key = permission.module.id;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(permission);

    return groups;
  }, {});

  function togglePermission(id: string) {
    setSelectedPermissions((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function toggleGroup(
    permissionIds: string[],
    checked: boolean
  ) {
    setSelectedPermissions((current) => {
      if (checked) {
        return Array.from(
          new Set([...current, ...permissionIds])
        );
      }

      return current.filter(
        (id) => !permissionIds.includes(id)
      );
    });
  }

  function selectAll() {
    setSelectedPermissions(
      catalog.permissions.map((item) => item.id)
    );
  }

  function clearSelection() {
    setSelectedPermissions([]);
  }

  async function save() {
    if (kind === "role" && !roleId) {
      setErr("لطفاً یک نقش انتخاب کنید.");
      return;
    }

    if (
      kind === "permission" &&
      selectedPermissions.length === 0
    ) {
      setErr("حداقل یک مجوز را انتخاب کنید.");
      return;
    }

    setBusy(true);
    setErr("");

    try {
      if (kind === "role") {
        await api(
          `/api/organization/assignments/${assignment.id}/access`,
          req("POST", {
            roleId,
            expiresAt: expiresDate ? tehranDateTimeToIso(expiresDate, expiresTime) : null,
          })
        );
      } else {
        await api(
          `/api/organization/assignments/${assignment.id}/access`,
          req("POST", {
            permissionIds: selectedPermissions,
            isAllowed: allowed,
            scope,
            expiresAt: expiresDate ? tehranDateTimeToIso(expiresDate, expiresTime) : null,
          })
        );
      }

      setRoleId("");
      setSelectedPermissions([]);
      setExpiresDate("");
      setExpiresTime("23:59");

      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "ذخیره دسترسی‌ها ناموفق بود."
      );
    } finally {
      setBusy(false);
    }
  }

  async function revoke(
    grant: Grant,
    grantKind: "role" | "permission"
  ) {
    if (!window.confirm("آیا از لغو این دسترسی مطمئن هستید؟")) {
      return;
    }

    setErr("");
    setRevoking(grant.id);

    try {
      await api(
        `/api/organization/assignments/${assignment.id}/access`,
        req("DELETE", {
          id: grant.id,
          kind: grantKind,
        })
      );

      await load();
    } catch (error) {
      setErr(
        error instanceof Error
          ? error.message
          : "لغو دسترسی ناموفق بود."
      );
    } finally {
      setRevoking(null);
    }
  }


  const filteredGroups = Object.entries(groupedPermissions).map(([id, permissions]) => ({
    id,
    module: permissions[0].module,
    permissions: permissions.filter((permission) =>
      `${permission.key} ${permission.name} ${permissionLabel(permission)} ${permission.description || ""}`
        .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()) ||
      moduleLabel(permissions[0].module.key, permissions[0].module.name)
        .toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    ),
  })).filter((group) => group.permissions.length > 0);

  const visibleIds = filteredGroups.flatMap((group) => group.permissions.map((p) => p.id));
  const selectedCount = selectedPermissions.length;
  const grantCount = roles.length + perms.length;
  const activeGrants = useMemo(() => [...roles, ...perms].filter((g) => g.isActive).length, [roles, perms]);
  const fieldClass = "w-full min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3 text-sm text-[var(--foreground)] outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15";
  const secondaryClass = "inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm font-medium transition hover:bg-[var(--muted)] disabled:opacity-50";

  return (
    <Modal title="مدیریت دسترسی انتصاب" close={close}>
      <div dir="rtl" className="space-y-5 text-[var(--foreground)]">
        <div className="relative overflow-hidden rounded-2xl border border-blue-500/20 bg-gradient-to-l from-blue-600/10 via-indigo-500/5 to-transparent p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20"><ShieldCheck size={23}/></div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-blue-600 dark:text-blue-400">مرکز کنترل مجوزهای سازمانی</p>
                <h2 className="mt-1 break-words text-lg font-black">{assignment.user?.fullName || assignment.userId}</h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">{assignment.position?.title || "انتصاب سازمانی"} · {assignment.organizationUnit?.name || "واحد نامشخص"}</p>
              </div>
            </div>
            <button type="button" onClick={() => void load()} disabled={loading || busy} className={secondaryClass} title="دریافت مجدد دسترسی‌ها"><RefreshCw size={15} className={loading ? "animate-spin" : ""}/> بروزرسانی</button>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3"><p className="text-[11px] text-[var(--muted-foreground)]">نقش‌های اختصاصی</p><p className="mt-1 text-xl font-black tabular-nums">{roles.length.toLocaleString("fa-IR")}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3"><p className="text-[11px] text-[var(--muted-foreground)]">مجوزهای مستقیم</p><p className="mt-1 text-xl font-black tabular-nums">{perms.length.toLocaleString("fa-IR")}</p></div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-3"><p className="text-[11px] text-[var(--muted-foreground)]">دسترسی‌های فعال</p><p className="mt-1 text-xl font-black tabular-nums text-emerald-600">{activeGrants.toLocaleString("fa-IR")}</p></div>
          </div>
        </div>

        {err && <ErrorBox>{err}</ErrorBox>}
        {loading && <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] p-3 text-sm text-[var(--muted-foreground)]"><LoaderCircle size={17} className="animate-spin"/> در حال دریافت فهرست دسترسی‌ها...</div>}

        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
          <div className="border-b border-[var(--border)] p-4 sm:p-5">
            <div className="flex items-center gap-2"><KeyRound size={19} className="text-blue-600"/><h3 className="font-bold">اختصاص دسترسی جدید</h3></div>
            <p className="mt-1 text-xs leading-6 text-[var(--muted-foreground)]">برای این انتصاب، نقش سازمانی یا مجوز مشخص با محدوده دسترسی تعریف کنید.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-[var(--muted)] p-1">
              <button type="button" onClick={() => {setKind("permission");setErr("");}} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${kind === "permission" ? "bg-[var(--surface)] text-blue-600 shadow-sm" : "text-[var(--muted-foreground)]"}`}><ShieldCheck size={17}/> مجوز مستقیم</button>
              <button type="button" onClick={() => {setKind("role");setErr("");}} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${kind === "role" ? "bg-[var(--surface)] text-blue-600 shadow-sm" : "text-[var(--muted-foreground)]"}`}><UsersRound size={17}/> نقش سازمانی</button>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-5">
            {kind === "role" ? (
              <div className="space-y-2"><label className="block text-xs font-semibold">انتخاب نقش سازمانی</label><select className={fieldClass} value={roleId} onChange={(e) => setRoleId(e.target.value)}><option value="">یک نقش انتخاب کنید...</option>{catalog.roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select><p className="text-xs leading-6 text-[var(--muted-foreground)]">مجوزهای نقش طبق تنظیمات همان نقش اعمال می‌شوند. این صفحه به‌تنهایی اختیارات تصمیم‌گیری تجاری ایجاد نمی‌کند.</p></div>
            ) : (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h4 className="text-sm font-bold">کاتالوگ مجوزها</h4><p className="mt-1 text-xs text-[var(--muted-foreground)]">{selectedCount.toLocaleString("fa-IR")} مجوز انتخاب شده</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => toggleGroup(visibleIds, true)} className={secondaryClass}><CheckCheck size={15}/> انتخاب نتایج</button><button type="button" onClick={clearSelection} className={secondaryClass}><X size={15}/> پاک کردن</button></div></div>
                <div className="relative"><Search size={17} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"/><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="جست‌وجوی ماژول، عملیات یا نام مجوز..." className={`${fieldClass} pr-10`}/></div>
                <div className="max-h-[360px] space-y-2 overflow-y-auto rounded-xl border border-[var(--border)] p-2 sm:p-3">
                  {filteredGroups.map(({id, module, permissions}) => {
                    const ids = permissions.map((p) => p.id);
                    const count = ids.filter((id) => selectedPermissions.includes(id)).length;
                    const open = expanded.includes(id) || Boolean(search.trim());
                    return <section key={id} className="overflow-hidden rounded-xl border border-[var(--border)]">
                      <div className="flex items-center gap-2 bg-[var(--muted)]/50 p-3">
                        <input type="checkbox" aria-label={`انتخاب مجوزهای ${module.name}`} checked={count === ids.length} ref={(node) => {if (node) node.indeterminate = count > 0 && count < ids.length;}} onChange={(e) => toggleGroup(ids, e.target.checked)} className="h-4 w-4 accent-blue-600"/>
                        <button type="button" onClick={() => setExpanded((old) => open ? old.filter((x) => x !== id) : [...old, id])} className="flex min-w-0 flex-1 items-center justify-between gap-2 text-right"><span className="truncate text-sm font-bold">{moduleLabel(module.key, module.name)}</span><span className="flex shrink-0 items-center gap-2 text-xs text-[var(--muted-foreground)]">{count.toLocaleString("fa-IR")} / {ids.length.toLocaleString("fa-IR")}{open ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}</span></button>
                      </div>
                      {open && <div className="grid gap-2 p-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.id} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 transition ${selectedPermissions.includes(permission.id) ? "border-blue-500/40 bg-blue-500/5" : "border-[var(--border)] hover:bg-[var(--muted)]/40"}`}><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" checked={selectedPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)}/><span className="min-w-0"><span className="block text-xs font-semibold leading-5">{permissionLabel(permission)}</span><span dir="ltr" className="mt-1 block break-all text-left font-mono text-[10px] text-[var(--muted-foreground)]">{permission.key}</span>{permission.description && <span className="mt-1 block text-[11px] leading-5 text-[var(--muted-foreground)]">{permission.description}</span>}</span></label>)}</div>}
                    </section>;
                  })}
                  {filteredGroups.length === 0 && <div className="py-10 text-center text-sm text-[var(--muted-foreground)]">مجوزی با این مشخصات پیدا نشد.</div>}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><label className="block text-xs font-semibold">نوع اثر مجوز</label><div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => setAllowed(true)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold ${allowed ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600" : "border-[var(--border)]"}`}><ShieldCheck size={16}/> اجازه</button><button type="button" onClick={() => setAllowed(false)} className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-3 text-xs font-semibold ${!allowed ? "border-rose-500/50 bg-rose-500/10 text-rose-600" : "border-[var(--border)]"}`}><ShieldBan size={16}/> منع</button></div></div>
                  <div className="space-y-2"><label className="block text-xs font-semibold">محدوده دسترسی</label><select className={fieldClass} value={scope} onChange={(e) => setScope(e.target.value)}>{Object.entries(SCOPE_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></div>
                </div>
              </>
            )}
            <div className="space-y-2"><label className="flex items-center gap-2 text-xs font-semibold"><Clock3 size={15}/> تاریخ و ساعت انقضا (شمسی، اختیاری)</label><JalaliDateTimePicker date={expiresDate} time={expiresTime} onDateChange={setExpiresDate} onTimeChange={setExpiresTime}/><p className="text-[11px] text-[var(--muted-foreground)]">در صورت خالی بودن تاریخ، دسترسی بدون تاریخ انقضا ثبت می‌شود.</p></div>
            <button type="button" disabled={busy || loading} onClick={() => void save()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">{busy ? <LoaderCircle size={17} className="animate-spin"/> : <Save size={17}/>} {busy ? "در حال ثبت..." : kind === "role" ? "ثبت نقش سازمانی" : `ثبت ${selectedCount.toLocaleString("fa-IR")} مجوز انتخاب‌شده`}</button>
          </div>
        </div>

        <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-bold"><LockKeyhole size={18} className="text-blue-600"/> دسترسی‌های ثبت‌شده</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">{grantCount.toLocaleString("fa-IR")} مورد در این انتصاب</p></div></div>
          <div className="space-y-5">
            <div><h4 className="mb-2 text-xs font-bold text-[var(--muted-foreground)]">نقش‌های اختصاص‌یافته</h4><div className="space-y-2">{roles.map((grant) => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div className="flex min-w-0 items-center gap-2"><div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-600"><UsersRound size={17}/></div><div className="min-w-0"><p className="break-words text-sm font-semibold">{grant.role?.name || grant.role?.key || "نقش نامشخص"}</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{grant.expiresAt ? `انقضا: ${formatJalaliDate(grant.expiresAt)}` : "بدون تاریخ انقضا"}</p></div></div><button type="button" disabled={revoking === grant.id} onClick={() => void revoke(grant,"role")} className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 size={14}/> لغو</button></div>)}{roles.length === 0 && <p className="rounded-xl bg-[var(--muted)]/40 p-4 text-xs text-[var(--muted-foreground)]">نقشی برای این انتصاب ثبت نشده است.</p>}</div></div>
            <div><h4 className="mb-2 text-xs font-bold text-[var(--muted-foreground)]">مجوزهای مستقیم</h4><div className="max-h-[320px] space-y-2 overflow-y-auto">{perms.map((grant) => <div key={grant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"><div className="flex min-w-0 items-start gap-2"><div className={`rounded-lg p-2 ${grant.isAllowed ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"}`}>{grant.isAllowed ? <ShieldCheck size={17}/> : <ShieldBan size={17}/>}</div><div className="min-w-0"><p className="break-words text-sm font-semibold">{grant.permission?.name || grant.permission?.key || "مجوز نامشخص"}</p><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{grant.isAllowed ? "مجاز" : "ممنوع"} · {SCOPE_LABELS[grant.scope || ""] || grant.scope || "محدوده نامشخص"}{grant.expiresAt ? ` · انقضا: ${formatJalaliDate(grant.expiresAt)}` : ""}</p></div></div><button type="button" disabled={revoking === grant.id} onClick={() => void revoke(grant,"permission")} className="flex items-center gap-1.5 rounded-lg border border-rose-500/20 px-3 py-2 text-xs text-rose-600 hover:bg-rose-500/10 disabled:opacity-50"><Trash2 size={14}/> لغو</button></div>)}{perms.length === 0 && <p className="rounded-xl bg-[var(--muted)]/40 p-4 text-xs text-[var(--muted-foreground)]">مجوز مستقیمی ثبت نشده است.</p>}</div></div>
          </div>
        </section>
        <div className="flex justify-end border-t border-[var(--border)] pt-3"><button type="button" className={secondaryClass} onClick={close}>بستن پنجره</button></div>
      </div>
    </Modal>
  );
}
