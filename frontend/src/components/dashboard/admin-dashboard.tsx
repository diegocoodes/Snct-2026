"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Eye,
  EyeOff,
  FolderKanban,
  Gift,
  LayoutGrid,
  LoaderCircle,
  Megaphone,
  PencilLine,
  Plus,
  Save,
  ScanLine,
  ScrollText,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { AdminEditaisPanel } from "@/components/dashboard/admin-editais-panel";
import { AdminEstandesPanel } from "@/components/dashboard/admin-estandes-panel";
import {
  AdminListPagination,
  AdminListSearch,
  useFilteredPagination,
} from "@/components/dashboard/admin-list-toolbar";
import { AdminProjetosPanel } from "@/components/dashboard/admin-projetos-panel";
import { AdminUsuariosPanel } from "@/components/dashboard/admin-usuarios-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  ManagedEvent,
  ManagedNotice,
  ManagedPartner,
  AuditLog,
  PublicUser,
  SiteSettings,
} from "@/lib/snct-types";
import { secureFetch } from "@/lib/secure-fetch";

function filterPartner(partner: ManagedPartner, query: string) {
  return partner.name.toLowerCase().includes(query);
}

function filterAuditLog(log: AuditLog, query: string) {
  const haystack = [
    log.action,
    log.entity,
    log.entityId,
    log.actorRole,
    log.outcome,
    log.createdAt,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

type AdminDashboardProps = {
  users: PublicUser[];
  events: ManagedEvent[];
  notices: ManagedNotice[];
  partners: ManagedPartner[];
  settings: SiteSettings;
  auditLogs: AuditLog[];
};

function formValues(form: HTMLFormElement) {
  return Object.fromEntries(new FormData(form).entries());
}

function AdminDashboard({
  users,
  events,
  notices,
  partners,
  settings,
  auditLogs,
}: AdminDashboardProps) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const partnerFilter = useCallback(filterPartner, []);
  const auditFilter = useCallback(filterAuditLog, []);
  const partnersList = useFilteredPagination({
    items: partners,
    filterFn: partnerFilter,
    pageSize: 8,
  });
  const auditList = useFilteredPagination({
    items: auditLogs,
    filterFn: auditFilter,
    pageSize: 10,
  });

  async function mutate(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    const actionKey = `${payload.action}-${payload.id ?? payload.userId ?? "new"}`;
    setBusyAction(actionKey);
    const response = await secureFetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok)
      toast.error(result.error ?? "Não foi possível salvar a alteração.");
    else {
      toast.success(successMessage);
      router.refresh();
    }
    setBusyAction("");
    return response.ok;
  }

  const visitors = users.filter(
    (user) =>
      user.role === "visitante" ||
      user.role === "aluno" ||
      user.role === "participante" ||
      user.role === "avaliador" ||
      user.role === "professor",
  );
  const staff = users.filter((user) => user.role === "staff");
  const checkins = visitors.filter((user) => user.checkedInAt).length;
  const gifts = visitors.filter((user) => user.giftDeliveredAt).length;

  return (
    <div>
      <div className="max-w-4xl">
        <p className="font-display text-sm tracking-[.2em] text-magenta-neon uppercase">
          Painel no-code
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-ice-white sm:text-4xl">
          Gestão da SNCT Paulista
        </h1>
        <p className="mt-4 leading-7 text-blue-gray">
          Gerencie equipe, visitantes e conteúdo visual por formulários. As
          mudanças em eventos, parceiros e Hero aparecem no portal.
        </p>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: "Visitantes",
            value: visitors.length,
            icon: UserRound,
            color: "text-cyan-electric bg-cyan-electric/10",
          },
          {
            label: "Equipe Staff",
            value: staff.length,
            icon: UsersRound,
            color: "text-[#BDA5FF] bg-purple-vibrant/15",
          },
          {
            label: "Check-ins",
            value: checkins,
            icon: ScanLine,
            color: "text-emerald-300 bg-emerald-400/10",
          },
          {
            label: "Brindes",
            value: gifts,
            icon: Gift,
            color: "text-[#FF9AE8] bg-magenta-neon/10",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} size="sm">
            <CardContent className="flex items-center gap-4">
              <span
                className={`grid size-11 place-items-center rounded-xl ${color}`}
              >
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <strong className="font-display text-2xl text-ice-white">
                  {value}
                </strong>
                <p className="text-xs text-blue-gray">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="site" className="mt-9">
        <TabsList
          variant="line"
          className="max-w-full justify-start overflow-x-auto pb-2"
        >
          <TabsTrigger value="site">
            <PencilLine aria-hidden /> Portal
          </TabsTrigger>
          <TabsTrigger value="users">
            <UsersRound aria-hidden /> Usuários
          </TabsTrigger>
          <TabsTrigger value="events">
            <CalendarDays aria-hidden /> Eventos
          </TabsTrigger>
          <TabsTrigger value="notices">
            <Megaphone aria-hidden /> Editais
          </TabsTrigger>
          <TabsTrigger value="partners">
            <ShieldCheck aria-hidden /> Parceiros
          </TabsTrigger>
          <TabsTrigger value="estandes">
            <LayoutGrid aria-hidden /> Stands
          </TabsTrigger>
          <TabsTrigger value="projetos">
            <FolderKanban aria-hidden /> Projetos
          </TabsTrigger>
          <TabsTrigger value="audit">
            <ScrollText aria-hidden /> Auditoria
          </TabsTrigger>
        </TabsList>

        <TabsContent value="site" className="pt-7">
          <Card className="border-purple-vibrant/20">
            <CardHeader>
              <CardTitle>Identidade da Hero</CardTitle>
              <p className="text-sm leading-6 text-blue-gray">
                Altere a assinatura da edição e a imagem principal sem editar o
                código.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-5 lg:grid-cols-[1fr_1.35fr_auto] lg:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  const values = formValues(event.currentTarget);
                  void mutate(
                    { action: "updateSettings", ...values },
                    "Hero atualizada com sucesso.",
                  );
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="eventEdition">Nome/ano da edição</Label>
                  <Input
                    id="eventEdition"
                    name="eventEdition"
                    defaultValue={settings.eventEdition}
                    placeholder="Paulista 2026"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heroImageUrl">Imagem ou URL da Hero</Label>
                  <Input
                    id="heroImageUrl"
                    name="heroImageUrl"
                    defaultValue={settings.heroImageUrl}
                    placeholder="/images/logo.png ou https://..."
                    required
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busyAction.startsWith("updateSettings")}
                >
                  <Save aria-hidden /> Salvar
                </Button>
              </form>
              <div className="mt-6 flex min-h-44 items-center justify-center overflow-hidden rounded-2xl border border-cyan-electric/15 bg-[radial-gradient(circle_at_center,rgb(106_0_255/25%),transparent_65%)] p-5">
                <img
                  src={settings.heroImageUrl}
                  alt="Prévia atual da Hero"
                  className="max-h-48 max-w-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="pt-7">
          <AdminUsuariosPanel users={users} />
        </TabsContent>

        <TabsContent value="events" className="pt-7">
          <Card className="border-magenta-neon/15">
            <CardHeader>
              <CardTitle>Adicionar evento</CardTitle>
              <p className="text-sm text-blue-gray">
                Informe a data completa (dia, mês e ano). A Home (Calendário)
                mostra só o dia atual e os futuros; a Programação guarda o
                histórico completo.
              </p>
            </CardHeader>
            <CardContent>
              <form
                className="grid gap-4 md:grid-cols-[.9fr_.7fr_1.5fr_1.2fr_auto] md:items-end"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const success = await mutate(
                    { action: "saveEvent", ...formValues(event.currentTarget) },
                    "Evento adicionado.",
                  );
                  if (success) event.currentTarget.reset();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="new-event-date">Data</Label>
                  <Input
                    id="new-event-date"
                    name="date"
                    type="date"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-event-time">Hora</Label>
                  <Input
                    id="new-event-time"
                    name="time"
                    type="time"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-event-title">Evento</Label>
                  <Input id="new-event-title" name="title" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-event-location">Local</Label>
                  <Input id="new-event-location" name="location" required />
                </div>
                <Button type="submit">
                  <Plus aria-hidden /> Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-5 grid gap-4">
            {events.map((event) => (
              <Card key={event.id} size="sm">
                <CardContent>
                  <form
                    className="grid gap-3 md:grid-cols-[.85fr_.65fr_1.4fr_1.15fr_auto] md:items-end"
                    onSubmit={(formEvent) => {
                      formEvent.preventDefault();
                      void mutate(
                        {
                          action: "saveEvent",
                          id: event.id,
                          ...formValues(formEvent.currentTarget),
                        },
                        "Evento atualizado.",
                      );
                    }}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor={`${event.id}-date`}>Data</Label>
                      <Input
                        id={`${event.id}-date`}
                        name="date"
                        type="date"
                        defaultValue={event.date}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${event.id}-time`}>Hora</Label>
                      <Input
                        id={`${event.id}-time`}
                        name="time"
                        type="time"
                        defaultValue={event.time}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${event.id}-title`}>Título</Label>
                      <Input
                        id={`${event.id}-title`}
                        name="title"
                        defaultValue={event.title}
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`${event.id}-location`}>Local</Label>
                      <Input
                        id={`${event.id}-location`}
                        name="location"
                        defaultValue={event.location}
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="submit"
                        size="icon"
                        aria-label={`Salvar ${event.title}`}
                        disabled={busyAction === `saveEvent-${event.id}`}
                      >
                        <Save aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="destructive"
                        aria-label={`Excluir ${event.title}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir o evento “${event.title}”?`,
                            )
                          )
                            void mutate(
                              { action: "deleteEvent", id: event.id },
                              "Evento excluído.",
                            );
                        }}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notices" className="pt-7">
          <AdminEditaisPanel notices={notices} />
        </TabsContent>

        <TabsContent value="partners" className="pt-7">
          <Card className="border-cyan-electric/15">
            <CardHeader>
              <CardTitle>Novo parceiro</CardTitle>
              <p className="text-sm text-blue-gray">
                Anexe a logomarca em PNG, WebP, JPEG ou SVG (até 2 MB).
              </p>
            </CardHeader>
            <CardContent>
              <form
                encType="multipart/form-data"
                className="grid gap-4 md:grid-cols-[1fr_1.6fr_auto] md:items-end"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const form = event.currentTarget;
                  setBusyAction("addPartner-new");
                  const response = await secureFetch("/api/admin", {
                    method: "POST",
                    body: new FormData(form),
                  });
                  const result = (await response.json()) as { error?: string };
                  if (!response.ok) {
                    toast.error(
                      result.error ?? "Não foi possível adicionar o parceiro.",
                    );
                  } else {
                    toast.success("Parceiro adicionado.");
                    form.reset();
                    router.refresh();
                  }
                  setBusyAction("");
                }}
              >
                <input type="hidden" name="action" value="addPartner" />
                <div className="space-y-2">
                  <Label htmlFor="partner-name">Nome da instituição</Label>
                  <Input id="partner-name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="partner-logo">Arquivo da logomarca</Label>
                  <Input
                    id="partner-logo"
                    name="logo"
                    type="file"
                    accept=".png,.webp,.jpg,.jpeg,.svg,image/png,image/webp,image/jpeg,image/svg+xml"
                    required
                    className="pt-1.5"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={busyAction === "addPartner-new"}
                >
                  {busyAction === "addPartner-new" ? (
                    <LoaderCircle className="animate-spin" aria-hidden />
                  ) : (
                    <Plus aria-hidden />
                  )}
                  Adicionar
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="mt-5 space-y-4">
            <AdminListSearch
              query={partnersList.query}
              onQueryChange={partnersList.setQuery}
              placeholder="Buscar parceiro…"
              resultLabel={`${partnersList.filteredCount} resultado(s)`}
            />
            {partnersList.pageItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-blue-gray">
                {partners.length
                  ? "Nenhum parceiro encontrado para esta busca."
                  : "Nenhum parceiro cadastrado."}
              </p>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {partnersList.pageItems.map((partner) => (
                  <Card key={partner.id} size="sm" className="overflow-hidden">
                    <CardContent>
                      <div className="grid h-28 place-items-center rounded-xl bg-white p-3">
                        <img
                          src={partner.logo}
                          alt={partner.name}
                          className="max-h-24 max-w-full object-contain"
                        />
                      </div>
                      <p className="mt-3 line-clamp-2 min-h-10 text-sm font-semibold text-ice-white">
                        {partner.name}
                      </p>
                      {partner.hidden ? (
                        <p className="mt-1 text-xs text-amber-300">
                          Oculto no site
                        </p>
                      ) : null}
                      <div className="mt-3 grid gap-2">
                        <Button
                          className="w-full"
                          size="sm"
                          variant="outline"
                          disabled={
                            busyAction === `togglePartnerHidden-${partner.id}`
                          }
                          onClick={() =>
                            void mutate(
                              {
                                action: "togglePartnerHidden",
                                id: partner.id,
                              },
                              partner.hidden
                                ? "Parceiro visível no site."
                                : "Parceiro ocultado do site.",
                            )
                          }
                        >
                          {partner.hidden ? (
                            <>
                              <Eye aria-hidden /> Mostrar
                            </>
                          ) : (
                            <>
                              <EyeOff aria-hidden /> Ocultar
                            </>
                          )}
                        </Button>
                        <Button
                          className="w-full"
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (window.confirm(`Remover ${partner.name}?`))
                              void mutate(
                                { action: "deletePartner", id: partner.id },
                                "Parceiro removido.",
                              );
                          }}
                        >
                          <Trash2 aria-hidden /> Remover
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            <AdminListPagination
              page={partnersList.page}
              totalPages={partnersList.totalPages}
              onPageChange={partnersList.setPage}
            />
          </div>
        </TabsContent>

        <TabsContent value="estandes" className="pt-7">
          <AdminEstandesPanel />
        </TabsContent>

        <TabsContent value="projetos" className="pt-7">
          <AdminProjetosPanel />
        </TabsContent>

        <TabsContent value="audit" className="pt-7">
          <Card className="border-cyan-electric/15">
            <CardHeader>
              <CardTitle>Trilha de auditoria</CardTitle>
              <p className="text-sm leading-6 text-blue-gray">
                Últimas ações sensíveis registradas pelo servidor. Endereços e
                identificadores técnicos são armazenados apenas como hashes.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <AdminListSearch
                query={auditList.query}
                onQueryChange={auditList.setQuery}
                placeholder="Buscar ação, perfil ou objeto…"
                resultLabel={`${auditList.filteredCount} resultado(s)`}
              />
              <div className="overflow-x-auto rounded-xl border border-white/10">
                <table className="w-full min-w-3xl text-left text-sm">
                  <thead className="bg-white/5 text-xs tracking-wide text-blue-gray uppercase">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Ação</th>
                      <th className="px-4 py-3">Perfil</th>
                      <th className="px-4 py-3">Objeto</th>
                      <th className="px-4 py-3">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {auditList.pageItems.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap px-4 py-3 text-blue-gray">
                          {new Intl.DateTimeFormat("pt-BR", {
                            dateStyle: "short",
                            timeStyle: "medium",
                          }).format(new Date(log.createdAt))}
                        </td>
                        <td className="px-4 py-3 font-medium text-ice-white">
                          {log.action}
                        </td>
                        <td className="px-4 py-3 text-blue-gray">
                          {log.actorRole ?? "público"}
                        </td>
                        <td className="px-4 py-3 text-blue-gray">
                          {log.entity}
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              log.outcome === "failure"
                                ? "destructive"
                                : "outline"
                            }
                            className={
                              log.outcome === "success"
                                ? "border-emerald-400/30 text-emerald-300"
                                : log.outcome === "blocked"
                                  ? "border-amber-400/30 text-amber-300"
                                  : undefined
                            }
                          >
                            {log.outcome}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!auditList.pageItems.length ? (
                <p className="py-8 text-center text-sm text-blue-gray">
                  {auditLogs.length
                    ? "Nenhum evento encontrado para esta busca."
                    : "Nenhum evento de segurança registrado."}
                </p>
              ) : null}
              <AdminListPagination
                page={auditList.page}
                totalPages={auditList.totalPages}
                onPageChange={auditList.setPage}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {busyAction ? (
        <div
          role="status"
          className="fixed right-5 bottom-5 z-50 flex items-center gap-2 rounded-xl border border-cyan-electric/20 bg-[#111329] px-4 py-3 text-sm text-ice-white shadow-xl"
        >
          <LoaderCircle
            className="size-4 animate-spin text-cyan-electric motion-reduce:animate-none"
            aria-hidden
          />{" "}
          Salvando alteração…
        </div>
      ) : null}
    </div>
  );
}

export { AdminDashboard };
