
"use client";

import {
  Activity,
  CheckCircle2,
  Factory,
  MoreHorizontal,
  Package,
  ShoppingCart,
  TrendingUp,
  Users,
  Zap,
} from "lucide-react";

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
  return (
    <>
      {/* Welcome */}
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

      {/* Statistics Heading */}
      <div className="section-heading">
        <h3>نمای کلی عملکرد</h3>
        <span>اطلاعات نمونه نمایشی</span>
      </div>

      {/* Statistics */}
      <section className="stats-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              className="stat-card glass"
              key={stat.label}
            >
              <div className="stat-top">
                <div className="stat-icon">
                  <Icon size={19} />
                </div>

                <MoreHorizontal
                  size={18}
                  color="var(--muted)"
                />
              </div>

              <div className="stat-label">
                {stat.label}
              </div>

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
                <TrendingUp
                  size={13}
                  className="trend-up"
                />
                <span>{stat.change}</span>
              </div>
            </article>
          );
        })}
      </section>

      {/* Production and Activities */}
      <section className="content-grid">

        {/* Production */}
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
              <div
                className="progress-fill"
                style={{ width: "82%" }}
              />
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

        {/* Activities */}
        <article className="panel glass">
          <div className="panel-title">
            <h3>آخرین رویدادها</h3>

            <MoreHorizontal
              size={18}
              color="var(--muted)"
            />
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
    </>
  );
}
