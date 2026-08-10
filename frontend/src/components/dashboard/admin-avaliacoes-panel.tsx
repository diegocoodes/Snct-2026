"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ClipboardCheck,
  LoaderCircle,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  AdminListPagination,
  AdminListSearch,
  useFilteredPagination,
} from "@/components/dashboard/admin-list-toolbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { secureFetch } from "@/lib/secure-fetch";
import { cn } from "@/lib/utils";

export type AdminAvaliacaoTrabalho = {
  id: string;
  standId: string;
  standCodigo: string;
  standNome: string;
  projetoId: string;
  projetoTitulo: string;
  projetoArea: string | null;
  escolaNome: string | null;
  total: number;
  totalMaximo: number;
  observacoes: string | null;
  createdAt: string;
};

export type AdminAvaliadorResumo = {
  id: string;
  nomeCompleto: string;
  email: string;
  telefone: string;
  cpf: string;
  ativo: boolean;
  createdAt: string;
  avaliacoesCount: number;
  metaMinima: number;
  metaAtingida: boolean;
  trabalhos: AdminAvaliacaoTrabalho[];
};

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function filterAvaliador(avaliador: AdminAvaliadorResumo, query: string) {
  const haystack = [
    avaliador.nomeCompleto,
    avaliador.email,
    avaliador.cpf,
    avaliador.telefone,
    ...avaliador.trabalhos.flatMap((item) => [
      item.standCodigo,
      item.standNome,
      item.projetoTitulo,
      item.escolaNome,
    ]),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function AdminAvaliacoesPanel() {
  const [avaliadores, setAvaliadores] = useState<AdminAvaliadorResumo[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filterFn = useCallback(filterAvaliador, []);
  const list = useFilteredPagination({
    items: avaliadores,
    filterFn,
    pageSize: 20,
  });

  const totais = useMemo(() => {
    const ativos = avaliadores.filter((item) => item.ativo).length;
    const avaliacoes = avaliadores.reduce(
      (sum, item) => sum + item.avaliacoesCount,
      0,
    );
    const metaAtingida = avaliadores.filter((item) => item.metaAtingida).length;
    const metaMinima = avaliadores[0]?.metaMinima ?? 18;
    return {
      avaliadores: avaliadores.length,
      ativos,
      avaliacoes,
      metaAtingida,
      metaMinima,
    };
  }, [avaliadores]);

  const load = useCallback(async () => {
    const response = await secureFetch("/api/admin?resource=avaliacoes");
    const data = (await response.json()) as {
      error?: string;
      avaliadores?: AdminAvaliadorResumo[];
    };
    if (!response.ok) {
      toast.error(data.error ?? "Não foi possível carregar as avaliações.");
      return;
    }
    setAvaliadores(data.avaliadores ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  return (
    <Card className="border-purple-vibrant/20">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="inline-flex items-center gap-2">
              <ClipboardCheck className="size-5 text-cyan-electric" aria-hidden />
              Avaliações
            </CardTitle>
            <p className="mt-2 text-sm leading-6 text-blue-gray">
              Contas de avaliador e os trabalhos (stands) que cada um já
              avaliou. Meta mínima: {totais.metaMinima} stands por avaliador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{totais.avaliadores} avaliadores</Badge>
            <Badge variant="outline">{totais.ativos} ativos</Badge>
            <Badge variant="outline">{totais.avaliacoes} avaliações</Badge>
            <Badge variant="outline">
              {totais.metaAtingida} na meta ({totais.metaMinima}+)
            </Badge>
          </div>
        </div>
        <AdminListSearch
          query={list.query}
          onQueryChange={list.setQuery}
          placeholder="Buscar avaliador, stand ou projeto…"
          resultLabel={`${list.filteredCount} de ${list.totalCount}`}
        />
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="inline-flex items-center gap-2 text-sm text-blue-gray">
            <LoaderCircle className="size-4 animate-spin" aria-hidden />
            Carregando avaliadores…
          </p>
        ) : list.pageItems.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-blue-gray">
            Nenhum avaliador encontrado.
          </p>
        ) : (
          <ul className="grid gap-3">
            {list.pageItems.map((avaliador) => {
              const open = expandedId === avaliador.id;
              return (
                <li
                  key={avaliador.id}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
                >
                  <button
                    type="button"
                    aria-expanded={open}
                    onClick={() =>
                      setExpandedId((current) =>
                        current === avaliador.id ? null : avaliador.id,
                      )
                    }
                    className="flex w-full items-start gap-3 p-4 text-left transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border border-cyan-electric/20 bg-cyan-electric/10 text-cyan-electric">
                      <UserRound className="size-5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-display text-base font-semibold text-ice-white">
                          {avaliador.nomeCompleto}
                        </span>
                        {avaliador.ativo ? (
                          <StatusBadge status="success">Ativo</StatusBadge>
                        ) : (
                          <StatusBadge status="error">Inativo</StatusBadge>
                        )}
                      </span>
                      <span className="mt-1 block text-sm text-blue-gray">
                        {avaliador.email}
                      </span>
                      <span className="mt-2 flex flex-wrap items-center gap-2 text-xs text-blue-gray">
                        <span className="inline-flex items-center gap-2">
                          <ClipboardCheck className="size-3.5" aria-hidden />
                          {avaliador.avaliacoesCount === 0
                            ? "Nenhum trabalho avaliado ainda"
                            : `${avaliador.avaliacoesCount}/${avaliador.metaMinima} stands`}
                        </span>
                        {avaliador.metaAtingida ? (
                          <StatusBadge status="success">Meta ok</StatusBadge>
                        ) : (
                          <StatusBadge status="warning">
                            Faltam{" "}
                            {Math.max(
                              0,
                              avaliador.metaMinima - avaliador.avaliacoesCount,
                            )}
                          </StatusBadge>
                        )}
                      </span>
                    </span>
                    <ChevronDown
                      className={cn(
                        "mt-1 size-5 shrink-0 text-blue-gray transition-transform",
                        open && "rotate-180 text-cyan-electric",
                      )}
                      aria-hidden
                    />
                  </button>

                  {open ? (
                    <div className="border-t border-white/8 px-4 pb-4 pt-3">
                      {avaliador.trabalhos.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-white/10 px-3 py-4 text-sm text-blue-gray">
                          Este avaliador ainda não concluiu nenhuma avaliação.
                        </p>
                      ) : (
                        <ul className="grid gap-2">
                          {avaliador.trabalhos.map((trabalho) => (
                            <li
                              key={trabalho.id}
                              className="rounded-xl border border-white/10 bg-[#0d0e16]/60 px-3 py-3 sm:px-4"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="font-medium text-ice-white">
                                    {trabalho.projetoTitulo}
                                  </p>
                                  <p className="mt-1 text-xs text-blue-gray">
                                    Stand {trabalho.standCodigo}
                                    {trabalho.standNome &&
                                    trabalho.standNome !== trabalho.standCodigo
                                      ? ` · ${trabalho.standNome}`
                                      : ""}
                                    {trabalho.escolaNome
                                      ? ` · ${trabalho.escolaNome}`
                                      : ""}
                                  </p>
                                  {trabalho.projetoArea ? (
                                    <p className="mt-1 text-xs text-blue-gray">
                                      Área: {trabalho.projetoArea}
                                    </p>
                                  ) : null}
                                </div>
                                <div className="text-right">
                                  <p className="font-display text-lg font-semibold text-cyan-electric">
                                    {trabalho.total}
                                    <span className="text-sm font-normal text-blue-gray">
                                      /{trabalho.totalMaximo}
                                    </span>
                                  </p>
                                  <p className="text-[0.7rem] text-blue-gray">
                                    {formatDateTime(trabalho.createdAt)}
                                  </p>
                                </div>
                              </div>
                              {trabalho.observacoes ? (
                                <p className="mt-2 text-xs leading-5 text-blue-gray">
                                  Obs.: {trabalho.observacoes}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-5">
          <AdminListPagination
            page={list.page}
            totalPages={list.totalPages}
            onPageChange={list.setPage}
          />
        </div>
      </CardContent>
    </Card>
  );
}

export { AdminAvaliacoesPanel };
