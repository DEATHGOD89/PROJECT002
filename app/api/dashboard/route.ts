import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Ensure Next.js does not cache this route and always fetches fresh data
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const providers = await prisma.provider.findMany({
      orderBy: { id: "asc" },
      include: {
        assignments: {
          include: {
            lead: {
              include: {
                service: true,
              },
            },
          },
          orderBy: {
            assignedAt: "desc",
          },
        },
      },
    });

    return NextResponse.json(providers);
  } catch (error: any) {
    console.error("[Dashboard API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to retrieve dashboard metrics." },
      { status: 500 }
    );
  }
}
