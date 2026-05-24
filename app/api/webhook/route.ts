import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, idempotencyKey } = body;

    // Validate that required fields are present
    if (!type || !idempotencyKey) {
      return NextResponse.json(
        { error: "Both 'type' and 'idempotencyKey' are required." },
        { status: 400 }
      );
    }

    // Step 1: Query database to see if we have already successfully processed this idempotency key
    const existingEvent = await prisma.webhookEvent.findUnique({
      where: { id: idempotencyKey },
    });

    if (existingEvent) {
      console.log(`[Webhook] Duplicate event detected for key: ${idempotencyKey}. Ignoring.`);
      return NextResponse.json({
        alreadyProcessed: true,
        message: `Webhook event with key ${idempotencyKey} was already processed.`,
      });
    }

    // Step 2: Atomic transaction to register the webhook event and execute quota resets
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify key inside the transaction to handle extreme concurrent duplicate requests safely
      const doubleCheck = await tx.webhookEvent.findUnique({
        where: { id: idempotencyKey },
      });

      if (doubleCheck) {
        return { alreadyProcessed: true };
      }

      // Record the WebhookEvent key so no further executions can take place
      await tx.webhookEvent.create({
        data: {
          id: idempotencyKey,
          type,
        },
      });

      // Execute quota reset or throw if event type is unknown
      if (type === "QUOTA_RESET") {
        await tx.provider.updateMany({
          data: {
            currentMonthLeads: 0,
          },
        });
      } else {
        throw new Error(`Unsupported webhook event type: ${type}`);
      }

      return { processed: true };
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Webhook API Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process webhook event." },
      { status: 500 }
    );
  }
}
