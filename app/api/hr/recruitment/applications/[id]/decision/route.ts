
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

import {
  ApplicationDecision,
  ApplicationReviewerType,
  ApplicationStage,
  DocumentsApplicationStatus,
  InitialApplicationStatus,
  UserAccessLevel,
  EmployeeEmploymentStatus,
} from "@/generated/prisma/client";

import { prisma } from "@/libs/prisma";
import { AUTH_COOKIE_NAMES } from "@/modules/auth/auth.constants";
import { getAuthenticatedUser } from "@/modules/auth/auth.service";

type Context = {
  params: Promise<{ id: string }>;
};

class DecisionError extends Error {
  constructor(
    message: string,
    public status = 400
  ) {
    super(message);
    this.name = "DecisionError";
  }
}

// ==========================================
// PERSONNEL CODE GENERATOR
// ==========================================

function getJalaliYear(date: Date): string {
  const formatter = new Intl.DateTimeFormat(
    "en-US-u-ca-persian",
    {
      year: "numeric",
    }
  );

  const year = formatter
    .formatToParts(date)
    .find((part) => part.type === "year")?.value;

  if (!year || !/^\d{4}$/.test(year)) {
    throw new DecisionError(
      "محاسبه سال شمسی برای کد پرسنلی انجام نشد.",
      500
    );
  }

  return year;
}

async function generatePersonnelCode(
  tx: Parameters<
    Parameters<typeof prisma.$transaction>[0]
  >[0],
  now: Date
): Promise<string> {
  const jalaliYear = getJalaliYear(now);

  const prefix = `SH-${jalaliYear}-`;

  // قفل تراکنشی برای جلوگیری از تولید شماره تکراری
  await tx.$queryRaw`
    SELECT pg_advisory_xact_lock(
      hashtext(${prefix})
    )
  `;

  const latestProfile = await tx.employeeProfile.findFirst({
    where: {
      personnelCode: {
        startsWith: prefix,
      },
    },
    orderBy: {
      personnelCode: "desc",
    },
    select: {
      personnelCode: true,
    },
  });

  let nextNumber = 1;

  if (latestProfile?.personnelCode) {
    const currentNumber = Number(
      latestProfile.personnelCode.slice(prefix.length)
    );

    if (
      !Number.isSafeInteger(currentNumber) ||
      currentNumber < 1
    ) {
      throw new DecisionError(
        "آخرین کد پرسنلی ثبت‌شده معتبر نیست.",
        500
      );
    }

    nextNumber = currentNumber + 1;
  }

  if (nextNumber > 9999) {
    throw new DecisionError(
      "ظرفیت شماره‌گذاری پرسنلی این سال تکمیل شده است.",
      409
    );
  }

  return `${prefix}${String(nextNumber).padStart(4, "0")}`;
}

// ==========================================
// AUTHENTICATION & REVIEWER
// ==========================================

