
import { NextRequest } from "next/server";

import {
  errorResponse,
  successResponse,
} from "@/libs/api-response";

import {
  authExceptionResponse,
} from "@/modules/auth/api-error-response";

import {
  assertSameOriginRequest,
  authorizeGlobalRequest,
} from "@/modules/auth/auth.middleware";

import {
  createItem,
  getItems,
} from "@/modules/items/item.service";

import {
  ITEM_TYPES,
  validateItem,
  type ItemInput,
} from "@/modules/items/item.validation";

function parsePositiveInteger(
  value: string | null,
  fallback: number
) {
  if (value === null || value.trim() === "") {
    return fallback;
  }

  const parsed = Number(value);

  return Number.isSafeInteger(parsed) && parsed > 0
    ? parsed
    : null;
}

export async function GET(request: NextRequest) {
  try {
    await authorizeGlobalRequest(
      request,
      "items.items.view"
    );

    const params = request.nextUrl.searchParams;

    const page = parsePositiveInteger(
      params.get("page"),
      1
    );

    const requestedLimit = parsePositiveInteger(
      params.get("limit"),
      20
    );

    const search = params.get("search")?.trim() || undefined;
    const itemType = params.get("itemType") || undefined;

    if (page === null || requestedLimit === null) {
      return errorResponse(
        "شماره صفحه و تعداد ردیف باید عدد صحیح مثبت باشند.",
        400
      );
    }

    if (
      itemType &&
      !ITEM_TYPES.includes(
        itemType as (typeof ITEM_TYPES)[number]
      )
    ) {
      return errorResponse("نوع کالا معتبر نیست.", 400);
    }

    if (search && search.length > 100) {
      return errorResponse(
        "عبارت جست‌وجو بیش از حد طولانی است.",
        400
      );
    }

    const result = await getItems({
      search,
      itemType,
      page,
      limit: Math.min(100, requestedLimit),
    });

    return successResponse(result);
  } catch (error) {
    return authExceptionResponse(
      error,
      "خطا در دریافت کالاها."
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);

    const { user } = await authorizeGlobalRequest(
      request,
      "items.items.create"
    );

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "بدنه درخواست JSON معتبر نیست.",
        400
      );
    }

    const validation = validateItem(body);

    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    const item = await createItem(
      validation.data as ItemInput,
      {
        actorUserId: user.id,
      }
    );

    return successResponse(item, 201);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return errorResponse(
        "کد کالا قبلاً ثبت شده است.",
        409
      );
    }

    return authExceptionResponse(
      error,
      "خطا در ثبت کالا."
    );
  }
}
