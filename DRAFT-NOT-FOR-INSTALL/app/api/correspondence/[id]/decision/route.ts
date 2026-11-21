import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, assertSameOriginRequest } from "@/modules/auth/auth.middleware";
import { CorrespondenceError, decideLetter } from "@/modules/correspondence/service";
import { CorrespondencePolicyError } from "@/modules/correspondence/policy";
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    assertSameOriginRequest(request);
    const user = await authenticateRequest(request);
    const { id } = await context.params;
    const data: unknown = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new CorrespondenceError("ورودی نامعتبر است.");
    const d = data as Record<string, unknown>;
    if (typeof d.assignmentId !== "string" || (d.decision !== "APPROVE_AND_FORWARD" && d.decision !== "REJECT" && d.decision !== "CLOSE_AT_TOP") || (d.note !== undefined && typeof d.note !== "string")) throw new CorrespondenceError("ورودی نامعتبر است.");
    return NextResponse.json({ data: await decideLetter(user.id, id, { assignmentId: d.assignmentId, decision: d.decision, note: d.note as string | undefined }) });
  } catch (error) {
    const status = error instanceof CorrespondenceError ? error.statusCode : error instanceof CorrespondencePolicyError ? 400 : error instanceof SyntaxError ? 400 : error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    if (status === 500) console.error("[CORRESPONDENCE_DECISION]", error);
    return NextResponse.json({ error: status === 500 ? "خطای داخلی سرور." : error instanceof Error ? error.message : "خطا" }, { status });
  }
}
