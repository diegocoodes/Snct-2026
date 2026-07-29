"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FolderKanban, LoaderCircle } from "lucide-react";
import { toast } from "sonner";

import type { AdminEstande } from "@/components/dashboard/admin-estandes-panel";
import {
  AdminListPagination,
  AdminListSearch,
  useFilteredPagination,
} from "@/components/dashboard/admin-list-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { secureFetch } from "@/lib/secure-fetch";

export type ProjetoStatus = "PENDENTE" | "APROVADO" | "REJEITADO";

export type AdminProjeto = {
  id: string;
  titulo: string;
  area: string | null;
  descricao: string | null;
  status: ProjetoStatus;
  escolaNome: string;
  professorNome: string;
  professorEmail: string;
  alunos: { id: string; nomeCompleto: string }[];
  alunosCount: number;
  estande: {
    id: string;
    codigo: string;
    nome: string | null;
    localizacao: string;
  } | null;
};

const selectClassName =
  "h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function statusBadgeForProjeto(status: ProjetoStatus) {
  if (status === "APROVADO")
    return <StatusBadge status="success">Aprovado</StatusBadge>;
  if (status === "REJEITADO")
    return <StatusBadge status="error">Rejeitado</StatusBadge>;
  return <StatusBadge status="warning">Pendente</StatusBadge>;
}

