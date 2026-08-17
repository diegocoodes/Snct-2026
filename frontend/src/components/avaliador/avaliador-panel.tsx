"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ClipboardCheck,
  Dices,
  LoaderCircle,
  ScanLine,
  VideoOff,
} from "lucide-react";
import QrScanner from "qr-scanner";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { AvaliadorRankingLive } from "@/components/avaliador/avaliador-ranking-live";
import { extractQrHash } from "@/lib/qr-payload";
import { secureFetch } from "@/lib/secure-fetch";

type Criterio = {
  key: string;
  codigo: string;
  label: string;
  descricao: string;
  maximo: number;
};

type EscalaItem = {
  nivel: string;
  faixa: string;
  referencia: string;
};

type StandInfo = {
  id: string;
  codigo: string;
  nome: string | null;
  status: string;
  qrCodeHash: string;
};

type ProjetoInfo = {
  id: string;
  titulo: string;
  area: string | null;
  descricao: string | null;
  instituicao: string;
  professor: { id: string; nomeCompleto: string; email: string };
  alunos: {
    id: string;
    usuarioId?: string;
    nomeCompleto: string;
    idade?: number;
  }[];
};

type TitulacaoOpcao = {
  codigo: string;
  titulo: string;
  faixaEtaria: string;
  referenciaEscolar: string;
  enfase: string;
  idadeMin: number;
  idadeMax: number;
  disponivel: boolean;
  concedida: {
    alunoId: string;
    alunoNome: string;
    standCodigo: string;
  } | null;
};

type TitulacoesEstado = {
  dataEvento: string;
  totalPorDia: number;
  disponiveis: number;
  usadas: number;
  opcoes: TitulacaoOpcao[];
};

type AvaliacaoListaItem = {
  id: string;
  standId: string;
  standCodigo: string;
  standNome: string;
  projetoTitulo: string;
  projetoTema: string | null;
  total: number;
  status: string;
  statusLabel: string;
  createdAt: string;
};

type AvaliacaoMeta = {
  feitas: number;
  minimo: number;
  restante: number;
  metaAtingida: boolean;
};

type StandAtribuido = {
  id: string;
  codigo: string;
  nome: string | null;
  projetoTitulo: string | null;
  escolaNome: string | null;
  professorNome: string | null;
  qrCodeHash: string;
  reservaExpiraEm: string | null;
  reservaMinutos: number;
  totalAvaliacoes: number;
};

