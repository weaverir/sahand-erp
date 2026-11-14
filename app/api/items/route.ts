import { NextRequest, NextResponse } from "next/server";
import { validateItem } from "../../../modules/items/item.validation";
import { createItem, getItems } from "../../../modules/items/item.service";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;

    const page = Math.max(1, Number(params.get("page") || 1));
    const limit = Math.min(
      100,
      Math.max(1, Number(params.get("limit") || 20))
    );

    const result = await getItems({
      search: params.get("search") || undefined,
      itemType: params.get("itemType") || undefined,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "خطا در دریافت کالاها." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = validateItem(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, message: validation.error },
        { status: 400 }
      );
    }

    const item = await createItem(validation.data as never);

    return NextResponse.json(
      { success: true, data: item },
      { status: 201 }
    );
  } catch (error: unknown) {
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
      { success: false, message: "خطا در ثبت کالا." },
      { status: 500 }
    );
  }
}
