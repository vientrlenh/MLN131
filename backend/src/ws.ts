import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";

export type WSEventType = "new_post" | "new_comment" | "new_vote";

export interface WSEvent {
  type: WSEventType;
  payload: Record<string, unknown>;
}

let wss: WebSocketServer | null = null;

export function initWebSocket(server: Server) {
  wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws) => {
    console.log("WebSocket client connected");
    ws.on("close", () => console.log("WebSocket client disconnected"));
  });

  return wss;
}

export function broadcast(event: WSEvent) {
  if (!wss) return;

  const data = JSON.stringify(event);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  }
}
