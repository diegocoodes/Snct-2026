import type { ManagedEvent } from "@/lib/snct-types";

function eventTimezone() {
  return process.env.APP_TIMEZONE || process.env.TZ || "America/Recife";
}

export function todayInEventTimezone(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: eventTimezone(),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Normaliza para YYYY-MM-DD. Aceita YYYY-MM-DD, DD/MM/YYYY ou DD/MM (ano padrão 2026). */
export function normalizeEventDate(
  value: string,
  fallbackYear = 2026,
): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() + 1 !== month ||
      date.getUTCDate() !== day
    ) {
      return null;
    }
    return trimmed;
  }

  const fullBr = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (fullBr) {
    const [, day, month, year] = fullBr;
    return normalizeEventDate(`${year}-${month}-${day}`, fallbackYear);
  }

  const shortBr = trimmed.match(/^(\d{2})\/(\d{2})$/);
  if (shortBr) {
    const [, day, month] = shortBr;
    return normalizeEventDate(
      `${fallbackYear}-${month}-${day}`,
      fallbackYear,
    );
  }

  return null;
}

export function formatEventDateBr(value: string) {
  const iso = normalizeEventDate(value);
  if (!iso) return value;
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function isEventOnOrAfter(
  eventDate: string,
  referenceDate = todayInEventTimezone(),
) {
  const iso = normalizeEventDate(eventDate);
  if (!iso) return false;
  return iso >= referenceDate;
}

export function compareEvents(a: ManagedEvent, b: ManagedEvent) {
  const dateA = normalizeEventDate(a.date) ?? a.date;
  const dateB = normalizeEventDate(b.date) ?? b.date;
  if (dateA !== dateB) return dateA.localeCompare(dateB);
  return a.time.localeCompare(b.time);
}

export function sortEvents(events: readonly ManagedEvent[]) {
  return [...events].sort(compareEvents);
}

export function filterCalendarEvents(
  events: readonly ManagedEvent[],
  today = todayInEventTimezone(),
) {
  return sortEvents(events).filter((event) =>
    isEventOnOrAfter(event.date, today),
  );
}

export function groupEventsByDate(events: readonly ManagedEvent[]) {
  const groups = new Map<string, ManagedEvent[]>();
  for (const event of sortEvents(events)) {
    const key = normalizeEventDate(event.date) ?? event.date;
    const list = groups.get(key) ?? [];
    list.push(event);
    groups.set(key, list);
  }
  return [...groups.entries()].map(([date, items]) => ({
    date,
    label: formatEventDateBr(date),
    events: items,
  }));
}
