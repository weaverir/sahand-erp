import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { jsonError, requireOrganizationAccess } from "@/modules/organization/organization-api";

export async function GET(request: NextRequest) {
  try {
    await requireOrganizationAccess("organization.audit.view");
    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(params.get("limit") || 30)));
    const entityType = params.get("entityType") || undefined;
    const action = params.get("action") || undefined;
    const actorUserId = params.get("actorUserId") || undefined;
    const [logs, total] = await Promise.all([
      prisma.organizationAuditLog.findMany({
        where: { ...(entityType ? { entityType } : {}), ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}), ...(actorUserId ? { actorUserId } : {}) },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.organizationAuditLog.count({
        where: { ...(entityType ? { entityType } : {}), ...(action ? { action: { contains: action, mode: "insensitive" as const } } : {}), ...(actorUserId ? { actorUserId } : {}) },
      }),
    ]);
    return NextResponse.json({ success: true, data: { logs, total, page, limit, pages: Math.ceil(total / limit) } });
  } catch (error) { return jsonError(error); }
}
