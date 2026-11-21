
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
    color: "cyan",
  },
  {
    label: "موجودی انبار",
    value: "۱۸,۶۵۰",
    unit: "واحد",
    change: "موجودی ثبت‌شده",
    icon: Package,
    color: "emerald",
  },
  {
    label: "سفارشات فعال",
    value: "۱۲۸",
    unit: "سفارش",
    change: "۱۸ سفارش جدید",
    icon: ShoppingCart,
    color: "violet",
  },
  {
    label: "پرسنل حاضر",
    value: "۴۲",
    unit: "نفر",
    change: "از ۴۶ نفر",
    icon: Users,
    color: "blue",
  },
] as const;

const statStyles = {
  cyan: {
    border: "hover:border-cyan-400/40",
    glow: "bg-cyan-400/15",
    icon: "bg-cyan-400/15 text-cyan-300",
    value: "text-cyan-200",
  },
  emerald: {
    border: "hover:border-emerald-400/40",
    glow: "bg-emerald-400/15",
    icon: "bg-emerald-400/15 text-emerald-300",
    value: "text-emerald-200",
  },
  violet: {
    border: "hover:border-violet-400/40",
    glow: "bg-violet-400/15",
    icon: "bg-violet-400/15 text-violet-300",
    value: "text-violet-200",
  },
  blue: {
    border: "hover:border-blue-400/40",
    glow: "bg-blue-400/15",
    icon: "bg-blue-400/15 text-blue-300",
    value: "text-blue-200",
  },
};

const productionLines = [
  {
    name: "خط تولید کابل Type-C",
    progress: 82,
    color: "from-cyan-400 to-blue-500",
    glow: "shadow-cyan-500/30",
  },
  {
    name: "خط تولید کابل Lightning",
    progress: 67,
    color: "from-emerald-400 to-teal-500",
    glow: "shadow-emerald-500/30",
  },
  {
    name: "خط مونتاژ و بسته‌بندی",
    progress: 45,
    color: "from-amber-400 to-orange-500",
    glow: "shadow-orange-500/30",
  },
];

const activities = [
  {
    title: "ثبت ورود کالا",
    description: "ورود مواد اولیه به انبار مرکزی",
    time: "۱۰ دقیقه پیش",
    icon: Package,
    color: "bg-cyan-400/15 text-cyan-300",
  },
  {
    title: "شروع دستور تولید",
    description: "دستور تولید کابل Type-C",
    time: "۳۵ دقیقه پیش",
    icon: Factory,
    color: "bg-violet-400/15 text-violet-300",
  },
  {
    title: "ثبت سفارش فروش",
    description: "سفارش جدید مشتری",
    time: "یک ساعت پیش",
    icon: ShoppingCart,
    color: "bg-emerald-400/15 text-emerald-300",
  },
];

