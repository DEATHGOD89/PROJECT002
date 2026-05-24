import { NextRequest, NextResponse } from "next/server";
import { allocateLead } from "@/lib/allocation";
import { sseBroadcaster } from "@/lib/sse";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customerName, phone, city, serviceId, description } = body;

    // Validate input fields are non-empty
    if (!customerName || !phone || !city || !serviceId || !description) {
      return NextResponse.json(
        { error: "All fields (customerName, phone, city, serviceId, description) are required." },
        { status: 400 }
      );
    }

    const parsedServiceId = parseInt(serviceId, 10);
    if (isNaN(parsedServiceId)) {
      return NextResponse.json(
        { error: "serviceId must be a valid integer." },
        { status: 400 }
      );
    }

    // Call the core allocation algorithm inside the interactive transaction
    const result = await allocateLead({
      customerName,
      phone,
      city,
      serviceId: parsedServiceId,
      description,
    });

    // Broadcast the real-time update using Server-Sent Events
    sseBroadcaster.broadcast("NEW_LEAD", {
      leadId: result.leadId,
      serviceId: parsedServiceId,
    });

    return NextResponse.json({
      success: true,
      leadId: result.leadId,
      assignedProviders: result.assignedProviders,
    });
  } catch (error: any) {
    console.error("[Leads API Error]:", error);

    // Handle duplicate phone + serviceId unique constraint violation (Prisma error code P2002)
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "A lead with this phone number has already requested this service." },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || "An unexpected error occurred during lead allocation." },
      { status: 500 }
    );
  }
}
