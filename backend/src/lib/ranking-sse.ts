import type { Response as ExpressResponse, Request as ExpressRequest } from "express";

import { getRankingAoVivo } from "@/lib/ranking";

type SseClient = {
  id: number;
  res: ExpressResponse;
};

const clients = new Set<SseClient>();
let nextId = 1;

function writeEvent(res: ExpressResponse, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function attachRankingSse(app: {
  get: (
    path: string,
    handler: (req: ExpressRequest, res: ExpressResponse) => void,
  ) => void;
}) {
  app.get("/api/avaliador/ranking/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const client: SseClient = { id: nextId++, res };
    clients.add(client);
    writeEvent(res, "connected", { ok: true });

    void getRankingAoVivo()
      .then((ranking) => writeEvent(res, "ranking", ranking))
      .catch(() =>
        writeEvent(res, "error", {
          error: "Não foi possível carregar o ranking.",
        }),
      );

    const heartbeat = setInterval(() => {
      res.write(": ping\n\n");
    }, 20_000);

    req.on("close", () => {
      clearInterval(heartbeat);
      clients.delete(client);
    });
  });
}

export async function broadcastRankingSse() {
  if (clients.size === 0) return;
  try {
    const ranking = await getRankingAoVivo();
    for (const client of clients) {
      try {
        writeEvent(client.res, "ranking", ranking);
      } catch {
        clients.delete(client);
      }
    }
  } catch (error) {
    console.error("[sse/ranking] falha no broadcast", error);
  }
}
