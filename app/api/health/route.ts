
import { prisma } from "@/libs/prisma";
import { successResponse, errorResponse } from "@/libs/api-response";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return successResponse({
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return errorResponse(
      "Database connection failed",
      503
    );
  }
}
