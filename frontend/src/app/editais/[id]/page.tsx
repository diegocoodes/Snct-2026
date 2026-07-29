import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarRange,
  Download,
  ExternalLink,
  FileText,
} from "lucide-react";

import { EventFooter } from "@/components/event/event-footer";
import { EventHeader } from "@/components/event/event-header";
import { InternalPageHero } from "@/components/event/internal-page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  canRegisterForNotice,
  formatBrDate,
  getNoticePeriodLabel,
  resolveNoticeStatus,
  todayInEventTimezone,
} from "@/lib/notices";
import { readPublicSnctStore } from "@/lib/snct-store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type NoticeDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoticeDetailPage({
  params,
}: NoticeDetailPageProps) {
  const { id } = await params;
  const store = await readPublicSnctStore();
  const notice = store.notices.find((item) => item.id === id);
  if (!notice) notFound();

  const status = resolveNoticeStatus(notice);
  const periodLabel = getNoticePeriodLabel(notice);
  const canRegister = canRegisterForNotice(notice);
  const inscriptionLabel = (() => {
    const today = todayInEventTimezone();
    if (canRegister) return "Inscrever-se no Edital";
    if (status === "encerrado") return "Inscrições Encerradas";
    if (notice.registrationStartsAt && today < notice.registrationStartsAt) {
      return "Inscrições em breve";
    }
    if (!notice.formUrl?.trim()) return "Formulário não informado";
    return "Inscrições Encerradas";
  })();
  const primaryDocument =
    notice.documents.find((document) =>
      document.mimeType.toLowerCase().includes("pdf"),
    ) ?? notice.documents[0];

  return (
    <>
      <EventHeader />
      <main>
        <InternalPageHero
          eyebrow="Editais"
          title={notice.title}
          description="Consulte o período de inscrição, baixe o PDF e acesse o formulário externo quando disponível."
        />

        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-6">
            <div>
              <Button variant="ghost" render={<Link href="/editais" />}>
                <ArrowLeft aria-hidden /> Voltar aos editais
              </Button>
            </div>

            <Card className="border-cyan-electric/15 bg-white/[0.03]">
              <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <CardTitle className="text-2xl">{notice.title}</CardTitle>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "h-7 shrink-0 px-3",
                    periodLabel === "Aberto"
                      ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-300"
                      : periodLabel === "Em breve"
                        ? "border-cyan-electric/25 bg-cyan-electric/10 text-cyan-electric"
                        : "border-white/10 bg-white/10 text-blue-gray",
                  )}
                >
                  {periodLabel === "Aberto"
                    ? "Inscrições abertas"
                    : periodLabel === "Em breve"
                      ? "Inscrições em breve"
                      : "Inscrições encerradas"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:grid-cols-2">
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-cyan-electric/10 text-cyan-electric">
                      <CalendarRange className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs tracking-wide text-blue-gray uppercase">
                        Início das inscrições
                      </p>
                      <p className="mt-1 font-semibold text-ice-white">
                        {formatBrDate(notice.registrationStartsAt) || "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-magenta-neon/10 text-magenta-neon">
                      <CalendarRange className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-xs tracking-wide text-blue-gray uppercase">
                        Encerramento das inscrições
                      </p>
                      <p className="mt-1 font-semibold text-ice-white">
                        {formatBrDate(notice.registrationEndsAt) || "—"}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h2 className="font-display text-xl font-semibold text-ice-white">
                    Descrição
                  </h2>
                  <div className="mt-4 whitespace-pre-wrap text-base leading-8 text-blue-gray">
                    {notice.description ||
                      "Nenhuma descrição foi publicada para este edital."}
                  </div>
                </div>

                <div className="flex flex-col gap-3 border-t border-white/10 pt-6 sm:flex-row sm:flex-wrap">
                  {primaryDocument ? (
                    <Button
                      variant="glow"
                      render={
                        <a
                          href={`/api/documents/${primaryDocument.id}`}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <Download aria-hidden /> Baixar Edital
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      <FileText aria-hidden /> PDF indisponível
                    </Button>
                  )}

                  {canRegister ? (
                    <Button
                      variant="outline"
                      render={
                        <a
                          href={notice.formUrl}
                          target="_blank"
                          rel="noreferrer"
                        />
                      }
                    >
                      <ExternalLink aria-hidden /> Inscrever-se no Edital
                    </Button>
                  ) : (
                    <Button variant="outline" disabled>
                      {inscriptionLabel}
                    </Button>
                  )}
                </div>

                {notice.documents.length > 1 ? (
                  <div>
                    <h3 className="text-sm font-semibold tracking-wide text-ice-white uppercase">
                      Documentos anexos
                    </h3>
                    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                      {notice.documents.map((document) => (
                        <li key={document.id}>
                          <a
                            href={`/api/documents/${document.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex min-w-0 items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3 transition-colors hover:border-cyan-electric/30 hover:bg-cyan-electric/[0.05]"
                          >
                            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-electric/10 text-cyan-electric">
                              <FileText className="size-4" aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-ice-white">
                                {document.name}
                              </span>
                              <span className="text-xs text-blue-gray">
                                {(document.size / 1024 / 1024).toFixed(2)} MB
                              </span>
                            </span>
                            <Download
                              className="size-4 shrink-0 text-cyan-electric"
                              aria-hidden
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </section>
      </main>
      <EventFooter />
    </>
  );
}
