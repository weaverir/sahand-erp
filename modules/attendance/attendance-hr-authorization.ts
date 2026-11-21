/**
 * Sahand ERP — pure authorization rules for HR attendance corrections.
 * This is a second gate AFTER server-side authentication and permission checks.
 * Do not derive these inputs from client-provided role names or scopes.
 */
export type HrAttendanceAction = "REQUEST_CORRECTION" | "REVIEW_CORRECTION" | "APPROVE_RECORD";

export interface HrAttendanceAuthorizationInput {
  action: HrAttendanceAction;
  permissionAllowed: boolean;
  permissionScopes: readonly string[];
  isSystemAdmin: boolean;
  /** Role keys obtained from the user's active, server-verified assignments. */
  activeAssignmentRoleKeys: readonly string[];
  /** True only when the server has independently verified the record's scope. */
  recordWithinAuthorizedScope: boolean;
}

export type HrAttendanceAuthorizationResult =
  | { allowed: true; reason: "ALLOWED" }
  | { allowed: false; reason: "PERMISSION_DENIED" | "SYSTEM_ADMIN_NOT_BUSINESS_APPROVER" | "HR_ROLE_REQUIRED" | "SCOPE_DENIED" };

export function authorizeHrAttendanceAction(input: HrAttendanceAuthorizationInput): HrAttendanceAuthorizationResult {
  if (input.isSystemAdmin) {
    return { allowed: false, reason: "SYSTEM_ADMIN_NOT_BUSINESS_APPROVER" };
  }
  if (!input.permissionAllowed) {
    return { allowed: false, reason: "PERMISSION_DENIED" };
  }
  if (!input.activeAssignmentRoleKeys.includes("hr_manager")) {
    return { allowed: false, reason: "HR_ROLE_REQUIRED" };
  }
  if (!input.recordWithinAuthorizedScope || !input.permissionScopes.includes("ALL")) {
    return { allowed: false, reason: "SCOPE_DENIED" };
  }
  return { allowed: true, reason: "ALLOWED" };
}
