import Link from "next/link";
import { ShieldCheck, Zap } from "lucide-react";

export default function RegisterPage() {
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
          <h2>ایجاد حساب کاربری</h2>

          <p>
            دسترسی به سامانه سهند توسط مدیر سیستم مدیریت می‌شود.
          </p>
        </div>

        <div className="register-notice">
          <ShieldCheck size={30} />

          <h3>ثبت‌نام نیازمند تأیید مدیر سیستم است</h3>

          <p>
            برای دریافت حساب کاربری، با مدیر سیستم سازمان
            تماس بگیرید. پس از ایجاد حساب و تخصیص نقش،
            امکان ورود به سامانه برای شما فراهم خواهد شد.
          </p>
        </div>

        <Link href="/" className="auth-submit auth-link-button">
          بازگشت به صفحه ورود
        </Link>
      </section>
    </main>
  );
}