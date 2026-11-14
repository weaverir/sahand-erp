
"use client";


import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpLeft,
  Bell,
  Cable,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
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
  TrendingUp,
  Users,
  Warehouse,
  X,
  Zap,
} from "lucide-react";

type Theme = "dark" | "light";

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

    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - 0.5) * 0.35,
      vy: (Math.random() - 0.5) * 0.35,
      radius: Math.random() * 1.5 + 0.6,
    }));

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

    const draw = () => {
      context.clearRect(0, 0, width, height);

      const particleColor =
        theme === "dark"
          ? "rgba(137, 181, 255,"
          : "rgba(57, 111, 190,";

      particles.forEach((particle, index) => {
        if (!reducedMotion) {
          particle.x += particle.vx;
          particle.y += particle.vy;

          if (particle.x < 0 || particle.x > width) particle.vx *= -1;
          if (particle.y < 0 || particle.y > height) particle.vy *= -1;

          const dx = particle.x - pointer.x;
          const dy = particle.y - pointer.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 110 && distance > 0) {
            particle.x += (dx / distance) * 0.35;
            particle.y += (dy / distance) * 0.35;
          }
        }

        context.beginPath();
        context.arc(
          particle.x,
          particle.y,
          particle.radius,
          0,
          Math.PI * 2
        );
        context.fillStyle = `${particleColor}0.7)`;
        context.fill();

        for (let j = index + 1; j < particles.length; j++) {
          const other = particles[j];
          const dx = particle.x - other.x;
          const dy = particle.y - other.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < 115) {
            const opacity = (1 - distance / 115) * 0.17;
            context.beginPath();
            context.moveTo(particle.x, particle.y);
            context.lineTo(other.x, other.y);
            context.strokeStyle = `${particleColor}${opacity})`;
            context.lineWidth = 0.7;
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

  return <canvas ref={canvasRef} className="particle-canvas" />;
}

const navigation = [
  {
    title: "داشبورد",
    icon: LayoutDashboard,
    active: true,
  },
  {
    title: "مدیریت تولید",
    icon: Factory,
  },
  {
    title: "انبارداری",
    icon: Warehouse,
  },
  {
    title: "فروش و سفارشات",
    icon: ShoppingCart,
  },
  {
    title: "محصولات و BOM",
    icon: Cable,
  },
  {
    title: "منابع انسانی",
    icon: Users,
  },
];

const managementNavigation = [
  { title: "گزارش‌ها", icon: ClipboardList },
  { title: "کنترل کیفیت", icon: ShieldCheck },
  { title: "تنظیمات سیستم", icon: Settings2 },
];

const stats = [
  {
    label: "تولید امروز",
    value: "۲,۴۸۰",
    unit: "عدد",
    change: "۱۲٪ افزایش",
    icon: Factory,
  },
  {
    label: "موجودی انبار",
    value: "۱۸,۶۵۰",
    unit: "واحد",
    change: "موجودی ثبت‌شده",
    icon: Package,
  },
  {
    label: "سفارشات فعال",
    value: "۱۲۸",
    unit: "سفارش",
    change: "۱۸ سفارش جدید",
    icon: ShoppingCart,
  },
  {
    label: "پرسنل حاضر",
    value: "۴۲",
    unit: "نفر",
    change: "از ۴۶ نفر",
    icon: Users,
  },
];

export default function DashboardPage() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activePage, setActivePage] = useState("داشبورد");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const savedTheme = localStorage.getItem("sahand-theme");

    if (savedTheme === "light" || savedTheme === "dark") {
      setTheme(savedTheme);
      document.documentElement.dataset.theme = savedTheme;
    } else {
      document.documentElement.dataset.theme = "dark";
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";

    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("sahand-theme", nextTheme);
  };

  const selectPage = (title: string) => {
    setActivePage(title);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-shell">
      <ParticleBackground theme={theme} />
      <div className="ambient-glow ambient-one" />
      <div className="ambient-glow ambient-two" />

      <div className="app-layout">
        <aside className={`sidebar glass ${mobileMenuOpen ? "open" : ""}`}>
          <div className="brand">
            <div className="brand-mark">
              <Zap size={23} strokeWidth={2.4} />
            </div>
            <div>
              <div className="brand-name">SAHAND ERP</div>
              <div className="brand-caption">ENTERPRISE MANAGEMENT</div>
            </div>
          </div>

          <div className="sidebar-label">منوی اصلی</div>

          <nav className="nav-list">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.title;

              return (
                <button
                  key={item.title}
                  className={`nav-item ${active ? "active" : ""}`}
                  onClick={() => selectPage(item.title)}
                >
                  <Icon size={18} />
                  <span>{item.title}</span>
                  {active && <ArrowDownLeft size={14} />}
                </button>
              );
            })}
          </nav>

          <div className="sidebar-label">مدیریت و نظارت</div>

          <nav className="nav-list">
            {managementNavigation.map((item) => {
              const Icon = item.icon;
              const active = activePage === item.title;

              return (
                <button
                  key={item.title}
                  className={`nav-item ${active ? "active" : ""}`}
                  onClick={() => selectPage(item.title)}
                >
                  <Icon size={18} />
                  <span>{item.title}</span>
                </button>
              );
            })}
          </nav>

          <div className="sidebar-bottom">
            <div className="sidebar-user">
              <div className="avatar">س</div>
              <div className="user-info">
                <strong>مدیریت سیستم</strong>
                <small>Administrator</small>
              </div>
              <MoreHorizontal size={18} color="var(--muted)" />
            </div>
          </div>
        </aside>

        <main className="main-content">
          <header className="topbar">
            <div className="page-heading">
              <h1>{activePage}</h1>
              <p>مرکز کنترل و مدیریت یکپارچه سهند</p>
            </div>

            <div className="topbar-actions">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="باز کردن منو"
              >
                {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
              </button>

              <label className="search-box">
                <Search size={16} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="جستجو در سیستم..."
                />
              </label>

              <div className="date-chip">
                <CalendarDays size={15} />
                <span>امروز</span>
              </div>

              <button
                className="icon-button"
                onClick={toggleTheme}
                aria-label="تغییر حالت روز و شب"
                title="تغییر تم"
              >
                {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <button
                className="icon-button"
                aria-label="اعلان‌ها"
                title="اعلان‌ها"
              >
                <Bell size={18} />
              </button>
            </div>
          </header>

          <section className="welcome-panel glass">
            <div className="welcome-copy">
              <div className="eyebrow">
                <Activity size={14} />
                سیستم مدیریت یکپارچه
              </div>
              <h2>به سهند خوش آمدید</h2>
              <p>
                نمای کلی عملکرد تولید، فروش و موجودی سازمان در یک نگاه
              </p>
            </div>

            <div className="welcome-orbit">
              <Zap size={37} />
            </div>
          </section>

          <div className="section-heading">
            <h3>نمای کلی عملکرد</h3>
            <span>اطلاعات نمونه نمایشی</span>
          </div>

          <section className="stats-grid">
            {stats.map((stat) => {
              const Icon = stat.icon;

              return (
                <article className="stat-card glass" key={stat.label}>
                  <div className="stat-top">
                    <div className="stat-icon">
                      <Icon size={19} />
                    </div>
                    <MoreHorizontal size={18} color="var(--muted)" />
                  </div>

                  <div className="stat-label">{stat.label}</div>

                  <div className="stat-value">
                    {stat.value}
                    <span
                      style={{
                        marginRight: 6,
                        color: "var(--muted)",
                        fontSize: 10,
                        fontWeight: 500,
                      }}
                    >
                      {stat.unit}
                    </span>
                  </div>

                  <div className="stat-foot">
                    <TrendingUp size={13} className="trend-up" />
                    <span>{stat.change}</span>
                  </div>
                </article>
              );
            })}
          </section>

          <section className="content-grid">
            <article className="panel glass">
              <div className="panel-title">
                <h3>وضعیت خطوط تولید</h3>
                <span className="status-pill">
                  <CheckCircle2 size={12} />
                  وضعیت عادی
                </span>
              </div>

              <div className="progress-item">
                <div className="progress-head">
                  <span>خط تولید کابل Type-C</span>
                  <span>۸۲٪</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: "82%" }} />
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-head">
                  <span>خط تولید کابل Lightning</span>
                  <span>۶۷٪</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill green"
                    style={{ width: "67%" }}
                  />
                </div>
              </div>

              <div className="progress-item">
                <div className="progress-head">
                  <span>خط مونتاژ و بسته‌بندی</span>
                  <span>۴۵٪</span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill orange"
                    style={{ width: "45%" }}
                  />
                </div>
              </div>
            </article>

            <article className="panel glass">
              <div className="panel-title">
                <h3>آخرین رویدادها</h3>
                <MoreHorizontal size={18} color="var(--muted)" />
              </div>

              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-dot">
                    <Package size={15} />
                  </div>
                  <div className="activity-copy">
                    <strong>ثبت ورود کالا</strong>
                    <p>ورود مواد اولیه به انبار مرکزی</p>
                    <time>۱۰ دقیقه پیش</time>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="activity-dot">
                    <Factory size={15} />
                  </div>
                  <div className="activity-copy">
                    <strong>شروع دستور تولید</strong>
                    <p>دستور تولید کابل Type-C</p>
                    <time>۳۵ دقیقه پیش</time>
                  </div>
                </div>

                <div className="activity-item">
                  <div className="activity-dot">
                    <ShoppingCart size={15} />
                  </div>
                  <div className="activity-copy">
                    <strong>ثبت سفارش فروش</strong>
                    <p>سفارش جدید مشتری</p>
                    <time>یک ساعت پیش</time>
                  </div>
                </div>
              </div>
            </article>
          </section>
        </main>
      </div>
    </div>
  );
}
