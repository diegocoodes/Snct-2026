import Link from "next/link";
import Image from "next/image";
import { ArrowRight, FileText } from "lucide-react";

import { EventFooter } from "@/components/event/event-footer";
import { EventHeader } from "@/components/event/event-header";
import { InternalPageHero } from "@/components/event/internal-page-hero";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/state-panel";
import { getNoticePeriodLabel } from "@/lib/notices";
import { readPublicSnctStore } from "@/lib/snct-store";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function NoticesPage() {
  const store = await readPublicSnctStore();

  return (
    <>
      <EventHeader />
      <main>
        <InternalPageHero
          eyebrow="Documentos oficiais"
          title="Editais e inscrições"
          description="Consulte os editais publicados, acompanhe o período de inscrição e acesse o PDF ou o formulário externo."
        />
        <section
          aria-labelledby="notices-list-title"
          className="px-5 py-20 sm:px-8 sm:py-24"
        >
          <div className="mx-auto max-w-5xl">
            <h2
              id="notices-list-title"
              className="font-display text-3xl font-semibold text-ice-white"
            >
              Editais publicados
            </h2>

            {store.notices.length ? (
              <div className="mt-10 grid gap-4">
                {store.notices.map((notice) => {
                  const periodLabel = getNoticePeriodLabel(notice);
                  const isArenaGamer = /arena\s*gamer/i.test(notice.title);
                  return (
                    <Card
                      key={notice.id}
                      className="border-cyan-electric/12 bg-white/[0.025]"
                    >
                      <CardContent>
                        {isArenaGamer ? (
                          <div className="mb-5 overflow-hidden rounded-2xl border border-cyan-electric/15 bg-[#080914] p-3">
                            <Image
                              src="/images/ARENAGAMER.png"
                              alt="Arte oficial completa da Arena Gamer"
                              width={1122}
                              height={1402}
                              sizes="(max-width: 1024px) 100vw, 64rem"
                              className="mx-auto h-auto max-h-[42rem] w-auto max-w-full object-contain"
                            />
                          </div>
                        ) : null}
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="font-display text-lg font-semibold leading-7 text-ice-white">
                              {notice.title}
                            </h3>
                            {notice.description ? (
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-blue-gray">
                                {notice.description}
                              </p>
                            ) : null}
                            <p className="mt-2 text-sm text-blue-gray">
                              Período de inscrição: {notice.registration}
                            </p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "h-6 shrink-0 px-2.5",
                              periodLabel === "Aberto"
                                ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-300"
                                : periodLabel === "Em breve"
                                  ? "border-cyan-electric/25 bg-cyan-electric/10 text-cyan-electric"
                                  : "border-white/10 bg-white/10 text-blue-gray",
                            )}
                          >
                            {periodLabel}
                          </Badge>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3 border-t border-white/10 pt-4">
                          {notice.documents.slice(0, 2).map((document, index) => (
                            <Button
                              key={document.id}
                              variant="glow"
                              render={
                                <a
                                  href={`/api/documents/${document.id}`}
                                  target="_blank"
                                  rel="noreferrer"
                                />
                              }
                            >
                              <FileText aria-hidden />
                              {notice.documents.length === 1
                                ? "Visualizar edital"
                                : `Visualizar edital ${index + 1}`}
                            </Button>
                          ))}
                          <Button
                            variant={
                              notice.documents.length ? "outline" : "glow"
                            }
                            render={<Link href={`/editais/${notice.id}`} />}
                          >
                            Detalhes
                            <ArrowRight aria-hidden />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                className="mt-10"
                title="Nenhum edital publicado"
                description="Os editais aparecerão aqui assim que forem publicados pela organização."
              />
            )}
          </div>
        </section>
      </main>
      <EventFooter />
    </>
  );
}
