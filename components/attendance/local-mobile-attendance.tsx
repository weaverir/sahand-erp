"use client";
import { useEffect, useRef, useState } from "react";

type Challenge = { challengeId: string; nonce: string; expiresAt: string };
type Position = { latitude: number; longitude: number; accuracyMeters: number; timestamp: number };

async function post<T>(path: string, body: object): Promise<T> {
  const response = await fetch(path, { method: "POST", credentials: "same-origin", cache: "no-store",
    headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? data.message ?? "خطای سرور");
  return (data.data ?? data) as T;
}

export default function LocalMobileAttendance() {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const location = useRef<Position | null>(null);
  const [gps, setGps] = useState("در انتظار GPS");
  const [status, setStatus] = useState("آماده شروع");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!navigator.geolocation) { setGps("GPS پشتیبانی نمی‌شود"); return; }
    const id = navigator.geolocation.watchPosition(p => {
      location.current = { latitude: p.coords.latitude, longitude: p.coords.longitude,
        accuracyMeters: p.coords.accuracy, timestamp: p.timestamp };
      setGps(`دقت: ${Math.round(p.coords.accuracy)} متر`);
    }, e => setGps(e.message), { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(id);
  }, []);
  useEffect(() => () => stream.current?.getTracks().forEach(t => t.stop()), []);

  async function capture(action: "CHECK_IN" | "CHECK_OUT") {
    setBusy(true);
    try {
      const c = await post<Challenge>("/api/attendance/challenges", { action });
      const s = await post<{ sessionToken: string }>("/api/attendance/local/session", { challengeId: c.challengeId, nonce: c.nonce });
      setStatus("در حال دریافت تصاویر زنده؛ دوربین را ثابت نگه دارید.");
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: 640 }, audio: false });
      if (!video.current) throw new Error("دوربین آماده نیست.");
      video.current.srcObject = stream.current;
      await video.current.play();
      const canvas = document.createElement("canvas");
      canvas.width = 480; canvas.height = 360;
      for (let i = 0; i < 3; i++) {
        if (i) await new Promise(resolve => setTimeout(resolve, 850));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("امکان پردازش تصویر نیست.");
        context.drawImage(video.current, 0, 0, canvas.width, canvas.height);
        const frameBase64 = canvas.toDataURL("image/jpeg", 0.72).split(",")[1];
        await post("/api/attendance/local/frame", { sessionToken: s.sessionToken, challengeId: c.challengeId, nonce: c.nonce, frameBase64 });
      }
      const p = location.current;
      if (!p || Date.now() - p.timestamp > 10000 || p.accuracyMeters > 30)
        throw new Error("موقعیت مکانی تازه و دقیق در دسترس نیست.");
      await post(`/api/attendance/challenges/${encodeURIComponent(c.challengeId)}/verify`, {
        nonce: c.nonce, latitude: p.latitude, longitude: p.longitude,
        accuracyMeters: p.accuracyMeters, liveSessionToken: s.sessionToken,
      });
      setStatus("حضور توسط سرور ثبت شد.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "ثبت حضور ناموفق بود.");
    } finally {
      stream.current?.getTracks().forEach(t => t.stop()); stream.current = null;
      if (video.current) video.current.srcObject = null;
      setBusy(false);
    }
  }
  return <main dir="rtl" style={{ maxWidth: 480, margin: "auto", padding: 24 }}>
    <h1>سهند | حضور و غیاب داخلی</h1>
    <p role="status">{status}</p><p>{gps}</p>
    <video ref={video} playsInline muted style={{ width: "100%", borderRadius: 12, background: "#222" }} />
    <div style={{ display: "flex", gap: 12 }}>
      <button disabled={busy} onClick={() => void capture("CHECK_IN")}>ثبت ورود</button>
      <button disabled={busy} onClick={() => void capture("CHECK_OUT")}>ثبت خروج</button>
    </div>
    <p>پردازش روی سرور خصوصی است. ثبت حضور تا فعال شدن مدل معتبر Liveness عمداً رد می‌شود.</p>
  </main>;
}
