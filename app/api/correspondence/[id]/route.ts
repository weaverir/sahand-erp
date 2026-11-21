import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/modules/auth/auth.middleware";
import { CorrespondenceError, getLetterDetail } from "@/modules/correspondence/service";
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await authenticateRequest(request);
    const { id } = await context.params;
    return NextResponse.json({ data: await getLetterDetail(user.id, id) }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const status = error instanceof CorrespondenceError ? error.statusCode :
      error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (status === 500) console.error("[CORRESPONDENCE_DETAIL]", error);
    return NextResponse.json({ error: status === 500 ? "خطای داخلی سرور." : error instanceof Error ? error.message : "خطا" }, { status });
  }
}
