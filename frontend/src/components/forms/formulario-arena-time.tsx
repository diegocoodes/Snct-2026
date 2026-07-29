"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { isValidCpf, onlyDigits } from "@/lib/cpf";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import { secureFetch } from "@/lib/secure-fetch";
import { cn } from "@/lib/utils";

const checkboxClassName =
  "mt-1 size-4 shrink-0 cursor-pointer rounded border border-cyan-electric/40 bg-[#111329] accent-cyan-electric";

const selectClassName =
  "h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const JOGOS = [
  { value: "LOL", label: "League of Legends", short: "LoL" },
  { value: "VALORANT", label: "Valorant", short: "Valorant" },
  { value: "FREE_FIRE", label: "Free Fire", short: "Free Fire" },
] as const;

const MEMBER_COUNT = 5;

type MemberDraft = {
  nomeCompleto: string;
  email: string;
  telefone: string;
  cpf: string;
  dataNascimento: string;
  estado: string;
  cidade: string;
  nick: string;
};

function emptyMember(): MemberDraft {
  return {
    nomeCompleto: "",
    email: "",
    telefone: "",
    cpf: "",
    dataNascimento: "",
    estado: "",
    cidade: "",
    nick: "",
  };
}

function ageFromBirth(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split("-").map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (
    now.getMonth() + 1 < m ||
    (now.getMonth() + 1 === m && now.getDate() < d)
  ) {
    age -= 1;
  }
  return age;
}

function isMemberFilled(member: MemberDraft) {
  return (
    member.nomeCompleto.trim().length >= 2 &&
    member.email.includes("@") &&
    onlyDigits(member.telefone).length >= 10 &&
    isValidCpf(member.cpf) &&
    Boolean(member.dataNascimento) &&
    Boolean(member.estado) &&
    member.cidade.trim().length >= 2 &&
    member.nick.trim().length >= 2
  );
}

