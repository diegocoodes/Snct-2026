"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Download,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  School,
  Trash2,
  Users,
  X,
} from "lucide-react";
import QRCode from "qrcode";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { buildCredentialQrPayload } from "@/lib/qr-payload";
import { secureFetch } from "@/lib/secure-fetch";

const checkboxClassName =
  "mt-1 size-4 shrink-0 cursor-pointer rounded border border-cyan-electric/40 bg-[#111329] accent-cyan-electric";

type Step = "escola" | "temas" | "cadastro" | "inscritos";

type ProjetoStatus = "PENDENTE" | "APROVADO" | "REJEITADO";

type ProfessorEscola = {
  id: string;
  nome: string;
  cidade: string | null;
  projetosCount?: number;
  locked?: boolean;
};

type ProfessorTema = {
  id: string;
  titulo: string;
  area: string | null;
  descricao: string | null;
  status: ProjetoStatus;
  alunosCount: number;
  estande: {
    id: string;
    codigo: string;
    nome: string | null;
    localizacao: string;
  } | null;
};

type ProfessorAlunoDocumento = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
};

type ProfessorAluno = {
  id: string;
  temaId: string;
  usuarioId: string;
  nomeCompleto: string;
  nomeResponsavel: string;
  email: string;
  telefone: string;
  cpf: string;
  dataNascimento: string;
  age: number;
  foto?: string;
  qrCodeHash: string;
  documentos: ProfessorAlunoDocumento[];
};

type PanelState = {
  escolas?: ProfessorEscola[];
  escola: ProfessorEscola | null;
  temas: ProfessorTema[];
  alunosByTema: Record<string, ProfessorAluno[]>;
};

function isProjetoLocked(tema: ProfessorTema) {
  return tema.status === "APROVADO" && Boolean(tema.estande);
}

function escolasFromPanel(panel: PanelState) {
  const list = panel.escolas?.length
    ? panel.escolas
    : panel.escola
      ? [panel.escola]
      : [];
  return list.map((escola) => {
    const temasDaEscola =
      panel.escola?.id === escola.id ? panel.temas : [];
    const lockedByTemas = temasDaEscola.some(isProjetoLocked);
    return {
      ...escola,
      locked: Boolean(escola.locked) || lockedByTemas,
      projetosCount:
        typeof escola.projetosCount === "number"
          ? Math.max(escola.projetosCount, temasDaEscola.length)
          : temasDaEscola.length || undefined,
    };
  });
}

function normalizePanel(data: PanelState): PanelState {
  const escolas = escolasFromPanel(data);
  const escola =
    (data.escola
      ? escolas.find((item) => item.id === data.escola?.id)
      : null) ??
    escolas[0] ??
    null;
  return { ...data, escolas, escola };
}

