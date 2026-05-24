type SSEClient = {
  id: string;
  controller: ReadableStreamDefaultController;
};

class SSEBroadcaster {
  private clients = new Map<string, SSEClient>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    if (typeof window === "undefined") {
      this.startHeartbeat();
    }
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) return;
    this.heartbeatInterval = setInterval(() => {
      this.ping();
    }, 30000);
  }

  addClient(id: string, controller: ReadableStreamDefaultController) {
    this.clients.set(id, { id, controller });
    console.log(`[SSE] Client registered. Total clients: ${this.clients.size}`);
  }

  removeClient(id: string) {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      console.log(`[SSE] Client disconnected. Total clients: ${this.clients.size}`);
    }
  }

  private ping() {
    if (this.clients.size === 0) return;
    const encoder = new TextEncoder();
    const pingMessage = "event: ping\ndata: heartbeat\n\n";
    this.clients.forEach((client, id) => {
      try {
        client.controller.enqueue(encoder.encode(pingMessage));
      } catch (error) {
        console.log(`[SSE] Failed to ping client ${id}, removing.`);
        this.clients.delete(id);
      }
    });
  }

  broadcast(event: string, data: any) {
    if (this.clients.size === 0) return;
    console.log(`[SSE] Broadcasting event: ${event} to ${this.clients.size} clients.`);
    const encoder = new TextEncoder();
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    this.clients.forEach((client, id) => {
      try {
        client.controller.enqueue(encoder.encode(payload));
      } catch (error) {
        console.log(`[SSE] Failed to send payload to client ${id}, removing.`);
        this.clients.delete(id);
      }
    });
  }
}

const globalForSSE = globalThis as unknown as {
  sseBroadcaster: SSEBroadcaster | undefined;
};

export const sseBroadcaster =
  globalForSSE.sseBroadcaster ?? new SSEBroadcaster();

if (process.env.NODE_ENV !== "production") {
  globalForSSE.sseBroadcaster = sseBroadcaster;
}