function FormularioArenaTime() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMember, setActiveMember] = useState(0);
  const [nomeTime, setNomeTime] = useState("");
  const [jogo, setJogo] = useState<(typeof JOGOS)[number]["value"] | "">("");
  const [membros, setMembros] = useState<MemberDraft[]>(() =>
    Array.from({ length: MEMBER_COUNT }, emptyMember),
  );
  const [aceitouDireitoImagem, setAceitouDireitoImagem] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [guardianConsent, setGuardianConsent] = useState(false);

  const hasMinor = useMemo(
    () =>
      membros.some((member) => {
        const age = ageFromBirth(member.dataNascimento);
        return age !== null && age < 18;
      }),
    [membros],
  );

  const filledCount = useMemo(
    () => membros.filter(isMemberFilled).length,
    [membros],
  );

  const member = membros[activeMember];

  function updateMember(index: number, patch: Partial<MemberDraft>) {
    setMembros((current) =>
      current.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    if (!jogo) {
      setError("Selecione o campeonato.");
      setLoading(false);
      return;
    }

    for (let i = 0; i < membros.length; i += 1) {
      const current = membros[i];
      if (!isValidCpf(current.cpf)) {
        setActiveMember(i);
        setError(`Integrante ${i + 1}: informe um CPF válido.`);
        setLoading(false);
        return;
      }
      if (current.nick.trim().length < 2) {
        setActiveMember(i);
        setError(`Integrante ${i + 1}: informe o nick no jogo.`);
        setLoading(false);
        return;
      }
      if (!isMemberFilled(current)) {
        setActiveMember(i);
        setError(`Integrante ${i + 1}: preencha todos os campos.`);
        setLoading(false);
        return;
      }
    }

    if (!aceitouDireitoImagem) {
      setError("Aceite o direito de uso de imagem para concluir a inscrição.");
      setLoading(false);
      return;
    }
    if (!privacyConsent) {
      setError("Aceite o aviso de privacidade para continuar.");
      setLoading(false);
      return;
    }
    if (hasMinor && !guardianConsent) {
      setError("O consentimento do responsável é obrigatório para menores.");
      setLoading(false);
      return;
    }

    const response = await secureFetch("/api/auth/registro/arena", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nomeTime: nomeTime.trim(),
        jogo,
        membros: membros.map((item) => ({
          nomeCompleto: item.nomeCompleto.trim(),
          email: item.email.trim().toLowerCase(),
          telefone: onlyDigits(item.telefone),
          cpf: onlyDigits(item.cpf),
          dataNascimento: item.dataNascimento,
          estado: item.estado,
          cidade: item.cidade.trim(),
          nick: item.nick.trim(),
        })),
        aceitouDireitoImagem,
        privacyConsent,
        guardianConsent: hasMinor ? guardianConsent : false,
      }),
    });

    const result = (await response.json()) as {
      error?: string;
      qrCodeHash?: string;
      user?: { nomeCompleto?: string };
      time?: { nome?: string; jogoLabel?: string };
    };

    if (!response.ok || !result.qrCodeHash) {
      setError(result.error ?? "Não foi possível concluir a inscrição do time.");
      setLoading(false);
      return;
    }

    const params = new URLSearchParams({
      hash: result.qrCodeHash,
      nome: result.user?.nomeCompleto ?? nomeTime,
      perfil: "PARTICIPANTE",
      time: result.time?.nome ?? nomeTime,
      jogo: result.time?.jogoLabel ?? jogo,
    });
    router.push(`/auth/inscricao/confirmacao?${params.toString()}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
        <div className="space-y-2">
          <Label htmlFor="nomeTime">Nome do time</Label>
          <Input
            id="nomeTime"
            name="nomeTime"
            required
            minLength={2}
            maxLength={120}
            value={nomeTime}
            onChange={(event) => setNomeTime(event.target.value)}
            placeholder="Ex.: Dragões Pixel"
          />
        </div>
        <div className="space-y-2">
          <Label>Campeonato</Label>
          <div className="grid grid-cols-3 gap-2">
            {JOGOS.map((option) => {
              const selected = jogo === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setJogo(option.value)}
                  className={cn(
                    "rounded-xl border px-2 py-2.5 text-center text-xs font-semibold transition-colors sm:text-sm",
                    selected
                      ? "border-cyan-electric/50 bg-cyan-electric/15 text-cyan-electric"
                      : "border-white/10 bg-white/[0.03] text-blue-gray hover:border-cyan-electric/25 hover:text-ice-white",
                  )}
                >
                  {option.short}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-electric/15 bg-cyan-electric/[0.04] px-4 py-3 text-sm text-blue-gray">
        <p className="inline-flex items-center gap-2">
          <Gamepad2 className="size-4 shrink-0 text-cyan-electric" aria-hidden />
          Preencha um integrante por vez. Já cadastrados só são vinculados.
        </p>
        <span className="text-xs font-semibold tracking-wide text-cyan-electric uppercase">
          {filledCount}/{MEMBER_COUNT} prontos
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[11rem_1fr]">
        <div
          role="tablist"
          aria-label="Integrantes do time"
          className="grid grid-cols-5 gap-2 lg:grid-cols-1"
        >
          {membros.map((item, index) => {
            const filled = isMemberFilled(item);
            const active = activeMember === index;
            return (
              <button
                key={index}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveMember(index)}
                className={cn(
                  "flex min-h-11 items-center justify-center gap-2 rounded-xl border px-2 text-sm font-semibold transition-colors lg:justify-start lg:px-3",
                  active
                    ? "border-cyan-electric/40 bg-cyan-electric/12 text-ice-white"
                    : "border-white/10 bg-white/[0.02] text-blue-gray hover:border-white/20 hover:text-ice-white",
                )}
              >
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[0.7rem]",
                    filled
                      ? "bg-emerald-500/20 text-emerald-300"
                      : "bg-white/10 text-blue-gray",
                  )}
                >
                  {filled ? <Check className="size-3.5" aria-hidden /> : index + 1}
                </span>
                <span className="hidden truncate lg:inline">
                  {index === 0 ? "Responsável" : `Integrante ${index + 1}`}
                </span>
              </button>
            );
          })}
        </div>

        <div
          role="tabpanel"
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 sm:p-5"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-cyan-electric">
                {activeMember === 0
                  ? "Responsável do time"
                  : `Integrante ${activeMember + 1}`}
              </p>
              <p className="text-xs text-blue-gray">
                Nome, contato, documento e nick no jogo
              </p>
            </div>
            <div className="flex gap-1">
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={activeMember === 0}
                aria-label="Integrante anterior"
                onClick={() => setActiveMember((value) => Math.max(0, value - 1))}
              >
                <ChevronLeft aria-hidden />
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                disabled={activeMember === MEMBER_COUNT - 1}
                aria-label="Próximo integrante"
                onClick={() =>
                  setActiveMember((value) =>
                    Math.min(MEMBER_COUNT - 1, value + 1),
                  )
                }
              >
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor={`membro-${activeMember}-nome`}>Nome completo</Label>
              <Input
                id={`membro-${activeMember}-nome`}
                required
                minLength={2}
                value={member.nomeCompleto}
                onChange={(event) =>
                  updateMember(activeMember, {
                    nomeCompleto: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-nick`}>Nick no jogo</Label>
              <Input
                id={`membro-${activeMember}-nick`}
                required
                minLength={2}
                maxLength={80}
                value={member.nick}
                onChange={(event) =>
                  updateMember(activeMember, { nick: event.target.value })
                }
                placeholder="Apelido"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-email`}>E-mail</Label>
              <Input
                id={`membro-${activeMember}-email`}
                type="email"
                required
                value={member.email}
                onChange={(event) =>
                  updateMember(activeMember, { email: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-telefone`}>Telefone</Label>
              <InputMask
                id={`membro-${activeMember}-telefone`}
                mask="phone"
                required
                value={member.telefone}
                onChange={(event) =>
                  updateMember(activeMember, { telefone: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-cpf`}>CPF</Label>
              <InputMask
                id={`membro-${activeMember}-cpf`}
                mask="cpf"
                required
                value={member.cpf}
                onChange={(event) =>
                  updateMember(activeMember, { cpf: event.target.value })
                }
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
              <Label htmlFor={`membro-${activeMember}-birth`}>
                Data de nascimento
              </Label>
              <Input
                id={`membro-${activeMember}-birth`}
                type="date"
                required
                value={member.dataNascimento}
                onChange={(event) =>
                  updateMember(activeMember, {
                    dataNascimento: event.target.value,
                  })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-estado`}>Estado</Label>
              <select
                id={`membro-${activeMember}-estado`}
                required
                value={member.estado}
                onChange={(event) =>
                  updateMember(activeMember, { estado: event.target.value })
                }
                className={selectClassName}
              >
                <option value="" disabled>
                  Selecione
                </option>
                {ESTADOS_BRASIL.map((item) => (
                  <option key={item.uf} value={item.uf}>
                    {item.uf} — {item.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor={`membro-${activeMember}-cidade`}>Cidade</Label>
              <Input
                id={`membro-${activeMember}-cidade`}
                required
                minLength={2}
                maxLength={120}
                value={member.cidade}
                onChange={(event) =>
                  updateMember(activeMember, { cidade: event.target.value })
                }
                placeholder="Digite a cidade"
              />
            </div>
          </div>

          {activeMember < MEMBER_COUNT - 1 ? (
            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveMember((value) => value + 1)}
              >
                Próximo integrante <ChevronRight aria-hidden />
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input
            id="aceitouDireitoImagem"
            type="checkbox"
            className={checkboxClassName}
            checked={aceitouDireitoImagem}
            onChange={(event) => setAceitouDireitoImagem(event.target.checked)}
            required
          />
          <Label
            htmlFor="aceitouDireitoImagem"
            className="cursor-pointer text-sm leading-6 text-blue-gray"
          >
            Autorizo o uso da imagem de todos os integrantes para divulgação do
            evento SNCT Paulista 2026.
          </Label>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <input
            id="privacyConsent"
            type="checkbox"
            className={checkboxClassName}
            checked={privacyConsent}
            onChange={(event) => setPrivacyConsent(event.target.checked)}
            required
          />
          <Label
            htmlFor="privacyConsent"
            className="cursor-pointer text-sm leading-6 text-blue-gray"
          >
            Li e aceito o{" "}
            <Link
              href="/privacidade"
              className="text-cyan-electric underline"
              onClick={(event) => event.stopPropagation()}
            >
              aviso de privacidade
            </Link>
            .
          </Label>
        </div>
      </div>

      {hasMinor ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <input
            id="guardianConsent"
            type="checkbox"
            className={checkboxClassName}
            checked={guardianConsent}
            onChange={(event) => setGuardianConsent(event.target.checked)}
            required
          />
          <Label
            htmlFor="guardianConsent"
            className="cursor-pointer text-sm leading-6 text-blue-gray"
          >
            Declaro que o responsável legal autoriza a participação do(s)
            menor(es) de idade do time.
          </Label>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="inline-flex items-center gap-2 text-xs text-blue-gray">
          <ShieldCheck className="size-4 text-cyan-electric" aria-hidden />
          Contas novas são criadas como Participante automaticamente.
        </p>
        <Button type="submit" variant="glow" disabled={loading}>
          {loading ? (
            <LoaderCircle className="animate-spin" aria-hidden />
          ) : null}
          Inscrever time
        </Button>
      </div>
    </form>
  );
}

export { FormularioArenaTime };
