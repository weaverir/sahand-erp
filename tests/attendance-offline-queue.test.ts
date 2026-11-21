import test from "node:test";
import assert from "node:assert/strict";
import { createOfflinePunch, enqueueOfflinePunch, pendingForSync, applySyncResponse, countPending } from "../modules/attendance/attendance-offline-queue";
const make = (id: string, kind: "CHECK_IN"|"CHECK_OUT", time: string) => createOfflinePunch({ id, deviceId: "tablet-1", employeeId: "employee-1", kind, occurredAtDevice: time, capturedMonotonicMs: 1 });
test("creates pending punch without biometric payload", () => { const p = make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); assert.equal(p.status, "PENDING"); assert.equal("faceImage" in p, false); });
test("rejects duplicate ids", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); assert.throws(() => enqueueOfflinePunch([p],p), /DUPLICATE/); });
test("orders overnight checkin before next-day checkout", () => { const a=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"), b=make("b", "CHECK_OUT", "2026-11-19T07:00:00+03:30"); assert.deepEqual(pendingForSync([b,a]).map(p=>p.id), ["a","b"]); });
test("accepted punch becomes synced", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); const q=applySyncResponse([p],"a",{outcome:"ACCEPTED",receiptId:"r1"}); assert.equal(q[0].status,"SYNCED"); assert.equal(countPending(q),0); });
test("idempotent duplicate server acknowledgement becomes synced", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); assert.equal(applySyncResponse([p],"a",{outcome:"ALREADY_EXISTS",receiptId:"r1"})[0].status,"SYNCED"); });
test("transient network failure retains punch", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); const q=applySyncResponse([p],"a",{outcome:"RETRY"}); assert.equal(q[0].status,"PENDING"); assert.equal(q[0].attempts,1); });
test("uncertain punch requires review", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); const q=applySyncResponse([p],"a",{outcome:"REVIEW_REQUIRED",reason:"CLOCK_DRIFT"}); assert.equal(q[0].status,"REVIEW_REQUIRED"); });
test("acknowledged punches cannot be reverted by late retry", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); const q=applySyncResponse([p],"a",{outcome:"ACCEPTED",receiptId:"r1"}); assert.deepEqual(applySyncResponse(q,"a",{outcome:"RETRY"}),q); });
test("rejects malformed timestamps", () => { assert.throws(() => make("a", "CHECK_IN", "yesterday"),/INVALID_TIME/); });
test("does not mutate original queue", () => { const p=make("a", "CHECK_IN", "2026-11-18T23:00:00+03:30"); const original=[p]; applySyncResponse(original,"a",{outcome:"RETRY"}); assert.equal(original[0].attempts,0); });

