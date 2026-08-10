import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";

import { getRankingAoVivo } from "@/lib/ranking";

type Client = WebSocket & { isAlive?: boolean };

let wss: WebSocketServer | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

function sendJson(socket: WebSocket, payload: unknown) {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

async function pushRankingTo(socket: WebSocket) {
  try {
    const ranking = await getRankingAoVivo();
    sendJson(socket, { type: "ranking", ...ranking });
  } catch (error) {
    console.error("[ws/ranking] falha ao montar ranking", error);
    sendJson(socket, {
      type: "error",
      error: "Não foi possível carregar o ranking.",
    });
  }
}

export function attachRankingWebSocket(server: HttpServer) {
  if (wss) return wss;

  wss = new WebSocketServer({ server, path: "/ws/ranking" });

  wss.on("connection", (socket) => {
    const client = socket as Client;
    client.isAlive = true;
    client.on("pong", () => {
      client.isAlive = true;
    });
    client.on("message", (raw) => {
      const text = typeof raw === "string" ? raw : raw.toString();
      if (text === "ping" || text === '{"type":"ping"}') {
        sendJson(client, { type: "pong" });
        return;
      }
      if (text === "refresh" || text.includes('"refresh"')) {
        void pushRankingTo(client);
      }
    });
    void pushRankingTo(client);
  });

  heartbeatTimer = setInterval(() => {
    if (!wss) return;
    for (const client of wss.clients) {
      const typed = client as Client;
      if (typed.isAlive === false) {
        typed.terminate();
        continue;
      }
      typed.isAlive = false;
      typed.ping();
    }
  }, 30_000);

  wss.on("close", () => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  });

  return wss;
}

export async function broadcastRankingUpdate() {
  if (!wss || wss.clients.size === 0) return;
  try {
    const ranking = await getRankingAoVivo();
    const payload = JSON.stringify({ type: "ranking", ...ranking });
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(payload);
      }
    }
  } catch (error) {
    console.error("[ws/ranking] falha no broadcast", error);
  }
}