async function getActor() {
  const cookieStore = await cookies();

  const token = cookieStore.get(
    AUTH_COOKIE_NAMES.access
  )?.value;

  if (!token) {
    throw new DecisionError(
      "برای ادامه وارد سامانه شوید.",
      401
    );
  }

  const authUser = await getAuthenticatedUser(token);

  const user = await prisma.user.findFirst({
    where: {
      id: authUser.id,
      isActive: true,
    },
    select: {
      id: true,
      roles: {
        where: {
          isActive: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
          role: {
            isActive: true,
          },
        },
        select: {
          role: {
            select: {
              key: true,
              isSystem: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new DecisionError(
      "کاربر فعال پیدا نشد.",
      403
    );
  }

  const roleKeys = user.roles.map(
    (item) => item.role.key
  );

  const isHR = roleKeys.includes("hr_manager");

  const isExecutive =
    roleKeys.includes("ceo") ||
    roleKeys.includes("ceo_deputy");

  if (isHR && isExecutive) {
    throw new DecisionError(
      "حساب کاربری دارای دو نقش بررسی استخدام است. نقش بررسی باید مشخص شود.",
      403
    );
  }

  if (!isHR && !isExecutive) {
    throw new DecisionError(
      "شما مجوز بررسی پرونده استخدام را ندارید.",
      403
    );
  }

  return {
    id: user.id,
    reviewerType: isHR
      ? ApplicationReviewerType.HR
      : ApplicationReviewerType.EXECUTIVE,
  };
}

// ==========================================
// ERROR HANDLER
// ==========================================

function responseError(error: unknown) {
  if (error instanceof DecisionError) {
    return NextResponse.json(
      {
        success: false,
        message: error.message,
      },
      {
        status: error.status,
      }
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "این کد یا پرونده قبلاً ثبت شده است.",
      },
      { status: 409 }
    );
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2034"
  ) {
    return NextResponse.json(
      {
        success: false,
        message:
          "پرونده هم‌زمان تغییر کرده است. دوباره اطلاعات را دریافت کنید.",
      },
      { status: 409 }
    );
  }

  console.error(
    "[RECRUITMENT_DECISION_ERROR]",
    error
  );

  return NextResponse.json(
    {
      success: false,
      message:
        "خطای داخلی هنگام ثبت تصمیم استخدام.",
    },
    { status: 500 }
  );
}

// ==========================================
// POST - APPLICATION DECISION
// ==========================================

export async function POST(
  request: NextRequest,
  context: Context
) {
  try {
    const actor = await getActor();

    const body = await request.json();

    const stage = body.stage as ApplicationStage;

    const decision =
      body.decision as ApplicationDecision;

    const comment =
      typeof body.comment === "string"
        ? body.comment.trim().slice(0, 2000)
        : null;

    if (
      !Object.values(ApplicationStage).includes(stage)
    ) {
      throw new DecisionError(
        "مرحله بررسی معتبر نیست."
      );
    }

    if (
      !Object.values(ApplicationDecision).includes(
        decision
      )
    ) {
      throw new DecisionError(
        "تصمیم انتخاب‌شده معتبر نیست."
      );
    }

    if (
      decision !== ApplicationDecision.APPROVED &&
      !comment
    ) {
      throw new DecisionError(
        "برای رد پرونده یا درخواست اصلاح، درج توضیحات الزامی است."
      );
    }

    const { id } = await context.params;

    if (!id?.trim()) {
      throw new DecisionError(
        "شناسه پرونده معتبر نیست."
      );
    }

    const application =
      await prisma.candidateApplication.findUnique({
        where: { id },
        select: {
          id: true,
          applicationNumber: true,
          userId: true,
          initialStatus: true,
          initialVersion: true,
          documentsStatus: true,
          documentsVersion: true,
        },
      });

    if (!application) {
      throw new DecisionError(
        "پرونده استخدامی پیدا نشد.",
        404
      );
    }

    if (application.userId === actor.id) {
      throw new DecisionError(
        "متقاضی نمی‌تواند پرونده استخدامی خودش را تأیید کند.",
        403
      );
    }

    if (
      stage === ApplicationStage.DOCUMENTS &&
      application.initialStatus !==
        InitialApplicationStatus.APPROVED
    ) {
      throw new DecisionError(
        "ابتدا باید مرحله اول استخدام توسط هر دو مرجع تأیید شود.",
        409
      );
    }

    const currentVersion =
      stage === ApplicationStage.INITIAL
        ? application.initialVersion
        : application.documentsVersion;

    const currentStatus =
      stage === ApplicationStage.INITIAL
        ? application.initialStatus
        : application.documentsStatus;

    const expectedStatus =
      actor.reviewerType === ApplicationReviewerType.HR
        ? stage === ApplicationStage.INITIAL
          ? InitialApplicationStatus.SUBMITTED
          : DocumentsApplicationStatus.SUBMITTED
        : stage === ApplicationStage.INITIAL
          ? InitialApplicationStatus.EXECUTIVE_REVIEW
          : DocumentsApplicationStatus.EXECUTIVE_REVIEW;

    if (currentStatus !== expectedStatus) {
      throw new DecisionError(
        actor.reviewerType === ApplicationReviewerType.HR
          ? "این پرونده در صف بررسی منابع انسانی نیست."
          : "پرونده هنوز توسط منابع انسانی تأیید نشده است.",
        409
      );
    }

    // ======================================
    // EXECUTIVE MUST HAVE HR APPROVAL
    // ======================================

    if (
      actor.reviewerType ===
      ApplicationReviewerType.EXECUTIVE
    ) {
      const hrApproval =
        await prisma.applicationApproval.findFirst({
          where: {
            applicationId: application.id,
            stage,
            reviewerType:
              ApplicationReviewerType.HR,
            decision:
              ApplicationDecision.APPROVED,
            applicationVersion: currentVersion,
          },
          select: {
            id: true,
          },
        });

      if (!hrApproval) {
        throw new DecisionError(
          "تأیید منابع انسانی برای این نسخه از پرونده ثبت نشده است.",
          409
        );
      }
    }

    // ======================================
    // NEXT STATUS
    // ======================================

    const nextStatus =
      decision === ApplicationDecision.APPROVED
        ? actor.reviewerType ===
          ApplicationReviewerType.HR
          ? stage === ApplicationStage.INITIAL
            ? InitialApplicationStatus.EXECUTIVE_REVIEW
            : DocumentsApplicationStatus.EXECUTIVE_REVIEW
          : stage === ApplicationStage.INITIAL
            ? InitialApplicationStatus.APPROVED
            : DocumentsApplicationStatus.APPROVED
        : decision === ApplicationDecision.REJECTED
          ? stage === ApplicationStage.INITIAL
            ? InitialApplicationStatus.REJECTED
            : DocumentsApplicationStatus.REJECTED
          : stage === ApplicationStage.INITIAL
            ? InitialApplicationStatus.NEEDS_CORRECTION
            : DocumentsApplicationStatus.NEEDS_CORRECTION;

    const now = new Date();

    let finalPersonnelCode: string | null = null;

    // ======================================
    // TRANSACTION
    // ======================================

    await prisma.$transaction(
      async (tx) => {
        const updateResult =
          stage === ApplicationStage.INITIAL
            ? await tx.candidateApplication.updateMany({
                where: {
                  id: application.id,
                  initialVersion: currentVersion,
                  initialStatus:
                    currentStatus as InitialApplicationStatus,
                },
                data: {
                  initialStatus:
                    nextStatus as InitialApplicationStatus,

                  ...(actor.reviewerType ===
                    ApplicationReviewerType.EXECUTIVE &&
                  decision ===
                    ApplicationDecision.APPROVED
                    ? {
                        initialApprovedAt: now,
                        documentsStatus:
                          DocumentsApplicationStatus.PENDING,
                      }
                    : {}),
                },
              })
            : await tx.candidateApplication.updateMany({
                where: {
                  id: application.id,
                  documentsVersion: currentVersion,
                  documentsStatus:
                    currentStatus as DocumentsApplicationStatus,
                },
                data: {
                  documentsStatus:
                    nextStatus as DocumentsApplicationStatus,

                  ...(actor.reviewerType ===
                    ApplicationReviewerType.EXECUTIVE &&
                  decision ===
                    ApplicationDecision.APPROVED
                    ? { documentsApprovedAt: now }
                    : {}),
                },
              });

        if (updateResult.count !== 1) {
          throw new DecisionError(
            "پرونده تغییر کرده است. اطلاعات جدید را دریافت کنید.",
            409
          );
        }

        // ==================================
        // SAVE APPROVAL
        // ==================================

        await tx.applicationApproval.create({
          data: {
            applicationId: application.id,
            stage,
            reviewerType: actor.reviewerType,
            reviewerUserId: actor.id,
            decision,
            comment,
            applicationVersion: currentVersion,
            decidedAt: now,
          },
        });

        // ==================================
        // INITIAL STAGE ACTIVATION
        // ==================================

        if (
          stage === ApplicationStage.INITIAL &&
          actor.reviewerType ===
            ApplicationReviewerType.EXECUTIVE &&
          decision === ApplicationDecision.APPROVED
        ) {
          await tx.user.update({
            where: {
              id: application.userId,
            },
            data: {
              isActive: true,
              accessLevel:
                UserAccessLevel.CANDIDATE_PORTAL,
            },
          });
        }

        // ==================================
        // FINAL DOCUMENTS APPROVAL
        // ==================================

        if (
          stage === ApplicationStage.DOCUMENTS &&
          actor.reviewerType ===
            ApplicationReviewerType.EXECUTIVE &&
          decision === ApplicationDecision.APPROVED
        ) {
          // تولید کد پرسنلی فقط در زمان نهایی‌سازی
          const existingProfile =
            await tx.employeeProfile.findUnique({
              where: {
                userId: application.userId,
              },
              select: {
                id: true,
                candidateApplicationId: true,
                personnelCode: true,
              },
            });

          if (
            existingProfile &&
            existingProfile.candidateApplicationId !==
              application.id
          ) {
            throw new DecisionError(
              "این حساب کاربری قبلاً به پرونده استخدامی دیگری متصل شده است.",
              409
            );
          }

          if (existingProfile?.personnelCode) {
            finalPersonnelCode =
              existingProfile.personnelCode;
          } else {
            const personnelCode =
              await generatePersonnelCode(tx, now);

            if (existingProfile) {
              await tx.employeeProfile.update({
                where: {
                  id: existingProfile.id,
                },
                data: {
                  personnelCode,
                  employmentStatus:
                    EmployeeEmploymentStatus.ACTIVE,
                },
              });
            } else {
              await tx.employeeProfile.create({
                data: {
                  userId: application.userId,
                  candidateApplicationId:
                    application.id,
                  personnelCode,
                  employmentStatus:
                    EmployeeEmploymentStatus.ACTIVE,
                  hireDate: now,
                },
              });
            }

            finalPersonnelCode = personnelCode;
          }

          // فعال‌سازی حساب دائمی ERP
          await tx.user.update({
            where: {
              id: application.userId,
            },
            data: {
              isActive: true,
              accessLevel: UserAccessLevel.ERP,
            },
          });
        }

        // ==================================
        // AUDIT LOG
        // ==================================

        await tx.auditLog.create({
          data: {
            actorUserId: actor.id,
            action:
              `CANDIDATE_${stage}_${actor.reviewerType}_${decision}`,
            entityType: "CandidateApplication",
            entityId: application.id,
            ipAddress:
              request.headers.get("x-real-ip") ||
              request.headers.get("x-forwarded-for") ||
              undefined,
            details: {
              applicationNumber:
                application.applicationNumber,
              stage,
              reviewerType: actor.reviewerType,
              decision,
              comment,
              applicationVersion: currentVersion,
              previousStatus: currentStatus,
              nextStatus,
              personnelCode: finalPersonnelCode,
            },
          },
        });
      },
      {
        isolationLevel: "Serializable",
      }
    );

    // ======================================
    // RESPONSE MESSAGE
    // ======================================

    let message = "";

    if (decision === ApplicationDecision.APPROVED) {
      if (
        actor.reviewerType ===
        ApplicationReviewerType.HR
      ) {
        message =
          "تأیید منابع انسانی ثبت شد و پرونده برای بررسی مدیرعامل یا قائم‌مقام ارسال شد.";
      } else if (
        stage === ApplicationStage.INITIAL
      ) {
        message =
          "مرحله اول با تأیید هر دو مرجع تکمیل شد. دسترسی پنل ثبت مدارک فعال شد.";
      } else {
        message =
          "مدارک مرحله دوم با تأیید هر دو مرجع نهایی شد. حساب ERP فعال و پرونده دائمی پرسنلی ایجاد شد.";
      }
    } else if (
      decision === ApplicationDecision.NEEDS_CORRECTION
    ) {
      message =
        "پرونده برای اصلاح به متقاضی بازگردانده شد.";
    } else {
      message = "درخواست استخدام رد شد.";
    }

    return NextResponse.json({
      success: true,
      data: {
        applicationId: application.id,
        applicationNumber:
          application.applicationNumber,
        stage,
        reviewerType: actor.reviewerType,
        decision,
        applicationVersion: currentVersion,
        status: nextStatus,
        personnelCode:
          finalPersonnelCode,
        message,
      },
    });

  } catch (error) {
    return responseError(error);
  }
}
