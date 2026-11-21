/** Pure validation shared by employee leave submission and tests. */
export type LeaveSubmission = { leaveTypeKey: string; startAt: Date; endAt: Date; requestedMinutes: number; reason: string | null };
export function validateLeaveSubmission(input: unknown, now = new Date()): LeaveSubmission {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('اطلاعات درخواست نامعتبر است.');
  const x = input as Record<string, unknown>;
  if (typeof x.leaveTypeKey !== 'string' || !/^[a-zA-Z0-9_-]{1,60}$/.test(x.leaveTypeKey)) throw new Error('نوع مرخصی نامعتبر است.');
  if (typeof x.startAt !== 'string' || typeof x.endAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(x.startAt) || !/^\d{4}-\d{2}-\d{2}T/.test(x.endAt)) throw new Error('تاریخ مرخصی نامعتبر است.');
  const startAt = new Date(x.startAt), endAt = new Date(x.endAt);
  if (!Number.isFinite(startAt.getTime()) || !Number.isFinite(endAt.getTime()) || startAt >= endAt) throw new Error('بازه مرخصی نامعتبر است.');
  if (startAt.getTime() < now.getTime() - 366 * 86400000 || endAt.getTime() > now.getTime() + 366 * 86400000) throw new Error('بازه درخواست خارج از محدوده مجاز است.');
  if (!Number.isSafeInteger(x.requestedMinutes) || (x.requestedMinutes as number) < 1 || (x.requestedMinutes as number) > 60 * 24 * 31 || (x.requestedMinutes as number) > (endAt.getTime() - startAt.getTime()) / 60000) throw new Error('مدت مرخصی نامعتبر است.');
  if (typeof x.reason !== 'string' || x.reason.trim().length > 1000) throw new Error('توضیحات نامعتبر است.');
  return { leaveTypeKey: x.leaveTypeKey, startAt, endAt, requestedMinutes: x.requestedMinutes as number, reason: x.reason.trim() || null };
}
export function nextUndecidedStep<T extends { decision: string | null; stepOrder: number }>(steps: T[]): T | undefined {
  return [...steps].sort((a,b)=>a.stepOrder-b.stepOrder).find(step => step.decision === null);
}

/** Reviewer authorization: production approvals must be scoped to the employee's unit. */
export function canReviewLeaveStep(input: {
  requiredRole: 'HR_MANAGER' | 'CEO_OR_DEPUTY' | 'SECTION_SUPERVISOR' | 'PRODUCTION_MANAGER';
  roleKeys: ReadonlySet<string>;
  reviewerAssignments: ReadonlyArray<{ id: string; organizationUnitId: string; roleKeys: ReadonlyArray<string> }>;
  employeeManagerAssignmentId: string | null;
  employeeOrganizationUnitId: string;
}): boolean {
  switch (input.requiredRole) {
    case 'HR_MANAGER': return input.roleKeys.has('hr_manager');
    case 'CEO_OR_DEPUTY': return input.roleKeys.has('ceo') || input.roleKeys.has('ceo_deputy');
    case 'SECTION_SUPERVISOR':
      return input.employeeManagerAssignmentId !== null &&
        input.reviewerAssignments.some(a => a.id === input.employeeManagerAssignmentId);
    case 'PRODUCTION_MANAGER':
      return input.reviewerAssignments.some(a =>
        a.organizationUnitId === input.employeeOrganizationUnitId &&
        a.roleKeys.includes('production_manager'));
  }
}