function filterProjeto(projeto: AdminProjeto, query: string) {
  const haystack = [
    projeto.titulo,
    projeto.area,
    projeto.escolaNome,
    projeto.professorNome,
    projeto.professorEmail,
    projeto.status,
    projeto.estande?.codigo,
    projeto.estande?.nome,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function AdminProjetosPanel() {
  const [estandes, setEstandes] = useState<AdminEstande[]>([]);
  const [projetos, setProjetos] = useState<AdminProjeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | ProjetoStatus>(
    "TODOS",
  );
  const [aprovando, setAprovando] = useState<AdminProjeto | null>(null);
  const [estandeSelecionado, setEstandeSelecionado] = useState("");

  const disponiveis = useMemo(
    () => estandes.filter((item) => item.status === "DISPONIVEL"),
    [estandes],
  );

  const projetosFiltrados = useMemo(() => {
    if (filtroStatus === "TODOS") return projetos;
    return projetos.filter((item) => item.status === filtroStatus);
  }, [projetos, filtroStatus]);

  const filterFn = useCallback(filterProjeto, []);
  const list = useFilteredPagination({
    items: projetosFiltrados,
    filterFn,
  });

  const load = useCallback(async () => {
    const response = await secureFetch("/api/admin");
    const data = (await response.json()) as {
      error?: string;
      estandes?: AdminEstande[];
      projetos?: AdminProjeto[];
    };
    if (!response.ok) {
      toast.error(data.error ?? "Não foi possível carregar os projetos.");
      return;
    }
    setEstandes(data.estandes ?? []);
    setProjetos(data.projetos ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function mutate(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const response = await secureFetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        estandes?: AdminEstande[];
        projetos?: AdminProjeto[];
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível concluir a ação.");
        return false;
      }
      if (data.estandes) setEstandes(data.estandes);
      if (data.projetos) setProjetos(data.projetos);
      if (!data.estandes || !data.projetos) await load();
      toast.success(successMessage);
      return true;
    } catch {
      toast.error("Falha de rede. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function confirmarAprovacao() {
    if (!aprovando || !estandeSelecionado) {
      toast.error("Selecione um stand disponível.");
      return;
    }
    const ok = await mutate(
      {
        action: "aprovarProjeto",
        projetoId: aprovando.id,
        estandeId: estandeSelecionado,
      },
      "Projeto aprovado. O stand recebeu o nome do projeto.",
    );
    if (ok) {
      setAprovando(null);
      setEstandeSelecionado("");
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-blue-gray">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Carregando projetos…
      </p>
    );
  }

  return (
    <div className="grid gap-6">
      <Card className="border-purple-vibrant/20">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FolderKanban className="size-5 text-[#BDA5FF]" aria-hidden />
              Projetos submetidos
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-blue-gray">
              Ao aprovar, escolha um stand disponível. O nome do stand
              passa a ser o título do projeto.
            </p>
          </div>
          <div className="space-y-2 sm:w-52">
            <Label htmlFor="filtro-projeto">Filtrar status</Label>
            <select
              id="filtro-projeto"
              className={selectClassName}
              value={filtroStatus}
              onChange={(event) =>
                setFiltroStatus(event.target.value as "TODOS" | ProjetoStatus)
              }
            >
              <option value="TODOS">Todos</option>
              <option value="PENDENTE">Pendentes</option>
              <option value="APROVADO">Aprovados</option>
              <option value="REJEITADO">Rejeitados</option>
            </select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminListSearch
            query={list.query}
            onQueryChange={list.setQuery}
            placeholder="Buscar projeto, escola ou professor…"
            resultLabel={`${list.filteredCount} resultado(s)`}
          />
          {list.pageItems.length === 0 ? (
            <p className="text-sm text-blue-gray">
              {projetosFiltrados.length
                ? "Nenhum projeto encontrado para esta busca."
                : "Nenhum projeto nesta lista."}
            </p>
          ) : (
            <ul className="space-y-3">
              {list.pageItems.map((projeto) => (
                <li
                  key={projeto.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-medium text-ice-white">
                          {projeto.titulo}
                        </h3>
                        {statusBadgeForProjeto(projeto.status)}
                      </div>
                      <p className="text-sm text-blue-gray">
                        Área/tema: {projeto.area || "—"}
                      </p>
                      <p className="text-sm text-blue-gray">
                        Escola: {projeto.escolaNome}
                      </p>
                      <p className="text-sm text-blue-gray">
                        Professor: {projeto.professorNome} (
                        {projeto.professorEmail})
                      </p>
                      <p className="text-sm text-blue-gray">
                        Alunos ({projeto.alunosCount}/4):{" "}
                        {projeto.alunos.length
                          ? projeto.alunos.map((a) => a.nomeCompleto).join(", ")
                          : "nenhum"}
                      </p>
                      <p className="text-sm text-blue-gray">
                        Stand:{" "}
                        {projeto.estande
                          ? `${projeto.estande.codigo}${
                              projeto.estande.nome
                                ? ` — ${projeto.estande.nome}`
                                : ""
                            }`
                          : "não vinculado"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {projeto.status !== "APROVADO" ? (
                        <Button
                          type="button"
                          variant="glow"
                          size="sm"
                          disabled={busy || disponiveis.length === 0}
                          onClick={() => {
                            setAprovando(projeto);
                            setEstandeSelecionado("");
                          }}
                        >
                          Aprovar
                        </Button>
                      ) : null}
                      {projeto.status !== "REJEITADO" ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              {
                                action: "rejeitarProjeto",
                                projetoId: projeto.id,
                              },
                              "Projeto rejeitado. Stand liberado, se havia vínculo.",
                            )
                          }
                        >
                          Rejeitar
                        </Button>
                      ) : null}
                      {projeto.status === "APROVADO" ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              {
                                action: "cancelarAprovacaoProjeto",
                                projetoId: projeto.id,
                              },
                              "Aprovação cancelada. Stand liberado.",
                            )
                          }
                        >
                          Cancelar aprovação
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AdminListPagination
            page={list.page}
            totalPages={list.totalPages}
            onPageChange={list.setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(aprovando)}
        onOpenChange={(open) => {
          if (!open) {
            setAprovando(null);
            setEstandeSelecionado("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Selecionar stand</DialogTitle>
            <DialogDescription>
              Ao confirmar, o projeto{" "}
              <strong className="text-ice-white">{aprovando?.titulo}</strong>{" "}
              será aprovado e o stand receberá esse nome.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="estande-aprovacao">Stands disponíveis</Label>
            <select
              id="estande-aprovacao"
              className={selectClassName}
              value={estandeSelecionado}
              onChange={(event) => setEstandeSelecionado(event.target.value)}
            >
              <option value="">Selecione…</option>
              {disponiveis.map((estande) => (
                <option key={estande.id} value={estande.id}>
                  Stand {estande.codigo}
                </option>
              ))}
            </select>
            {disponiveis.length === 0 ? (
              <p className="text-sm text-red-300">
                Não há stands disponíveis. Cadastre na aba Stands.
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAprovando(null);
                setEstandeSelecionado("");
              }}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="glow"
              disabled={busy || !estandeSelecionado}
              onClick={() => void confirmarAprovacao()}
            >
              Confirmar aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AdminProjetosPanel };
