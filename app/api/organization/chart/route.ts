
import "server-only";

import { NextRequest } from "next/server";

import { prisma } from "@/libs/prisma";

import {
  successResponse,
  errorResponse,
} from "@/libs/api-response";

import {
  authorizeRequest,
} from "@/modules/auth/auth.middleware";

function getStatusCode(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof error.statusCode === "number"
  ) {
    return error.statusCode;
  }

  return 500;
}

type ChartNode = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: string;
  sortOrder: number;
  location: {
    id: string;
    name: string;
    code: string;
  } | null;
  assignments: {
    id: string;
    userId: string;
    positionId: string;
    managerAssignmentId: string | null;
    assignmentType: string;
    isPrimary: boolean;
    startDate: Date;
    endDate: Date | null;
    user: {
      id: string;
      username: string;
      fullName: string;
    };
    position: {
      id: string;
      code: string;
      title: string;
      isManagerial: boolean;
    };
  }[];
  children: ChartNode[];
};

export async function GET(request: NextRequest) {
  try {
    await authorizeRequest(
      request,
      "organization.chart.view"
    );

    const now = new Date();

    const units = await prisma.organizationUnit.findMany({
      where: {
        status: "ACTIVE",
      },
      include: {
        location: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        assignments: {
          where: {
            status: "ACTIVE",
            OR: [
              { endDate: null },
              { endDate: { gt: now } },
            ],
          },
          select: {
            id: true,
            userId: true,
            positionId: true,
            managerAssignmentId: true,
            assignmentType: true,
            isPrimary: true,
            startDate: true,
            endDate: true,
            user: {
              select: {
                id: true,
                username: true,
                fullName: true,
              },
            },
            position: {
              select: {
                id: true,
                code: true,
                title: true,
                isManagerial: true,
              },
            },
          },
          orderBy: [
            { isPrimary: "desc" },
            { startDate: "asc" },
          ],
        },
      },
      orderBy: [
        { sortOrder: "asc" },
        { name: "asc" },
      ],
    });

    const nodes = new Map<string, ChartNode>();

    for (const unit of units) {
      const node: ChartNode = {
        id: unit.id,
        code: unit.code,
        name: unit.name,
        description: unit.description,
        parentId: unit.parentId,
        status: unit.status,
        sortOrder: unit.sortOrder,
        location: unit.location,
        assignments: unit.assignments.map((assignment) => ({
          id: assignment.id,
          userId: assignment.userId,
          positionId: assignment.positionId,
          managerAssignmentId: assignment.managerAssignmentId,
          assignmentType: assignment.assignmentType,
          isPrimary: assignment.isPrimary,
          startDate: assignment.startDate,
          endDate: assignment.endDate,
          user: assignment.user,
          position: assignment.position,
        })),
        children: [],
      };

      nodes.set(unit.id, node);
    }

    const roots: ChartNode[] = [];

    for (const node of nodes.values()) {
      if (!node.parentId || !nodes.has(node.parentId)) {
        roots.push(node);
        continue;
      }

      if (node.parentId === node.id) {
        roots.push(node);
        continue;
      }

      nodes.get(node.parentId)!.children.push(node);
    }

    const result = {
      chart: roots,
      count: units.length,
      activeAssignments: units.reduce(
        (total, unit) =>
          total + unit.assignments.length,
        0
      ),
      generatedAt: now.toISOString(),
    };

    return successResponse(result);

  } catch (error) {
    const statusCode = getStatusCode(error);

    if (statusCode !== 500) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "دسترسی به چارت سازمانی امکان‌پذیر نیست.",
        statusCode
      );
    }

    console.error(
      "[ORGANIZATION_CHART_GET_ERROR]",
      error
    );

    return errorResponse(
      "خطا در دریافت چارت سازمانی.",
      500
    );
  }
}
