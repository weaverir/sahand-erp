
"use client";

import { useEffect, useRef, useState } from "react";
import { FaceLivenessDetectorCore } from "@aws-amplify/ui-react-liveness";
import { ThemeProvider } from "@aws-amplify/ui-react";
import "@aws-amplify/ui-react/styles.css";

type Position = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  timestamp: number;
};

type Session = {
  sessionId: string;
  liveSessionToken: string;
  region: string;
};

type Challenge = {
  challengeId: string;
  nonce: string;
  expiresAt: string;
};

async function post(
  url: string,
  payload: object
): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const json: unknown = await response.json();

  if (!response.ok) {
    throw new Error(
      (json as { error?: string; message?: string })?.error ||
        (json as { message?: string })?.message ||
        "خطای سرور"
    );
  }

  return json as Record<string, unknown>;
}

function unwrap<T>(data: Record<string, unknown>): T {
  // Compatible with successResponse({ ... }) and direct JSON responses.
  return (data.data && typeof data.data === "object"
    ? data.data
    : data) as T;
}

export default function MobileAttendance() {
  const [position, setPosition] = useState<Position | null>(null);
  const [gpsError, setGpsError] = useState("");
  const [message, setMessage] = useState(
    "برای ثبت حضور، دوربین و موقعیت مکانی را فعال کنید."
  );
  const [busy, setBusy] = useState(false);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [watching, setWatching] = useState(false);

  const watchId = useRef<number | null>(null);
  const currentPosition = useRef<Position | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) {
      setGpsError("مرورگر از GPS پشتیبانی نمی‌کند.");
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        const value: Position = {
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
          accuracyMeters: p.coords.accuracy,
          timestamp: p.timestamp,
        };

        currentPosition.current = value;
        setPosition(value);
        setGpsError("");
      },
      (e) => setGpsError(e.message),
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 15000,
      }
    );

    setWatching(true);

    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current);
      }
    };
  }, []);

  async function start(action: "CHECK_IN" | "CHECK_OUT") {
    setBusy(true);
    setMessage("در حال ایجاد چالش امنیتی...");
    setSession(null);
    setChallenge(null);

    try {
      const c = unwrap<Challenge>(
        await post("/api/attendance/challenges", { action })
      );

      const s = unwrap<Session>(
        await post("/api/attendance/aws/session", {
          challengeId: c.challengeId,
          nonce: c.nonce,
        })
      );

      setChallenge(c);
      setSession(s);
      setMessage("چهره خود را طبق راهنمای دوربین تأیید کنید.");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "خطای نامشخص"
      );
    } finally {
      setBusy(false);
    }
  }

  async function complete(): Promise<void> {
    if (!session || !challenge) return;

    setBusy(true);

    try {
      const p = currentPosition.current;

      if (
        !p ||
        Date.now() - p.timestamp > 10000 ||
        p.accuracyMeters > 30
      ) {
        throw new Error(
          "GPS تازه و دقیق در دسترس نیست؛ دوباره تلاش کنید."
        );
      }

      if (
        Date.now() >= new Date(challenge.expiresAt).getTime()
      ) {
        throw new Error("مهلت چالش تمام شده است.");
      }

      await post(
        `/api/attendance/challenges/${encodeURIComponent(
          challenge.challengeId
        )}/verify`,
        {
          nonce: challenge.nonce,
          latitude: p.latitude,
          longitude: p.longitude,
          accuracyMeters: p.accuracyMeters,
          liveSessionToken: session.liveSessionToken,
        }
      );

      setMessage("ثبت حضور با موفقیت توسط سرور تأیید شد.");
    } catch (e) {
      setMessage(
        e instanceof Error
          ? e.message
          : "تأیید حضور ناموفق بود."
      );
    } finally {
      setSession(null);
      setChallenge(null);
      setBusy(false);
    }
  }

  return (
    <main
      dir="rtl"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        padding: 20,
        fontFamily: "sans-serif",
      }}
    >
      <h1>سهند | حضور و غیاب</h1>

      <p role="status">{message}</p>

      <p>
        GPS:{" "}
        {gpsError ||
          (position
            ? `دقت ${Math.round(position.accuracyMeters)} متر`
            : "در انتظار دریافت موقعیت")}
      </p>

      <p style={{ fontSize: 12 }}>
        پایش مکانی فقط هنگام باز بودن این صفحه قابل اتکاست؛{" "}
        {watching
          ? "پایش فعال است."
          : "پایش غیرفعال است."}
      </p>

      {!session && (
        <div style={{ display: "flex", gap: 12 }}>
          <button
            disabled={busy || !position}
            onClick={() => void start("CHECK_IN")}
          >
            ثبت ورود
          </button>

          <button
            disabled={busy || !position}
            onClick={() => void start("CHECK_OUT")}
          >
            ثبت خروج
          </button>
        </div>
      )}

      {session && (
        <ThemeProvider>
          <FaceLivenessDetectorCore
            key={session.sessionId}
            sessionId={session.sessionId}
            region={session.region}
            onAnalysisComplete={async () => {
              await complete();
            }}
            onError={() => {
              setMessage(
                "خطای دوربین؛ یک نشست جدید ایجاد کنید."
              );
              setSession(null);
              setChallenge(null);
            }}
            config={{
              credentialProvider: async () => {
                const data = await post(
                  "/api/attendance/aws/credentials",
                  {
                    token: session.liveSessionToken,
                  }
                );

                return {
                  accessKeyId: String(data.accessKeyId),
                  secretAccessKey: String(
                    data.secretAccessKey
                  ),
                  sessionToken: String(data.sessionToken),
                  expiration: new Date(
                    String(data.expiration)
                  ),
                };
              },
            }}
          />
        </ThemeProvider>
      )}

      {session && (
        <button
          onClick={() => {
            setSession(null);
            setChallenge(null);
          }}
        >
          لغو
        </button>
      )}

      <p style={{ fontSize: 12 }}>
        ویدئوی زنده توسط AWS پردازش می‌شود؛ سهند تصویر
        زنده را ذخیره نمی‌کند.
      </p>
    </main>
  );
}
