
"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  ArrowDownLeft,
  Bell,
  Cable,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock3,
  Factory,
  LayoutDashboard,
  Menu,
  Moon,
  MoreHorizontal,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Users,
  UserCheck,
  Warehouse,
  Network,
  X,
  Zap,
} from "lucide-react";

import {
  useThemeStore,
  type Theme,
} from "@/stores/theme.store";

import { useUIStore } from "@/stores/ui.store";

// =============================================
// Particle Background
// =============================================

function ParticleBackground({ theme }: { theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let width = 0;
    let height = 0;
    let animationFrame = 0;

    const pointer = { x: -1000, y: -1000 };

    const particleCount = Math.min(
      85,
      Math.max(55, Math.floor(window.innerWidth / 16))
    );

    const particles = Array.from(
      { length: particleCount },
      () => ({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.24,
        vy: (Math.random() - 0.5) * 0.24,
        radius: Math.random() * 1.8 + 1,
        phase: Math.random() * Math.PI * 2,
        glow: Math.random() * 0.5 + 0.5,
      })
    );

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = width * dpr;
      canvas.height = height * dpr;

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const draw = (time = 0) => {
      context.clearRect(0, 0, width, height);

      const isDark = theme === "dark";

      const particleColor = isDark
        ? "137, 190, 255"
        : "53, 112, 195";

      const lineColor = isDark
        ? "115, 169, 255"
        : "66, 119, 190";

      particles.forEach((particle, index) => {
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < -10 || particle.x > width + 10) {
            particle.vx *= -1;
          }

          if (particle.y < -10 || particle.y > height + 10) {
            particle.vy *= -1;
          }

          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 150 && distance > 0) {
            const force = (150 - distance) / 150;

            particle.x += (dx / distance) * force * 0.65;
            particle.y += (dy / distance) * force * 0.65;
          }
        }

        const pulse = reducedMotion
          ? 1
          : 0.75 +
            Math.sin(time * 0.0015 + particle.phase) * 0.25;

        const alpha = particle.glow * pulse;

        const gradient = context.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.radius * 6
        );

        gradient.addColorStop(
          0,
          `rgba(${particleColor}, ${0.45 * alpha})`
        );

        gradient.addColorStop(
          0.35,
          `rgba(${particleColor}, ${0.16 * alpha})`
        );

        gradient.addColorStop(
          1,
          `rgba(${particleColor}, 0)`
        );

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius * 6,
          0,
          Math.PI * 2
        );

        context.fillStyle = gradient;
        context.fill();

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );

        context.fillStyle = `rgba(${particleColor}, ${
          0.65 * alpha
        })`;

        context.shadowColor = `rgba(${particleColor}, 0.9)`;
        context.shadowBlur = isDark ? 13 : 9;

        context.fill();
        context.shadowBlur = 0;

        for (let j = index + 1; j < particles.length; j++) {
          const other = particles[j];

          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 145) {
            const opacity =
              (1 - distance / 145) *
              (isDark ? 0.23 : 0.17);

            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);

            context.strokeStyle = `rgba(${lineColor}, ${opacity})`;
            context.lineWidth = 0.8;
            context.stroke();
          }
        }
      });

      if (!reducedMotion) {
        animationFrame = requestAnimationFrame(draw);
      }
    };

    const handlePointer = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };

    const handlePointerLeave = () => {
      pointer.x = -1000;
      pointer.y = -1000;
    };

    resize();
    draw();

    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", handlePointer);
    window.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      cancelAnimationFrame(animationFrame);

      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", handlePointer);
      window.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [theme]);

  return (
    <canvas
      ref={canvasRef}
      className="particle-canvas erp-glow-canvas"
      aria-hidden="true"
    />
  );
}

// =============================================
// Navigation
// =============================================

const navigation = [
  {
    title: "داشبورد",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "مدیریت تولید",
    href: "/production",
    icon: Factory,
  },
  {
    title: "انبارداری",
    href: "/warehouse",
    icon: Warehouse,
  },
  {
    title: "فروش و سفارشات",
    href: "/sales",
    icon: ShoppingCart,
  },
  {
    title: "محصولات و BOM",
    href: "/items",
    icon: Cable,
  },
];

const hrNavigation = [
  {
    title: "چارت سازمانی",
    href: "/organization",
    icon: Network,
  },
  {
    title: "تأیید پرونده‌های استخدام",
    href: "/hr/recruitment",
    icon: UserCheck,
  },
];

const hrFutureNavigation = [
  {
    title: "حضور و غیاب منابع انسانی",
    icon: Clock3,
  },
  {
    title: "اطلاعات پرسنل",
    icon: Users,
  },
];

const managementNavigation = [
  {
    title: "گزارش‌ها",
    href: "/reports",
    icon: ClipboardList,
  },
  {
    title: "کنترل کیفیت",
    href: "/quality",
    icon: ShieldCheck,
  },
  {
    title: "تنظیمات سیستم",
    href: "/settings",
    icon: Settings2,
  },
];

// =============================================
// ERP Shell
// =============================================

interface ErpShellProps {
  children: ReactNode;
}

