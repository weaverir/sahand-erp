"use client";

import type {
  OfflinePunch,
  NewOfflinePunch,
} from "@/modules/attendance/attendance-offline-queue";

const DATABASE_NAME = "sahand-attendance";
const DATABASE_VERSION = 1;
const STORE_NAME = "offline-punches";

const INDEX_STATUS = "status";
const INDEX_OCCURRED_AT = "occurredAtDevice";

export interface OfflineStorageStats {
  total: number;
  pending: number;
  synced: number;
  reviewRequired: number;
}

export interface OfflineStorage {
  add(punch: OfflinePunch): Promise<void>;
  addNew(input: NewOfflinePunch): Promise<OfflinePunch>;
  get(id: string): Promise<OfflinePunch | null>;
  getAll(): Promise<OfflinePunch[]>;
  getPending(): Promise<OfflinePunch[]>;
  update(punch: OfflinePunch): Promise<void>;
  markSynced(id: string, receiptId: string): Promise<void>;
  markReviewRequired(id: string, reason: string): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  remove(id: string): Promise<void>;
  clearSynced(): Promise<number>;
  stats(): Promise<OfflineStorageStats>;
  clearAll(): Promise<void>;
}

function assertBrowser(): void {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    throw new Error("OFFLINE_STORAGE_REQUIRES_BROWSER");
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("INDEXED_DB_ERROR"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("INDEXED_DB_TRANSACTION_ERROR"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("INDEXED_DB_TRANSACTION_ABORTED"));
  });
}

function openDatabase(): Promise<IDBDatabase> {
  assertBrowser();

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      let store: IDBObjectStore;

      if (!database.objectStoreNames.contains(STORE_NAME)) {
        store = database.createObjectStore(STORE_NAME, {
          keyPath: "id",
        });
      } else {
        store = request.transaction!.objectStore(STORE_NAME);
      }

      if (!store.indexNames.contains(INDEX_STATUS)) {
        store.createIndex(INDEX_STATUS, "status", {
          unique: false,
        });
      }

      if (!store.indexNames.contains(INDEX_OCCURRED_AT)) {
        store.createIndex(INDEX_OCCURRED_AT, "occurredAtDevice", {
          unique: false,
        });
      }
    };

    request.onsuccess = () => {
      const database = request.result;

      database.onversionchange = () => {
        database.close();
      };

      resolve(database);
    };

    request.onerror = () => {
      reject(
        request.error ?? new Error("INDEXED_DB_OPEN_FAILED")
      );
    };

    request.onblocked = () => {
      reject(new Error("INDEXED_DB_OPEN_BLOCKED"));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    const request = operation(store);
    const result = await requestToPromise(request);
    await transactionToPromise(transaction);

    return result;
  } finally {
    database.close();
  }
}

function sortByAttendanceTime(
  punches: OfflinePunch[]
): OfflinePunch[] {
  return punches.sort(
    (a, b) =>
      Date.parse(a.occurredAtDevice) -
        Date.parse(b.occurredAtDevice) ||
      a.capturedMonotonicMs - b.capturedMonotonicMs ||
      a.id.localeCompare(b.id)
  );
}

export function createAttendanceOfflineStorage(): OfflineStorage {
  return {
    async add(punch) {
      if (!punch || typeof punch !== "object") {
        throw new Error("INVALID_PUNCH");
      }

      await withStore("readwrite", store => store.add(punch));
    },

    async addNew(input) {
      const { createOfflinePunch } = await import(
        "@/modules/attendance/attendance-offline-queue"
      );

      const punch = createOfflinePunch(input);

      await this.add(punch);

      return punch;
    },

    async get(id) {
      const result = await withStore("readonly", store =>
        store.get(id)
      );

      return result ?? null;
    },

    async getAll() {
      const result = await withStore("readonly", store =>
        store.getAll()
      );

      return sortByAttendanceTime(result);
    },

    async getPending() {
      const result = await withStore("readonly", store =>
        store.index(INDEX_STATUS).getAll("PENDING")
      );

      return sortByAttendanceTime(result);
    },

    async update(punch) {
      await withStore("readwrite", store =>
        store.put(punch)
      );
    },

    async markSynced(id, receiptId) {
      if (!receiptId || receiptId.trim().length === 0) {
        throw new Error("INVALID_RECEIPT");
      }

      const database = await openDatabase();

      try {
        const transaction = database.transaction(
          STORE_NAME,
          "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        const punch = await requestToPromise(request);

        if (!punch) {
          throw new Error("PUNCH_NOT_FOUND");
        }

        if (punch.status !== "PENDING") {
          return;
        }

        punch.status = "SYNCED";
        punch.serverReceiptId = receiptId;
        punch.attempts += 1;

        store.put(punch);

        await transactionToPromise(transaction);
      } finally {
        database.close();
      }
    },

    async markReviewRequired(id, reason) {
      if (!reason || reason.trim().length === 0) {
        throw new Error("INVALID_REVIEW_REASON");
      }

      const database = await openDatabase();

      try {
        const transaction = database.transaction(
          STORE_NAME,
          "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        const punch = await requestToPromise(request);

        if (!punch) {
          throw new Error("PUNCH_NOT_FOUND");
        }

        if (punch.status !== "PENDING") {
          return;
        }

        punch.status = "REVIEW_REQUIRED";
        punch.reviewReason = reason;
        punch.attempts += 1;

        store.put(punch);

        await transactionToPromise(transaction);
      } finally {
        database.close();
      }
    },

    async incrementAttempts(id) {
      const database = await openDatabase();

      try {
        const transaction = database.transaction(
          STORE_NAME,
          "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(id);

        const punch = await requestToPromise(request);

        if (!punch) {
          throw new Error("PUNCH_NOT_FOUND");
        }

        if (punch.status !== "PENDING") {
          return;
        }

        punch.attempts += 1;

        store.put(punch);

        await transactionToPromise(transaction);
      } finally {
        database.close();
      }
    },

    async remove(id) {
      await withStore("readwrite", store =>
        store.delete(id)
      );
    },

    async clearSynced() {
      const database = await openDatabase();

      try {
        const transaction = database.transaction(
          STORE_NAME,
          "readwrite"
        );

        const store = transaction.objectStore(STORE_NAME);
        const request = store.index(INDEX_STATUS).openCursor("SYNCED");

        let deleted = 0;

        await new Promise<void>((resolve, reject) => {
          request.onerror = () => {
            reject(
              request.error ??
                new Error("INDEXED_DB_CURSOR_ERROR")
            );
          };

          request.onsuccess = () => {
            const cursor = request.result;

            if (!cursor) {
              resolve();
              return;
            }

            cursor.delete();
            deleted += 1;
            cursor.continue();
          };
        });

        await transactionToPromise(transaction);

        return deleted;
      } finally {
        database.close();
      }
    },

    async stats() {
      const all = await this.getAll();

      return {
        total: all.length,
        pending: all.filter(
          punch => punch.status === "PENDING"
        ).length,
        synced: all.filter(
          punch => punch.status === "SYNCED"
        ).length,
        reviewRequired: all.filter(
          punch => punch.status === "REVIEW_REQUIRED"
        ).length,
      };
    },

    async clearAll() {
      await withStore("readwrite", store =>
        store.clear()
      );
    },
  };
}