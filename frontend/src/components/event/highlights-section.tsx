import { ArrowLeft, ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { featuredNotices, upcomingEvents } from "@/config/highlights";
import type { UpcomingEvent } from "@/config/highlights";
import { filterCalendarEvents, formatEventDateBr } from "@/lib/events";
import { getNoticePeriodLabel } from "@/lib/notices";
import type { ManagedEvent, ManagedNotice } from "@/lib/snct-types";
import { cn } from "@/lib/utils";

const defaultNotices: ManagedNotice[] = featuredNotices.map(
  (notice, index) => ({
    id: `notice-${index + 1}`,
    title: notice.title,
    description: notice.description,
    registration: notice.registration,
    registrationStartsAt: notice.registrationStartsAt,
    registrationEndsAt: notice.registrationEndsAt,
    formUrl: notice.formUrl ?? "",
    status: notice.status,
    documents: [],
  }),
);

const defaultEvents: ManagedEvent[] = upcomingEvents.map((event, index) => ({
  id: `event-${index + 1}`,
  ...event,
}));

function HighlightsSection({
  events = defaultEvents,
  notices = defaultNotices,
}: {
  events?:
    | readonly ManagedEvent[]
    | readonly (UpcomingEvent & { id?: string })[];
  notices?: readonly ManagedNotice[];
}) {
  const calendarEvents = filterCalendarEvents(
    events.map((event, index) => ({
      id: event.id ?? `event-${index + 1}`,
      date: event.date,
      time: event.time,
      title: event.title,
      location: event.location,
    })),
  );

  return (
    <section
      id="destaques"
      aria-labelledby="highlights-title"
      className="relative overflow-hidden border-y border-white/8 bg-[radial-gradient(circle_at_8%_16%,rgb(106_0_255/16%),transparent_30%),radial-gradient(circle_at_90%_24%,rgb(255_46_209/9%),transparent_27%),radial-gradient(circle_at_58%_100%,rgb(0_229_255/7%),transparent_32%),#11131a] px-5 py-16 sm:px-8 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 mx-auto h-px max-w-3xl bg-gradient-to-r from-transparent via-cyan-electric/55 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute -top-48 left-1/2 size-[30rem] -translate-x-1/2 rounded-full bg-purple-vibrant/8 blur-[130px]"
      />

      <h2 id="highlights-title" className="sr-only">
        Editais e calendário
      </h2>

      <div className="relative mx-auto max-w-7xl">
        <nav
          aria-label="Navegação entre editais e calendário"
          className="mb-8 flex justify-end gap-2"
        >
          <Button
            size="icon-sm"
            variant="outline"
            className="border-cyan-electric/45 bg-transparent text-cyan-electric hover:border-cyan-electric hover:bg-cyan-electric/10"
            render={
              <a
                href="#featured-notices-title"
                aria-label="Ir para editais em destaque"
              />
            }
          >
            <ArrowLeft aria-hidden />
          </Button>
          <Button
            size="icon-sm"
            variant="outline"
            className="border-cyan-electric/45 bg-transparent text-cyan-electric hover:border-cyan-electric hover:bg-cyan-electric/10"
            render={
              <a
                href="#upcoming-events-title"
                aria-label="Ir para o calendário"
              />
            }
          >
            <ArrowRight aria-hidden />
          </Button>
        </nav>

        <div className="grid gap-14 lg:grid-cols-[1.08fr_.92fr] lg:gap-0">
          <article className="min-w-0 lg:pr-10 xl:pr-14">
            <div className="flex items-end justify-between gap-4">
              <h3
                id="featured-notices-title"
                className="font-display text-2xl font-semibold tracking-tight text-ice-white sm:text-3xl"
              >
                Editais em destaque
              </h3>
              <a
                href="/editais"
                className="shrink-0 text-sm font-medium text-cyan-electric underline-offset-4 transition-colors hover:text-ice-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-electric"
              >
                ver todos
              </a>
            </div>

            <ul className="mt-5 divide-y divide-white/15">
              {notices.slice(0, 5).map((notice) => {
                const periodLabel = getNoticePeriodLabel(notice);
                return (
                  <li
                    key={notice.id}
                    className="flex items-start justify-between gap-4 py-4 first:pt-0"
                  >
                    <div className="min-w-0">
                      <a
                        href={`/editais/${notice.id}`}
                        className="text-sm leading-6 font-semibold text-ice-white/85 transition-colors hover:text-cyan-electric sm:text-base"
                      >
                        {notice.title}
                      </a>
                      <p className="mt-0.5 text-xs leading-5 text-blue-gray sm:text-sm">
                        Inscrições: {notice.registration}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "mt-0.5 h-6 shrink-0 px-2.5",
                        periodLabel === "Aberto"
                          ? "border-emerald-400/25 bg-emerald-400/15 text-emerald-300"
                          : periodLabel === "Em breve"
                            ? "border-cyan-electric/25 bg-cyan-electric/10 text-cyan-electric"
                            : "border-white/10 bg-white/10 text-blue-gray",
                      )}
                    >
                      {periodLabel}
                    </Badge>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="min-w-0 lg:border-l lg:border-cyan-electric/20 lg:pl-10 xl:pl-14">
            <div className="flex items-end justify-between gap-4">
              <h3
                id="upcoming-events-title"
                className="font-display text-2xl font-semibold tracking-tight text-ice-white sm:text-3xl"
              >
                Calendário
              </h3>
              <a
                href="/programacao"
                className="shrink-0 text-sm font-medium text-cyan-electric underline-offset-4 transition-colors hover:text-ice-white hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-electric"
              >
                ver programação
              </a>
            </div>

            {calendarEvents.length ? (
              <ol className="relative mt-7 space-y-6 border-l border-cyan-electric/25">
                {calendarEvents.map((event) => (
                  <li
                    key={event.id}
                    className="relative grid gap-1 pl-6 sm:grid-cols-[7.5rem_1fr] sm:gap-4"
                  >
                    <span
                      aria-hidden="true"
                      className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-cyan-electric shadow-[0_0_14px_rgb(0_229_255/60%)]"
                    />
                    <time
                      dateTime={`${event.date}T${event.time}`}
                      className="text-sm font-semibold text-[#9AB7C8]"
                    >
                      {formatEventDateBr(event.date)} {event.time}
                    </time>
                    <div>
                      <p className="text-sm leading-6 font-semibold text-ice-white/85 sm:text-base">
                        {event.title}
                      </p>
                      <p className="mt-0.5 text-xs tracking-wide text-blue-gray uppercase">
                        {event.location}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-7 text-sm leading-6 text-blue-gray">
                Nenhum evento agendado para hoje ou para os próximos dias.
              </p>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}

export { HighlightsSection };
