
import { NextRequest } from "next/server";

import {
  EmployeeShiftScheduleStatus as Status,
  Prisma,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";
import { findEmployeeShiftConflicts } from "@/modules/shifts/employee-shift-overlap";
import { lockShiftAssignments } from "@/modules/shifts/assignment-conflict-db";
import { findRecurringVsWeeklyConflict } from "@/modules/shifts/recurring-vs-weekly";
import type { RecurringAssignment } from "@/modules/shifts/recurring-shift-conflict";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  assertSameOriginRequest,
  authenticateRequest,
} from "@/modules/auth/auth.middleware";

type Context = {
  params: Promise<{ id: string }>;
};

type ReviewAction = "APPROVE" | "REJECT";

class ReviewError extends Error {
  constructor(
    message: string,
    public statusCode = 400
  ) {
    super(message);
    this.name = "ReviewError";
  }
}

function isObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function handleError(error: unknown) {
  if (error instanceof ReviewError) {
    return errorResponse(
      error.message,
      error.statusCode
    );
  }

  if (
    error instanceof Error &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return errorResponse(
      error.message,
      error.statusCode
    );
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  ) {
    return errorResponse(
      "تداخل در ثبت تصمیم رخ داد. دوباره تلاش کنید.",
      409
    );
  }

  console.error("[WEEKLY_SCHEDULE_REVIEW]", error);

  return errorResponse(
    "خطا در بررسی برنامه هفتگی.",
    500
  );
}

/**
 * بررسی نقش واقعی مدیر منابع انسانی.
 *
 * نقش عمومی یا نقش مربوط به یک مسئولیت سازمانی
 * باید فعال و منقضی‌نشده باشد.
 *
 * system_admin به‌تنهایی اجازه تأیید ندارد.
 */
async function assertHrManager(
  userId: string
): Promise<void> {
  const now = new Date();

  const user = await prisma.user.findFirst({
    where: {
      id: userId,
      isActive: true,
      accessLevel: "ERP",
    },
    select: {
      roles: {
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
          role: {
            key: "hr_manager",
            isActive: true,
          },
        },
        select: {
          id: true,
        },
        take: 1,
      },
      employeeAssignments: {
        where: {
          status: "ACTIVE",
          startDate: { lte: now },
          OR: [
            { endDate: null },
            { endDate: { gt: now } },
          ],
        },
        select: {
          roles: {
            where: {
              isActive: true,
              OR: [
                { expiresAt: null },
                { expiresAt: { gt: now } },
              ],
              role: {
                key: "hr_manager",
                isActive: true,
              },
            },
            select: {
              id: true,
            },
            take: 1,
          },
        },
      },
    },
  });

  const hasGlobalRole =
    (user?.roles.length ?? 0) > 0;

  const hasAssignmentRole =
    user?.employeeAssignments.some(
      (assignment) => assignment.roles.length > 0
    ) ?? false;

  if (!hasGlobalRole && !hasAssignmentRole) {
    throw new ReviewError(
      "فقط مدیر منابع انسانی مجاز به تأیید یا رد برنامه هفتگی است.",
      403
    );
  }
}

/**
 * POST /api/attendance/weekly-schedules/:id/review
 *
 * {
 *   "action": "APPROVE" | "REJECT",
 *   "comment": "..."
 * }
 */
