
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, LockKeyhole, UserRound, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!identifier.trim() || !password) {
      toast.error("نام کاربری و رمز عبور را وارد کنید.");
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/auth/login", {
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
          result.message || "نام کاربری یا رمز عبور صحیح نیست."
        );
      }

      toast.success("ورود موفقیت‌آمیز بود.");

      router.replace("/dashboard");
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
    <main className="auth-page">
      <section className="auth-card glass">
        <div className="auth-brand">
          <div className="brand-mark">
            <Zap size={27} />
          </div>

          <div>
            <h1>SAHAND ERP</h1>
            <span>ENTERPRISE MANAGEMENT</span>
          </div>
        </div>

        <div className="auth-heading">
          <h2>خوش آمدید</h2>
          <p>برای ورود به سامانه اطلاعات حساب خود را وارد کنید.</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <label>
            <span>نام کاربری یا ایمیل</span>

            <div className="auth-input">
              <UserRound size={18} />

              <input
                type="text"
                value={identifier}
                onChange={(event) =>
                  setIdentifier(event.target.value)
                }
                placeholder="نام کاربری یا ایمیل"
                autoComplete="username"
                required
              />
            </div>
          </label>

          <label>
            <span>رمز عبور</span>

            <div className="auth-input">
              <LockKeyhole size={18} />

              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(event.target.value)
                }
                placeholder="رمز عبور"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={18} />
                در حال ورود...
              </>
            ) : (
              "ورود به سامانه"
            )}
          </button>
        </form>

        <div className="auth-footer">
          <span>حساب کاربری ندارید؟</span>
          <Link href="/register">درخواست ایجاد حساب</Link>
        </div>
      </section>
    </main>
  );
}