/** inicio → atribuido → confirmar-qr → ficha */
type Mode = "inicio" | "atribuido" | "confirmar-qr" | "ficha" | "titulacao";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function AvaliadorPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const confirmQrRef = useRef<(raw: string) => Promise<void>>(async () => {});
  const expectedHashRef = useRef<string>("");

  const [mode, setMode] = useState<Mode>("inicio");
  const [cameraError, setCameraError] = useState("");
  const [manualHash, setManualHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scannerReady, setScannerReady] = useState(0);
  const [listaLoading, setListaLoading] = useState(true);
  const [avaliacoesFeitas, setAvaliacoesFeitas] = useState<AvaliacaoListaItem[]>(
    [],
  );
  const [metaAvaliacoes, setMetaAvaliacoes] = useState<AvaliacaoMeta>({
    feitas: 0,
    minimo: 18,
    restante: 18,
    metaAtingida: false,
  });
  const [buscaAvaliados, setBuscaAvaliados] = useState("");
  const [standAtribuido, setStandAtribuido] = useState<StandAtribuido | null>(
    null,
  );

  const [stand, setStand] = useState<StandInfo | null>(null);
  const [projeto, setProjeto] = useState<ProjetoInfo | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [totalMaximo, setTotalMaximo] = useState(100);
  const [escalaDesempenho, setEscalaDesempenho] = useState<EscalaItem[]>([]);
  const [titulacoes, setTitulacoes] = useState<TitulacoesEstado | null>(null);
  const [titulacaoAlunoPorCategoria, setTitulacaoAlunoPorCategoria] = useState<
    Record<string, string>
  >({});
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");

  const total = useMemo(() => {
    return Object.values(notas).reduce((sum, value) => {
      if (value === "") return sum;
      const n = Number(value);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }, [notas]);

  const criteriosPreenchidos = useMemo(() => {
    return criterios.filter((criterio) => {
      const value = notas[criterio.key];
      return value !== "" && value != null;
    }).length;
  }, [criterios, notas]);

  const fichaPronta = criterios.length > 0 && criteriosPreenchidos === criterios.length;

  const avaliacoesFiltradas = useMemo(() => {
    const q = buscaAvaliados.trim().toLowerCase();
    if (!q) return avaliacoesFeitas;
    return avaliacoesFeitas.filter((item) => {
      const haystack = [
        item.standCodigo,
        item.standNome,
        item.projetoTitulo,
        item.projetoTema ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [avaliacoesFeitas, buscaAvaliados]);

  const destroyScanner = useCallback(() => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (!scanner) return;
    try {
      scanner.stop();
    } catch {
      // ignore
    }
    try {
      scanner.destroy();
    } catch {
      // ignore
    }
  }, []);

  const loadAvaliacoesFeitas = useCallback(async () => {
    setListaLoading(true);
    try {
      const response = await secureFetch("/api/avaliador/avaliacoes");
      const data = (await response.json()) as {
        error?: string;
        avaliacoes?: AvaliacaoListaItem[];
        meta?: AvaliacaoMeta;
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível carregar suas avaliações.");
        return;
      }
      const avaliacoes = data.avaliacoes ?? [];
      setAvaliacoesFeitas(avaliacoes);
      if (data.meta) {
        setMetaAvaliacoes(data.meta);
      } else {
        const minimo = 18;
        const feitas = avaliacoes.length;
        setMetaAvaliacoes({
          feitas,
          minimo,
          restante: Math.max(0, minimo - feitas),
          metaAtingida: feitas >= minimo,
        });
      }
    } catch {
      toast.error("Falha de rede ao carregar avaliações.");
    } finally {
      setListaLoading(false);
    }
  }, []);

  const resetParaInicio = useCallback(() => {
    processingRef.current = false;
    expectedHashRef.current = "";
    setStand(null);
    setProjeto(null);
    setCriterios([]);
    setNotas({});
    setObservacoes("");
    setStandAtribuido(null);
    setTitulacoes(null);
    setTitulacaoAlunoPorCategoria({});
    setManualHash("");
    setCameraError("");
    setBuscaAvaliados("");
    setMode("inicio");
    destroyScanner();
    router.replace(pathname);
  }, [destroyScanner, pathname, router]);

  async function abrirTitulacaoDoStand(standId: string) {
    setLoading(true);
    try {
      const response = await secureFetch(
        `/api/avaliador/stands/${encodeURIComponent(standId)}/titulacao`,
      );
      const data = (await response.json()) as {
        error?: string;
        stand?: StandInfo;
        projeto?: ProjetoInfo;
        titulacoes?: TitulacoesEstado;
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível abrir este stand.");
        return;
      }
      setStand(data.stand ?? null);
      setProjeto(data.projeto ?? null);
      setTitulacoes(data.titulacoes ?? null);
      setTitulacaoAlunoPorCategoria({});
      setMode("titulacao");
    } catch {
      toast.error("Falha de rede ao abrir o stand.");
    } finally {
      setLoading(false);
    }
  }

  async function salvarTitulacoesAvulsas() {
    if (!stand || !projeto) return;
    const pedidos = (titulacoes?.opcoes ?? [])
      .filter((opcao) => opcao.disponivel && !opcao.concedida)
      .map((opcao) => {
        const alunoId = titulacaoAlunoPorCategoria[opcao.codigo]?.trim();
        if (!alunoId) return null;
        return { categoria: opcao.codigo, alunoId };
      })
      .filter((item): item is { categoria: string; alunoId: string } =>
        Boolean(item),
      );

    if (pedidos.length === 0) {
      toast.error("Escolha pelo menos um aluno para premiar, ou volte.");
      return;
    }

    setBusy(true);
    try {
      let okCount = 0;
      for (const pedido of pedidos) {
        const response = await secureFetch("/api/avaliador/titulacoes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            categoria: pedido.categoria,
            alunoId: pedido.alunoId,
            standId: stand.id,
            projetoId: projeto.id,
          }),
        });
        const data = (await response.json()) as {
          error?: string;
          titulacao?: { titulo: string; alunoNome: string };
          opcoes?: TitulacaoOpcao[];
          dataEvento?: string;
          totalPorDia?: number;
          disponiveis?: number;
          usadas?: number;
        };
        if (!response.ok) {
          toast.error(data.error ?? "Não foi possível conceder o título.");
          continue;
        }
        okCount += 1;
        toast.success(
          data.titulacao
            ? `Título "${data.titulacao.titulo}" concedido a ${data.titulacao.alunoNome}.`
            : "Título concedido.",
        );
        if (data.opcoes) {
          setTitulacoes({
            dataEvento: data.dataEvento ?? titulacoes?.dataEvento ?? "",
            totalPorDia: data.totalPorDia ?? 3,
            disponiveis: data.disponiveis ?? 0,
            usadas: data.usadas ?? 0,
            opcoes: data.opcoes,
          });
        }
      }
      if (okCount > 0) {
        setTitulacaoAlunoPorCategoria({});
        await loadAvaliacoesFeitas();
        resetParaInicio();
      }
    } catch {
      toast.error("Falha de rede ao conceder títulos.");
    } finally {
      setBusy(false);
    }
  }

  const confirmarQrDoStand = useCallback(
    async (raw: string) => {
      const hash = extractQrHash(raw);
      if (!hash) {
        toast.error("QR Code inválido.");
        processingRef.current = false;
        return;
      }

      const esperado = expectedHashRef.current;
      if (!esperado || hash !== esperado) {
        toast.error(
          standAtribuido
            ? `QR incorreto. Escaneie o QR do stand ${standAtribuido.codigo}.`
            : "QR incorreto. Escaneie o QR do stand atribuído.",
        );
        processingRef.current = false;
        return;
      }

      setLoading(true);
      try {
        const response = await secureFetch(
          `/api/avaliador/stand/${encodeURIComponent(hash)}`,
        );
        const data = (await response.json()) as {
          error?: string;
          jaAvaliado?: boolean;
          reservado?: boolean;
          stand?: StandInfo;
          projeto?: ProjetoInfo;
          criterios?: Criterio[];
          totalMaximo?: number;
          escalaDesempenho?: EscalaItem[];
          titulacoes?: TitulacoesEstado;
        };

        if (response.status === 409 || data.jaAvaliado) {
          toast.error(
            data.error ?? "Você já realizou a avaliação deste stand.",
          );
          processingRef.current = false;
          void loadAvaliacoesFeitas();
          return;
        }

        if (!response.ok) {
          toast.error(data.error ?? "Não foi possível confirmar o stand.");
          processingRef.current = false;
          return;
        }

        setStand(data.stand ?? null);
        setProjeto(data.projeto ?? null);
        setCriterios(data.criterios ?? []);
        setTotalMaximo(data.totalMaximo ?? 100);
        setEscalaDesempenho(data.escalaDesempenho ?? []);
        setTitulacoes(data.titulacoes ?? null);
        setTitulacaoAlunoPorCategoria({});
        const next: Record<string, string> = {};
        for (const criterio of data.criterios ?? []) {
          next[criterio.key] = "";
        }
        setNotas(next);
        setObservacoes("");
        destroyScanner();
        setMode("ficha");
        toast.success(`Stand ${data.stand?.codigo ?? ""} confirmado.`);
        router.replace(`${pathname}?stand=${encodeURIComponent(hash)}`);
      } catch {
        toast.error("Falha de rede ao confirmar o stand.");
        processingRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [destroyScanner, loadAvaliacoesFeitas, pathname, router, standAtribuido],
  );

  confirmQrRef.current = confirmarQrDoStand;

  useEffect(() => {
    void loadAvaliacoesFeitas();
  }, [loadAvaliacoesFeitas]);

  useEffect(() => {
    if (mode !== "confirmar-qr") {
      destroyScanner();
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    processingRef.current = false;
    const scanner = new QrScanner(
      video,
      (result) => {
        if (processingRef.current) return;
        processingRef.current = true;
        void confirmQrRef.current(result.data);
      },
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 4,
      },
    );
    scannerRef.current = scanner;
    scanner
      .start()
      .then(() => {
        if (cancelled) return;
        setCameraError("");
      })
      .catch(() => {
        if (cancelled) return;
        setCameraError(
          "Não foi possível acessar a câmera. Cole o código do QR abaixo.",
        );
      });

    return () => {
      cancelled = true;
      destroyScanner();
    };
  }, [destroyScanner, mode, scannerReady]);

  async function comecarAvaliacao() {
    setLoading(true);
    try {
      const response = await secureFetch("/api/avaliador/comecar-avaliacao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const data = (await response.json()) as {
        error?: string;
        stand?: {
          id?: string;
          qrCodeHash: string;
          codigo?: string;
          nome?: string | null;
          projetoTitulo?: string | null;
          escolaNome?: string | null;
          professorNome?: string | null;
          reservaExpiraEm?: string;
          reservaMinutos?: number;
          totalAvaliacoes?: number;
          reutilizada?: boolean;
        };
      };
      if (!response.ok || !data.stand) {
        toast.error(data.error ?? "Não foi possível iniciar a avaliação.");
        return;
      }

      const atribuido: StandAtribuido = {
        id: data.stand.id ?? "",
        codigo: data.stand.codigo ?? "—",
        nome: data.stand.nome ?? null,
        projetoTitulo: data.stand.projetoTitulo ?? null,
        escolaNome: data.stand.escolaNome ?? null,
        professorNome: data.stand.professorNome ?? null,
        qrCodeHash: data.stand.qrCodeHash,
        reservaExpiraEm: data.stand.reservaExpiraEm ?? null,
        reservaMinutos: data.stand.reservaMinutos ?? 25,
        totalAvaliacoes: data.stand.totalAvaliacoes ?? 0,
      };
      expectedHashRef.current = atribuido.qrCodeHash;
      setStandAtribuido(atribuido);
      setStand(null);
      setProjeto(null);
      setMode("atribuido");
      toast.success(
        data.stand.reutilizada
          ? `Continue no stand ${atribuido.codigo}.`
          : `Vá até o stand ${atribuido.codigo}.`,
      );
    } catch {
      toast.error("Falha de rede ao iniciar a avaliação.");
    } finally {
      setLoading(false);
    }
  }

  function irParaConfirmacaoQr() {
    if (!standAtribuido) return;
    expectedHashRef.current = standAtribuido.qrCodeHash;
    processingRef.current = false;
    setManualHash("");
    setCameraError("");
    setMode("confirmar-qr");
    setScannerReady((value) => value + 1);
  }

  async function onSubmitAvaliacao(event: FormEvent) {
    event.preventDefault();
    if (!stand || !projeto) return;

    for (const criterio of criterios) {
      const raw = notas[criterio.key];
      if (raw === "" || raw == null) {
        toast.error(`Informe a nota de "${criterio.label}".`);
        return;
      }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > criterio.maximo) {
        toast.error(
          `"${criterio.label}" deve ser um inteiro de 0 a ${criterio.maximo}.`,
        );
        return;
      }
    }

    const payloadNotas: Record<string, number> = {};
    for (const criterio of criterios) {
      payloadNotas[criterio.key] = Number(notas[criterio.key]);
    }

    const titulacoesPedido = (titulacoes?.opcoes ?? [])
      .filter((opcao) => opcao.disponivel && !opcao.concedida)
      .map((opcao) => {
        const alunoId = titulacaoAlunoPorCategoria[opcao.codigo]?.trim();
        if (!alunoId) return null;
        return { categoria: opcao.codigo, alunoId };
      })
      .filter((item): item is { categoria: string; alunoId: string } =>
        Boolean(item),
      );

    setBusy(true);
    try {
      const response = await secureFetch("/api/avaliador/avaliacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standId: stand.id,
          projetoId: projeto.id,
          notas: payloadNotas,
          observacoes,
          titulacoes: titulacoesPedido,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        titulacoesConcedidas?: {
          titulo: string;
          alunoNome: string;
        }[];
        titulacaoErros?: string[];
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível salvar a avaliação.");
        return;
      }
      toast.success("Avaliação registrada com sucesso.");
      for (const item of data.titulacoesConcedidas ?? []) {
        toast.success(
          `Título "${item.titulo}" concedido a ${item.alunoNome}.`,
        );
      }
      for (const erro of data.titulacaoErros ?? []) {
        toast.error(erro);
      }
      await loadAvaliacoesFeitas();
      resetParaInicio();
    } catch {
      toast.error("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {mode === "inicio" ? (
        <header className="max-w-3xl">
          <p className="font-display text-sm tracking-[.2em] text-cyan-electric uppercase">
            Avaliador
          </p>
          <h1 className="mt-2 font-display text-3xl font-semibold text-ice-white">
            Avaliar trabalhos
          </h1>
          <p className="mt-3 text-blue-gray">
            Clique em Começar Avaliação para receber o stand, vá até ele e, ao
            preencher, confirme o QR Code do stand antes de abrir a ficha. Cada
            avaliador deve avaliar pelo menos {metaAvaliacoes.minimo} stands.
          </p>
        </header>
      ) : null}

      {mode === "inicio" ? (
        <Card className="border-cyan-electric/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dices className="size-5 text-cyan-electric" aria-hidden />
              Iniciar avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <p className="text-xs tracking-wide text-blue-gray uppercase">
                    Meta de avaliações
                  </p>
                  <p className="mt-1 font-display text-2xl font-semibold text-ice-white">
                    {metaAvaliacoes.feitas}
                    <span className="text-base font-normal text-blue-gray">
                      /{metaAvaliacoes.minimo}
                    </span>
                  </p>
                </div>
                {metaAvaliacoes.metaAtingida ? (
                  <StatusBadge status="success">Meta atingida</StatusBadge>
                ) : (
                  <StatusBadge status="warning">
                    Faltam {metaAvaliacoes.restante}
                  </StatusBadge>
                )}
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={metaAvaliacoes.minimo}
                aria-valuenow={Math.min(
                  metaAvaliacoes.feitas,
                  metaAvaliacoes.minimo,
                )}
                aria-label="Progresso da meta de avaliações"
              >
                <div
                  className={
                    metaAvaliacoes.metaAtingida
                      ? "h-full rounded-full bg-emerald-400 transition-all"
                      : "h-full rounded-full bg-cyan-electric transition-all"
                  }
                  style={{
                    width: `${Math.min(
                      100,
                      (metaAvaliacoes.feitas / metaAvaliacoes.minimo) * 100,
                    )}%`,
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-blue-gray">
                {metaAvaliacoes.metaAtingida
                  ? "Você já cumpriu a meta mínima. Pode continuar avaliando se quiser."
                  : `Avalie pelo menos ${metaAvaliacoes.minimo} stands para cumprir a meta.`}
              </p>
            </div>
            <Button
              type="button"
              variant="glow"
              className="w-full"
              disabled={loading}
              onClick={() => void comecarAvaliacao()}
            >
              {loading ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Dices className="size-4" aria-hidden />
              )}
              Começar Avaliação
            </Button>
            <p className="text-center text-xs text-blue-gray">
              O sistema atribui o próximo stand da fila equilibrada e reserva por
              25 minutos.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {mode === "inicio" ? <AvaliadorRankingLive /> : null}

      {mode === "atribuido" && standAtribuido ? (
        <Card className="border-purple-vibrant/20">
          <CardHeader>
            <CardTitle>Stand atribuído</CardTitle>
            <p className="mt-1 text-sm text-blue-gray">
              Dirija-se a este stand. Ao chegar, clique em Preencher e escaneie
              o QR Code para liberar a ficha.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 p-6 text-center">
              <p className="text-xs tracking-[.2em] text-cyan-electric uppercase">
                Vá até o stand
              </p>
              <p className="mt-2 font-display text-5xl font-semibold text-ice-white">
                {standAtribuido.codigo}
              </p>
              {standAtribuido.projetoTitulo ? (
                <p className="mt-3 text-base font-medium text-ice-white">
                  {standAtribuido.projetoTitulo}
                </p>
              ) : null}
              {standAtribuido.escolaNome ? (
                <p className="mt-2 text-sm text-blue-gray">
                  Escola:{" "}
                  <span className="text-ice-white">{standAtribuido.escolaNome}</span>
                </p>
              ) : null}
              {standAtribuido.professorNome ? (
                <p className="mt-1 text-sm text-blue-gray">
                  Professor responsável:{" "}
                  <span className="text-ice-white">
                    {standAtribuido.professorNome}
                  </span>
                </p>
              ) : null}
              <p className="mt-4 text-sm text-blue-gray">
                Reserva por {standAtribuido.reservaMinutos} minutos
                {standAtribuido.reservaExpiraEm
                  ? ` · até ${formatDateTime(standAtribuido.reservaExpiraEm)}`
                  : ""}
              </p>
            </div>
            <Button
              type="button"
              variant="glow"
              className="w-full"
              onClick={irParaConfirmacaoQr}
            >
              <ClipboardCheck className="size-4" aria-hidden />
              Preencher
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mode === "confirmar-qr" && standAtribuido ? (
        <Card className="border-cyan-electric/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-5 text-cyan-electric" aria-hidden />
              Confirmar stand {standAtribuido.codigo}
            </CardTitle>
            <p className="mt-1 text-sm text-blue-gray">
              Escaneie o QR Code do stand {standAtribuido.codigo} para abrir a
              ficha de avaliação.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-electric/20 bg-cyan-electric/5 px-4 py-3 text-center">
              <p className="text-xs tracking-wide text-blue-gray uppercase">
                Stand esperado
              </p>
              <p className="mt-1 font-display text-3xl text-ice-white">
                {standAtribuido.codigo}
              </p>
            </div>
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full object-cover"
                muted
                playsInline
              />
            </div>
            {cameraError ? (
              <p className="flex items-start gap-2 text-sm text-warning">
                <VideoOff className="mt-0.5 size-4 shrink-0" aria-hidden />
                {cameraError}
              </p>
            ) : null}
            {loading ? (
              <p className="flex items-center justify-center gap-2 text-sm text-blue-gray">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Confirmando stand…
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {mode === "ficha" && stand && projeto ? (
        <Card className="border-cyan-electric/20">
          <CardContent className="space-y-5 pt-6">
            <div className="rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 px-4 py-5 text-center">
              <p className="text-xs tracking-[0.2em] text-cyan-electric uppercase">
                Avaliando agora
              </p>
              <p className="mt-1 font-display text-5xl font-semibold text-ice-white">
                Stand {stand.codigo}
              </p>
              <p className="mt-3 text-base font-medium break-words text-ice-white">
                {projeto.titulo}
              </p>
              <p className="mt-1 text-sm text-blue-gray">{projeto.instituicao}</p>
            </div>

            <ol className="grid gap-2 sm:grid-cols-3">
              {[
                { n: "1", t: "Dê as notas", d: "Toque um número em cada critério" },
                { n: "2", t: "Título especial", d: "Só se alguém realmente se destacar" },
                { n: "3", t: "Salvar", d: "Confirme no botão verde no final" },
              ].map((step) => (
                <li
                  key={step.n}
                  className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-cyan-electric/20 font-display text-sm text-cyan-electric">
                    {step.n}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ice-white">
                      {step.t}
                    </span>
                    <span className="block text-xs text-blue-gray">{step.d}</span>
                  </span>
                </li>
              ))}
            </ol>

            <form className="space-y-6" onSubmit={onSubmitAvaliacao}>
              <section className="space-y-3">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h3 className="font-display text-sm tracking-wide text-cyan-electric uppercase">
                      Passo 1 — Notas
                    </h3>
                    <p className="mt-1 text-sm text-blue-gray">
                      Toque na nota de cada item. Quanto maior o número, melhor.
                    </p>
                  </div>
                  <p className="rounded-full border border-white/10 px-3 py-1 text-xs text-blue-gray">
                    <span className="text-ice-white">
                      {criteriosPreenchidos}/{criterios.length}
                    </span>{" "}
                    preenchidos
                  </p>
                </div>

                <ul className="space-y-3">
                  {criterios.map((criterio, index) => {
                    const opcoes = Array.from(
                      { length: criterio.maximo + 1 },
                      (_, i) => String(i),
                    );
                    const selected = notas[criterio.key] ?? "";
                    return (
                      <li
                        key={criterio.key}
                        className={
                          selected !== ""
                            ? "rounded-2xl border border-cyan-electric/40 bg-cyan-electric/[0.06] p-4"
                            : "rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                        }
                      >
                        <div className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/5 text-xs font-medium text-cyan-electric">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-ice-white">
                              {criterio.label}
                            </p>
                            <p className="mt-1 text-sm text-blue-gray">
                              {criterio.descricao}
                            </p>
                            <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-blue-gray">
                              <span>Pior</span>
                              <span>Melhor (máx. {criterio.maximo})</span>
                            </div>
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {opcoes.map((opcao) => {
                                const isSelected = selected === opcao;
                                return (
                                  <button
                                    key={opcao}
                                    type="button"
                                    aria-pressed={isSelected}
                                    className={
                                      isSelected
                                        ? "min-h-11 min-w-11 rounded-xl border border-cyan-electric bg-cyan-electric text-base font-semibold text-[#0b1020] shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                                        : "min-h-11 min-w-11 rounded-xl border border-white/15 bg-[#111329] text-base text-blue-gray transition hover:border-cyan-electric/50 hover:text-ice-white"
                                    }
                                    onClick={() =>
                                      setNotas((prev) => ({
                                        ...prev,
                                        [criterio.key]: opcao,
                                      }))
                                    }
                                  >
                                    {opcao}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>

              <section className="space-y-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] p-3 sm:p-4">
                <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-3">
                  <p className="text-sm font-medium text-ice-white">
                    Passo 2 — Título especial do dia
                  </p>
                  <div className="mt-2 space-y-2 text-sm leading-relaxed text-blue-gray">
                    <p>
                      Essa titulação é{" "}
                      <strong className="text-ice-white">muito especial</strong>.
                      Não precisa dar na primeira avaliação.
                    </p>
                    <p>
                      Você pode avaliar outros stands primeiro e, quando
                      encontrar quem{" "}
                      <strong className="text-ice-white">
                        realmente se destacou
                      </strong>
                      , premiar aqui — ou clicar no stand na lista{" "}
                      <strong className="text-ice-white">
                        Stands Já Avaliados
                      </strong>{" "}
                      para entregar o título depois.
                    </p>
                    <p>
                      Se ainda não tiver certeza, escolha{" "}
                      <strong className="text-ice-white">
                        “Não premiar agora”
                      </strong>{" "}
                      e salve só as notas.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  {(titulacoes?.opcoes ?? []).map((opcao) => {
                    const elegiveis = projeto.alunos.filter(
                      (aluno) =>
                        typeof aluno.idade === "number" &&
                        aluno.idade >= (opcao.idadeMin ?? 0) &&
                        aluno.idade <= (opcao.idadeMax ?? 120),
                    );
                    const escolhido =
                      titulacaoAlunoPorCategoria[opcao.codigo] ?? "";
                    const jaUsado = !opcao.disponivel || Boolean(opcao.concedida);

                    return (
                      <div
                        key={opcao.codigo}
                        className="rounded-2xl border border-white/10 bg-[#111329]/80 p-4"
                      >
                        <p className="font-display text-base text-ice-white">
                          {opcao.titulo}
                        </p>
                        <p className="mt-1 text-sm text-blue-gray">
                          Para quem tem {opcao.faixaEtaria}
                        </p>

                        {jaUsado ? (
                          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-blue-gray">
                            {opcao.concedida
                              ? `Você já usou este título hoje (${opcao.concedida.alunoNome}).`
                              : "Você já usou este título hoje."}
                          </p>
                        ) : elegiveis.length === 0 ? (
                          <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-blue-gray">
                            Neste stand não há aluno nessa idade.
                          </p>
                        ) : (
                          <div className="mt-3 space-y-2">
                            <p className="text-sm text-ice-white">
                              Quer premiar alguém deste stand?
                            </p>
                            <div className="grid gap-2">
                              <button
                                type="button"
                                className={
                                  escolhido === ""
                                    ? "min-h-12 rounded-xl border border-cyan-electric/50 bg-cyan-electric/15 px-3 py-2 text-left text-sm text-ice-white"
                                    : "min-h-12 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-blue-gray"
                                }
                                onClick={() =>
                                  setTitulacaoAlunoPorCategoria((prev) => {
                                    const next = { ...prev };
                                    delete next[opcao.codigo];
                                    return next;
                                  })
                                }
                              >
                                Não premiar agora
                              </button>
                              {elegiveis.map((aluno) => {
                                const ativo = escolhido === aluno.id;
                                return (
                                  <button
                                    key={aluno.id}
                                    type="button"
                                    className={
                                      ativo
                                        ? "min-h-12 rounded-xl border border-cyan-electric bg-cyan-electric/20 px-3 py-2 text-left text-sm font-medium text-ice-white"
                                        : "min-h-12 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-blue-gray hover:border-cyan-electric/40 hover:text-ice-white"
                                    }
                                    onClick={() =>
                                      setTitulacaoAlunoPorCategoria((prev) => ({
                                        ...prev,
                                        [opcao.codigo]: aluno.id,
                                      }))
                                    }
                                  >
                                    {aluno.nomeCompleto}
                                    {typeof aluno.idade === "number" ? (
                                      <span className="ml-2 text-xs opacity-80">
                                        {aluno.idade} anos
                                      </span>
                                    ) : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <p className="text-center text-xs text-blue-gray">
                  Lembrete: cada título só pode ser usado 1 vez por dia. Use com
                  cuidado para quem realmente brilhar.
                </p>
              </section>

              <section className="space-y-2">
                <h3 className="font-display text-sm tracking-wide text-cyan-electric uppercase">
                  Observações
                  <span className="ml-2 text-[11px] font-normal tracking-normal text-blue-gray normal-case">
                    (opcional)
                  </span>
                </h3>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  rows={3}
                  placeholder="Se quiser, escreva um comentário rápido…"
                />
              </section>

              <div className="sticky bottom-3 z-10 space-y-3 rounded-2xl border border-cyan-electric/30 bg-[#0d1224]/95 p-4 shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-wide text-blue-gray uppercase">
                      Total da ficha
                    </p>
                    <p className="font-display text-2xl text-ice-white">
                      {total}
                      <span className="text-base text-blue-gray">
                        {" "}
                        / {totalMaximo}
                      </span>
                    </p>
                  </div>
                  {!fichaPronta ? (
                    <p className="max-w-[11rem] text-right text-xs text-warning">
                      Faltam {criterios.length - criteriosPreenchidos} nota(s)
                    </p>
                  ) : (
                    <p className="text-xs text-cyan-electric">Pronto para salvar</p>
                  )}
                </div>
                <Button
                  type="submit"
                  variant="glow"
                  className="h-12 w-full text-base"
                  disabled={busy || !fichaPronta}
                >
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  Salvar avaliação
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {mode === "titulacao" && stand && projeto ? (
        <Card className="border-cyan-electric/20">
          <CardContent className="space-y-5 pt-6">
            <div className="rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 px-4 py-5 text-center">
              <p className="text-xs tracking-[0.2em] text-cyan-electric uppercase">
                Premiar título especial
              </p>
              <p className="mt-1 font-display text-4xl font-semibold text-ice-white">
                Stand {stand.codigo}
              </p>
              <p className="mt-3 text-base font-medium break-words text-ice-white">
                {projeto.titulo}
              </p>
              <p className="mt-1 text-sm text-blue-gray">{projeto.instituicao}</p>
            </div>

            <div className="rounded-xl border border-amber-400/25 bg-amber-400/10 px-3 py-3 text-sm text-blue-gray">
              Você já avaliou este stand. Agora pode entregar um título especial
              a quem realmente se destacou — ou voltar sem premiar.
            </div>

            <div className="space-y-3">
              {(titulacoes?.opcoes ?? []).map((opcao) => {
                const elegiveis = projeto.alunos.filter(
                  (aluno) =>
                    typeof aluno.idade === "number" &&
                    aluno.idade >= (opcao.idadeMin ?? 0) &&
                    aluno.idade <= (opcao.idadeMax ?? 120),
                );
                const escolhido =
                  titulacaoAlunoPorCategoria[opcao.codigo] ?? "";
                const jaUsado = !opcao.disponivel || Boolean(opcao.concedida);

                return (
                  <div
                    key={opcao.codigo}
                    className="rounded-2xl border border-white/10 bg-[#111329]/80 p-4"
                  >
                    <p className="font-display text-base text-ice-white">
                      {opcao.titulo}
                    </p>
                    <p className="mt-1 text-sm text-blue-gray">
                      Para quem tem {opcao.faixaEtaria}
                    </p>

                    {jaUsado ? (
                      <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-blue-gray">
                        {opcao.concedida
                          ? `Você já usou este título hoje (${opcao.concedida.alunoNome}).`
                          : "Você já usou este título hoje."}
                      </p>
                    ) : elegiveis.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-blue-gray">
                        Neste stand não há aluno nessa idade.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        <p className="text-sm text-ice-white">
                          Quer premiar alguém deste stand?
                        </p>
                        <div className="grid gap-2">
                          <button
                            type="button"
                            className={
                              escolhido === ""
                                ? "min-h-12 rounded-xl border border-cyan-electric/50 bg-cyan-electric/15 px-3 py-2 text-left text-sm text-ice-white"
                                : "min-h-12 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-blue-gray"
                            }
                            onClick={() =>
                              setTitulacaoAlunoPorCategoria((prev) => {
                                const next = { ...prev };
                                delete next[opcao.codigo];
                                return next;
                              })
                            }
                          >
                            Não premiar agora
                          </button>
                          {elegiveis.map((aluno) => {
                            const ativo = escolhido === aluno.id;
                            return (
                              <button
                                key={aluno.id}
                                type="button"
                                className={
                                  ativo
                                    ? "min-h-12 rounded-xl border border-cyan-electric bg-cyan-electric/20 px-3 py-2 text-left text-sm font-medium text-ice-white"
                                    : "min-h-12 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2 text-left text-sm text-blue-gray hover:border-cyan-electric/40 hover:text-ice-white"
                                }
                                onClick={() =>
                                  setTitulacaoAlunoPorCategoria((prev) => ({
                                    ...prev,
                                    [opcao.codigo]: aluno.id,
                                  }))
                                }
                              >
                                {aluno.nomeCompleto}
                                {typeof aluno.idade === "number" ? (
                                  <span className="ml-2 text-xs opacity-80">
                                    {aluno.idade} anos
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-3 z-10 space-y-2 rounded-2xl border border-cyan-electric/30 bg-[#0d1224]/95 p-4 shadow-2xl backdrop-blur">
              <Button
                type="button"
                variant="glow"
                className="h-12 w-full text-base"
                disabled={busy || loading}
                onClick={() => void salvarTitulacoesAvulsas()}
              >
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : null}
                Confirmar premiação
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                disabled={busy}
                onClick={resetParaInicio}
              >
                Voltar sem premiar
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {mode === "inicio" ? (
        <Card className="border-white/10">
          <CardHeader>
            <CardTitle>Stands Já Avaliados</CardTitle>
            <p className="text-sm text-blue-gray">
              Progresso: {metaAvaliacoes.feitas}/{metaAvaliacoes.minimo}. Toque
              em um stand para entregar um título especial depois.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <input
                type="search"
                value={buscaAvaliados}
                onChange={(event) => setBuscaAvaliados(event.target.value)}
                placeholder="Buscar por stand, projeto ou tema…"
                className="h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm text-ice-white outline-none placeholder:text-blue-gray focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
              />
              {buscaAvaliados.trim() ? (
                <p className="text-xs text-blue-gray">
                  {avaliacoesFiltradas.length} resultado(s)
                </p>
              ) : null}
            </div>
            {listaLoading ? (
              <p className="flex items-center gap-2 text-sm text-blue-gray">
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
                Carregando…
              </p>
            ) : avaliacoesFeitas.length === 0 ? (
              <p className="text-sm text-blue-gray">
                Você ainda não avaliou nenhum stand.
              </p>
            ) : avaliacoesFiltradas.length === 0 ? (
              <p className="text-sm text-blue-gray">
                Nenhum stand encontrado para “{buscaAvaliados.trim()}”.
              </p>
            ) : (
              <ul className="space-y-3">
                {avaliacoesFiltradas.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-left transition hover:border-cyan-electric/40 hover:bg-cyan-electric/[0.04]"
                      onClick={() => void abrirTitulacaoDoStand(item.standId)}
                      disabled={loading}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-1">
                          <p className="font-medium text-ice-white">
                            {item.standNome}
                            <span className="ml-2 text-sm text-blue-gray">
                              ({item.standCodigo})
                            </span>
                          </p>
                          <p className="text-sm text-blue-gray">
                            Projeto:{" "}
                            <span className="text-ice-white">
                              {item.projetoTitulo}
                            </span>
                          </p>
                          <p className="text-sm text-blue-gray">
                            Tema:{" "}
                            <span className="text-ice-white">
                              {item.projetoTema || "—"}
                            </span>
                          </p>
                          <p className="text-sm text-blue-gray">
                            Avaliado em {formatDateTime(item.createdAt)}
                          </p>
                          <p className="pt-1 text-xs text-cyan-electric">
                            Toque para premiar um título especial
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          <StatusBadge status="success">
                            {item.statusLabel}
                          </StatusBadge>
                          <p className="text-sm text-ice-white">
                            Total: <strong>{item.total}</strong>
                          </p>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export { AvaliadorPanel };
