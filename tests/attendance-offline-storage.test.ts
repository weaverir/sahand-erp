import test from "node:test";
import assert from "node:assert/strict";

test("offline storage module exposes browser-only storage factory", async () => {
  const module = await import(
    "../modules/attendance/attendance-offline-storage"
  );

  assert.equal(
    typeof module.createAttendanceOfflineStorage,
    "function"
  );
});

test("offline storage does not execute IndexedDB during module import", async () => {
  const module = await import(
    "../modules/attendance/attendance-offline-storage"
  );

  assert.doesNotThrow(() => {
    assert.equal(
      typeof module.createAttendanceOfflineStorage,
      "function"
    );
  });
});

test("offline storage requires a browser environment", async () => {
  const { createAttendanceOfflineStorage } = await import(
    "../modules/attendance/attendance-offline-storage"
  );

  const storage = createAttendanceOfflineStorage();

  await assert.rejects(
    () => storage.getAll(),
    /OFFLINE_STORAGE_REQUIRES_BROWSER|INDEXED_DB/
  );
});