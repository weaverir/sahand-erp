"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  Bell,
  Cable,
  CalendarDays,
  Clock3,
  ChevronDown,
  ClipboardList,
  ClipboardCheck,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Users,
  UserCheck,
  Warehouse,
  X,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useThemeStore } from "@/stores/theme.store";
import { useUIStore } from "@/stores/ui.store";
interface ErpShellProps {
  children: ReactNode;
}
interface CurrentUser {
  id: string;
  username: string;
  fullName: string;
  email?: string | null;
}
interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  permission?: string | readonly string[];
}
/**
* * Tailwind theme handling:*
* **
* * The existing project uses:*
* * document.documentElement.dataset.theme = theme*
* **
* * All colors below use Tailwind's group-data variant*
* * instead of relying on Tailwind's darkMode configuration.*
* */
const shellDark = "group-data-[theme=dark]/theme:";
/* Navigation Configuration */
const mainNavigation: NavItem[] = [
  { title: "داشبورد", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.dashboard.view" },
  { title: "نامه‌نگاری سازمانی", href: "/correspondence", icon: ClipboardList },
  { title: "ترددهای من", href: "/attendance/my", icon: Clock3 },
  { title: "درخواست و مانده مرخصی من", href: "/attendance/leave", icon: CalendarDays },
  { title: "محصولات و BOM", href: "/items", icon: Cable, permission: "items.items.view" },
];
const hrNavigation: NavItem[] = [
  { title: "داشبورد حضور و غیاب", href: "/hr/attendance", icon: Clock3, permission: "attendance.attendance.view" },
  { title: "کارکرد ماهانه", href: "/hr/attendance/monthly", icon: CalendarDays, permission: "attendance.attendance.view" },
  { title: "بررسی اصلاحات تردد", href: "/hr/attendance/corrections", icon: ClipboardCheck, permission: "attendance.attendance.update" },
  { title: "مانده و افتتاحیه مرخصی", href: "/hr/leave", icon: CalendarDays, permission: "attendance.attendance.view" },
  { title: "بررسی درخواست‌های مرخصی", href: "/hr/leave/requests", icon: ClipboardCheck, permission: "attendance.attendance.view" },
  { title: "مدیریت شیفت و برنامه هفتگی", href: "/hr/shifts", icon: Clock3, permission: "attendance.shift.view" },
  { title: "مدیریت تقویم تعطیلات", href: "/hr/holidays", icon: CalendarDays, permission: "attendance.attendance.view" },
  { title: "تأیید پرونده‌های استخدامی", href: "/hr/recruitment", icon: UserCheck, permission: ["hr.recruitment.view", "hr.recruitment.initial.review.hr", "hr.recruitment.documents.review.hr"] },
  { title: "فهرست کارکنان", href: "/hr/personnel", icon: Users, permission: "hr.personnel.view" },
  { title: "کارکنان فعلی", href: "/hr/personnel/current", icon: UserCheck, permission: "hr.personnel.view" },
  { title: "کارکنان سابق", href: "/hr/personnel/former", icon: Users, permission: "hr.personnel.view" },
];
const organizationNavigation: NavItem[] = [
  {
    title: "چارت سازمانی",
    href: "/organization",
    icon: Network,
    permission: "organization.chart.view",
  },
];
const managementNavigation: NavItem[] = [
  {
    title: "مدیریت تولید",
    href: "/production",
    icon: Factory,
    permission: "production.work_order.view",
  },
  {
    title: "انبارداری",
    href: "/warehouse",
    icon: Warehouse,
    permission: "warehouse.stock.view",
  },
  {
    title: "فروش و سفارشات",
    href: "/sales",
    icon: ShoppingCart,
    permission: "sales.sales_order.view",
  },
  {
    title: "گزارش‌ها",
    href: "/reports",
    icon: ClipboardList,
    permission: "reports.reports.view",
  },
  {
    title: "کنترل کیفیت",
    href: "/quality",
    icon: ShieldCheck,
    permission: "quality.inspection.view",
  },
  {
    title: "تنظیمات سیستم",
    href: "/settings",
    icon: Settings2,
    permission: "settings.settings.view",
  },
];
function hasNavigationPermission(
  item: NavItem,
  permissions: Set<string>
): boolean {
  if (!item.permission) return true;
  return Array.isArray(item.permission)
    ? item.permission.some((key) => permissions.has(key))
    : permissions.has(item.permission as string);
}
function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`)
  );
}
/* Tailwind UI Classes */
const navBase = [
  "group relative flex w-full items-center gap-3",
  "rounded-xl px-3.5 py-3 text-right text-[13px]",
  "font-medium transition-all duration-300 ease-out",
  "focus-visible:outline-2 focus-visible:outline-blue-400",
  "motion-safe:hover:-translate-x-0.5",
].join(" ");
const navInactive = [
  "text-slate-600 hover:bg-slate-900/5",
  "hover:text-slate-900",
  "group-data-[theme=dark]/theme:text-slate-300",
  "group-data-[theme=dark]/theme:hover:bg-white/[0.075]",
  "group-data-[theme=dark]/theme:hover:text-white",
].join(" ");
const navActive = [
  "border border-blue-500/20",
  "bg-gradient-to-l from-blue-500/20",
  "via-indigo-500/10 to-transparent",
  "text-blue-700 shadow-sm shadow-blue-500/10",
  "group-data-[theme=dark]/theme:text-blue-200",
  "group-data-[theme=dark]/theme:border-blue-400/20",
  "group-data-[theme=dark]/theme:shadow-blue-950/30",
].join(" ");
const iconButton = [
  "relative inline-flex size-10 shrink-0",
  "items-center justify-center rounded-xl",
  "border border-slate-200/70",
  "bg-white/60 text-slate-600",
  "shadow-sm backdrop-blur-md",
  "transition-all duration-300 ease-out",
  "hover:-translate-y-0.5",
  "hover:border-blue-400/40",
  "hover:bg-blue-500/10 hover:text-blue-600",
  "active:scale-95",
  "focus-visible:outline-2",
  "focus-visible:outline-blue-400",
  "disabled:cursor-not-allowed",
  "disabled:opacity-50",
  "group-data-[theme=dark]/theme:border-white/10",
  "group-data-[theme=dark]/theme:bg-white/[0.055]",
  "group-data-[theme=dark]/theme:text-slate-300",
  "group-data-[theme=dark]/theme:hover:text-blue-200",
].join(" ");
/* Animated Navigation Section */
function AnimatedNavSection({
  id,
  title,
  icon: SectionIcon,
  items,
  pathname,
  search,
  permissions,
  onNavigate,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
  pathname: string;
  search: string;
  permissions: Set<string>;
  onNavigate: () => void;
}) {
  const sectionIsActive = items.some((item) =>
    isActive(pathname, item.href)
  );
  const [isOpen, setIsOpen] =
    useState(sectionIsActive);
  useEffect(() => {
    if (sectionIsActive) {
      setIsOpen(true);
    }
  }, [sectionIsActive]);
  const filteredItems = items.filter(
    (item) =>
      hasNavigationPermission(item, permissions) &&
      item.title
        .toLocaleLowerCase("fa")
        .includes(search.trim().toLocaleLowerCase("fa"))
  );
  if (!filteredItems.length) return null;
  const expanded = isOpen || Boolean(search.trim());
  return (
    <section className="space-y-1">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setIsOpen((value) => !value);
        }}
        aria-expanded={expanded}
        aria-controls={id}
        className={[
          navBase,
          sectionIsActive ? navActive : navInactive,
        ].join(" ")}
      >
        <span
          className={[
            "flex size-8 shrink-0 items-center",
            "justify-center rounded-lg",
            "transition-all duration-300",
            sectionIsActive
              ? "bg-blue-500/15 text-blue-500 group-data-[theme=dark]/theme:text-blue-300"
              : "bg-slate-500/5 text-slate-500 group-hover:bg-blue-500/10 group-hover:text-blue-500 group-data-[theme=dark]/theme:bg-white/5 group-data-[theme=dark]/theme:text-slate-400",
          ].join(" ")}
        >
          <SectionIcon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          {title}
        </span>
        <ChevronDown
          size={16}
          className={[
            "shrink-0 text-slate-400",
            "transition-transform duration-300 ease-out",
            expanded ? "rotate-180" : "",
          ].join(" ")}
        />
      </button>
      <div
        id={id}
        aria-hidden={!expanded}
        className={[
          "grid transition-[grid-template-rows,opacity]",
          "duration-300 ease-out",
          expanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0",
        ].join(" ")}
      >
        <div className="min-h-0 overflow-hidden">
          <nav className="mr-5 mt-2 mb-3 space-y-1 border-r border-slate-200/80 pr-3 group-data-[theme=dark]/theme:border-white/10">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  tabIndex={expanded ? 0 : -1}
                  aria-current={active ? "page" : undefined}
                  className={[
                    navBase,
                    "py-2.5 text-xs",
                    active ? navActive : navInactive,
                  ].join(" ")}
                >
                  <Icon
                    size={16}
                    className="shrink-0 transition-transform duration-300 group-hover:scale-110"
                  />
                  <span className="min-w-0 flex-1">
                    {item.title}
                  </span>
                  {active && (
                    <ArrowDownLeft
                      size={13}
                      className="shrink-0 text-blue-400"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </section>
  );
}
/* Iran Date and Time */
const iranDateFormatter = new Intl.DateTimeFormat(
  "fa-IR-u-ca-persian",
  {
    timeZone: "Asia/Tehran",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }
);
const iranTimeFormatter = new Intl.DateTimeFormat(
  "fa-IR",
  {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }
);
function IranDateTime() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const updateClock = () => setNow(new Date());
    updateClock();
    const timer = window.setInterval(updateClock, 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <div
      aria-label="تاریخ و ساعت رسمی ایران"
      className="hidden items-center gap-2.5 rounded-xl border border-slate-200/70 bg-white/60 px-3.5 py-2.5 text-xs text-slate-600 shadow-sm backdrop-blur-md transition-colors duration-300 sm:inline-flex group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:bg-white/[0.055] group-data-[theme=dark]/theme:text-slate-300"
    >
      <CalendarDays
        size={16}
        className="shrink-0 text-blue-500 group-data-[theme=dark]/theme:text-blue-300"
        aria-hidden="true"
      />
      <span className="whitespace-nowrap">
        {now
          ? iranDateFormatter.format(now)
          : "تاریخ ایران"}
      </span>
      <span className="h-4 w-px bg-slate-200 group-data-[theme=dark]/theme:bg-white/15" />
      <span
        dir="ltr"
        suppressHydrationWarning
        className="font-bold tabular-nums text-slate-800 group-data-[theme=dark]/theme:text-white"
      >
        {now
          ? iranTimeFormatter.format(now)
          : "--:--"}
      </span>
    </div>
  );
}
/* ERP Shell */
export default function ErpShell({
  children,
}: ErpShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore(
    (state) => state.toggleTheme
  );
  const mobileMenuOpen = useUIStore(
    (state) => state.mobileMenuOpen
  );
  const closeMobileMenu = useUIStore(
    (state) => state.closeMobileMenu
  );
  const toggleMobileMenu = useUIStore(
    (state) => state.toggleMobileMenu
  );
  const [search, setSearch] = useState("");
  const [user, setUser] =
    useState<CurrentUser | null>(null);
  const [permissions, setPermissions] =
    useState<Set<string>>(new Set());
  const [userLoading, setUserLoading] =
    useState(true);
  const [loggingOut, setLoggingOut] =
    useState(false);
  const [logoutError, setLogoutError] =
    useState("");
  /* Theme */
  useEffect(() => {
    void useThemeStore.persist.rehydrate();
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  /* Mobile Menu */
  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        closeMobileMenu();
      }
    };
    const previousOverflow =
      document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    window.addEventListener("resize", handleResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener(
        "keydown",
        handleEscape
      );
      window.removeEventListener(
        "resize",
        handleResize
      );
    };
  }, [mobileMenuOpen, closeMobileMenu]);
  /* Current User */
  useEffect(() => {
    let cancelled = false;
    async function loadCurrentUser() {
      try {
        const [userResponse, permissionResponse] =
          await Promise.all([
            fetch("/api/auth/me", {
              credentials: "same-origin",
              cache: "no-store",
            }),
            fetch("/api/auth/permissions", {
              credentials: "same-origin",
              cache: "no-store",
            }),
          ]);
        const userResult = await userResponse.json();
        const permissionResult =
          await permissionResponse.json();
        if (
          !userResponse.ok ||
          !userResult?.success ||
          !userResult?.data
        ) {
          if (userResponse.status === 401) {
            router.replace("/");
          }
          return;
        }
        if (!cancelled) {
          setUser(userResult.data as CurrentUser);
          const keys = Array.isArray(
            permissionResult?.data?.permissions
          )
            ? permissionResult.data.permissions.filter(
                (value: unknown): value is string =>
                  typeof value === "string"
              )
            : [];
          setPermissions(new Set(keys));
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setPermissions(new Set());
        }
      } finally {
        if (!cancelled) {
          setUserLoading(false);
        }
      }
    }
    void loadCurrentUser();
    return () => {
      cancelled = true;
    };
  }, [router]);
  /* Refresh Permissions */
  useEffect(() => {
    const refreshPermissions = async () => {
      try {
        const response = await fetch(
          "/api/auth/permissions",
          {
            credentials: "same-origin",
            cache: "no-store",
          }
        );
        if (!response.ok) return;
        const result = await response.json();
        const keys = result?.data?.permissions;
        if (
          result?.success &&
          Array.isArray(keys)
        ) {
          setPermissions(
            new Set(
              keys.filter(
                (key: unknown): key is string =>
                  typeof key === "string"
              )
            )
          );
        }
      } catch {
        // Keep the last known menu while offline.
      }
    };
    const onVisibility = () => {
      if (
        document.visibilityState === "visible"
      ) {
        void refreshPermissions();
      }
    };
    window.addEventListener(
      "focus",
      refreshPermissions
    );
    document.addEventListener(
      "visibilitychange",
      onVisibility
    );
    return () => {
      window.removeEventListener(
        "focus",
        refreshPermissions
      );
      document.removeEventListener(
        "visibilitychange",
        onVisibility
      );
    };
  }, []);
  /* Logout */
  const handleLogout = useCallback(
    async () => {
      if (loggingOut) return;
      setLoggingOut(true);
      setLogoutError("");
      try {
        const response = await fetch(
          "/api/auth/logout",
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              Accept: "application/json",
            },
          }
        );
        const result = await response
          .json()
          .catch(() => null);
        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.message ||
              "خروج از حساب انجام نشد. دوباره تلاش کنید."
          );
        }
        setUser(null);
        router.replace("/");
        router.refresh();
      } catch (error) {
        setLogoutError(
          error instanceof Error
            ? error.message
            : "خطا در خروج از حساب کاربری."
        );
        setLoggingOut(false);
      }
    },
    [loggingOut, router]
  );
  /* Navigation State */
  const allNavigation = useMemo(
    () => [
      ...mainNavigation,
      ...managementNavigation,
      ...hrNavigation,
      ...organizationNavigation,
    ],
    []
  );
  const currentPage =
    allNavigation
      .filter((item) => hasNavigationPermission(item, permissions) && isActive(pathname, item.href))
      .sort((a, b) => b.href.length - a.href.length)[0]?.title ?? "سامانه مدیریت سهند";
  const visibleMainItems = mainNavigation.filter(
    (item) =>
      hasNavigationPermission(item, permissions) &&
      item.title
        .toLocaleLowerCase("fa")
        .includes(
          search.trim().toLocaleLowerCase("fa")
        )
  );
  const displayName =
    user?.fullName?.trim() ||
    (userLoading
      ? "در حال دریافت..."
      : "کاربر سامانه");
  const username = user?.username
    ? `@${user.username}`
    : "";
  const avatarLetter =
    displayName !== "کاربر سامانه" &&
    displayName !== "در حال دریافت..."
      ? displayName.charAt(0)
      : "س";
  /* Render */
  return (
    <div
      dir="rtl"
      data-theme={theme}
      className="group/theme relative isolate min-h-screen overflow-x-clip bg-slate-50 text-slate-900 transition-colors duration-500 data-[theme=dark]:bg-[#090e24] data-[theme=dark]:text-slate-100"
    >
      <div className="relative z-10 flex min-h-screen w-full gap-0 p-3 sm:p-4 lg:gap-5 lg:p-5">
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <button
            type="button"
            aria-label="بستن منو"
            onClick={closeMobileMenu}
            className="fixed inset-0 z-[80] bg-slate-950/75 backdrop-blur-sm lg:hidden"
          />
        )}
        {/* Sidebar */}
        <aside
          id="erp-main-sidebar"
          onClick={(event) => {
            event.stopPropagation();
          }}
          className={[
            "fixed bottom-3 right-3 top-3 z-[90]",
            "flex w-[min(340px,calc(100vw-24px))]",
            "flex-col overflow-x-hidden overflow-y-auto",
            "rounded-3xl border border-slate-200/70",
            "bg-white/95 p-4",
            "shadow-[0_25px_80px_rgba(0,0,0,0.25)]",
            "backdrop-blur-2xl",
            "transition-[transform,visibility,background-color,border-color]",
            "duration-300 ease-out",
            "group-data-[theme=dark]/theme:border-white/10",
            "group-data-[theme=dark]/theme:bg-[#10172f]/95",
            "group-data-[theme=dark]/theme:shadow-black/40",
            "lg:sticky lg:top-5 lg:bottom-auto",
            "lg:z-20 lg:h-[calc(100vh-40px)]",
            "lg:w-[280px] lg:shrink-0",
            "lg:translate-x-0 lg:visible",
            "lg:rounded-[26px]",
            mobileMenuOpen
              ? "visible translate-x-0"
              : "invisible translate-x-[calc(100%+24px)] lg:visible",
          ].join(" ")}
        >
          {/* Brand */}
          <div className="mb-6 flex shrink-0 items-center gap-3 border-b border-slate-200/70 px-1 pb-5 group-data-[theme=dark]/theme:border-white/10">
            <div className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-500 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent to-white/20" />
              <Zap
                size={24}
                strokeWidth={2.4}
                className="relative drop-shadow-lg"
              />
            </div>
            <div className="min-w-0 flex-1">
              <div
                dir="ltr"
                className="text-left text-base font-black tracking-[0.09em] text-slate-900 group-data-[theme=dark]/theme:text-white"
              >
                SAHAND ERP
              </div>
              <div
                dir="ltr"
                className="mt-1 text-left text-[9px] font-semibold tracking-[0.12em] text-slate-400"
              >
                ENTERPRISE MANAGEMENT
              </div>
            </div>
            <button
              type="button"
              className={`${iconButton} lg:hidden`}
              onClick={closeMobileMenu}
              aria-label="بستن منو"
            >
              <X size={19} />
            </button>
          </div>
          {/* Main Navigation */}
          <div className="mb-3 px-3 text-[11px] font-bold tracking-wide text-slate-400 group-data-[theme=dark]/theme:text-slate-500">
            منوی اصلی
          </div>
          <nav className="space-y-1">
            {visibleMainItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(
                pathname,
                item.href
              );
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  aria-current={
                    active ? "page" : undefined
                  }
                  className={[
                    navBase,
                    active
                      ? navActive
                      : navInactive,
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-300 group-hover:scale-110",
                      active
                        ? "bg-blue-500/15 text-blue-500 group-data-[theme=dark]/theme:text-blue-300"
                        : "bg-slate-500/5 text-slate-500 group-hover:bg-blue-500/10 group-hover:text-blue-500 group-data-[theme=dark]/theme:bg-white/5 group-data-[theme=dark]/theme:text-slate-400",
                    ].join(" ")}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {item.title}
                  </span>
                  {active && (
                    <ArrowDownLeft
                      size={14}
                      className="shrink-0 text-blue-400"
                    />
                  )}
                </Link>
              );
            })}
            <AnimatedNavSection
              id="erp-hr-submenu"
              title="منابع انسانی"
              icon={Users}
              items={hrNavigation}
              pathname={pathname}
              search={search}
              permissions={permissions}
              onNavigate={closeMobileMenu}
            />
            <AnimatedNavSection
              id="erp-organization-submenu"
              title="ساختار سازمانی"
              icon={Network}
              items={organizationNavigation}
              pathname={pathname}
              search={search}
              permissions={permissions}
              onNavigate={closeMobileMenu}
            />
          </nav>
          {/* Management Navigation */}
          <div className="mb-3 mt-7 border-t border-slate-200/70 px-3 pt-6 text-[11px] font-bold tracking-wide text-slate-400 group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:text-slate-500">
            مدیریت و نظارت
          </div>
          <nav className="space-y-1">
            <AnimatedNavSection
              id="erp-management-submenu"
              title="مدیریت و نظارت"
              icon={Settings2}
              items={managementNavigation}
              pathname={pathname}
              search={search}
              permissions={permissions}
              onNavigate={closeMobileMenu}
            />
          </nav>
          {/* User Section */}
          <div className="mt-auto shrink-0 pt-8">
            <div className="rounded-2xl border border-slate-200/70 bg-slate-100/70 p-3 shadow-sm transition-colors duration-300 group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:bg-white/[0.055]">
              <div className="flex items-center gap-3">
                <div
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-blue-400/20 bg-gradient-to-br from-blue-500/20 to-violet-500/20 text-lg font-black text-blue-600 group-data-[theme=dark]/theme:text-blue-200"
                >
                  {avatarLetter}
                </div>
                <div className="min-w-0 flex-1">
                  <strong
                    title={displayName}
                    className="block truncate text-sm font-bold text-slate-900 group-data-[theme=dark]/theme:text-white"
                  >
                    {displayName}
                  </strong>
                  <small
                    title={user?.username || ""}
                    className="mt-1 block truncate text-xs text-slate-500 group-data-[theme=dark]/theme:text-slate-400"
                  >
                    {username ||
                      (userLoading
                        ? " "
                        : "حساب کاربری")}
                  </small>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void handleLogout();
                  }}
                  disabled={
                    loggingOut || userLoading
                  }
                  aria-label="خروج از حساب کاربری"
                  title="خروج از حساب"
                  className={[
                    iconButton,
                    "hover:border-red-400/30",
                    "hover:bg-red-500/10",
                    "hover:text-red-500",
                  ].join(" ")}
                >
                  {loggingOut ? (
                    <span
                      aria-hidden="true"
                      className="size-4 animate-spin rounded-full border-2 border-current border-l-transparent motion-reduce:animate-none"
                    />
                  ) : (
                    <LogOut size={18} />
                  )}
                </button>
              </div>
              {logoutError && (
                <p
                  role="alert"
                  className="mt-3 text-xs leading-6 text-red-500"
                >
                  {logoutError}
                </p>
              )}
              <div className="mt-3 border-t border-slate-200/70 pt-3 text-center text-[10px] text-slate-400 group-data-[theme=dark]/theme:border-white/10">
                {loggingOut
                  ? "در حال خروج..."
                  : "خروج امن از سامانه"}
              </div>
            </div>
          </div>
        </aside>
        {/* Main Content */}
        <main className="min-w-0 flex-1">
          {/* Top Navbar */}
          <header className="relative mb-5 flex min-h-[82px] flex-wrap items-center justify-between gap-4 rounded-3xl border border-slate-200/70 bg-white/75 px-4 py-4 shadow-xl shadow-slate-900/5 backdrop-blur-2xl transition-all duration-500 sm:px-6 group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:bg-[#151b37]/75 group-data-[theme=dark]/theme:shadow-black/10">
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-black tracking-tight text-slate-900 sm:text-xl group-data-[theme=dark]/theme:text-white">
                {currentPage}
              </h1>
              <p className="mt-1.5 text-xs leading-5 text-slate-500 group-data-[theme=dark]/theme:text-slate-400">
                مرکز کنترل و مدیریت یکپارچه سهند
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {/* Mobile Menu */}
              <button
                type="button"
                className={`${iconButton} lg:hidden`}
                onClick={toggleMobileMenu}
                aria-label={
                  mobileMenuOpen
                    ? "بستن منو"
                    : "باز کردن منو"
                }
                aria-expanded={mobileMenuOpen}
                aria-controls="erp-main-sidebar"
              >
                {mobileMenuOpen ? (
                  <X size={19} />
                ) : (
                  <Menu size={19} />
                )}
              </button>
              {/* Search */}
              <label className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200/70 bg-white/60 px-3 text-slate-400 transition-all duration-300 focus-within:border-blue-400/50 focus-within:ring-2 focus-within:ring-blue-500/10 md:flex group-data-[theme=dark]/theme:border-white/10 group-data-[theme=dark]/theme:bg-white/[0.055]">
                <Search
                  size={16}
                  className="shrink-0"
                />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                  }}
                  placeholder="جستجو در منو..."
                  aria-label="جستجو در منو"
                  className="w-36 border-0 bg-transparent text-xs text-slate-900 outline-none placeholder:text-slate-400 lg:w-44 group-data-[theme=dark]/theme:text-white"
                />
              </label>
              {/* Date */}
              <IranDateTime />
              {/* Theme */}
              <button
                type="button"
                className={iconButton}
                onClick={toggleTheme}
                aria-label="تغییر حالت روز و شب"
                title="تغییر تم"
              >
                <span className="transition-transform duration-500 hover:rotate-12">
                  {theme === "dark" ? (
                    <Sun size={18} />
                  ) : (
                    <Moon size={18} />
                  )}
                </span>
              </button>
              {/* Notifications */}
              <button
                type="button"
                className={iconButton}
                aria-label="اعلان‌ها"
                title="اعلان‌ها"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>
          {/* Page Content */}
          <div className="relative min-w-0 pb-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
