import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, assertSameOriginRequest } from "@/modules/auth/auth.middleware";
import { createLetter, listLetters, CorrespondenceError } from "@/modules/correspondence/service";
import { CorrespondencePolicyError } from "@/modules/correspondence/policy";

function fail(error: unknown) {
  if (error instanceof CorrespondenceError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
  if (error instanceof CorrespondencePolicyError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof SyntaxError) return NextResponse.json({ error: "JSON نامعتبر است." }, { status: 400 });
  if (error instanceof Error && "statusCode" in error && typeof error.statusCode === "number") return NextResponse.json({ error: error.message }, { status: error.statusCode });
  console.error("[CORRESPONDENCE]", error);
  return NextResponse.json({ error: "خطای داخلی سرور." }, { status: 500 });
}
export async function GET(request: NextRequest) {
  try { const user = await authenticateRequest(request); return NextResponse.json({ data: await listLetters(user.id) }, { headers: { "Cache-Control": "private, no-store" } }); }
  catch (error) { return fail(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertSameOriginRequest(request);
    const user = await authenticateRequest(request);
    const data: unknown = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new CorrespondenceError("ورودی نامعتبر است.");
    const d = data as Record<string, unknown>;
    if (typeof d.assignmentId !== "string" || typeof d.subject !== "string" || typeof d.body !== "string" || (d.priority !== "NORMAL" && d.priority !== "URGENT")) throw new CorrespondenceError("ورودی نامعتبر است.");
    return NextResponse.json({ data: await createLetter(user.id, { assignmentId: d.assignmentId, subject: d.subject, body: d.body, priority: d.priority }) }, { status: 201 });
  } catch (error) { return fail(error); }
}
