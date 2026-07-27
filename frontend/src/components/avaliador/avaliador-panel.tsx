"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ClipboardCheck,
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
  secao: string;
  label: string;
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

type AvaliacaoExistente = {
  id: string;
  notas: Record<string, number | null>;
  total: number;
  observacoes: string | null;
};

type Mode = "scanner" | "detalhe" | "ficha";

const NOTA_OPCOES = ["1", "2", "3", "4", "5", "N/A"] as const;

function AvaliadorPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const loadByHashRef = useRef<(hash: string) => Promise<void>>(async () => {});

  const [mode, setMode] = useState<Mode>("scanner");
  const [cameraError, setCameraError] = useState("");
  const [manualHash, setManualHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scannerReady, setScannerReady] = useState(0);

  const [stand, setStand] = useState<StandInfo | null>(null);
  const [projeto, setProjeto] = useState<ProjetoInfo | null>(null);
  const [criterios, setCriterios] = useState<Criterio[]>([]);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");
  const [avaliacaoExistente, setAvaliacaoExistente] =
    useState<AvaliacaoExistente | null>(null);

  const total = useMemo(() => {
    return Object.values(notas).reduce((sum, value) => {
      if (value === "N/A" || value === "") return sum;
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

  const goToScanner = useCallback(() => {
    processingRef.current = false;
    setStand(null);
    setProjeto(null);
    setCriterios([]);
    setNotas({});
    setObservacoes("");
    setAvaliacaoExistente(null);
    setCameraError("");
    setMode("scanner");
    setScannerReady((value) => value + 1);
    router.replace(pathname);
  }, [pathname, router]);

  const loadByHash = useCallback(
    async (raw: string) => {
      const hash = extractQrHash(raw);
      if (!hash) {
        toast.error("QR Code inválido.");
        return;
      }
      setLoading(true);
      try {
        const response = await secureFetch(
          `/api/avaliador/stand/${encodeURIComponent(hash)}`,
        );
        const data = (await response.json()) as {
          error?: string;
          stand?: StandInfo;
          projeto?: ProjetoInfo;
          criterios?: Criterio[];
          avaliacao?: AvaliacaoExistente | null;
        };
        if (!response.ok) {
          toast.error(data.error ?? "Não foi possível carregar o stand.");
          processingRef.current = false;
          return;
        }
        setStand(data.stand ?? null);
        setProjeto(data.projeto ?? null);
        setCriterios(data.criterios ?? []);
        const existing = data.avaliacao ?? null;
        setAvaliacaoExistente(existing);
        if (existing) {
          const next: Record<string, string> = {};
          for (const [key, value] of Object.entries(existing.notas)) {
            next[key] = value == null ? "N/A" : String(value);
          }
          setNotas(next);
          setObservacoes(existing.observacoes ?? "");
        } else {
          const next: Record<string, string> = {};
          for (const criterio of data.criterios ?? []) {
            next[criterio.key] = "";
          }
          setNotas(next);
          setObservacoes("");
        }
        setMode("detalhe");
        destroyScanner();
        router.replace(`${pathname}?stand=${encodeURIComponent(hash)}`);
      } catch {
        toast.error("Falha de rede ao buscar o stand.");
        processingRef.current = false;
      } finally {
        setLoading(false);
      }
    },
    [destroyScanner, pathname, router],
  );

  loadByHashRef.current = loadByHash;

  useEffect(() => {
    const fromQuery = searchParams.get("stand");
    if (fromQuery) {
      void loadByHash(fromQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "scanner") {
      destroyScanner();
      return;
    }
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;
    const scanner = new QrScanner(
      video,
      (result) => {
        if (processingRef.current) return;
        processingRef.current = true;
        void loadByHashRef.current(result.data);
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
          "Não foi possível acessar a câmera. Cole o código do stand abaixo.",
        );
      });

    return () => {
      cancelled = true;
      destroyScanner();
    };
  }, [destroyScanner, mode, scannerReady]);

  async function onSubmitAvaliacao(event: FormEvent) {
    event.preventDefault();
    if (!stand || !projeto) return;

    for (const criterio of criterios) {
      if (!notas[criterio.key]) {
        toast.error(`Informe a nota do critério ${criterio.codigo}.`);
        return;
      }
    }

    const payloadNotas: Record<string, number | null> = {};
    for (const criterio of criterios) {
      const value = notas[criterio.key];
      payloadNotas[criterio.key] = value === "N/A" ? null : Number(value);
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
      toast.success("Avaliação salva com sucesso.");
      setMode("detalhe");
      setAvaliacaoExistente({
        id: "saved",
        notas: payloadNotas,
        total,
        observacoes,
      });
    } catch {
      toast.error("Falha de rede ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const secoes = useMemo(() => {
    const map = new Map<string, Criterio[]>();
    for (const criterio of criterios) {
      const list = map.get(criterio.secao) ?? [];
      list.push(criterio);
      map.set(criterio.secao, list);
    }
    return [...map.entries()];
  }, [criterios]);

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
          Escaneie o QR Code do stand para ver o projeto e preencher a ficha de
          avaliação.
        </p>
      </header>

      {mode === "scanner" ? (
        <Card className="border-cyan-electric/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanLine className="size-5 text-cyan-electric" aria-hidden />
              Escanear QR do stand
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <form
              className="flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={(event) => {
                event.preventDefault();
                void loadByHash(manualHash);
              }}
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Label htmlFor="stand-hash">Ou cole o código do stand</Label>
                <Input
                  id="stand-hash"
                  value={manualHash}
                  onChange={(event) => setManualHash(event.target.value)}
                  placeholder="Cole o hash ou a URL do QR"
                />
              </div>
              <Button type="submit" disabled={loading || !manualHash.trim()}>
                {loading ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : (
                  "Buscar"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {mode === "detalhe" && stand && projeto ? (
        <Card className="border-purple-vibrant/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Stand {stand.codigo}</CardTitle>
              <p className="mt-1 text-sm text-blue-gray">
                Projeto vinculado e pronto para avaliação.
              </p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={goToScanner}>
              <ArrowLeft className="size-4" aria-hidden />
              Novo scan
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs tracking-wide text-blue-gray uppercase">
                  Título do trabalho
                </p>
                <p className="mt-1 font-medium text-ice-white">{projeto.titulo}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <p className="text-xs tracking-wide text-blue-gray uppercase">
                  Instituição
                </p>
                <p className="mt-1 font-medium text-ice-white">
                  {projeto.instituicao}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-blue-gray">
              <p>
                Área/tema:{" "}
                <span className="text-ice-white">{projeto.area || "—"}</span>
              </p>
              <p className="mt-2">
                Professor:{" "}
                <span className="text-ice-white">
                  {projeto.professor.nomeCompleto}
                </span>
              </p>
              <p className="mt-2">
                Alunos ({projeto.alunos.length}/4):{" "}
                <span className="text-ice-white">
                  {projeto.alunos.length
                    ? projeto.alunos.map((a) => a.nomeCompleto).join(", ")
                    : "nenhum"}
                </span>
              </p>
              {avaliacaoExistente ? (
                <p className="mt-3">
                  <StatusBadge status="success">
                    Já avaliado · total {avaliacaoExistente.total}
                  </StatusBadge>
                </p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="glow"
              onClick={() => setMode("ficha")}
            >
              <ClipboardCheck className="size-4" aria-hidden />
              {avaliacaoExistente ? "Editar avaliação" : "Avaliar"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {mode === "ficha" && stand && projeto ? (
        <Card className="border-cyan-electric/20">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Ficha de avaliação</CardTitle>
              <p className="mt-1 text-sm text-blue-gray">
                Feira de Ciências — notas de 1 a 5 ou N/A.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMode("detalhe")}
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

              {secoes.map(([secao, items]) => (
                <section key={secao} className="space-y-3">
                  <h3 className="font-display text-sm tracking-wide text-cyan-electric uppercase">
                    {secao}
                  </h3>
                  <ul className="space-y-3">
                    {items.map((criterio) => (
                      <li
                        key={criterio.key}
                        className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
                      >
                        <p className="text-sm text-ice-white">
                          <span className="text-cyan-electric">
                            {criterio.codigo}
                          </span>{" "}
                          {criterio.label}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {NOTA_OPCOES.map((opcao) => {
                            const selected = notas[criterio.key] === opcao;
                            return (
                              <button
                                key={opcao}
                                type="button"
                                className={
                                  selected
                                    ? "rounded-xl border border-cyan-electric bg-cyan-electric/20 px-3 py-1.5 text-sm text-ice-white"
                                    : "rounded-xl border border-white/15 bg-transparent px-3 py-1.5 text-sm text-blue-gray hover:border-cyan-electric/40"
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
                    ))}
                  </ul>
                </section>
              ))}

              <div className="rounded-2xl border border-purple-vibrant/30 bg-purple-vibrant/10 px-4 py-3 text-ice-white">
                TOTAL: <strong className="font-display text-xl">{total}</strong>
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
    </div>
  );
}

export { AvaliadorPanel };
