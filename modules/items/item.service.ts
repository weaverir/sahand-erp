import { prisma } from "../../libs/prisma";
import type { ItemInput } from "./item.validation";

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

export async function createItem(data: ItemInput) {
  return prisma.item.create({ data });
}

export async function updateItem(id: string, data: Partial<ItemInput>) {
  return prisma.item.update({
    where: { id },
    data,
  });
}

export async function deactivateItem(id: string) {
  return prisma.item.update({
    where: { id },
    data: { isActive: false },
  });
}