export async function POST(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const actor = await authenticateRequest(request);

    await assertHrManager(actor.id);

    const { id } = await context.params;

    if (!id || id.length > 100) {
      throw new ReviewError(
        "شناسه برنامه معتبر نیست."
      );
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      throw new ReviewError(
        "ساختار JSON درخواست معتبر نیست."
      );
    }

    if (!isObject(body)) {
      throw new ReviewError(
        "اطلاعات بررسی معتبر نیست."
      );
    }

    const action = body.action;

    if (action !== "APPROVE" && action !== "REJECT") {
      throw new ReviewError(
        "عملیات باید APPROVE یا REJECT باشد."
      );
    }

    const reviewAction: ReviewAction = action;

    const rawComment = body.comment;

    if (
      rawComment !== undefined &&
      rawComment !== null &&
      typeof rawComment !== "string"
    ) {
      throw new ReviewError(
        "توضیحات بررسی معتبر نیست."
      );
    }

    const comment =
      typeof rawComment === "string"
        ? rawComment.trim()
        : "";

    if (comment.length > 2000) {
      throw new ReviewError(
        "توضیحات نباید بیشتر از ۲۰۰۰ کاراکتر باشد."
      );
    }

    if (
      reviewAction === "REJECT" &&
      comment.length === 0
    ) {
      throw new ReviewError(
        "برای رد برنامه، ثبت دلیل الزامی است."
      );
    }

    const result = await prisma.$transaction(
      async (tx) => {
        // Shared transaction lock with direct shift-assignment writers.
        await lockShiftAssignments(tx);
        // Read employee ID before taking the per-employee lock.
        const reference =
          await tx.employeeShiftSchedule.findUnique({
            where: { id },
            select: {
              employeeUserId: true,
            },
          });

        if (!reference) {
          throw new ReviewError(
            "برنامه هفتگی یافت نشد.",
            404
          );
        }

        // Serialize decisions for all schedules of this employee.
        const lockedUsers = await tx.$queryRaw<
          Array<{ id: string }>
        >`
          SELECT id
          FROM "User"
          WHERE id = ${reference.employeeUserId}
          FOR UPDATE
        `;

        if (lockedUsers.length === 0) {
          throw new ReviewError(
            "کارمند مربوط به برنامه یافت نشد.",
            404
          );
        }

        const current =
          await tx.employeeShiftSchedule.findUnique({
            where: { id },
            include: {
              segments: {
                orderBy: [
                  { workDate: "asc" },
                  { segmentOrder: "asc" },
                ],
              },
            },
          });

        if (!current) {
          throw new ReviewError(
            "برنامه هفتگی یافت نشد.",
            404
          );
        }

        if (current.status !== Status.SUBMITTED) {
          throw new ReviewError(
            "فقط برنامه ارسال‌شده و در انتظار بررسی قابل تأیید یا رد است.",
            409
          );
        }

        const latest =
          await tx.employeeShiftSchedule.findFirst({
            where: {
              employeeUserId: current.employeeUserId,
              weekStartDate: current.weekStartDate,
            },
            orderBy: {
              version: "desc",
            },
            select: {
              id: true,
            },
          });

        if (latest?.id !== current.id) {
          throw new ReviewError(
            "این برنامه آخرین نسخه نیست.",
            409
          );
        }

        if (
          reviewAction === "APPROVE" &&
          current.segments.length === 0
        ) {
          throw new ReviewError(
            "برنامه بدون بازه کاری قابل تأیید نیست."
          );
        }

        // An approved schedule must not overlap another approved week for this employee.
        // The employee row is already locked above, so competing review requests
        // using this endpoint are serialized for the same employee.
        if (reviewAction === "APPROVE") {
          const proposed = current.segments.map((segment) => ({
            startsAt: segment.startsAt,
            endsAt: segment.endsAt,
            id: segment.id,
          }));

          const internalConflicts = findEmployeeShiftConflicts(proposed, []);
          if (internalConflicts.length > 0) {
            throw new ReviewError(
              "بازه‌های همین برنامه با یکدیگر تداخل دارند.",
              409
            );
          }

          // Reject weekly approval if an active recurring assignment (individual,
          // unit or company) covers the same employee and overlaps any segment.
          const employeeAssignments = await tx.employeeAssignment.findMany({
            where: { userId: current.employeeUserId, status: "ACTIVE" },
            select: { id: true, organizationUnitId: true },
          });
          const assignmentIds = employeeAssignments.map((a) => a.id);
          const unitIds = employeeAssignments.map((a) => a.organizationUnitId);
          const recurringAssignments = await tx.shiftAssignment.findMany({
            where: {
              isActive: true,
              OR: [
                { targetType: "COMPANY" },
                { targetType: "UNIT", organizationUnitId: { in: unitIds } },
                { targetType: "EMPLOYEE", employeeAssignmentId: { in: assignmentIds } },
              ],
            },
            include: { shift: { include: { days: true } } },
          });
          for (const assignment of recurringAssignments) {
            const recurring: RecurringAssignment = {
              id: assignment.id,
              validFrom: assignment.validFrom.toISOString().slice(0, 10),
              validTo: assignment.validTo?.toISOString().slice(0, 10) ?? null,
              days: assignment.shift.days.map((d) => ({
                dayOfWeek: d.dayOfWeek,
                isWorkingDay: d.isWorkingDay,
                startMinute: d.startMinute,
                endMinute: d.endMinute,
                dayType: d.dayType,
              })),
            };
            for (const segment of proposed) {
              const conflict = findRecurringVsWeeklyConflict(recurring, segment);
              if (conflict) {
                throw new ReviewError(
                  `این برنامه با تخصیص شیفت ${assignment.shift.name} تداخل دارد (${conflict.overlapMinutes} دقیقه).`,
                  409
                );
              }
            }
          }

          const minStart = new Date(Math.min(...proposed.map((s) => s.startsAt.getTime())));
          const maxEnd = new Date(Math.max(...proposed.map((s) => s.endsAt.getTime())));

          const otherApproved = await tx.employeeShiftScheduleSegment.findMany({
            where: {
              startsAt: { lt: maxEnd },
              endsAt: { gt: minStart },
              schedule: {
                employeeUserId: current.employeeUserId,
                status: Status.APPROVED,
                // Revisions of this same week are superseded during approval.
                weekStartDate: { not: current.weekStartDate },
              },
            },
            select: { id: true, startsAt: true, endsAt: true },
          });

          const conflicts = findEmployeeShiftConflicts(proposed, otherApproved);
          if (conflicts.length > 0) {
            const first = conflicts[0];
            throw new ReviewError(
              `این برنامه با شیفت تأییدشده دیگری برای همین کارمند تداخل دارد (${first.overlapMinutes} دقیقه).`,
              409
            );
          }
        }

        const reviewedAt = new Date();

        // Supersede previous approved versions atomically.
        const previousApproved =
          reviewAction === "APPROVE"
            ? await tx.employeeShiftSchedule.findMany({
                where: {
                  employeeUserId: current.employeeUserId,
                  weekStartDate: current.weekStartDate,
                  status: Status.APPROVED,
                  id: { not: current.id },
                },
                select: {
                  id: true,
                  version: true,
                  status: true,
                },
              })
            : [];

        if (reviewAction === "APPROVE") {
          for (const previous of previousApproved) {
            await tx.employeeShiftSchedule.update({
              where: { id: previous.id },
              data: {
                status: Status.SUPERSEDED,
              },
            });

            await tx.employeeShiftScheduleRevision.create({
              data: {
                scheduleId: previous.id,
                actorUserId: actor.id,
                action: "SUPERSEDED",
                beforeData: {
                  status: previous.status,
                  version: previous.version,
                },
                afterData: {
                  status: Status.SUPERSEDED,
                  supersededByScheduleId: current.id,
                },
                comment:
                  "نسخه جدید برنامه هفتگی تأیید شد.",
              },
            });
          }
        }

        const nextStatus =
          reviewAction === "APPROVE"
            ? Status.APPROVED
            : Status.REJECTED;

        const updated =
          await tx.employeeShiftSchedule.update({
            where: { id: current.id },
            data: {
              status: nextStatus,
              reviewedByUserId: actor.id,
              reviewedAt,
              reviewComment: comment || null,
              publishedAt:
                reviewAction === "APPROVE"
                  ? reviewedAt
                  : null,
            },
            include: {
              segments: {
                orderBy: [
                  { workDate: "asc" },
                  { segmentOrder: "asc" },
                ],
              },
            },
          });

        await tx.employeeShiftScheduleRevision.create({
          data: {
            scheduleId: updated.id,
            actorUserId: actor.id,
            action:
              reviewAction === "APPROVE"
                ? "APPROVED"
                : "REJECTED",
            beforeData: {
              status: current.status,
              reviewedByUserId: current.reviewedByUserId,
              reviewedAt:
                current.reviewedAt?.toISOString() ?? null,
              publishedAt:
                current.publishedAt?.toISOString() ?? null,
            },
            afterData: {
              status: updated.status,
              reviewedByUserId: actor.id,
              reviewedAt: reviewedAt.toISOString(),
              publishedAt:
                updated.publishedAt?.toISOString() ?? null,
              previousApprovedVersions:
                previousApproved.map((item) => item.version),
            },
            comment: comment || null,
          },
        });

        return updated;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
        maxWait: 5000,
        timeout: 10000,
      }
    );

    return successResponse({
      schedule: result,
      message:
        reviewAction === "APPROVE"
          ? "برنامه هفتگی تأیید و منتشر شد."
          : "برنامه هفتگی رد شد.",
    });
  } catch (error) {
    return handleError(error);
  }
}
