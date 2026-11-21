import assert from "node:assert/strict";
import test from "node:test";
import { authorizeHrAttendanceAction, type HrAttendanceAuthorizationInput } from "../modules/attendance/attendance-hr-authorization";

const valid: HrAttendanceAuthorizationInput = {
  action: "REVIEW_CORRECTION",
  permissionAllowed: true,
  permissionScopes: ["ALL"],
  isSystemAdmin: false,
  activeAssignmentRoleKeys: ["hr_manager"],
  recordWithinAuthorizedScope: true,
};

for (const action of ["REQUEST_CORRECTION", "REVIEW_CORRECTION", "APPROVE_RECORD"] as const) {
  test(`HR manager may perform ${action} with verified global scope`, () => {
    assert.deepEqual(authorizeHrAttendanceAction({ ...valid, action }), { allowed: true, reason: "ALLOWED" });
  });
}

test("system administrator is not an HR business approver", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, isSystemAdmin: true }).reason, "SYSTEM_ADMIN_NOT_BUSINESS_APPROVER");
});
test("system administrator is denied even if also assigned HR role", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, isSystemAdmin: true, activeAssignmentRoleKeys: ["hr_manager", "system_admin"] }).allowed, false);
});
test("permission is mandatory", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, permissionAllowed: false }).reason, "PERMISSION_DENIED");
});
test("HR role must be active and server verified", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, activeAssignmentRoleKeys: ["ceo"] }).reason, "HR_ROLE_REQUIRED");
});
test("global role grant alone does not replace HR role", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, activeAssignmentRoleKeys: [] }).allowed, false);
});
test("OWN scope does not authorize organization-wide HR corrections", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, permissionScopes: ["OWN"] }).reason, "SCOPE_DENIED");
});
test("record outside verified scope is rejected", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, recordWithinAuthorizedScope: false }).reason, "SCOPE_DENIED");
});
test("explicit denial is enforced", () => {
  assert.equal(authorizeHrAttendanceAction({ ...valid, permissionAllowed: false, permissionScopes: ["ALL"] }).allowed, false);
});
