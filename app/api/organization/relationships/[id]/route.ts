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

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess(
      "organization.relationships.manage"
    );
    const { id } = await context.params;

    const before = await prisma.organizationRelationship.findUnique({
      where: { id },
    });

    if (!before) {
      throw new OrganizationApiError("رابطه سازمانی پیدا نشد.", 404);
    }

    const body = await request.json();
    const data: {
      description?: string | null;
      endDate?: Date | null;
      status?: "ACTIVE" | "ENDED" | "SUSPENDED";
      relationshipType?: (typeof RELATIONSHIP_TYPES)[number];
    } = {};

    if (body.description !== undefined) {
      data.description =
        typeof body.description === "string"
          ? body.description.trim() || null
          : null;
    }

    if (body.endDate !== undefined) {
      data.endDate = parseDate(body.endDate, "تاریخ پایان", true);
    }

    if (body.status !== undefined) {
      if (!["ACTIVE", "ENDED", "SUSPENDED"].includes(body.status)) {
        throw new OrganizationApiError("وضعیت رابطه معتبر نیست.");
      }
      data.status = body.status;
      if (body.status === "ENDED" && data.endDate === undefined) {
        data.endDate = new Date();
      }
      if (body.status === "ACTIVE") {
        data.endDate = null;
      }
    }

    if (body.relationshipType !== undefined) {
      if (!RELATIONSHIP_TYPES.includes(body.relationshipType)) {
        throw new OrganizationApiError("نوع رابطه معتبر نیست.");
      }
      data.relationshipType = body.relationshipType;
    }

    const after = await prisma.organizationRelationship.update({
      where: { id },
      data,
    });

    await audit(
      actor.id,
      "OrganizationRelationship",
      id,
      "ORGANIZATION_RELATIONSHIP_UPDATED",
      before,
      after
    );

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess(
      "organization.relationships.manage"
    );
    const { id } = await context.params;

    const before = await prisma.organizationRelationship.findUnique({
      where: { id },
    });

    if (!before) {
      throw new OrganizationApiError("رابطه سازمانی پیدا نشد.", 404);
    }

    if (before.status === "ENDED") {
      return NextResponse.json({
        success: true,
        data: before,
        message: "این رابطه قبلاً خاتمه یافته است.",
      });
    }

    const after = await prisma.organizationRelationship.update({
      where: { id },
      data: {
        status: "ENDED",
        endDate: new Date(),
      },
    });

    await audit(
      actor.id,
      "OrganizationRelationship",
      id,
      "ORGANIZATION_RELATIONSHIP_ENDED",
      before,
      after
    );

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    return jsonError(error);
  }
}
