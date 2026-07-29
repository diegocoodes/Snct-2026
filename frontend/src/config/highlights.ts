export type NoticeStatus = "aberto" | "encerrado";

export type FeaturedNotice = {
  title: string;
  description: string;
  registration: string;
  registrationStartsAt?: string;
  registrationEndsAt?: string;
  formUrl?: string;
  status: NoticeStatus;
};

export type UpcomingEvent = {
  date: string;
  time: string;
  title: string;
  location: string;
};

export const featuredNotices: readonly FeaturedNotice[] = [
  {
    title:
      "I Workshop, Lucro Turbinado: Estratégias Digitais e IA para o Comércio de Paulista",
    description:
      "Capacitação prática em estratégias digitais e inteligência artificial para o comércio local. O workshop reúne especialistas, empreendedores e estudantes para discutir ferramentas digitais, automação e IA aplicadas ao varejo de Paulista.",
    registration: "06/11/2026 – 26/11/2026",
    registrationStartsAt: "2026-11-06",
    registrationEndsAt: "2026-11-26",
    formUrl: "",
    status: "aberto",
  },
  {
    title: "PITCH — O roteiro para uma apresentação eficaz",
    description:
      "Oficina de comunicação para montar e apresentar pitches com clareza e impacto, com foco em storytelling e prática de apresentação.",
    registration: "20/10/2025 – 27/10/2025",
    registrationStartsAt: "2025-10-20",
    registrationEndsAt: "2025-10-27",
    formUrl: "",
    status: "encerrado",
  },
  {
    title: "Campeonato Free Fire Mobile",
    description:
      "Torneio gamer aberto ao público durante a SNCT Paulista, com regras oficiais publicadas no edital.",
    registration: "16/10/2025 – 23/10/2025",
    registrationStartsAt: "2025-10-16",
    registrationEndsAt: "2025-10-23",
    formUrl: "",
    status: "encerrado",
  },
  {
    title: "Esquenta SNCT Caravana REC’n’Play",
    description:
      "Programação preparatória da caravana REC’n’Play na SNCT, com inscrição prévia conforme o edital.",
    registration: "05/10/2025 – 16/10/2025",
    registrationStartsAt: "2025-10-05",
    registrationEndsAt: "2025-10-16",
    formUrl: "",
    status: "encerrado",
  },
  {
    title: "Arena Gamer",
    description:
      "Espaço de jogos e desafios digitais da SNCT Paulista, com vagas limitadas e inscrição pelo formulário oficial.",
    registration: "29/09/2025 – 21/10/2025",
    registrationStartsAt: "2025-09-29",
    registrationEndsAt: "2025-10-21",
    formUrl: "",
    status: "encerrado",
  },
] as const;

export const upcomingEvents: readonly UpcomingEvent[] = [
  {
    date: "2026-10-24",
    time: "08:00",
    title: "Credenciamento",
    location: "Local a definir",
  },
  {
    date: "2026-10-24",
    time: "08:00",
    title: "Uso da Robótica no Meio Ambiente",
    location: "Arena Robótica",
  },
  {
    date: "2026-10-24",
    time: "09:00",
    title: "Abertura Oficial — Autoridades",
    location: "Palco principal",
  },
  {
    date: "2026-10-24",
    time: "09:00",
    title: "Abertura",
    location: "Arena Gamer",
  },
  {
    date: "2026-10-24",
    time: "09:00",
    title: "Valorant — Mira Bamba x RCL",
    location: "Arena Gamer",
  },
  {
    date: "2026-10-24",
    time: "09:15",
    title: "Introdução à Programação com Arduino",
    location: "Arena Robótica",
  },
] as const;
