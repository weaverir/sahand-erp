"use client";
import { useCallback, useEffect, useState } from "react";

type Assignment = { id: string; responsibilityTitle: string | null; organizationUnit: { name: string }; managerAssignmentId: string | null };
type Letter = { id: string; subject: string; priority: "NORMAL" | "URGENT"; status: string; senderUserId: string; currentReviewerAssignmentId: string | null; createdAt: string };

export default function CorrespondencePage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [letters, setLetters] = useState<Letter[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const reload = useCallback(async () => {
    const [a, l] = await Promise.all([fetch("/api/correspondence/assignments", { cache: "no-store" }), fetch("/api/correspondence", { cache: "no-store" })]);
    if (!a.ok || !l.ok) { setError("دریافت اطلاعات کارتابل ناموفق بود."); return; }
    const aa = await a.json(); const ll = await l.json();
    setAssignments(aa.data); setLetters(ll.data);
    setAssignmentId(old => old || aa.data[0]?.id || "");
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  async function send(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/correspondence", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId, subject, body, priority }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "ثبت نامه ناموفق بود.");
      setSubject(""); setBody(""); setPriority("NORMAL"); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }
  async function decide(letter: Letter, decision: string) {
    const selected = assignments.find(a => a.id === letter.currentReviewerAssignmentId);
    if (!selected) return;
    const note = window.prompt("توضیح اقدام (اختیاری):") ?? "";
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/correspondence/${encodeURIComponent(letter.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignmentId: selected.id, decision, note }) });
      const data = await r.json(); if (!r.ok) throw new Error(data.error || "اقدام ناموفق بود."); await reload();
    } catch (err) { setError(err instanceof Error ? err.message : "خطا"); }
    finally { setBusy(false); }
  }
  return <main dir="rtl" className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
    <h1 className="text-2xl font-bold">نامه‌نگاری سازمانی</h1>
    {error && <p role="alert" className="rounded-lg border border-red-400 p-3 text-red-600">{error}</p>}
    <form onSubmit={send} className="space-y-4 rounded-2xl border p-5">
      <h2 className="text-lg font-semibold">نامه جدید</h2>
      <label className="block">مسئولیت فرستنده<select className="mt-1 w-full rounded-lg border bg-transparent p-2" value={assignmentId} onChange={e => setAssignmentId(e.target.value)} required>{assignments.map(a => <option key={a.id} value={a.id}>{a.organizationUnit.name} - {a.responsibilityTitle || "مسئولیت سازمانی"}</option>)}</select></label>
      <label className="block">موضوع<input className="mt-1 w-full rounded-lg border bg-transparent p-2" value={subject} maxLength={200} onChange={e => setSubject(e.target.value)} required /></label>
      <label className="block">متن نامه<textarea className="mt-1 min-h-32 w-full rounded-lg border bg-transparent p-2" value={body} maxLength={20000} onChange={e => setBody(e.target.value)} required /></label>
      <label className="block">اولویت<select className="mt-1 w-full rounded-lg border bg-transparent p-2" value={priority} onChange={e => setPriority(e.target.value as "NORMAL" | "URGENT")}><option value="NORMAL">عادی</option><option value="URGENT">فوری (حداکثر ۲ نامه در ماه شمسی)</option></select></label>
      <button disabled={busy || !assignmentId} className="rounded-lg bg-blue-600 px-5 py-2 text-white disabled:opacity-50">ارسال به مدیر مستقیم</button>
    </form>
    <section className="space-y-3"><h2 className="text-lg font-semibold">کارتابل من</h2>
      {letters.map(l => { const mine = assignments.some(a => a.id === l.currentReviewerAssignmentId); return <article key={l.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{l.subject}</strong><span className="text-sm">{l.priority === "URGENT" ? "فوری" : "عادی"} · {l.status} · {new Date(l.createdAt).toLocaleDateString("fa-IR")}</span></div>
        {mine && l.status === "PENDING" && <div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} className="rounded border px-3 py-1" onClick={() => void decide(l, "APPROVE_AND_FORWARD")}>تأیید و ارجاع</button><button disabled={busy} className="rounded border px-3 py-1" onClick={() => void decide(l, "CLOSE_AT_TOP")}>خاتمه در رأس</button><button disabled={busy} className="rounded border px-3 py-1" onClick={() => void decide(l, "REJECT")}>رد نامه</button></div>}</article>; })}
      {!letters.length && <p className="text-sm opacity-70">نامه‌ای برای نمایش وجود ندارد.</p>}
    </section>
  </main>;
}
