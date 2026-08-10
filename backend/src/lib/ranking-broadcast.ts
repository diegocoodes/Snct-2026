import { attachRankingWebSocket, broadcastRankingUpdate as broadcastWs } from "@/lib/ranking-ws";
import { attachRankingSse, broadcastRankingSse } from "@/lib/ranking-sse";

export async function broadcastRankingUpdate() {
  await Promise.all([broadcastWs(), broadcastRankingSse()]);
}

export { attachRankingWebSocket, attachRankingSse };
