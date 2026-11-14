import { NextRequest, NextResponse } from "next/server";
import { validateItem } from "../../../../modules/items/item.validation";
import {
  deactivateItem,
  getItemById,
  updateItem,
} from "../../../../modules/items/item.service";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: NextRequest,
  context: Context
) {
  try {
    const { id } = await context.params;
    const item = await getItemById(id);

    if (!item) {
      return NextResponse.json(
        { success: false, message: "کالا پیدا نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: item });
  } catch {
    return NextResponse.json(
      { success: false, message: "خطا در دریافت کالا." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: Context
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const validation = validateItem(body, true);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 }
      );
    }

    if (Object.keys(validation.data).length === 0) {
      return NextResponse.json(
        { success: false, message: "هیچ فیلدی برای ویرایش ارسال نشده است." },
        { status: 400 }
      );
    }

    const item = await updateItem(id, validation.data as never);

    return NextResponse.json({ success: true, data: item });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "کالا پیدا نشد." },
        { status: 404 }
      );
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, message: "کد کالا قبلاً ثبت شده است." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, message: "خطا در ویرایش کالا." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: Context
) {
  try {
    const { id } = await context.params;
    const item = await deactivateItem(id);

    return NextResponse.json({
      success: true,
      message: "کالا غیرفعال شد.",
      data: item,
    });
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { success: false, message: "کالا پیدا نشد." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { success: false, message: "خطا در غیرفعال‌سازی کالا." },
      { status: 500 }
    );
  }
}