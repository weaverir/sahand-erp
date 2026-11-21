import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_VERSION = "v1";

function getKey(): Buffer {
  const value = process.env.ATTENDANCE_BIOMETRIC_KEY_V1;
  if (!value) throw new Error("ATTENDANCE_BIOMETRIC_KEY_V1 is not configured.");
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("Biometric key must be base64 for exactly 32 bytes.");
  return key;
}

export function encryptReferenceImage(plain: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { encrypted, iv, authTag: cipher.getAuthTag(), keyVersion: KEY_VERSION };
}

export function decryptReferenceImage(input: {
  encrypted: Uint8Array; iv: Uint8Array; authTag: Uint8Array; keyVersion: string;
}): Buffer {
  if (input.keyVersion !== KEY_VERSION) throw new Error("Unsupported biometric key version.");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(input.iv));
  decipher.setAuthTag(Buffer.from(input.authTag));
  return Buffer.concat([decipher.update(Buffer.from(input.encrypted)), decipher.final()]);
}
