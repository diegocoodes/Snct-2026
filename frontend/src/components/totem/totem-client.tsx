"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Keyboard,
  LoaderCircle,
  LogOut,
  Printer,
  RotateCcw,
  ScanLine,
  VideoOff,
} from "lucide-react";
import QrScanner from "qr-scanner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractQrHash } from "@/lib/qr-payload";
import { secureFetch } from "@/lib/secure-fetch";

type TotemState = "reading" | "loading" | "ready" | "error";
type TotemPerson = {
  nomeCompleto: string;
  roleNome?: string;
  jaRegistrado?: boolean;
};

/** Ajusta o tamanho da fonte para o nome caber em uma linha na etiqueta 57×30 mm. */
function fitPrintName(element: HTMLElement | null) {
  if (!element) return;
  const maxWidth = element.clientWidth || element.parentElement?.clientWidth || 0;
  if (!maxWidth) return;

  let size = 15;
  element.style.fontSize = `${size}pt`;
  element.style.whiteSpace = "nowrap";

  while (element.scrollWidth > maxWidth && size > 6) {
    size -= 0.25;
    element.style.fontSize = `${size}pt`;
  }
}

function TotemClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const processingRef = useRef(false);
  const printTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const printNameRef = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<TotemState>("reading");
  const [manualToken, setManualToken] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [message, setMessage] = useState("");
  const [person, setPerson] = useState<TotemPerson | null>(null);

  async function processToken(rawToken: string) {
    const token = extractQrHash(rawToken);
    if (!token || processingRef.current) return;

    processingRef.current = true;
    setState("loading");
    setMessage("");

    try {
      const response = await secureFetch(
        `/totem/consulta?qr=${encodeURIComponent(token)}`,
      );
      const result = (await response.json()) as {
        error?: string;
        usuario?: TotemPerson;
      };

      if (!response.ok || !result.usuario) {
        setState("error");
        setMessage(
          result.error ??
            "Não foi possível identificar a pessoa deste QR Code.",
        );
        return;
      }

      scannerRef.current?.stop();
      setPerson(result.usuario);
      setState("ready");
      printTimerRef.current = setTimeout(() => {
        fitPrintName(printNameRef.current);
        window.print();
      }, 450);
    } catch {
      setState("error");
      setMessage("Falha de conexão. Verifique a rede e tente novamente.");
    } finally {
      processingRef.current = false;
    }
  }

  useEffect(() => {
    if (!videoRef.current) return;

    const scanner = new QrScanner(
      videoRef.current,
      (result) => void processToken(result.data),
      {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        returnDetailedScanResult: true,
        maxScansPerSecond: 4,
      },
    );

    scannerRef.current = scanner;
    scanner.start().catch(() => {
      setCameraError(
        "Câmera indisponível. Conecte um leitor ou informe o código abaixo.",
      );
    });

    return () => {
      if (printTimerRef.current) clearTimeout(printTimerRef.current);
      scanner.destroy();
    };
  }, []);

  useEffect(() => {
    if (state !== "ready" || !person) return;
    const frame = requestAnimationFrame(() => fitPrintName(printNameRef.current));
    return () => cancelAnimationFrame(frame);
  }, [state, person]);

  function readNext() {
    if (printTimerRef.current) clearTimeout(printTimerRef.current);
    setPerson(null);
    setManualToken("");
    setMessage("");
    setState("reading");
    scannerRef.current?.start().catch(() => {
      setCameraError(
        "Câmera indisponível. Conecte um leitor ou informe o código abaixo.",
      );
    });
  }

  function reprint() {
    fitPrintName(printNameRef.current);
    window.print();
  }

  return (
    <main className="totem-screen relative min-h-screen overflow-hidden bg-[#070511] px-5 py-6 text-ice-white sm:px-8 lg:px-12">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(circle_at_12%_8%,rgb(0_229_255/12%),transparent_26rem),radial-gradient(circle_at_92%_90%,rgb(106_0_255/22%),transparent_32rem)]"
      />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl border border-cyan-electric/30 bg-cyan-electric/10 text-cyan-electric">
              <ScanLine className="size-6" aria-hidden />
            </span>
            <div>
              <p className="font-display text-lg font-semibold">Totem SNCT</p>
              <p className="text-xs tracking-[.18em] text-blue-gray uppercase">
                Identificação e impressão
              </p>
            </div>
          </div>
          <Button variant="ghost" render={<Link href="/perfil" />}>
            <LogOut aria-hidden /> Sair do totem
          </Button>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-12">
          <div>
            <p className="font-display text-sm tracking-[.24em] text-cyan-electric uppercase">
              Atendimento automático
            </p>
            <h1 className="mt-3 max-w-2xl font-display text-4xl leading-tight font-semibold sm:text-5xl">
              Aponte o QR Code para a câmera
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-blue-gray sm:text-lg">
              Após a identificação, a etiqueta de 57 × 30 mm com o nome será
              preparada para impressão.
            </p>

            <div className="relative mt-8 max-w-3xl overflow-hidden rounded-[2rem] border border-cyan-electric/25 bg-black shadow-[0_24px_80px_rgb(0_0_0/45%)]">
              <video
                ref={videoRef}
                className="aspect-video size-full object-cover"
                muted
                playsInline
                aria-label="Câmera do leitor de QR Code"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-[14%] rounded-3xl border-2 border-cyan-electric/70 shadow-[0_0_30px_rgb(0_229_255/18%)]"
              />
              {cameraError ? (
                <div className="absolute inset-0 grid place-items-center bg-[#090713]/95 p-8 text-center">
                  <div>
                    <VideoOff
                      className="mx-auto size-10 text-magenta-neon"
                      aria-hidden
                    />
                    <p className="mt-4 max-w-sm leading-6 text-blue-gray">
                      {cameraError}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>

            <form
              className="mt-5 flex max-w-3xl flex-col gap-3 sm:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                void processToken(manualToken);
              }}
            >
              <div className="relative flex-1">
                <Keyboard
                  className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-blue-gray"
                  aria-hidden
                />
                <Input
                  value={manualToken}
                  onChange={(event) => setManualToken(event.target.value)}
                  className="h-12 pl-12"
                  placeholder="Leitor USB ou código manual"
                  aria-label="Conteúdo do QR Code"
                />
              </div>
              <Button
                type="submit"
                className="h-12"
                disabled={state === "loading" || !manualToken.trim()}
              >
                {state === "loading" ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <ScanLine aria-hidden />
                )}
                Identificar
              </Button>
            </form>
          </div>

          <aside
            className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 shadow-[0_24px_70px_rgb(0_0_0/24%)] backdrop-blur sm:p-8"
            aria-live="polite"
          >
            {state === "ready" && person ? (
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-400/15 text-emerald-300">
                  <CheckCircle2 className="size-9" aria-hidden />
                </span>
                <p className="mt-5 text-sm tracking-[.2em] text-emerald-300 uppercase">
                  Check-in concluído
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold break-words">
                  {person.nomeCompleto}
                </h2>
                {person.roleNome ? (
                  <p className="mt-2 text-sm text-blue-gray">{person.roleNome}</p>
                ) : null}
                {person.jaRegistrado ? (
                  <p className="mt-3 text-sm text-cyan-electric/90">
                    Check-in de hoje já estava registrado. Imprimindo etiqueta.
                  </p>
                ) : null}
                <div className="mx-auto mt-7 w-fit max-w-full rounded-2xl bg-white px-5 py-4 text-left text-black shadow-xl">
                  <p className="text-[10px] font-bold tracking-[.18em] uppercase">
                    SNCT Paulista 2026
                  </p>
                  <p className="mt-1 max-w-64 overflow-hidden font-sans text-xl leading-none font-extrabold uppercase whitespace-nowrap">
                    {person.nomeCompleto}
                  </p>
                </div>
                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <Button variant="glow" onClick={reprint}>
                    <Printer aria-hidden /> Imprimir novamente
                  </Button>
                  <Button variant="outline" onClick={readNext}>
                    <RotateCcw aria-hidden /> Ler próximo
                  </Button>
                </div>
              </div>
            ) : state === "error" ? (
              <div className="text-center">
                <span className="mx-auto grid size-16 place-items-center rounded-full bg-red-500/15 text-red-300">
                  <ScanLine className="size-8" aria-hidden />
                </span>
                <h2 className="mt-5 font-display text-2xl font-semibold">
                  QR Code não reconhecido
                </h2>
                <p className="mt-3 leading-7 text-blue-gray">{message}</p>
                <Button className="mt-7 w-full" variant="outline" onClick={readNext}>
                  <RotateCcw aria-hidden /> Tentar novamente
                </Button>
              </div>
            ) : (
              <div className="grid min-h-72 place-items-center text-center">
                <div>
                  {state === "loading" ? (
                    <LoaderCircle
                      className="mx-auto size-12 animate-spin text-cyan-electric"
                      aria-hidden
                    />
                  ) : (
                    <ScanLine
                      className="mx-auto size-12 text-cyan-electric/70"
                      aria-hidden
                    />
                  )}
                  <h2 className="mt-5 font-display text-2xl font-semibold">
                    {state === "loading"
                      ? "Identificando…"
                      : "Aguardando leitura"}
                  </h2>
                  <p className="mt-3 leading-7 text-blue-gray">
                    Mantenha o QR Code dentro da área indicada.
                  </p>
                </div>
              </div>
            )}
          </aside>
        </section>
      </div>

      {person ? (
        <div className="totem-print-label" aria-hidden="true">
          <p className="totem-print-event">SNCT PAULISTA 2026</p>
          <p ref={printNameRef} className="totem-print-name">
            {person.nomeCompleto}
          </p>
        </div>
      ) : null}
    </main>
  );
}

export { TotemClient };
