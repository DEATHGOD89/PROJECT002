import { NextRequest } from "next/server";
import { sseBroadcaster } from "@/lib/sse";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = uuidv4();

  const stream = new ReadableStream({
    start(controller) {
      // Register this client connection in the global broadcaster registry
      sseBroadcaster.addClient(clientId, controller);

      // Send initial handshake event to confirm successful connection
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode("event: connected\ndata: Welcome to Prowider Live Stream\n\n")
      );
    },
    cancel() {
      // Clean up the client from our broadcaster registry when they disconnect
      sseBroadcaster.removeClient(clientId);
    },
  });

  // Return the stream with SSE-specific HTTP headers
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
