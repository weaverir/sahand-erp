import { NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { jsonError, requireOrganizationAccess } from "@/modules/organization/organization-api";

export async function GET() {
  try {
    await requireOrganizationAccess("organization.access.view");
    const [roles, modules, permissions] = await Promise.all([
      prisma.role.findMany({ where: { isActive: true, isSystem: false }, select: { id: true, key: true, name: true, description: true }, orderBy: { name: "asc" } }),
      prisma.module.findMany({ where: { isActive: true }, select: { id: true, key: true, name: true, sortOrder: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
      prisma.permission.findMany({ select: { id: true, key: true, name: true, description: true, resource: true, action: true, module: { select: { id: true, key: true, name: true } } }, orderBy: [{ moduleId: "asc" }, { name: "asc" }] }),
    ]);
    return NextResponse.json({ success: true, data: { roles, modules, permissions } });
  } catch (error) { return jsonError(error); }
}
