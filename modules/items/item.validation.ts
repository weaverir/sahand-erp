export const ITEM_TYPES = [
  "RAW_MATERIAL",
  "COMPONENT",
  "FINISHED_GOOD",
  "SEMI_FINISHED",
  "PACKAGING",
  "CONSUMABLE",
] as const;

export const UNITS = [
  "PIECE",
  "METER",
  "KILOGRAM",
  "GRAM",
  "LITER",
  "BOX",
  "ROLL",
  "SET",
] as const;

export type ItemInput = {
  sku: string;
  name: string;
  description?: string | null;
  itemType: (typeof ITEM_TYPES)[number];
  baseUnit: (typeof UNITS)[number];
};

export function validateItem(data: unknown, partial = false) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { success: false as const, error: "داده ارسالی معتبر نیست." };
  }

  const body = data as Record<string, unknown>;
  const errors: string[] = [];

  const allowedFields = [
    "sku",
    "name",
    "description",
    "itemType",
    "baseUnit",
  ];

  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      errors.push(`فیلد ${key} مجاز نیست.`);
    }
  }

  if (!partial || "sku" in body) {
    if (typeof body.sku !== "string" || !body.sku.trim()) {
      errors.push("کد کالا الزامی است.");
    }
  }

  if (!partial || "name" in body) {
    if (typeof body.name !== "string" || !body.name.trim()) {
      errors.push("نام کالا الزامی است.");
    }
  }

  if (!partial || "itemType" in body) {
    if (
      typeof body.itemType !== "string" ||
      !ITEM_TYPES.includes(body.itemType as (typeof ITEM_TYPES)[number])
    ) {
      errors.push("نوع کالا معتبر نیست.");
    }
  }

  if (!partial || "baseUnit" in body) {
    if (
      typeof body.baseUnit !== "string" ||
      !UNITS.includes(body.baseUnit as (typeof UNITS)[number])
    ) {
      errors.push("واحد اندازه‌گیری معتبر نیست.");
    }
  }

  if (
    "description" in body &&
    body.description !== null &&
    typeof body.description !== "string"
  ) {
    errors.push("توضیحات باید متن باشد.");
  }

  if (errors.length) {
    return { success: false as const, error: errors.join(" ") };
  }

  const result: Record<string, unknown> = {};

  for (const key of allowedFields) {
    if (key in body) {
      const value = body[key];
      result[key] =
        typeof value === "string" ? value.trim() : value;
    }
  }

  return { success: true as const, data: result };
}