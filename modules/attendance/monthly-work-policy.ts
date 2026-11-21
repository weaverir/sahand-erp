/** Pure monthly attendance policy. No database writes or side effects. */
export type MinuteInterval = { startAt: string; endAt: string };
export type MonthlyPeriodStatus = "OPEN" | "CALCULATING" | "PENDING_REVIEW" | "CLOSED" | "REOPENED";
export type DailyWorkInput = {
  required: MinuteInterval[];
  attendance: MinuteInterval[];
  approvedLeave: MinuteInterval[];
};
export type DailyWorkResult = {
  requiredMinutes: number;
  workedMinutes: number;
  leaveCoveredMinutes: number;
  coveredMinutes: number;
  uncoveredMinutes: number;
};
function parsed(value: string): number {
  const n = Date.parse(value);
  if (!Number.isFinite(n) || !/(Z|[+-]\d\d:\d\d)$/.test(value)) {
    throw new Error("Intervals require valid ISO timestamps with an explicit timezone");
  }
  return n;
}
function normalized(items: MinuteInterval[]): Array<[number, number]> {
  const sorted = items.map(({startAt,endAt}) => {
    const start = parsed(startAt), end = parsed(endAt);
    if (end <= start || start % 60000 !== 0 || end % 60000 !== 0) {
      throw new Error("Intervals must be positive and minute-aligned");
    }
    return [start,end] as [number,number];
  }).sort((a,b)=>a[0]-b[0]);
  const result: Array<[number,number]> = [];
  for (const [start,end] of sorted) {
    const last = result[result.length-1];
    if (last && start <= last[1]) last[1] = Math.max(last[1],end);
    else result.push([start,end]);
  }
  return result;
}
function intersection(a: Array<[number,number]>, b: Array<[number,number]>): number {
  let i=0,j=0,total=0;
  while (i<a.length && j<b.length) {
    total += Math.max(0,Math.min(a[i][1],b[j][1])-Math.max(a[i][0],b[j][0]));
    if(a[i][1]<b[j][1]) i++; else j++;
  }
  return total/60000;
}
export function calculateDailyWork(input: DailyWorkInput): DailyWorkResult {
  const required=normalized(input.required);
  const attendance=normalized(input.attendance);
  const leave=normalized(input.approvedLeave);
  const workedMinutes=intersection(required,attendance);
  // Presence takes precedence over approved leave in overlapping intervals.
  const leaveCoveredMinutes=intersection(required,leave)-intersection(required, normalized([
    ...input.approvedLeave.flatMap(l => {
      const ls=parsed(l.startAt),le=parsed(l.endAt);
      return input.attendance.flatMap(a => {
        const s=Math.max(ls,parsed(a.startAt)),e=Math.min(le,parsed(a.endAt));
        return s<e?[{startAt:new Date(s).toISOString(),endAt:new Date(e).toISOString()}]:[];
      });
    })
  ]));
  const requiredMinutes=required.reduce((s,[a,b])=>s+(b-a)/60000,0);
  const coveredMinutes=workedMinutes+leaveCoveredMinutes;
  return {requiredMinutes,workedMinutes,leaveCoveredMinutes,coveredMinutes,
    uncoveredMinutes:Math.max(0,requiredMinutes-coveredMinutes)};
}
export function monthlyLeaveBalance(openingMinutes:number,creditMinutes:number,usedMinutes:number):number {
  for(const n of [openingMinutes,creditMinutes,usedMinutes]) if(!Number.isSafeInteger(n)) throw new Error("Minute amounts must be safe integers");
  if(creditMinutes<0||usedMinutes<0) throw new Error("Credit and usage cannot be negative");
  return openingMinutes+creditMinutes-usedMinutes;
}
export function mayCloseMonthlyPeriod(input:{status:MonthlyPeriodStatus;actorIsHrApprover:boolean;unresolvedCount:number;calculationComplete:boolean}):boolean {
  return input.status==="PENDING_REVIEW" && input.actorIsHrApprover &&
    Number.isSafeInteger(input.unresolvedCount) && input.unresolvedCount===0 && input.calculationComplete;
}
/** The period is named by Jalali year and month, not Gregorian month. */
export function jalaliMonthKey(year:number,month:number):string {
  if(!Number.isInteger(year)||year<1||!Number.isInteger(month)||month<1||month>12) throw new Error("Invalid Jalali period");
  return `${year}-${String(month).padStart(2,"0")}`;
}
