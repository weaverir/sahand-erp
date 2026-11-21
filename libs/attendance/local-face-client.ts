import "server-only";

const base = process.env.LOCAL_FACE_SERVICE_URL ?? "http://127.0.0.1:8765";
const secret = process.env.LOCAL_FACE_SERVICE_KEY;

export async function localFaceRequest<T>(path: string, payload: object): Promise<T> {
  if (!secret || secret.length < 32) throw new Error("LOCAL_FACE_SERVICE_KEY تنظیم نشده است.");
  // Private loopback by default; remote deployment requires a protected internal network.
  const endpoint = new URL(path, base);
  if (!(["127.0.0.1", "localhost", "::1"].includes(endpoint.hostname) ||
    process.env.LOCAL_FACE_ALLOW_PRIVATE_NETWORK === "true")) {
    throw new Error("آدرس سرویس چهره باید داخلی و قابل اعتماد باشد.");
  }
  const response = await fetch(endpoint, {
    method: "POST", cache: "no-store",
    headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`سرویس داخلی چهره درخواست را رد کرد (${response.status}).`);
  return response.json() as Promise<T>;
}
