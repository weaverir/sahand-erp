import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/libs/prisma";
import {
  audit,
  jsonError,
  OrganizationApiError,
  requireOrganizationAccess,
  parseDate,
} from "@/modules/organization/organization-api";

type Context = {
  params: Promise<{ id: string }>;
};

const VALID_SCOPES = [
  "ALL",
  "OWN",
  "UNIT",
  "SUBTREE",
  "DEPARTMENT",
  "ASSIGNED",
] as const;

// GET - ACCESS LIST
export async function GET(_request: NextRequest, context: Context) {
  try {
    await requireOrganizationAccess("organization.access.view");
    const { id } = await context.params;

    const assignment = await prisma.employeeAssignment.findUnique({
      where: { id },
      select: {
        id: true,
        roles: {
          where: { isActive: true },
          include: {
            role: {
              select: {
                id: true,
                key: true,
                name: true,
                isSystem: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
        permissions: {
          where: { isActive: true },
          include: {
            permission: {
              select: {
                id: true,
                key: true,
                name: true,
                resource: true,
                action: true,
                module: {
                  select: { key: true, name: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!assignment) {
      throw new OrganizationApiError("انتصاب پیدا نشد.", 404);
    }

    return NextResponse.json({ success: true, data: assignment });
  } catch (error) {
    return jsonError(error);
  }
}

// POST - ASSIGN ROLE OR MULTIPLE PERMISSIONS
export async function POST(request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess(
      "organization.access.manage"
    );
    const { id } = await context.params;
    const body = await request.json();

    const assignment = await prisma.employeeAssignment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!assignment) {
      throw new OrganizationApiError("انتصاب پیدا نشد.", 404);
    }

    const expiresAt = parseDate(body.expiresAt, "تاریخ انقضا", true);

    // ASSIGN ROLE
    if (typeof body.roleId === "string" && body.roleId.trim()) {
      const role = await prisma.role.findUnique({
        where: { id: body.roleId },
        select: { id: true, isActive: true, isSystem: true },
      });

      if (!role || !role.isActive) {
        throw new OrganizationApiError(
          "نقش انتخاب‌شده معتبر یا فعال نیست."
        );
      }

      if (role.isSystem) {
        throw new OrganizationApiError(
          "نقش سیستمی را نمی‌توان مستقیماً به انتصاب اختصاص داد.",
          403
        );
      }

      const saved = await prisma.employeeAssignmentRole.upsert({
        where: {
          assignmentId_roleId: { assignmentId: id, roleId: role.id },
        },
        create: {
          assignmentId: id,
          roleId: role.id,
          assignedById: actor.id,
          expiresAt,
        },
        update: {
          isActive: true,
          assignedById: actor.id,
          expiresAt,
        },
        include: {
          role: { select: { id: true, key: true, name: true } },
        },
      });

      await audit(
        actor.id,
        "EmployeeAssignmentRole",
        saved.id,
        "ASSIGNMENT_ROLE_GRANTED",
        null,
        { assignmentId: id, roleId: role.id, expiresAt }
      );

      return NextResponse.json({ success: true, data: saved }, { status: 201 });
    }

    // MULTIPLE PERMISSIONS
    const rawPermissionIds: unknown =
      body.permissionIds ??
      (body.permissionId ? [body.permissionId] : []);

    if (
      !Array.isArray(rawPermissionIds) ||
      rawPermissionIds.length === 0 ||
      !rawPermissionIds.every(
        (value: unknown) =>
          typeof value === "string" && value.trim().length > 0
      )
    ) {
      throw new OrganizationApiError("حداقل یک مجوز معتبر انتخاب کنید.");
    }

    const uniquePermissionIds = [
      ...new Set(
        (rawPermissionIds as string[]).map((value) => value.trim())
      ),
    ];

    // The old 200-item limit rejected valid bulk assignments.
    // Validate the unique IDs against the database instead.
    if (body.scope !== undefined) {
      if (
        typeof body.scope !== "string" ||
        !VALID_SCOPES.includes(
          body.scope as (typeof VALID_SCOPES)[number]
        )
      ) {
        throw new OrganizationApiError("محدوده دسترسی معتبر نیست.");
      }
    }

    if (
      body.isAllowed !== undefined &&
      typeof body.isAllowed !== "boolean"
    ) {
      throw new OrganizationApiError("وضعیت مجوز معتبر نیست.");
    }

    const isAllowed = body.isAllowed ?? true;
    const scope = body.scope ?? "OWN";

    // Check that every selected permission exists before changing anything.
    const permissions = await prisma.permission.findMany({
      where: { id: { in: uniquePermissionIds } },
      select: { id: true, key: true },
    });

    if (permissions.length !== uniquePermissionIds.length) {
      throw new OrganizationApiError(
        "یک یا چند مجوز انتخاب‌شده در سیستم وجود ندارد."
      );
    }

    // Preserve the previous state for audit records.
    const previous = await prisma.employeeAssignmentPermission.findMany({
      where: {
        assignmentId: id,
        permissionId: { in: uniquePermissionIds },
      },
    });

    const previousMap = new Map(
      previous.map((item) => [item.permissionId, item])
    );

    // Persist the entire selection atomically.
    const saved = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const permission of permissions) {
        const item = await tx.employeeAssignmentPermission.upsert({
          where: {
            assignmentId_permissionId: {
              assignmentId: id,
              permissionId: permission.id,
            },
          },
          create: {
            assignmentId: id,
            permissionId: permission.id,
            isAllowed,
            scope,
            assignedById: actor.id,
            expiresAt,
          },
          update: {
            isActive: true,
            isAllowed,
            scope,
            assignedById: actor.id,
            expiresAt,
          },
          include: {
            permission: {
              select: { id: true, key: true, name: true },
            },
          },
        });

        results.push(item);
      }

      return results;
    });

    for (const item of saved) {
      const before = previousMap.get(item.permissionId) ?? null;
      await audit(
        actor.id,
        "EmployeeAssignmentPermission",
        item.id,
        "ASSIGNMENT_PERMISSION_UPSERTED",
        before,
        item
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: `${saved.length} مجوز با موفقیت ثبت شد.`,
        data: saved,
        count: saved.length,
      },
      { status: 201 }
    );
  } catch (error) {
    return jsonError(error);
  }
}

// DELETE - REVOKE ACCESS
export async function DELETE(request: NextRequest, context: Context) {
  try {
    const { actor } = await requireOrganizationAccess(
      "organization.access.manage"
    );
    const { id } = await context.params;
    const body = await request.json();

    if (
      typeof body.id !== "string" ||
      !["role", "permission"].includes(body.kind)
    ) {
      throw new OrganizationApiError("شناسه و نوع دسترسی الزامی است.");
    }

    if (body.kind === "role") {
      const before = await prisma.employeeAssignmentRole.findFirst({
        where: { id: body.id, assignmentId: id },
      });

      if (!before) {
        throw new OrganizationApiError("نقش انتصاب پیدا نشد.", 404);
      }

      const after = await prisma.employeeAssignmentRole.update({
        where: { id: body.id },
        data: { isActive: false },
      });

      await audit(
        actor.id,
        "EmployeeAssignmentRole",
        body.id,
        "ASSIGNMENT_ROLE_REVOKED",
        before,
        after
      );

      return NextResponse.json({ success: true, data: after });
    }

    const before = await prisma.employeeAssignmentPermission.findFirst({
      where: { id: body.id, assignmentId: id },
    });

    if (!before) {
      throw new OrganizationApiError("مجوز انتصاب پیدا نشد.", 404);
    }

    const after = await prisma.employeeAssignmentPermission.update({
      where: { id: body.id },
      data: { isActive: false },
    });

    await audit(
      actor.id,
      "EmployeeAssignmentPermission",
      body.id,
      "ASSIGNMENT_PERMISSION_REVOKED",
      before,
      after
    );

    return NextResponse.json({ success: true, data: after });
  } catch (error) {
    return jsonError(error);
  }
}