function formatCpf(raw: string) {
  const cpf = onlyDigits(raw);
  if (cpf.length !== 11) return raw;
  return `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
}

function AlunoQrThumb({ hash, name }: { hash: string; name: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(buildCredentialQrPayload(hash), {
      width: 220,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#10002b", light: "#f7f7fb" },
    }).then((value) => {
      if (active) setSrc(value);
    });
    return () => {
      active = false;
    };
  }, [hash]);

  if (!src) {
    return (
      <div className="size-14 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
    );
  }

  return (
    <Image
      src={src}
      alt={`QR Code de ${name}`}
      width={56}
      height={56}
      className="size-14 rounded-lg"
      unoptimized
    />
  );
}

function ProfessorPanel() {
  const [panel, setPanel] = useState<PanelState>({
    escolas: [],
    escola: null,
    temas: [],
    alunosByTema: {},
  });
  const [step, setStep] = useState<Step>("escola");
  const [loading, setLoading] = useState(true);
  const [escolaNome, setEscolaNome] = useState("");
  const [editingEscola, setEditingEscola] = useState(false);
  const [editingEscolaId, setEditingEscolaId] = useState<string | null>(null);
  const [addingTema, setAddingTema] = useState(false);
  const [editingTemaId, setEditingTemaId] = useState<string | null>(null);
  const [temaTitulo, setTemaTitulo] = useState("");
  const [temaArea, setTemaArea] = useState("");
  const [temaDescricao, setTemaDescricao] = useState("");
  const [selectedTemaId, setSelectedTemaId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [birth, setBirth] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [aceitouDireitoImagem, setAceitouDireitoImagem] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);

  const age = useMemo(() => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return null;
    const [y, m, d] = birth.split("-").map(Number);
    const now = new Date();
    let value = now.getFullYear() - y;
    if (
      now.getMonth() + 1 < m ||
      (now.getMonth() + 1 === m && now.getDate() < d)
    ) {
      value -= 1;
    }
    return value;
  }, [birth]);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const response = await secureFetch("/api/professor", {
          method: "GET",
          cache: "no-store",
        });
        const data = (await response.json().catch(() => null)) as
          | PanelState
          | null;
        if (!active || !response.ok || !data) return;
        const normalized = normalizePanel(data);
        setPanel(normalized);
        const escolas = escolasFromPanel(normalized);
        setEscolaNome("");
        setEditingEscola(escolas.length === 0);
        setEditingEscolaId(null);
        setStep("escola");
        setSelectedTemaId(null);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const escolas = escolasFromPanel(panel);
  const selectedTema =
    panel.temas.find((tema) => tema.id === selectedTemaId) ?? null;
  const alunos = selectedTema
    ? (panel.alunosByTema[selectedTema.id] ?? [])
    : [];

  function applyPanel(data: PanelState) {
    const normalized = normalizePanel(data);
    setPanel(normalized);
    const nextEscolas = escolasFromPanel(normalized);
    if (editingEscolaId && nextEscolas.some((item) => item.id === editingEscolaId)) {
      const current = nextEscolas.find((item) => item.id === editingEscolaId);
      setEscolaNome(current?.nome ?? "");
      setEditingEscola(false);
      setEditingEscolaId(null);
    } else if (!editingEscola) {
      setEscolaNome("");
      setEditingEscola(nextEscolas.length === 0);
      setEditingEscolaId(null);
    }
    if (
      selectedTemaId &&
      !normalized.temas.some((tema) => tema.id === selectedTemaId)
    ) {
      setSelectedTemaId(null);
      setStep(normalized.escola || nextEscolas.length ? "temas" : "escola");
    }
  }

  async function loadEscolaPanel(escolaId: string) {
    setBusy(true);
    setError("");
    try {
      const response = await secureFetch(
        `/api/professor?escolaId=${encodeURIComponent(escolaId)}`,
        { method: "GET", cache: "no-store" },
      );
      const data = (await response.json().catch(() => null)) as
        | (PanelState & { error?: string })
        | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "Não foi possível abrir a escola.");
        return false;
      }
      const normalized = normalizePanel(data);
      applyPanel(normalized);
      return normalized;
    } catch {
      setError("Falha de rede. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function mutateJson(
    method: "POST" | "DELETE",
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await secureFetch("/api/professor", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await response.json().catch(() => null)) as
        | (PanelState & { error?: string })
        | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "Não foi possível salvar.");
        return false;
      }
      applyPanel(data);
      setMessage(successMessage);
      return true;
    } catch {
      setError("Falha de rede. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function onSaveEscola(event: FormEvent) {
    event.preventDefault();
    const ok = await mutateJson(
      "POST",
      {
        action: "saveEscola",
        nome: escolaNome,
        cidade: "Paulista",
        ...(editingEscolaId ? { escolaId: editingEscolaId } : {}),
      },
      editingEscolaId ? "Escola atualizada." : "Escola cadastrada.",
    );
    if (ok) {
      setEditingEscola(false);
      setEditingEscolaId(null);
      setEscolaNome("");
      setStep("temas");
    }
  }

  async function onDeleteEscola(escolaId: string) {
    if (
      !window.confirm(
        "Excluir a escola remove todos os projetos e alunos. Continuar?",
      )
    ) {
      return;
    }
    const ok = await mutateJson(
      "DELETE",
      { action: "deleteEscola", escolaId },
      "Escola excluída.",
    );
    if (ok) {
      setStep("escola");
      setSelectedTemaId(null);
      setEditingEscola(false);
      setEditingEscolaId(null);
    }
  }

  async function onCreateTema(event: FormEvent) {
    event.preventDefault();
    if (!panel.escola) {
      setError("Selecione ou cadastre uma escola antes de criar projetos.");
      return;
    }
    if (panel.escola.locked) {
      setError(
        "Esta escola já possui projeto aprovado e vinculado a um stand. Não é possível cadastrar outro projeto.",
      );
      setAddingTema(false);
      return;
    }
    const ok = await mutateJson(
      "POST",
      {
        action: "createTema",
        escolaId: panel.escola.id,
        titulo: temaTitulo,
        area: temaArea,
        descricao: temaDescricao,
      },
      "Projeto cadastrado e enviado para análise.",
    );
    if (ok) {
      setTemaTitulo("");
      setTemaArea("");
      setTemaDescricao("");
      setAddingTema(false);
    }
  }

  async function onUpdateTema(event: FormEvent) {
    event.preventDefault();
    if (!editingTemaId) return;
    const ok = await mutateJson(
      "POST",
      {
        action: "updateTema",
        temaId: editingTemaId,
        titulo: temaTitulo,
        area: temaArea,
        descricao: temaDescricao,
      },
      "Projeto atualizado.",
    );
    if (ok) {
      setEditingTemaId(null);
      setTemaTitulo("");
      setTemaArea("");
      setTemaDescricao("");
    }
  }

  async function onDeleteTema(temaId: string) {
    if (
      !window.confirm(
        "Excluir o projeto remove os alunos cadastrados nele. Continuar?",
      )
    ) {
      return;
    }
    await mutateJson(
      "DELETE",
      { action: "deleteTema", temaId },
      "Projeto removido.",
    );
  }

  function startEditTema(tema: ProfessorTema) {
    setAddingTema(false);
    setEditingTemaId(tema.id);
    setTemaTitulo(tema.titulo);
    setTemaArea(tema.area ?? "");
    setTemaDescricao(tema.descricao ?? "");
  }

  function openCadastro(temaId: string) {
    setSelectedTemaId(temaId);
    setStep("cadastro");
    setError("");
    setMessage("");
  }

  async function openAlunosDaEscola(escolaId: string) {
    const escolaPanel = await loadEscolaPanel(escolaId);
    if (!escolaPanel) return;

    if (escolaPanel.temas.length === 1) {
      setSelectedTemaId(escolaPanel.temas[0].id);
      setStep("inscritos");
      setMessage("");
      return;
    }

    setSelectedTemaId(null);
    setStep("temas");
    setMessage(
      escolaPanel.temas.length > 1
        ? "Escolha um projeto para visualizar os alunos cadastrados."
        : "Cadastre um projeto para adicionar e visualizar alunos.",
    );
  }

  async function onCreateAluno(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTema) return;

    const formEl = event.currentTarget;
    const form = new FormData(formEl);

    if (!isValidCpf(String(form.get("cpf") ?? ""))) {
      setError("Informe um CPF válido.");
      return;
    }
    if (!aceitouDireitoImagem) {
      setError("Aceite o direito de uso de imagem para concluir.");
      return;
    }
    if (!privacyConsent) {
      setError("Aceite o aviso de privacidade para continuar.");
      return;
    }
    if (age !== null && age < 18 && !guardianConsent) {
      setError("O consentimento do responsável é obrigatório para menores.");
      return;
    }
    const autorizacao = form.get("autorizacao");
    if (
      age !== null &&
      age < 18 &&
      (!(autorizacao instanceof File) || autorizacao.size < 1)
    ) {
      setError(
        "Anexe o documento de autorização dos pais/responsáveis para menores.",
      );
      return;
    }

    setBusy(true);
    setError("");
    setMessage("");

    const payload = new FormData();
    payload.set("action", "createAluno");
    payload.set("temaId", selectedTema.id);
    payload.set("nomeCompleto", String(form.get("nomeCompleto") ?? "").trim());
    payload.set(
      "nomeResponsavel",
      String(form.get("nomeResponsavel") ?? "").trim(),
    );
    payload.set("email", String(form.get("email") ?? "").trim().toLowerCase());
    payload.set("telefone", onlyDigits(String(form.get("telefone") ?? "")));
    payload.set("cpf", onlyDigits(String(form.get("cpf") ?? "")));
    payload.set("dataNascimento", String(form.get("dataNascimento") ?? ""));
    payload.set(
      "aceitouDireitoImagem",
      aceitouDireitoImagem ? "true" : "false",
    );
    payload.set("privacyConsent", privacyConsent ? "true" : "false");
    if (guardianConsent) payload.set("guardianConsent", "true");

    const foto = form.get("foto");
    if (foto instanceof File && foto.size > 0) {
      payload.set("foto", foto);
    }
    if (autorizacao instanceof File && autorizacao.size > 0) {
      payload.set("autorizacao", autorizacao);
    }

    try {
      const response = await secureFetch("/api/professor", {
        method: "POST",
        body: payload,
      });
      const data = (await response.json().catch(() => null)) as
        | (PanelState & { error?: string })
        | null;
      if (!response.ok || !data) {
        setError(data?.error ?? "Não foi possível cadastrar o aluno.");
        return;
      }
      applyPanel(data);
      setMessage("Aluno cadastrado neste projeto.");
      formEl.reset();
      setBirth("");
      setPreview(null);
      setAceitouDireitoImagem(false);
      setPrivacyConsent(false);
      setGuardianConsent(false);
    } catch {
      setError("Falha de rede. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function goBackToEscolas() {
    setSelectedTemaId(null);
    setAddingTema(false);
    setEditingTemaId(null);
    setBusy(true);
    setError("");
    try {
      const response = await secureFetch("/api/professor", {
        method: "GET",
        cache: "no-store",
      });
      const data = (await response.json().catch(() => null)) as
        | (PanelState & { error?: string })
        | null;
      if (response.ok && data) {
        applyPanel(data);
      }
      setStep("escola");
    } catch {
      setStep("escola");
    } finally {
      setBusy(false);
    }
  }

  function goCadastrarEscola() {
    setStep("escola");
    setSelectedTemaId(null);
    setEditingEscola(true);
    setEditingEscolaId(null);
    setEscolaNome("");
    setError("");
    setMessage("Preencha os dados para cadastrar uma nova escola.");
  }

  function goCadastrarAluno() {
    if (escolas.length === 0) {
      setStep("escola");
      setEditingEscola(true);
      setEditingEscolaId(null);
      setError("Cadastre a escola antes de cadastrar alunos.");
      return;
    }
    if (step === "escola") {
      setError("Clique na escola para abrir os projetos e cadastrar o aluno.");
      return;
    }
    if (!panel.escola) {
      setStep("escola");
      setError("Abra uma escola para cadastrar alunos no projeto.");
      return;
    }
    if (panel.temas.length === 0) {
      setSelectedTemaId(null);
      setEditingTemaId(null);
      setTemaTitulo("");
      setTemaArea("");
      setTemaDescricao("");
      setAddingTema(true);
      setStep("temas");
      setError("Crie um projeto antes de cadastrar alunos.");
      return;
    }
    if (panel.temas.length === 1) {
      openCadastro(panel.temas[0].id);
      setMessage("Cadastre o aluno neste projeto.");
      return;
    }
    setSelectedTemaId(null);
    setAddingTema(false);
    setStep("temas");
    setError("");
    setMessage("Escolha um projeto e clique em Cadastrar alunos.");
  }

  if (loading) {
    return <p className="text-blue-gray">Carregando painel do professor…</p>;
  }

  const title =
    step === "escola"
      ? "Suas escolas"
      : step === "temas"
        ? "Projetos"
        : step === "inscritos"
          ? `Alunos — ${selectedTema?.titulo ?? ""}`
          : `Cadastrar alunos — ${selectedTema?.titulo ?? ""}`;

  return (
    <div className="space-y-6">
      <header className="max-w-3xl">
        <p className="font-display text-sm tracking-[.2em] text-cyan-electric uppercase">
          Escola e alunos
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ice-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 leading-7 text-blue-gray">
          {step === "escola"
            ? "Cadastre mais de uma escola e clique nela para ver os projetos."
            : step === "temas"
              ? panel.escola?.locked
                ? "Esta escola já tem projeto aprovado com stand. Só é possível cadastrar alunos."
                : "Edite ou exclua projetos pendentes, ou abra um projeto para cadastrar alunos."
              : step === "inscritos"
                ? "Alunos já inscritos neste projeto."
                : "Preencha os dados para inscrever um aluno neste projeto."}
        </p>
      </header>

      {panel.escola && step !== "escola" ? (
        <nav
          aria-label="Navegação"
          className="flex flex-wrap items-center gap-1 text-sm text-blue-gray"
        >
          <button
            type="button"
            className="hover:text-cyan-electric"
            onClick={() => {
              void goBackToEscolas();
            }}
          >
            {panel.escola.nome}
          </button>
          <ChevronRight className="size-4 opacity-50" aria-hidden />
          {step === "temas" ? (
            <span className="text-ice-white">Projetos</span>
          ) : (
            <>
              <button
                type="button"
                className="hover:text-cyan-electric"
                onClick={() => {
                  setStep("temas");
                  setSelectedTemaId(null);
                }}
              >
                Projetos
              </button>
              <ChevronRight className="size-4 opacity-50" aria-hidden />
              <span className="text-ice-white">
                {selectedTema?.titulo ?? "Projeto"}
              </span>
            </>
          )}
        </nav>
      ) : null}

      {(error || message) && (
        <p
          role="status"
          className={
            error
              ? "rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              : "rounded-xl border border-cyan-electric/30 bg-cyan-electric/10 px-4 py-3 text-sm text-cyan-100"
          }
        >
          {error || message}
        </p>
      )}

      {/* Escola */}
      {step === "escola" ? (
        <section className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="glow" onClick={goCadastrarEscola}>
              <School className="size-4" aria-hidden />
              Cadastrar escola
            </Button>
            <Button type="button" variant="outline" onClick={goCadastrarAluno}>
              <Users className="size-4" aria-hidden />
              Cadastrar aluno ao projeto
            </Button>
          </div>

          {editingEscola ? (
            <form onSubmit={onSaveEscola} className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs tracking-[0.18em] text-blue-gray uppercase">
                  {editingEscolaId ? "Editar escola" : "Nova escola"}
                </p>
                {escolas.length > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingEscola(false);
                      setEditingEscolaId(null);
                      setEscolaNome("");
                    }}
                  >
                    <X className="size-4" aria-hidden />
                    Cancelar
                  </Button>
                ) : null}
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label htmlFor="escola-nome">Nome da escola</Label>
                  <Input
                    id="escola-nome"
                    value={escolaNome}
                    onChange={(event) => setEscolaNome(event.target.value)}
                    placeholder="Ex.: Escola Zulmira de Paula"
                    required
                  />
                </div>
                <div className="w-full space-y-1 sm:w-40">
                  <Label>Cidade</Label>
                  <p className="flex h-11 items-center rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-ice-white">
                    Paulista
                  </p>
                </div>
                <Button type="submit" disabled={busy} className="shrink-0">
                  <Check className="size-4" aria-hidden />
                  {editingEscolaId ? "Salvar" : "Continuar"}
                </Button>
              </div>
            </form>
          ) : null}

          {escolas.length === 0 && !editingEscola ? (
            <p className="text-sm text-blue-gray">
              Nenhuma escola cadastrada ainda.
            </p>
          ) : (
            <ul className="space-y-2">
              {escolas.map((escola) => {
                const locked = Boolean(escola.locked);
                const projetos =
                  escola.projetosCount ??
                  (panel.escola?.id === escola.id ? panel.temas.length : 0);
                return (
                  <li
                    key={escola.id}
                    className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5"
                  >
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        void loadEscolaPanel(escola.id).then((ok) => {
                          if (ok) {
                            setStep("temas");
                            setSelectedTemaId(null);
                            setMessage("");
                          }
                        });
                      }}
                      className="group flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cyan-electric/10 text-cyan-electric">
                        <School className="size-6" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-xl font-semibold text-ice-white">
                          {escola.nome}
                        </span>
                        <span className="mt-1 block text-sm text-blue-gray">
                          Paulista · {projetos} projeto
                          {projetos === 1 ? "" : "s"}
                          {locked ? " · vinculado a stand" : ""}
                        </span>
                      </span>
                    </button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => void openAlunosDaEscola(escola.id)}
                    >
                      <Users className="size-4" aria-hidden />
                      Visualizar alunos cadastrados
                    </Button>
                    {!locked ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Editar ${escola.nome}`}
                          onClick={() => {
                            setEditingEscola(true);
                            setEditingEscolaId(escola.id);
                            setEscolaNome(escola.nome);
                          }}
                        >
                          <Pencil className="size-4" aria-hidden />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          disabled={busy}
                          aria-label={`Excluir ${escola.nome}`}
                          onClick={() => void onDeleteEscola(escola.id)}
                        >
                          <Trash2 className="size-4 text-red-300" aria-hidden />
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : null}

      {/* Temas */}
      {step === "temas" && panel.escola ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                void goBackToEscolas();
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar
            </Button>
            {!addingTema && !editingTemaId && !panel.escola.locked ? (
              <Button
                type="button"
                variant="glow"
                size="sm"
                onClick={() => {
                  setEditingTemaId(null);
                  setTemaTitulo("");
                  setTemaArea("");
                  setTemaDescricao("");
                  setAddingTema(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                Novo projeto
              </Button>
            ) : null}
          </div>

          {addingTema || editingTemaId ? (
            <form
              onSubmit={editingTemaId ? onUpdateTema : onCreateTema}
              className="flex flex-col gap-3 rounded-2xl border border-dashed border-cyan-electric/30 bg-cyan-electric/[0.03] p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tema-titulo">Título do projeto</Label>
                  <Input
                    id="tema-titulo"
                    value={temaTitulo}
                    onChange={(event) => setTemaTitulo(event.target.value)}
                    placeholder="Ex.: Robótica educacional"
                    required
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tema-area">Área/tema</Label>
                  <Input
                    id="tema-area"
                    value={temaArea}
                    onChange={(event) => setTemaArea(event.target.value)}
                    placeholder="Ex.: Ciências da Natureza"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tema-descricao">Descrição (opcional)</Label>
                <Input
                  id="tema-descricao"
                  value={temaDescricao}
                  onChange={(event) => setTemaDescricao(event.target.value)}
                  placeholder="Resumo do projeto"
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={busy} size="sm">
                  <Check className="size-4" aria-hidden />
                  {editingTemaId ? "Salvar" : "Adicionar"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingTema(false);
                    setEditingTemaId(null);
                    setTemaTitulo("");
                    setTemaArea("");
                    setTemaDescricao("");
                  }}
                >
                  <X className="size-4" aria-hidden />
                </Button>
              </div>
            </form>
          ) : null}

          {panel.temas.length === 0 ? (
            <p className="text-sm text-blue-gray">
              Nenhum projeto ainda. Crie o primeiro para cadastrar alunos.
            </p>
          ) : (
            <ul className="space-y-2">
              {panel.temas.map((tema) => (
                <li
                  key={tema.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <button
                      type="button"
                      onClick={() => openCadastro(tema.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block font-medium text-ice-white">
                        {tema.titulo}
                      </span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-blue-gray">
                        {tema.status === "APROVADO" ? (
                          <StatusBadge status="success">Aprovado</StatusBadge>
                        ) : tema.status === "REJEITADO" ? (
                          <StatusBadge status="error">Rejeitado</StatusBadge>
                        ) : (
                          <StatusBadge status="warning">Pendente</StatusBadge>
                        )}
                        <span>
                          {tema.alunosCount}/4 aluno
                          {tema.alunosCount === 1 ? "" : "s"}
                          {tema.area ? ` · ${tema.area}` : ""}
                          {tema.descricao ? ` · ${tema.descricao}` : ""}
                        </span>
                      </span>
                      {tema.estande ? (
                        <span className="mt-1 block text-sm text-cyan-electric/90">
                          Stand {tema.estande.codigo}
                          {tema.estande.nome ? ` — ${tema.estande.nome}` : ""}
                        </span>
                      ) : (
                        <span className="mt-1 block text-sm text-blue-gray">
                          Sem stand (aguardando aprovação do administrador)
                        </span>
                      )}
                    </button>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      {!isProjetoLocked(tema) ? (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${tema.titulo}`}
                            onClick={() => startEditTema(tema)}
                          >
                            <Pencil className="size-4" aria-hidden />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={busy}
                            aria-label={`Excluir ${tema.titulo}`}
                            onClick={() => void onDeleteTema(tema.id)}
                          >
                            <Trash2 className="size-4 text-red-300" aria-hidden />
                          </Button>
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="glow"
                        size="sm"
                        disabled={tema.alunosCount >= 4}
                        onClick={() => openCadastro(tema.id)}
                      >
                        {tema.alunosCount >= 4
                          ? "Limite de alunos"
                          : "Cadastrar alunos"}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Cadastro de alunos no tema */}
      {step === "cadastro" && selectedTema ? (
        <section className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("temas");
                setSelectedTemaId(null);
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar aos projetos
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStep("inscritos")}
            >
              <Users className="size-4" aria-hidden />
              Ver alunos inscritos no projeto
              {alunos.length > 0 ? ` (${alunos.length})` : ""}
            </Button>
          </div>

          <div className="rounded-2xl border border-cyan-electric/25 bg-cyan-electric/[0.05] px-4 py-3 text-sm text-cyan-100">
            Você está cadastrando alunos no projeto{" "}
            <strong className="text-ice-white">{selectedTema.titulo}</strong>
            {" "}
            ({alunos.length}/4 participantes).
          </div>

          {alunos.length >= 4 ? (
            <p className="rounded-2xl border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning">
              Este projeto já atingiu o limite de 4 alunos. Remova um aluno para
              cadastrar outro.
            </p>
          ) : (
          <form
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={(event) => void onCreateAluno(event)}
          >
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="aluno-nome">Nome completo</Label>
              <Input
                id="aluno-nome"
                name="nomeCompleto"
                autoComplete="name"
                minLength={2}
                required
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="aluno-responsavel">
                Nome completo do responsável
              </Label>
              <Input
                id="aluno-responsavel"
                name="nomeResponsavel"
                autoComplete="name"
                minLength={2}
                required
              />
              <p className="text-xs text-blue-gray">
                A criança ficará vinculada a você como professor responsável
                pelo projeto.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="aluno-email">E-mail</Label>
              <Input
                id="aluno-email"
                name="email"
                type="email"
                autoComplete="email"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aluno-telefone">Telefone</Label>
              <InputMask
                id="aluno-telefone"
                name="telefone"
                mask="phone"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aluno-cpf">CPF</Label>
              <InputMask id="aluno-cpf" name="cpf" mask="cpf" required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="aluno-nascimento">Data de nascimento</Label>
              <Input
                id="aluno-nascimento"
                name="dataNascimento"
                type="date"
                required
                value={birth}
                onChange={(event) => setBirth(event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="aluno-foto">Foto da criança</Label>
              <Input
                id="aluno-foto"
                name="foto"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                required
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) {
                    setPreview(null);
                    return;
                  }
                  setPreview(URL.createObjectURL(file));
                }}
              />
              {preview ? (
                <Image
                  src={preview}
                  alt="Pré-visualização da foto"
                  width={120}
                  height={120}
                  className="mt-3 size-28 rounded-xl object-cover"
                  unoptimized
                />
              ) : null}
            </div>

            {age !== null && age < 18 ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="aluno-autorizacao">
                    Autorização dos pais/responsáveis
                  </Label>
                  <Input
                    id="aluno-autorizacao"
                    name="autorizacao"
                    type="file"
                    accept=".pdf,.doc,.docx,image/jpeg,image/png,image/webp,application/pdf"
                    required
                  />
                  <p className="text-xs text-blue-gray">
                    Obrigatório para menores · PDF, DOC, DOCX ou imagem até 10
                    MB
                  </p>
                </div>

                <label className="flex items-start gap-3 sm:col-span-2 text-sm leading-6 text-blue-gray">
                  <input
                    id="aluno-guardian"
                    name="guardianConsent"
                    type="checkbox"
                    className={checkboxClassName}
                    checked={guardianConsent}
                    onChange={(event) =>
                      setGuardianConsent(event.target.checked)
                    }
                    required
                  />
                  Declaro que o responsável legal autoriza a participação do
                  menor e que o documento anexado é válido.
                </label>
              </>
            ) : null}

            <label className="flex items-start gap-3 sm:col-span-2 text-sm leading-6 text-blue-gray">
              <input
                id="aluno-imagem"
                type="checkbox"
                className={checkboxClassName}
                checked={aceitouDireitoImagem}
                onChange={(event) =>
                  setAceitouDireitoImagem(event.target.checked)
                }
                required
              />
              Autorizo o uso da imagem do aluno para divulgação do evento SNCT
              Paulista 2026.
            </label>

            <label className="flex items-start gap-3 sm:col-span-2 text-sm leading-6 text-blue-gray">
              <input
                id="aluno-privacy"
                type="checkbox"
                className={checkboxClassName}
                checked={privacyConsent}
                onChange={(event) => setPrivacyConsent(event.target.checked)}
                required
              />
              <span>
                Li e aceito o{" "}
                <Link
                  href="/privacidade"
                  className="text-cyan-electric underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  aviso de privacidade
                </Link>
                .
              </span>
            </label>

            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} variant="glow">
                {busy ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Plus className="size-4" aria-hidden />
                )}
                Cadastrar aluno neste projeto
              </Button>
            </div>
          </form>
          )}
        </section>
      ) : null}

      {/* Lista de inscritos */}
      {step === "inscritos" && selectedTema ? (
        <section className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep("cadastro")}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar ao cadastro
            </Button>
            <Button
              type="button"
              variant="glow"
              size="sm"
              onClick={() => setStep("cadastro")}
            >
              <Plus className="size-4" aria-hidden />
              Cadastrar outro aluno
            </Button>
          </div>

          <p className="text-xs tracking-[0.18em] text-blue-gray uppercase">
            {alunos.length} aluno{alunos.length === 1 ? "" : "s"} inscrito
            {alunos.length === 1 ? "" : "s"} em {selectedTema.titulo}
          </p>

          {alunos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 px-4 py-6 text-sm text-blue-gray">
              Nenhum aluno inscrito neste projeto ainda.
            </p>
          ) : (
            <ul className="divide-y divide-white/10 border-y border-white/10">
              {alunos.map((aluno) => (
                <li
                  key={aluno.id}
                  className="flex items-start gap-3 py-4 first:pt-3 last:pb-3"
                >
                  <AlunoQrThumb
                    hash={aluno.qrCodeHash}
                    name={aluno.nomeCompleto}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ice-white">
                      {aluno.nomeCompleto}
                    </p>
                    <p className="mt-0.5 text-xs text-blue-gray">
                      CPF {formatCpf(aluno.cpf)} · {aluno.age} anos
                    </p>
                    <p className="truncate text-xs text-blue-gray">
                      Responsável: {aluno.nomeResponsavel}
                    </p>
                    <p className="truncate text-xs text-blue-gray">
                      {aluno.email}
                    </p>
                    {aluno.documentos.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {aluno.documentos.map((doc) => (
                          <a
                            key={doc.id}
                            href={`/api/professor?documentId=${encodeURIComponent(doc.id)}`}
                            className="inline-flex items-center gap-1 text-xs text-cyan-electric hover:underline"
                          >
                            <FileText className="size-3.5" aria-hidden />
                            {doc.name}
                            <Download className="size-3.5" aria-hidden />
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    aria-label={`Remover ${aluno.nomeCompleto}`}
                    onClick={() =>
                      void mutateJson(
                        "DELETE",
                        {
                          action: "deleteAluno",
                          alunoId: aluno.id,
                        },
                        "Aluno removido.",
                      )
                    }
                  >
                    <Trash2 className="size-4 text-red-300" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

export { ProfessorPanel };
