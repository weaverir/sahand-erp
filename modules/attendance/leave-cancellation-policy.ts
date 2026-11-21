/** Employee withdrawal is only allowed before the first approval decision. */
export function canWithdrawLeave(input: {
  status: string;
  employeeUserId: string;
  actorUserId: string;
  approvalDecisions: ReadonlyArray<string | null>;
}): boolean {
  return input.employeeUserId === input.actorUserId &&
    input.status === 'PENDING' &&
    input.approvalDecisions.every(decision => decision === null);
}
