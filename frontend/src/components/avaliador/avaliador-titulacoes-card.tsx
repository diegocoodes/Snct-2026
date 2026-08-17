"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Award } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { secureFetch } from "@/lib/secure-fetch";

type TitulacaoOpcao = {
  codigo: string;
  titulo: string;
  faixaEtaria: string;
  disponivel: boolean;
  concedida: { alunoNome: string; standCodigo: string } | null;
};

function AvaliadorTitulacoesCard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dataEvento, setDataEvento] = useState("");
  const [disponiveis, setDisponiveis] = useState(0);
  const [totalPorDia, setTotalPorDia] = useState(3);
  const [opcoes, setOpcoes] = useState<TitulacaoOpcao[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await secureFetch("/api/avaliador/titulacoes");
        const data = (await response.json()) as {
          error?: string;
          dataEvento?: string;
          disponiveis?: number;
          totalPorDia?: number;
          opcoes?: TitulacaoOpcao[];
        };
        if (cancelled) return;
        if (!response.ok) {
          setError(data.error ?? "Não foi possível carregar as titulações.");
          return;
        }
        setDataEvento(data.dataEvento ?? "");
        setDisponiveis(data.disponiveis ?? 0);
        setTotalPorDia(data.totalPorDia ?? 3);
        setOpcoes(data.opcoes ?? []);
      } catch {
        if (!cancelled) setError("Falha de rede ao carregar titulações.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="mb-6 border-cyan-electric/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="size-5 text-cyan-electric" aria-hidden />
          Titulações do dia
        </CardTitle>
        <p className="text-sm text-blue-gray">
          Você tem 3 títulos por dia (Pequeno(a) Cientista, Explorador(a) e
          Pesquisador(a)). Cada um só pode ser concedido uma vez ao dia, para um
          único candidato. Quando as 3 forem usadas, voltam no próximo dia do
          evento.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-blue-gray">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Carregando…
          </p>
        ) : error ? (
          <p className="text-sm text-warning">{error}</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-blue-gray">
              Disponíveis hoje ({dataEvento}):{" "}
              <strong className="text-ice-white">
                {disponiveis}/{totalPorDia}
              </strong>
            </p>
            <ul className="space-y-2">
              {opcoes.map((item) => (
                <li
                  key={item.codigo}
                  className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm text-ice-white">{item.titulo}</p>
                    <p className="text-xs text-blue-gray">{item.faixaEtaria}</p>
                    {item.concedida ? (
                      <p className="mt-1 text-xs text-blue-gray">
                        Concedido a {item.concedida.alunoNome} (stand{" "}
                        {item.concedida.standCodigo})
                      </p>
                    ) : null}
                  </div>
                  {item.disponivel ? (
                    <StatusBadge status="info">Disponível</StatusBadge>
                  ) : (
                    <StatusBadge status="success">Usado</StatusBadge>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { AvaliadorTitulacoesCard };
