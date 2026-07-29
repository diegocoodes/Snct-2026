import type { ManagedNotice, NoticeStatus } from "@/lib/snct-types";

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

/** Converte Date/string do MySQL para YYYY-MM-DD. */
export function toDateOnly(value: Date | string | null | undefined) {
  if (!value) return undefined;
  if (typeof value === "string") {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match?.[1];
  }
  // Colunas DATE do MySQL: usar componentes UTC para não “voltar” um dia no fuso.
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatBrDate(value: string | undefined) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

export function formatRegistrationPeriod(
  startsAt?: string,
  endsAt?: string,
  fallback = "",
) {
  if (startsAt && endsAt) {
    return `${formatBrDate(startsAt)} – ${formatBrDate(endsAt)}`;
  }
  return fallback;
}

export function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function resolveNoticeStatus(
  notice: Pick<
    ManagedNotice,
    "registrationStartsAt" | "registrationEndsAt" | "status"
  >,
  today = todayInEventTimezone(),
): NoticeStatus {
  const endsAt = notice.registrationEndsAt;
  if (endsAt && today > endsAt) return "encerrado";
  if (endsAt || notice.registrationStartsAt) return "aberto";
  return notice.status === "encerrado" ? "encerrado" : "aberto";
}

export function getNoticePeriodLabel(
  notice: Pick<
    ManagedNotice,
    "registrationStartsAt" | "registrationEndsAt" | "status"
  >,
  today = todayInEventTimezone(),
) {
  const startsAt = notice.registrationStartsAt;
  const endsAt = notice.registrationEndsAt;
  if (endsAt && today > endsAt) return "Encerrado";
  if (startsAt && today < startsAt) return "Em breve";
  if (startsAt || endsAt) return "Aberto";
  return notice.status === "encerrado" ? "Encerrado" : "Aberto";
}

export function canRegisterForNotice(
  notice: Pick<
    ManagedNotice,
    "registrationStartsAt" | "registrationEndsAt" | "status" | "formUrl"
  >,
  today = todayInEventTimezone(),
) {
  if (!notice.formUrl?.trim()) return false;
  const startsAt = notice.registrationStartsAt;
  const endsAt = notice.registrationEndsAt;
  if (startsAt && today < startsAt) return false;
  if (endsAt && today > endsAt) return false;
  if (!startsAt && !endsAt && notice.status === "encerrado") return false;
  return true;
}

export function mapNoticeRow(row: {
  id: string;
  title: string;
  description?: string | null;
  registration: string;
  registration_starts_at?: Date | string | null;
  registration_ends_at?: Date | string | null;
  form_url?: string | null;
  status: NoticeStatus | string;
}) {
  const registrationStartsAt = toDateOnly(row.registration_starts_at);
  const registrationEndsAt = toDateOnly(row.registration_ends_at);
  const base = {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    registration: formatRegistrationPeriod(
      registrationStartsAt,
      registrationEndsAt,
      row.registration,
    ),
    registrationStartsAt,
    registrationEndsAt,
    formUrl: row.form_url ?? "",
    status: (row.status === "encerrado" ? "encerrado" : "aberto") as NoticeStatus,
    documents: [] as ManagedNotice["documents"],
  };
  return {
    ...base,
    status: resolveNoticeStatus(base),
  } satisfies Omit<ManagedNotice, "documents"> & {
    documents: ManagedNotice["documents"];
  };
}
