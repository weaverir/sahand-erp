
import "server-only";

import {
  mkdir,
  writeFile,
  unlink,
} from "node:fs/promises";

import path from "node:path";

import {
  createHash,
  randomUUID,
} from "node:crypto";

export class PrivateFileStorageError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "PrivateFileStorageError";
  }
}

export type StoredPrivateFile = {
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
};

type StoreFileOptions = {
  directory: string;
  maxBytes: number;
  allowedMimeTypes: readonly string[];
};

const MIME_SIGNATURES = [
  {
    mime: "image/jpeg",
    extension: "jpg",
    matches: (b: Buffer) =>
      b.length >= 3 &&
      b[0] === 0xff &&
      b[1] === 0xd8 &&
      b[2] === 0xff,
  },
  {
    mime: "image/png",
    extension: "png",
    matches: (b: Buffer) =>
      b.length >= 8 &&
      b.subarray(0, 8).equals(
        Buffer.from([
          0x89, 0x50, 0x4e, 0x47,
          0x0d, 0x0a, 0x1a, 0x0a,
        ])
      ),
  },
  {
    mime: "image/webp",
    extension: "webp",
    matches: (b: Buffer) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
  {
    mime: "application/pdf",
    extension: "pdf",
    matches: (b: Buffer) =>
      b.length >= 5 &&
      b.toString("ascii", 0, 5) === "%PDF-",
  },
] as const;

function getStorageRoot() {
  return path.resolve(
    process.env.PRIVATE_UPLOAD_DIR ||
    path.join(process.cwd(), "private-uploads")
  );
}

function resolveStoragePath(storageKey: string) {
  const root = getStorageRoot();

  const normalizedKey = storageKey.replace(/\\/g, "/");

  if (
    normalizedKey.startsWith("/") ||
    normalizedKey.split("/").some(
      (part) => !part || part === "." || part === ".."
    )
  ) {
    throw new PrivateFileStorageError(
      "مسیر فایل معتبر نیست.",
      400
    );
  }

  const absolutePath = path.resolve(
    root,
    ...normalizedKey.split("/")
  );

  if (!absolutePath.startsWith(root + path.sep)) {
    throw new PrivateFileStorageError(
      "دسترسی به مسیر فایل مجاز نیست.",
      403
    );
  }

  return absolutePath;
}

function sanitizeFileName(name: string) {
  const baseName = path
    .basename(name.replace(/\\/g, "/"))
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim();

  return baseName.slice(0, 180) || "document";
}

export async function storePrivateFile(
  file: File,
  options: StoreFileOptions
): Promise<StoredPrivateFile> {
  if (!file || file.size <= 0) {
    throw new PrivateFileStorageError(
      "فایل ارسالی خالی است."
    );
  }

  if (file.size > options.maxBytes) {
    throw new PrivateFileStorageError(
      "حجم فایل بیشتر از حد مجاز است."
    );
  }

  if (
    !/^[a-zA-Z0-9/_-]+$/.test(options.directory)
  ) {
    throw new PrivateFileStorageError(
      "مسیر ذخیره‌سازی نامعتبر است."
    );
  }

  const buffer = Buffer.from(
    await file.arrayBuffer()
  );

  if (buffer.length !== file.size) {
    throw new PrivateFileStorageError(
      "خواندن فایل با مشکل مواجه شد."
    );
  }

  const detected = MIME_SIGNATURES.find(
    (signature) => signature.matches(buffer)
  );

  if (!detected) {
    throw new PrivateFileStorageError(
      "نوع واقعی فایل قابل شناسایی نیست."
    );
  }

  if (
    !options.allowedMimeTypes.includes(
      detected.mime
    )
  ) {
    throw new PrivateFileStorageError(
      "نوع فایل مجاز نیست."
    );
  }

  if (
    file.type &&
    file.type !== detected.mime &&
    file.type !== "application/octet-stream"
  ) {
    throw new PrivateFileStorageError(
      "نوع اعلام‌شده با محتوای واقعی فایل مطابقت ندارد."
    );
  }

  const storageKey =
    `${options.directory}/${randomUUID()}.${detected.extension}`;

  const absolutePath = resolveStoragePath(storageKey);

  await mkdir(path.dirname(absolutePath), {
    recursive: true,
    mode: 0o700,
  });

  await writeFile(absolutePath, buffer, {
    flag: "wx",
    mode: 0o600,
  });

  const checksum = createHash("sha256")
    .update(buffer)
    .digest("hex");

  return {
    fileName: sanitizeFileName(file.name),
    storageKey,
    mimeType: detected.mime,
    sizeBytes: buffer.length,
    checksum,
  };
}

export async function deletePrivateFile(
  storageKey: string
) {
  const absolutePath = resolveStoragePath(storageKey);

  try {
    await unlink(absolutePath);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }

    throw error;
  }
}
