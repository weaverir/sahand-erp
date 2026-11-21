type AttendanceRecordState = "OPEN" | "COMPLETED" | "PENDING_REVIEW" | "APPROVED" | "REJECTED";

/** COMPLETED is a valid calculated record for preview, but not HR-finalized. */
export function attendanceStatusIssue(status: AttendanceRecordState): string | null {
  switch (status) {
    case "COMPLETED":
    case "APPROVED":
      return null;
    case "OPEN":
      return "Attendance record is still open";
    case "PENDING_REVIEW":
      return "Attendance record is pending review";
    case "REJECTED":
      return "Attendance record was rejected";
  }
}


