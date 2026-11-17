import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import { audit, jsonError, OrganizationApiError, requireOrganizationAccess, parseDate } from "@/modules/organization/organization-api";

type Context = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireOrganizationAccess("organization.access.view");
    const { id } = await context.params;
    const assignment = await prisma.employeeAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        roles: { include: { role: { select: { id: true, key: true, name: true, isSystem: true } } }, orderBy: { createdAt: "desc" } },
        permissions: { include: { permission: { select: { id: true, key: true, name: true, resource: true, action: true, module: { select: { key: true, name: true } } } } }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!assignment) throw new OrganizationApiError("انتصاب پیدا نشد.", 404);
    return NextResponse.json({ success: true, data: assignment });
  } catch (error) { return jsonError(error); }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess("organization.access.manage");
    const { id } = await context.params;
    const body = await request.json();
    const assignment = await prisma.employeeAssignment.findUnique({ where: { id }, select: { id: true } });
    if (!assignment) throw new OrganizationApiError("انتصاب پیدا نشد.", 404);

    if (typeof body.roleId === "string" && body.roleId.trim()) {
      const role = await prisma.role.findUnique({ where: { id: body.roleId }, select: { id: true, isActive: true, isSystem: true } });
      if (!role || !role.isActive) throw new OrganizationApiError("نقش انتخاب‌شده معتبر یا فعال نیست.");
      if (role.isSystem) throw new OrganizationApiError("نقش سیستمی را نمی‌توان مستقیماً به انتصاب سازمانی اختصاص داد.", 403);
      const expiresAt = parseDate(body.expiresAt, "تاریخ انقضا", true);
      const saved = await prisma.employeeAssignmentRole.upsert({
        where: { assignmentId_roleId: { assignmentId: id, roleId: role.id } },
        create: { assignmentId: id, roleId: role.id, assignedById: actor.id, expiresAt },
        update: { isActive: true, assignedById: actor.id, expiresAt },
        include: { role: { select: { id: true, key: true, name: true } } },
      });
      await audit(actor.id, "EmployeeAssignmentRole", saved.id, "ASSIGNMENT_ROLE_GRANTED", null, { assignmentId: id, roleId: role.id, expiresAt });
      return NextResponse.json({ success: true, data: saved }, { status: 201 });
    }

    if (typeof body.permissionId === "string" && body.permissionId.trim()) {
      const permission = await prisma.permission.findUnique({ where: { id: body.permissionId }, select: { id: true, key: true } });
      if (!permission) throw new OrganizationApiError("مجوز انتخاب‌شده پیدا نشد.", 404);
      const scopes = ["ALL", "OWN", "UNIT", "SUBTREE", "DEPARTMENT", "ASSIGNED"];
      if (body.scope !== undefined && !scopes.includes(body.scope)) throw new OrganizationApiError("محدوده دسترسی معتبر نیست.");
      if (typeof body.isAllowed !== "boolean" && body.isAllowed !== undefined) throw new OrganizationApiError("وضعیت مجوز معتبر نیست.");
      const expiresAt = parseDate(body.expiresAt, "تاریخ انقضا", true);
      const before = await prisma.employeeAssignmentPermission.findUnique({
        where: { assignmentId_permissionId: { assignmentId: id, permissionId: permission.id } },
      });
      const saved = await prisma.employeeAssignmentPermission.upsert({
        where: { assignmentId_permissionId: { assignmentId: id, permissionId: permission.id } },
        create: { assignmentId: id, permissionId: permission.id, isAllowed: body.isAllowed ?? true, scope: body.scope ?? "OWN", assignedById: actor.id, expiresAt },
        update: { isActive: true, isAllowed: body.isAllowed ?? true, scope: body.scope ?? "OWN", assignedById: actor.id, expiresAt },
        include: { permission: { select: { id: true, key: true, name: true } } },
      });
      await audit(actor.id, "EmployeeAssignmentPermission", saved.id, "ASSIGNMENT_PERMISSION_UPSERTED", before, saved);
      return NextResponse.json({ success: true, data: saved }, { status: 201 });
    }
    throw new OrganizationApiError("roleId یا permissionId الزامی است.");
  } catch (error) { return jsonError(error); }
}

export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess("organization.access.manage");
    const { id } = await context.params;
    const body = await request.json();
    if (typeof body.id !== "string" || !["role", "permission"].includes(body.kind)) throw new OrganizationApiError("شناسه و نوع دسترسی الزامی است.");
    if (body.kind === "role") {
      const before = await prisma.employeeAssignmentRole.findFirst({ where: { id: body.id, assignmentId: id } });
      if (!before) throw new OrganizationApiError("نقش انتصاب پیدا نشد.", 404);
      const after = await prisma.employeeAssignmentRole.update({ where: { id: body.id }, data: { isActive: false } });
      await audit(actor.id, "EmployeeAssignmentRole", body.id, "ASSIGNMENT_ROLE_REVOKED", before, after);
      return NextResponse.json({ success: true, data: after });
    }
    const before = await prisma.employeeAssignmentPermission.findFirst({ where: { id: body.id, assignmentId: id } });
    if (!before) throw new OrganizationApiError("مجوز انتصاب پیدا نشد.", 404);
    const after = await prisma.employeeAssignmentPermission.update({ where: { id: body.id }, data: { isActive: false } });
    await audit(actor.id, "EmployeeAssignmentPermission", body.id, "ASSIGNMENT_PERMISSION_REVOKED", before, after);
    return NextResponse.json({ success: true, data: after });
  } catch (error) { return jsonError(error); }
}
