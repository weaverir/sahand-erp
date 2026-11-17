import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import {
  audit,
  jsonError,
  OrganizationApiError,
  parseDate,
  requireOrganizationAccess,
} from "@/modules/organization/organization-api";

const RELATIONSHIP_TYPES = [
  "REPORTS_TO",
  "FUNCTIONAL_REPORTS_TO",
  "SUPERVISES",
  "COLLABORATES_WITH",
  "ADVISES",
  "DELEGATES_TO",
] as const;

export async function GET(request: NextRequest) {
  try {
    await requireOrganizationAccess("organization.relationships.view");

    const status = request.nextUrl.searchParams.get("status");
    if (status && !["ACTIVE", "ENDED", "SUSPENDED"].includes(status)) {
      throw new OrganizationApiError("فیلتر وضعیت معتبر نیست.");
    }

    const relationships = await prisma.organizationRelationship.findMany({
      where: status ? { status: status as "ACTIVE" | "ENDED" | "SUSPENDED" } : {},
      include: {
        sourceAssignment: {
          include: {
            user: { select: { id: true, username: true, fullName: true } },
            position: { select: { title: true } },
            organizationUnit: { select: { name: true } },
          },
        },
        targetAssignment: {
          include: {
            user: { select: { id: true, username: true, fullName: true } },
            position: { select: { title: true } },
            organizationUnit: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: { relationships, count: relationships.length },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { actor } = await requireOrganizationAccess(
      "organization.relationships.manage"
    );
    const body = await request.json();

    const { sourceAssignmentId, targetAssignmentId, relationshipType } = body;

    if (
      typeof sourceAssignmentId !== "string" ||
      !sourceAssignmentId.trim() ||
      typeof targetAssignmentId !== "string" ||
      !targetAssignmentId.trim()
    ) {
      throw new OrganizationApiError("هر دو انتصاب الزامی هستند.");
    }

    if (sourceAssignmentId === targetAssignmentId) {
      throw new OrganizationApiError(
        "مبدأ و مقصد رابطه نمی‌توانند یک انتصاب باشند."
      );
    }

    if (!RELATIONSHIP_TYPES.includes(relationshipType)) {
      throw new OrganizationApiError("نوع رابطه معتبر نیست.");
    }

    const [source, target] = await Promise.all([
      prisma.employeeAssignment.findUnique({
        where: { id: sourceAssignmentId },
        select: { id: true, status: true },
      }),
      prisma.employeeAssignment.findUnique({
        where: { id: targetAssignmentId },
        select: { id: true, status: true },
      }),
    ]);

    if (!source || !target) {
      throw new OrganizationApiError(
        "یکی از انتصاب‌های انتخاب‌شده پیدا نشد.",
        404
      );
    }

    if (source.status !== "ACTIVE" || target.status !== "ACTIVE") {
      throw new OrganizationApiError(
        "فقط برای انتصاب فعال می‌توان رابطه ایجاد کرد."
      );
    }

    const startDate = parseDate(
      body.startDate ?? new Date().toISOString(),
      "تاریخ شروع"
    )!;

    const endDate = parseDate(body.endDate, "تاریخ پایان", true);

    if (endDate && endDate < startDate) {
      throw new OrganizationApiError(
        "تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد."
      );
    }

    const created = await prisma.organizationRelationship.create({
      data: {
        sourceAssignmentId,
        targetAssignmentId,
        relationshipType,
        status: "ACTIVE",
        startDate,
        endDate,
        description:
          typeof body.description === "string"
            ? body.description.trim() || null
            : null,
        createdByUserId: actor.id,
      },
      include: {
        sourceAssignment: {
          include: {
            user: { select: { fullName: true, username: true } },
            position: { select: { title: true } },
          },
        },
        targetAssignment: {
          include: {
            user: { select: { fullName: true, username: true } },
            position: { select: { title: true } },
          },
        },
      },
    });

    await audit(
      actor.id,
      "OrganizationRelationship",
      created.id,
      "ORGANIZATION_RELATIONSHIP_CREATED",
      undefined,
      created
    );

    return NextResponse.json(
      { success: true, data: created },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
