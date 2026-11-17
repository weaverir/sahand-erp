
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
  deactivateItem,
  getItemById,
  updateItem,
} from "@/modules/items/item.service";

import {
  validateItem,
  type ItemInput,
} from "@/modules/items/item.validation";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  request: NextRequest,
  context: Context
) {
  try {
    await authorizeGlobalRequest(
      request,
      "items.items.view"
    );

    const { id } = await context.params;

    const item = await getItemById(id);

    if (!item) {
      return errorResponse("کالا پیدا نشد.", 404);
    }

    return successResponse(item);
  } catch (error) {
    return authExceptionResponse(
      error,
      "خطا در دریافت کالا."
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const { user } = await authorizeGlobalRequest(
      request,
      "items.items.update"
    );

    const { id } = await context.params;

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return errorResponse(
        "بدنه درخواست JSON معتبر نیست.",
        400
      );
    }

    const validation = validateItem(body, true);

    if (!validation.success) {
      return errorResponse(validation.error, 400);
    }

    if (Object.keys(validation.data).length === 0) {
      return errorResponse(
        "هیچ فیلدی برای ویرایش ارسال نشده است.",
        400
      );
    }

    const item = await updateItem(
      id,
      validation.data as Partial<ItemInput>,
      {
        actorUserId: user.id,
      }
    );

    return successResponse(item);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error
    ) {
      if (error.code === "P2025") {
        return errorResponse("کالا پیدا نشد.", 404);
      }

      if (error.code === "P2002") {
        return errorResponse(
          "کد کالا قبلاً ثبت شده است.",
          409
        );
      }
    }

    return authExceptionResponse(
      error,
      "خطا در ویرایش کالا."
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: Context
) {
  try {
    assertSameOriginRequest(request);

    const { user } = await authorizeGlobalRequest(
      request,
      "items.items.delete"
    );

    const { id } = await context.params;

    const item = await deactivateItem(id, {
      actorUserId: user.id,
    });

    return successResponse(item);
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return errorResponse("کالا پیدا نشد.", 404);
    }

    return authExceptionResponse(
      error,
      "خطا در غیرفعال‌سازی کالا."
    );
  }
}
