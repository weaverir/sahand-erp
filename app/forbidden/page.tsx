import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main dir="rtl" className="min-h-screen grid place-items-center p-6">
      <section className="w-full max-w-lg rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold">دسترسی غیرمجاز</h1>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">نقش کاربری شما اجازه مشاهده این بخش را ندارد. در صورت نیاز با مدیر سیستم تماس بگیرید.</p>
        <Link href="/dashboard" className="mt-6 inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-medium text-white">بازگشت به داشبورد</Link>
      </section>
    </main>
  );
}