export default function DashboardPage() {
  return (
    <main
      dir="rtl"
      className="relative isolate min-h-full w-full overflow-hidden rounded-[28px] bg-[#0b1129] p-4 text-slate-100 sm:p-6 lg:p-8"
    >
      {/* Background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -right-40 -top-48 h-[500px] w-[500px] rounded-full bg-blue-600/25 blur-[110px]" />

        <div className="absolute -bottom-56 -left-40 h-[550px] w-[550px] rounded-full bg-violet-600/25 blur-[120px]" />

        <div className="absolute left-1/3 top-0 h-72 w-72 rounded-full bg-rose-600/10 blur-[100px]" />

        <div className="absolute inset-0 bg-gradient-to-bl from-blue-950/30 via-transparent to-violet-950/40" />
      </div>

      <div className="relative z-10 mx-auto max-w-[1600px] space-y-7">
        {/* Welcome */}
        <section className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.065] p-6 shadow-2xl shadow-black/15 backdrop-blur-xl transition-all duration-500 hover:border-blue-400/25 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute -left-20 -top-20 h-64 w-64 rounded-full bg-blue-500/15 blur-3xl transition-transform duration-700 group-hover:scale-125"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1.5 text-xs font-medium text-blue-200">
                <Activity size={14} />
                سیستم مدیریت یکپارچه
              </div>

              <div>
                <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
                  به سهند خوش آمدید
                </h2>

                <p className="mt-3 max-w-xl text-sm leading-7 text-slate-300">
                  نمای کلی عملکرد تولید، فروش و موجودی سازمان در یک نگاه
                </p>
              </div>
            </div>

            <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl border border-blue-300/20 bg-gradient-to-br from-blue-500/25 to-violet-500/20 shadow-lg shadow-blue-950/40 transition-transform duration-500 group-hover:rotate-6 group-hover:scale-105 sm:h-24 sm:w-24">
              <div className="absolute inset-2 rounded-2xl border border-white/10" />

              <Zap
                size={37}
                className="relative text-blue-200 drop-shadow-[0_0_18px_rgba(96,165,250,0.7)]"
              />
            </div>
          </div>
        </section>

        {/* Statistics heading */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1 rounded-full bg-gradient-to-b from-blue-400 to-violet-500" />

            <h3 className="text-lg font-bold text-white">
              نمای کلی عملکرد
            </h3>
          </div>

          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400">
            اطلاعات نمونه نمایشی
          </span>
        </div>

        {/* Statistics */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            const style = statStyles[stat.color];

            return (
              <article
                key={stat.label}
                className={[
                  "group relative overflow-hidden rounded-2xl",
                  "border border-white/10 bg-white/[0.065]",
                  "p-5 shadow-xl shadow-black/10 backdrop-blur-xl",
                  "transition-all duration-500 ease-out",
                  "motion-safe:hover:-translate-y-1.5",
                  "hover:bg-white/[0.09]",
                  "hover:shadow-2xl hover:shadow-blue-950/30",
                  style.border,
                ].join(" ")}
              >
                <div
                  aria-hidden="true"
                  className={[
                    "pointer-events-none absolute -left-12 -top-12",
                    "h-36 w-36 rounded-full blur-3xl",
                    "opacity-60 transition-all duration-700",
                    "group-hover:scale-150 group-hover:opacity-100",
                    style.glow,
                  ].join(" ")}
                />

                <div className="relative flex items-center justify-between">
                  <div
                    className={[
                      "flex h-11 w-11 items-center justify-center",
                      "rounded-xl border border-white/10",
                      "transition-transform duration-500",
                      "group-hover:scale-110",
                      style.icon,
                    ].join(" ")}
                  >
                    <Icon size={20} />
                  </div>

                  <MoreHorizontal
                    size={19}
                    className="text-slate-500 transition-colors duration-300 group-hover:text-slate-300"
                  />
                </div>

                <div className="relative mt-6">
                  <p className="text-sm font-medium text-slate-300">
                    {stat.label}
                  </p>

                  <div className="mt-2 flex items-baseline gap-2">
                    <strong
                      className={[
                        "text-3xl font-black tracking-tight",
                        style.value,
                      ].join(" ")}
                    >
                      {stat.value}
                    </strong>

                    <span className="text-xs font-medium text-slate-400">
                      {stat.unit}
                    </span>
                  </div>
                </div>

                <div className="relative mt-5 flex items-center gap-2 border-t border-white/10 pt-4">
                  <TrendingUp
                    size={14}
                    className="text-emerald-400"
                  />

                  <span className="text-xs text-slate-300">
                    {stat.change}
                  </span>
                </div>
              </article>
            );
          })}
        </section>

        {/* Production and activities */}
        <section className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {/* Production */}
          <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.065] shadow-xl shadow-black/10 backdrop-blur-xl transition-all duration-500 hover:border-blue-400/25">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-5 py-5 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-white">
                <Factory size={18} className="text-blue-300" />
                وضعیت خطوط تولید
              </h3>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300">
                <CheckCircle2 size={13} />
                وضعیت عادی
              </span>
            </div>

            <div className="space-y-7 p-5 sm:p-6">
              {productionLines.map((line) => (
                <div key={line.name} className="group/line space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-slate-200">
                      {line.name}
                    </span>

                    <span className="text-sm font-bold text-white">
                      {line.progress}٪
                    </span>
                  </div>

                  <div
                    role="progressbar"
                    aria-label={line.name}
                    aria-valuenow={line.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    className="h-2.5 overflow-hidden rounded-full bg-white/10"
                  >
                    <div
                      className={[
                        "h-full rounded-full bg-gradient-to-l",
                        "transition-all duration-700 ease-out",
                        "group-hover/line:brightness-125",
                        "shadow-lg",
                        line.color,
                        line.glow,
                      ].join(" ")}
                      style={{ width: `${line.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Activities */}
          <article className="group relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.065] shadow-xl shadow-black/10 backdrop-blur-xl transition-all duration-500 hover:border-violet-400/25">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-white/[0.035] px-5 py-5 sm:px-6">
              <h3 className="flex items-center gap-2 text-base font-bold text-white">
                <Activity size={18} className="text-violet-300" />
                آخرین رویدادها
              </h3>

              <MoreHorizontal size={19} className="text-slate-400" />
            </div>

            <div className="divide-y divide-white/10 px-5 sm:px-6">
              {activities.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="group/item flex items-start gap-4 py-5 transition-all duration-300 hover:translate-x-[-3px]"
                  >
                    <div
                      className={[
                        "flex h-11 w-11 shrink-0 items-center justify-center",
                        "rounded-xl border border-white/10",
                        "transition-transform duration-300",
                        "group-hover/item:scale-110",
                        item.color,
                      ].join(" ")}
                    >
                      <Icon size={18} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <strong className="text-sm font-semibold text-white">
                        {item.title}
                      </strong>

                      <p className="mt-1 text-xs leading-6 text-slate-400">
                        {item.description}
                      </p>

                      <time className="mt-2 block text-[11px] text-slate-500">
                        {item.time}
                      </time>
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
