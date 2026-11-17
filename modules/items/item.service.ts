import "server-only";

import { prisma } from "@/libs/prisma";
import type { ItemInput } from "./item.validation";

type AuditContext = {
  actorUserId: string;
  ipAddress?: string;
};

export async function getItems(params: {
  search?: string;
  itemType?: string;
  page: number;
  limit: number;
}) {
  const { search, itemType, page, limit } = params;

  const where = {
    isActive: true,
    ...(itemType ? { itemType: itemType as never } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { sku: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [items, total] = await prisma.$transaction([
    prisma.item.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.item.count({ where }),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getItemById(id: string) {
  return prisma.item.findUnique({
    where: { id },
  });
}

export async function createItem(
  data: ItemInput,
  audit: AuditContext
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.create({ data });

    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        action: "ITEM_CREATED",
        entityType: "Item",
        entityId: item.id,
        ipAddress: audit.ipAddress,
        details: {
          sku: item.sku,
          name: item.name,
          itemType: item.itemType,
        },
      },
    });

    return item;
  });
}

export async function updateItem(
  id: string,
  data: Partial<ItemInput>,
  audit: AuditContext
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.update({
      where: { id },
      data,
    });

    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        action: "ITEM_UPDATED",
        entityType: "Item",
        entityId: item.id,
        ipAddress: audit.ipAddress,
        details: {
          changedFields: Object.keys(data),
        },
      },
    });

    return item;
  });
}

export async function deactivateItem(
  id: string,
  audit: AuditContext
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.update({
      where: { id },
      data: { isActive: false },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: audit.actorUserId,
        action: "ITEM_DEACTIVATED",
        entityType: "Item",
        entityId: item.id,
        ipAddress: audit.ipAddress,
        details: {
          sku: item.sku,
          name: item.name,
        },
      },
    });

    return item;
  });
}