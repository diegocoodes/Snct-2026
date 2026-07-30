"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowLeft,
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
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
  alunos: { id: string; nomeCompleto: string }[];
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
type Mode = "inicio" | "atribuido" | "confirmar-qr" | "ficha";

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
  const [standAtribuido, setStandAtribuido] = useState<StandAtribuido | null>(
    null,
  );

  const [stand, setStand] = useState<StandInfo | null>(null);
  const [projeto, setProjeto] = useState<ProjetoInfo | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [totalMaximo, setTotalMaximo] = useState(100);
  const [escalaDesempenho, setEscalaDesempenho] = useState<EscalaItem[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");

  const total = useMemo(() => {
    return Object.values(notas).reduce((sum, value) => {
      if (value === "") return sum;
      const n = Number(value);
      return Number.isFinite(n) ? sum + n : sum;
    }, 0);
  }, [notas]);

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
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível carregar suas avaliações.");
        return;
      }
      setAvaliacoesFeitas(data.avaliacoes ?? []);
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
    setManualHash("");
    setCameraError("");
    setMode("inicio");
    destroyScanner();
    router.replace(pathname);
  }, [destroyScanner, pathname, router]);

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
        }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível salvar a avaliação.");
        return;
      }
      toast.success("Avaliação registrada com sucesso.");
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
      <header className="max-w-3xl">
        <p className="font-display text-sm tracking-[.2em] text-cyan-electric uppercase">
          Avaliador
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-ice-white">
          Avaliar trabalhos
        </h1>
        <p className="mt-3 text-blue-gray">
          Clique em Começar Avaliação para receber o stand, vá até ele e, ao
          preencher, confirme o QR Code do stand antes de abrir a ficha.
        </p>
      </header>

      {mode === "inicio" ? (
        <Card className="border-cyan-electric/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dices className="size-5 text-cyan-electric" aria-hidden />
              Iniciar avaliação
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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

      {mode === "atribuido" && standAtribuido ? (
        <Card className="border-purple-vibrant/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Stand atribuído</CardTitle>
              <p className="mt-1 text-sm text-blue-gray">
                Dirija-se a este stand. Ao chegar, clique em Preencher e escaneie
                o QR Code para liberar a ficha.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetParaInicio}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Cancelar
            </Button>
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
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="size-5 text-cyan-electric" aria-hidden />
                Confirmar stand {standAtribuido.codigo}
              </CardTitle>
              <p className="mt-1 text-sm text-blue-gray">
                Escaneie o QR Code do stand {standAtribuido.codigo} para abrir a
                ficha de avaliação.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                destroyScanner();
                setMode("atribuido");
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-cyan-electric/20 bg-cyan-electric/5 px-4 py-3 text-center">
              <p className="text-xs text-blue-gray uppercase tracking-wide">
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
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void confirmarQrDoStand(manualHash);
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="stand-hash">Ou cole o código do QR</Label>
                <Input
                  id="stand-hash"
                  value={manualHash}
                  onChange={(event) => setManualHash(event.target.value)}
                  placeholder="Cole o hash ou a URL do QR do stand"
                />
              </div>
              <Button type="submit" disabled={loading || !manualHash.trim()}>
                Confirmar
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {mode === "ficha" && stand && projeto ? (
        <Card className="border-cyan-electric/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Ficha de avaliação — Stand {stand.codigo}</CardTitle>
              <p className="mt-1 text-sm text-blue-gray">
                Critérios do edital — total de até {totalMaximo} pontos.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setMode("atribuido");
                setStand(null);
                setProjeto(null);
              }}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Voltar
            </Button>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={onSubmitAvaliacao}>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Título do trabalho</Label>
                  <Input value={projeto.titulo} readOnly />
                </div>
                <div className="space-y-2">
                  <Label>Instituição</Label>
                  <Input value={projeto.instituicao} readOnly />
                </div>
              </div>

              {escalaDesempenho.length ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <p className="text-xs tracking-wide text-cyan-electric uppercase">
                    Escala de desempenho (referência)
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-blue-gray">
                    {escalaDesempenho.map((item) => (
                      <li key={item.nivel}>
                        <span className="text-ice-white">{item.nivel}</span>
                        {" — "}
                        {item.faixa}: {item.referencia}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <ul className="space-y-3">
                {criterios.map((criterio) => {
                  const opcoes = Array.from(
                    { length: criterio.maximo + 1 },
                    (_, i) => String(i),
                  );
                  return (
                    <li
                      key={criterio.key}
                      className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <p className="text-sm text-ice-white">
                        <span className="text-cyan-electric">
                          {criterio.codigo}.
                        </span>{" "}
                        {criterio.label}
                        <span className="ml-2 text-xs text-blue-gray">
                          (máx. {criterio.maximo})
                        </span>
                      </p>
                      <p className="mt-1 text-sm text-blue-gray">
                        {criterio.descricao}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {opcoes.map((opcao) => {
                          const selected = notas[criterio.key] === opcao;
                          return (
                            <button
                              key={opcao}
                              type="button"
                              className={
                                selected
                                  ? "min-w-10 rounded-xl border border-cyan-electric bg-cyan-electric/20 px-3 py-1.5 text-sm text-ice-white"
                                  : "min-w-10 rounded-xl border border-white/15 bg-transparent px-3 py-1.5 text-sm text-blue-gray hover:border-cyan-electric/40"
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
                    </li>
                  );
                })}
              </ul>

              <div className="rounded-2xl border border-purple-vibrant/30 bg-purple-vibrant/10 px-4 py-3 text-ice-white">
                TOTAL:{" "}
                <strong className="font-display text-xl">{total}</strong>
                <span className="text-blue-gray"> / {totalMaximo}</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações do avaliador</Label>
                <Textarea
                  id="observacoes"
                  value={observacoes}
                  onChange={(event) => setObservacoes(event.target.value)}
                  rows={4}
                  placeholder="Comentários opcionais"
                />
              </div>

              <Button type="submit" variant="glow" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : null}
                Salvar avaliação
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-white/10">
        <CardHeader>
          <CardTitle>Stands Já Avaliados</CardTitle>
          <p className="text-sm text-blue-gray">
            Histórico dos stands que você já avaliou nesta feira.
          </p>
        </CardHeader>
        <CardContent>
          {listaLoading ? (
            <p className="flex items-center gap-2 text-sm text-blue-gray">
              <LoaderCircle className="size-4 animate-spin" aria-hidden />
              Carregando…
            </p>
          ) : avaliacoesFeitas.length === 0 ? (
            <p className="text-sm text-blue-gray">
              Você ainda não avaliou nenhum stand.
            </p>
          ) : (
            <ul className="space-y-3">
              {avaliacoesFeitas.map((item) => (
                <li
                  key={item.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
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
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { AvaliadorPanel };
