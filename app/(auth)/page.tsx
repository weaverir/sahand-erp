
"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  FileUser,
  Fingerprint,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  UserRound,
  Users,
} from "lucide-react";

import { toast } from "sonner";

type LoginType = "employee" | "candidate";

const inputWrapperClass =
  "flex h-[46px] items-center gap-3 rounded-xl " +
  "border border-white/[0.12] bg-[#101c34] px-3.5 " +
  "transition-colors focus-within:border-sky-400/50 " +
  "focus-within:ring-2 focus-within:ring-sky-400/10";

const inputClass =
  "h-full w-full min-w-0 flex-1 appearance-none border-0 " +
  "!bg-transparent !shadow-none !ring-0 px-0 py-0 " +
  "text-sm text-white outline-none " +
  "placeholder:text-slate-500 " +
  "focus:!bg-transparent focus:outline-none " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loginType, setLoginType] =
    useState<LoginType>("employee");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (loading) return;

    if (!identifier.trim() || !password) {
      toast.error("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    try {
      setLoading(true);

      const endpoint =
        loginType === "candidate"
          ? "/api/recruitment/candidate-login"
          : "/api/auth/login";

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          identifier: identifier.trim(),
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message ||
            "نام کاربری یا رمز عبور صحیح نیست."
        );
      }

      toast.success("ورود موفقیت‌آمیز بود.");

      router.replace(
        loginType === "candidate"
          ? "/candidate-portal"
          : "/dashboard"
      );

      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "خطا در برقراری ارتباط با سرور"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      dir="rtl"
      className="relative isolate flex min-h-dvh items-center justify-center overflow-hidden bg-[#060d1d] px-4 py-5 text-slate-100"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-blue-600/[0.14] blur-[120px]" />
        <div className="absolute -bottom-48 -left-40 h-[520px] w-[520px] rounded-full bg-cyan-500/[0.08] blur-[130px]" />
        <div className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-500/[0.06] blur-[110px]" />
      </div>

      <div className="w-full max-w-[405px]">
        <section className="relative overflow-hidden rounded-[24px] border border-white/[0.12] bg-gradient-to-br from-[#202b40]/95 via-[#151f34]/95 to-[#0d1628]/95 p-5 shadow-[0_20px_65px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.12)] backdrop-blur-2xl sm:p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />

          <header className="flex flex-col items-center text-center">
            <Image
              src="/logo.png"
              alt="لوگوی شرکت سهند پیشرو ارتباطات کیان"
              width={180}
              height={110}
              priority
              className="h-[105px] w-[180px] object-contain"
            />

            <h1
              dir="ltr"
              className="mt-1 text-[23px] font-black tracking-[0.14em] text-white"
            >
              SAHAND ERP
            </h1>

            <p className="mt-1.5 text-[11px] font-medium text-sky-300">
              شرکت سهند پیشرو ارتباطات کیان
            </p>

            <div className="mt-4 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            <h2 className="mt-4 text-lg font-bold text-white">
              ورود به سامانه
            </h2>

            <p className="mt-1.5 text-xs leading-6 text-slate-400">
              نوع حساب خود را انتخاب و اطلاعات ورود را وارد کنید.
            </p>
          </header>

          <div
            role="group"
            aria-label="نوع حساب کاربری"
            className="mt-5 grid grid-cols-2 gap-1.5 rounded-xl border border-white/[0.08] bg-[#091427] p-1"
          >
            <button
              type="button"
              disabled={loading}
              aria-pressed={loginType === "employee"}
              onClick={() => setLoginType("employee")}
              className={
                "flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-all disabled:opacity-50 " +
                (loginType === "employee"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-950/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200")
              }
            >
              <Users className="h-4 w-4 shrink-0" />
              کارکنان سازمان
            </button>

            <button
              type="button"
              disabled={loading}
              aria-pressed={loginType === "candidate"}
              onClick={() => setLoginType("candidate")}
              className={
                "flex min-h-[44px] items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold transition-all disabled:opacity-50 " +
                (loginType === "candidate"
                  ? "bg-gradient-to-r from-blue-600 to-sky-600 text-white shadow-md shadow-blue-950/30"
                  : "text-slate-400 hover:bg-white/[0.06] hover:text-slate-200")
              }
            >
              <FileUser className="h-4 w-4 shrink-0" />
              متقاضی استخدام
            </button>
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-lg border border-sky-400/[0.1] bg-sky-400/[0.045] px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-sky-300" />

            <p className="text-[11px] leading-5 text-slate-300">
              {loginType === "employee"
                ? "ورود کارکنان و مدیران به محیط مدیریت سازمان"
                : "پیگیری و تکمیل پرونده استخدامی"}
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mt-5 space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">
                نام کاربری یا ایمیل
              </span>

              <div className={inputWrapperClass}>
                <UserRound className="h-[17px] w-[17px] shrink-0 text-slate-400" />

                <input
                  type="text"
                  name="username"
                  value={identifier}
                  onChange={(event) =>
                    setIdentifier(event.target.value)
                  }
                  placeholder="نام کاربری یا ایمیل"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  disabled={loading}
                  required
                  className={inputClass}
                />
              </div>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-300">
                رمز عبور
              </span>

              <div className={inputWrapperClass}>
                <LockKeyhole className="h-[17px] w-[17px] shrink-0 text-slate-400" />

                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="رمز عبور"
                  autoComplete="current-password"
                  disabled={loading}
                  required
                  className={inputClass}
                />

                <button
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    setShowPassword((previous) => !previous)
                  }
                  aria-label={
                    showPassword
                      ? "مخفی‌کردن رمز عبور"
                      : "نمایش رمز عبور"
                  }
                  aria-pressed={showPassword}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-sky-300"
                >
                  {showPassword ? (
                    <EyeOff className="h-[17px] w-[17px]" />
                  ) : (
                    <Eye className="h-[17px] w-[17px]" />
                  )}
                </button>
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="flex min-h-[46px] w-full items-center justify-center gap-2.5 rounded-xl border border-sky-300/20 bg-gradient-to-r from-blue-600 to-sky-500 px-4 text-sm font-bold text-white shadow-[0_7px_22px_rgba(37,99,235,0.2)] transition-all hover:from-blue-500 hover:to-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                  در حال ورود...
                </>
              ) : (
                <>
                  <Fingerprint className="h-[18px] w-[18px]" />

                  {loginType === "candidate"
                    ? "ورود به پنل متقاضی"
                    : "ورود به سامانه"}

                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2 border-t border-white/[0.08] pt-4 text-xs">
            <span className="text-slate-400">
              حساب کاربری ندارید؟
            </span>

            <Link
              href="/register"
              className="font-semibold text-sky-300 transition-colors hover:text-sky-200"
            >
              درخواست ایجاد حساب
            </Link>
          </div>
        </section>

        <footer className="mt-4 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} Sahand ERP
        </footer>
      </div>
    </main>
  );
}
