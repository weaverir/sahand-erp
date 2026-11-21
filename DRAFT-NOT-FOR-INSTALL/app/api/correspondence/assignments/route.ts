import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/modules/auth/auth.middleware";
import { prisma } from "@/libs/prisma";
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    const now = new Date();
    const assignments = await prisma.employeeAssignment.findMany({ where: {
      userId: user.id, status: "ACTIVE", startDate: { lte: now },
      OR: [{ endDate: null }, { endDate: { gte: now } }],
    }, select: { id: true, responsibilityTitle: true, organizationUnit: { select: { name: true } }, managerAssignmentId: true } });
    return NextResponse.json({ data: assignments }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof Error && "statusCode" in error && typeof error.statusCode === "number" ? error.statusCode : 500;
    return NextResponse.json({ error: status === 500 ? "خطای داخلی سرور." : error instanceof Error ? error.message : "خطا" }, { status });
  }
}