export default function ErpShell({ children }: ErpShellProps) {
  const pathname = usePathname();

  const theme = useThemeStore((state) => state.theme);
  const toggleTheme = useThemeStore((state) => state.toggleTheme);

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

  const [hrMenuOpen, setHrMenuOpen] = useState(
    pathname === "/organization" ||
      pathname.startsWith("/organization/") ||
      pathname.startsWith("/hr/")
  );

  useEffect(() => {
    void useThemeStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    closeMobileMenu();
  }, [pathname, closeMobileMenu]);

  const isActive = (href: string) => {
    return (
      pathname === href ||
      pathname.startsWith(`${href}/`)
    );
  };

  const currentPage =
    [...navigation, ...managementNavigation, ...hrNavigation].find(
      (item) => isActive(item.href)
    )?.title ?? "سامانه مدیریت سهند";

  return (
    <div className="app-shell erp-glass-shell">
      <ParticleBackground theme={theme} />

      <div className="ambient-glow ambient-one" />
      <div className="ambient-glow ambient-two" />

      {/* Mobile Overlay */}

      {mobileMenuOpen && (
        <button
          type="button"
          aria-label="بستن منو"
          className="erp-mobile-overlay"
          onClick={closeMobileMenu}
        />
      )}

      <div className="app-layout">
        {/* Main Sidebar */}

        <aside
          className={`sidebar glass ${
            mobileMenuOpen ? "open" : ""
          }`}
        >
          {/* Brand */}

          <div className="brand">
            <div className="brand-mark">
              <Zap size={23} strokeWidth={2.4} />
            </div>

            <div>
              <div className="brand-name">SAHAND ERP</div>
              <div className="brand-caption">
                ENTERPRISE MANAGEMENT
              </div>
            </div>

            <button
              type="button"
              className="icon-button mobile-menu erp-close-sidebar"
              onClick={closeMobileMenu}
              aria-label="بستن منو"
            >
              <X size={19} />
            </button>
          </div>

          {/* Main Navigation */}

          <div className="sidebar-label">منوی اصلی</div>

          <nav className="nav-list">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`nav-item ${
                    active ? "active" : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>{item.title}</span>

                  {active && (
                    <ArrowDownLeft size={14} />
                  )}
                </Link>
              );
            })}

            {/* HR expandable menu */}

            <div>
              <button
                type="button"
                className={`nav-item ${
                  hrMenuOpen ||
                  pathname.startsWith("/hr/") ||
                  isActive("/organization")
                    ? "active"
                    : ""
                }`}
                onClick={() => setHrMenuOpen((prev) => !prev)}
                aria-expanded={hrMenuOpen}
                aria-controls="hr-submenu"
                style={{
                  width: "100%",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "right",
                  font: "inherit",
                }}
              >
                <Users size={18} />
                <span style={{ flex: 1 }}>منابع انسانی</span>

                <ChevronDown
                  size={16}
                  style={{
                    transform: hrMenuOpen
                      ? "rotate(180deg)"
                      : "rotate(0deg)",
                    transition: "transform 0.2s ease",
                  }}
                />
              </button>

              {hrMenuOpen && (
                <div
                  id="hr-submenu"
                  className="nav-list"
                  style={{
                    paddingRight: 16,
                    marginTop: 6,
                    marginBottom: 8,
                    gap: 4,
                    borderRight: "1px solid var(--border)",
                  }}
                >
                  {hrNavigation.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={closeMobileMenu}
                        className={`nav-item ${
                          active ? "active" : ""
                        }`}
                        aria-current={active ? "page" : undefined}
                        style={{ fontSize: 13 }}
                      >
                        <Icon size={16} />
                        <span>{item.title}</span>
                      </Link>
                    );
                  })}

                  {hrFutureNavigation.map((item) => {
                    const Icon = item.icon;

                    return (
                      <div
                        key={item.title}
                        className="nav-item"
                        aria-disabled="true"
                        title="این بخش در حال توسعه است"
                        style={{
                          opacity: 0.45,
                          cursor: "not-allowed",
                          fontSize: 13,
                        }}
                      >
                        <Icon size={16} />
                        <span>{item.title}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>

          {/* Management Navigation */}

          <div className="sidebar-label">
            مدیریت و نظارت
          </div>

          <nav className="nav-list">
            {managementNavigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={`nav-item ${
                    active ? "active" : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon size={18} />
                  <span>{item.title}</span>

                  {active && (
                    <ArrowDownLeft size={14} />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Sidebar Bottom */}

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <div className="avatar">س</div>

              <div className="user-info">
                <strong>مدیریت سیستم</strong>
                <small>Administrator</small>
              </div>

              <MoreHorizontal
                size={18}
                color="var(--muted)"
              />
            </div>
          </div>
        </aside>

        {/* Main Content */}

        <main className="main-content">
          {/* Topbar */}

          <header className="topbar">
            <div className="page-heading">
              <h1>{currentPage}</h1>
              <p>مرکز کنترل و مدیریت یکپارچه سهند</p>
            </div>

            <div className="topbar-actions">
              {/* Mobile Menu */}

              <button
                type="button"
                className="icon-button mobile-menu"
                onClick={toggleMobileMenu}
                aria-label="باز کردن منو"
              >
                {mobileMenuOpen ? (
                  <X size={19} />
                ) : (
                  <Menu size={19} />
                )}
              </button>

              {/* Search */}

              <label className="search-box">
                <Search size={16} />

                <input
                  value={search}
                  onChange={(event) =>
                    setSearch(event.target.value)
                  }
                  placeholder="جستجو در سیستم..."
                />
              </label>

              {/* Date */}

              <div className="date-chip">
                <CalendarDays size={15} />
                <span>امروز</span>
              </div>

              {/* Theme */}

              <button
                type="button"
                className="icon-button"
                onClick={toggleTheme}
                aria-label="تغییر حالت روز و شب"
                title="تغییر تم"
              >
                {theme === "dark" ? (
                  <Sun size={18} />
                ) : (
                  <Moon size={18} />
                )}
              </button>

              {/* Notifications */}

              <button
                type="button"
                className="icon-button"
                aria-label="اعلان‌ها"
                title="اعلان‌ها"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>

          {/* Page Content */}

          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
