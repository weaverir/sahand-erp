/** Employee-level interval conflict detection. Shift templates may overlap. */
export type ShiftInterval = { startsAt: Date; endsAt: Date; id?: string; label?: string };
export type ShiftConflict = { proposed: ShiftInterval; existing: ShiftInterval; overlapMinutes: number };

function valid(i: ShiftInterval): void {
  if (!(i.startsAt instanceof Date) || !(i.endsAt instanceof Date) ||
      !Number.isFinite(i.startsAt.getTime()) || !Number.isFinite(i.endsAt.getTime()) ||
      i.startsAt >= i.endsAt) throw new Error('Invalid shift interval');
}

/** Half-open intervals [start,end): ending exactly when another starts is allowed. */
export function shiftOverlapMinutes(a: ShiftInterval, b: ShiftInterval): number {
  valid(a); valid(b);
  return Math.max(0, Math.min(+a.endsAt, +b.endsAt) - Math.max(+a.startsAt, +b.startsAt)) / 60000;
}

export function findEmployeeShiftConflicts(proposed: ShiftInterval[], existing: ShiftInterval[]): ShiftConflict[] {
  const conflicts: ShiftConflict[] = [];
  for (const p of proposed) valid(p);
  for (const e of existing) valid(e);
  for (let i = 0; i < proposed.length; i++) {
    for (const e of existing) {
      const overlapMinutes = shiftOverlapMinutes(proposed[i], e);
      if (overlapMinutes > 0) conflicts.push({ proposed: proposed[i], existing: e, overlapMinutes });
    }
    for (let j = 0; j < i; j++) {
      const overlapMinutes = shiftOverlapMinutes(proposed[i], proposed[j]);
      if (overlapMinutes > 0) conflicts.push({ proposed: proposed[i], existing: proposed[j], overlapMinutes });
    }
  }
  return conflicts;
}
