"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Crown,
  LoaderCircle,
  Medal,
  Radio,
  Star,
  Trophy,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { secureFetch } from "@/lib/secure-fetch";
import { cn } from "@/lib/utils";

type RankingTrabalho = {
  posicao: number;
  standCodigo: string;
  standNome: string;
  projetoTitulo: string;
  projetoArea: string | null;
  escolaNome: string | null;
  media: number;
  notaMaxima: number;
  avaliacoesCount: number;
  totalMaximo: number;
};

type RankingTitulacao = {
  posicao: number;
  alunoNome: string;
  projetoTitulo: string | null;
  escolaNome: string | null;
  standCodigo: string | null;
  titulacoesCount: number;
  categorias: { codigo: string; titulo: string; quantidade: number }[];
};

type RankingPayload = {
  updatedAt: string;
  trabalhos: RankingTrabalho[];
  titulacoes: RankingTitulacao[];
};

function rankingWsUrl() {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws/ranking`;
}

function formatUpdatedAt(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RankBadge({ posicao }: { posicao: number }) {
  if (posicao === 1) {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-amber-400/20 text-amber-300">
        <Crown className="size-4" aria-hidden />
      </span>
    );
  }
  if (posicao === 2) {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-slate-300/20 text-slate-200">
        <Medal className="size-4" aria-hidden />
      </span>
    );
  }
  if (posicao === 3) {
    return (
      <span className="grid size-8 place-items-center rounded-full bg-orange-400/20 text-orange-300">
        <Medal className="size-4" aria-hidden />
      </span>
    );
  }
  return (
    <span className="grid size-8 place-items-center rounded-full bg-white/10 text-xs font-semibold text-blue-gray">
      {posicao}º
    </span>
  );
}

function AvaliadorRankingLive() {
  const [tab, setTab] = useState<"trabalhos" | "titulos">("trabalhos");
  const [ranking, setRanking] = useState<RankingPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [transport, setTransport] = useState<"ws" | "sse" | "poll">("poll");
  const [error, setError] = useState("");
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const applyPayload = useCallback((data: RankingPayload) => {
    setRanking(data);
    setError("");
    setLoading(false);
  }, []);

  const loadHttp = useCallback(async () => {
    try {
      const response = await secureFetch("/api/avaliador/ranking");
      const data = (await response.json()) as RankingPayload & { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível carregar o ranking.");
        setLoading(false);
        return;
      }
      applyPayload(data);
    } catch {
      setError("Falha de rede ao carregar o ranking.");
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void loadHttp();

    let closed = false;
    let attempt = 0;
    let preferSse = false;

    function connectSse() {
      if (closed) return;
      eventSourceRef.current?.close();
      const source = new EventSource("/api/avaliador/ranking/stream");
      eventSourceRef.current = source;

      source.addEventListener("ranking", (event) => {
        try {
          const data = JSON.parse(
            String((event as MessageEvent).data),
          ) as RankingPayload;
          applyPayload(data);
          setLive(true);
          setTransport("sse");
        } catch {
          // ignore
        }
      });

      source.onerror = () => {
        setLive(false);
        source.close();
        eventSourceRef.current = null;
        if (closed) return;
        reconnectTimer.current = setTimeout(() => {
          void loadHttp();
          connectSse();
        }, 5_000);
      };
    }

    function connectWs() {
      if (closed || preferSse) {
        connectSse();
        return;
      }
      const url = rankingWsUrl();
      if (!url) {
        connectSse();
        return;
      }

      try {
        const socket = new WebSocket(url);
        socketRef.current = socket;
        let opened = false;

        const openTimeout = setTimeout(() => {
          if (!opened) {
            preferSse = true;
            socket.close();
            connectSse();
          }
        }, 2500);

        socket.onopen = () => {
          opened = true;
          clearTimeout(openTimeout);
          attempt = 0;
          setLive(true);
          setTransport("ws");
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(String(event.data)) as RankingPayload & {
              type?: string;
              error?: string;
            };
            if (message.type === "pong") return;
            if (message.type === "error") {
              setError(message.error ?? "Erro no ranking ao vivo.");
              return;
            }
            if (message.trabalhos && message.titulacoes) {
              applyPayload(message);
            }
          } catch {
            // ignore malformed
          }
        };

        socket.onclose = () => {
          clearTimeout(openTimeout);
          setLive(false);
          socketRef.current = null;
          if (closed) return;
          if (!opened || preferSse) {
            preferSse = true;
            connectSse();
            return;
          }
          const delay = Math.min(15_000, 1_000 * 2 ** attempt);
          attempt += 1;
          reconnectTimer.current = setTimeout(connectWs, delay);
        };

        socket.onerror = () => {
          preferSse = true;
          socket.close();
        };
      } catch {
        preferSse = true;
        connectSse();
      }
    }

    connectWs();

    const poll = setInterval(() => {
      const wsOpen =
        socketRef.current && socketRef.current.readyState === WebSocket.OPEN;
      const sseOpen = Boolean(eventSourceRef.current);
      if (!wsOpen && !sseOpen) {
        setTransport("poll");
        void loadHttp();
      }
    }, 30_000);

    return () => {
      closed = true;
      clearInterval(poll);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      socketRef.current?.close();
      socketRef.current = null;
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [applyPayload, loadHttp]);

  return (
    <Card className="border-cyan-electric/20">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <Trophy className="size-5 text-cyan-electric" aria-hidden />
              Ranking ao vivo
            </CardTitle>
            <p className="mt-2 text-sm text-blue-gray">
              Trabalhos com melhor média de notas e alunos em destaque nas
              titulações.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {live ? (
              <Badge
                variant="outline"
                className="border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              >
                <Radio className="size-3.5 animate-pulse" aria-hidden />
                Ao vivo
                {transport === "ws"
                  ? " · WS"
                  : transport === "sse"
                    ? " · SSE"
                    : ""}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="border-amber-400/30 bg-amber-400/10 text-amber-200"
              >
                <WifiOff className="size-3.5" aria-hidden />
                Reconectando…
              </Badge>
            )}
            {ranking?.updatedAt ? (
              <span className="text-xs text-blue-gray">
                Atualizado às {formatUpdatedAt(ranking.updatedAt)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2" role="tablist" aria-label="Tipo de ranking">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "trabalhos"}
            onClick={() => setTab("trabalhos")}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              tab === "trabalhos"
                ? "border-cyan-electric/40 bg-cyan-electric/15 text-cyan-electric"
                : "border-white/10 bg-white/[0.02] text-blue-gray hover:text-ice-white",
            )}
          >
            Trabalhos por nota
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "titulos"}
            onClick={() => setTab("titulos")}
            className={cn(
              "rounded-xl border px-3 py-2 text-sm font-semibold transition-colors",
              tab === "titulos"
                ? "border-cyan-electric/40 bg-cyan-electric/15 text-cyan-electric"
                : "border-white/10 bg-white/[0.02] text-blue-gray hover:text-ice-white",
            )}
          >
            Destaques (títulos)
          </button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-blue-gray">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Carregando ranking…
          </p>
        ) : error && !ranking ? (
          <p className="text-sm text-red-200">{error}</p>
        ) : tab === "trabalhos" ? (
          ranking?.trabalhos.length ? (
            <ol className="grid gap-2">
              {ranking.trabalhos.map((item) => (
                <li
                  key={`${item.standCodigo}-${item.projetoTitulo}`}
                  className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
                >
                  <RankBadge posicao={item.posicao} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-ice-white">
                      {item.projetoTitulo}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-gray">
                      Stand {item.standCodigo}
                      {item.escolaNome ? ` · ${item.escolaNome}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-semibold text-cyan-electric">
                      {item.media}
                      <span className="text-sm font-normal text-blue-gray">
                        /{item.totalMaximo}
                      </span>
                    </p>
                    <p className="text-[0.7rem] text-blue-gray">
                      {item.avaliacoesCount} aval.
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-blue-gray">
              Ainda não há avaliações registradas.
            </p>
          )
        ) : ranking?.titulacoes.length ? (
          <ol className="grid gap-2">
            {ranking.titulacoes.map((item) => (
              <li
                key={item.alunoNome + item.posicao}
                className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
              >
                <RankBadge posicao={item.posicao} />
                <div className="min-w-0 flex-1">
                  <p className="inline-flex items-center gap-2 font-medium text-ice-white">
                    <Star className="size-3.5 text-amber-300" aria-hidden />
                    {item.alunoNome}
                  </p>
                  <p className="mt-0.5 text-xs text-blue-gray">
                    {item.projetoTitulo ?? "Projeto"}
                    {item.standCodigo ? ` · Stand ${item.standCodigo}` : ""}
                    {item.escolaNome ? ` · ${item.escolaNome}` : ""}
                  </p>
                  {item.categorias.length ? (
                    <p className="mt-1 text-[0.7rem] text-blue-gray">
                      {item.categorias
                        .map(
                          (cat) =>
                            `${cat.titulo}${cat.quantidade > 1 ? ` ×${cat.quantidade}` : ""}`,
                        )
                        .join(" · ")}
                    </p>
                  ) : null}
                </div>
                <div className="text-right">
                  <p className="font-display text-lg font-semibold text-magenta-neon">
                    {item.titulacoesCount}
                  </p>
                  <p className="text-[0.7rem] text-blue-gray">
                    título{item.titulacoesCount === 1 ? "" : "s"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-blue-gray">
            Ainda não há titulações concedidas.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export { AvaliadorRankingLive };
