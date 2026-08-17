"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ExternalLink,
  FileText,
  LoaderCircle,
  PencilLine,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/state-panel";
import { getNoticePeriodLabel } from "@/lib/notices";
import type { ManagedNotice } from "@/lib/snct-types";
import { secureFetch } from "@/lib/secure-fetch";
import { cn } from "@/lib/utils";

function AdminEditaisPanel({ notices }: { notices: ManagedNotice[] }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedNotice | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(notice: ManagedNotice) {
    setEditing(notice);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
  }

  async function mutateForm(payload: FormData, successMessage: string) {
    const id = String(payload.get("id") ?? "new");
    setBusyAction(`saveNotice-${id}`);
    const response = await secureFetch("/api/admin", {
      method: "POST",
      body: payload,
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error ?? "Não foi possível salvar o edital.");
    } else {
      toast.success(successMessage);
      closeDialog();
      router.refresh();
    }
    setBusyAction("");
    return response.ok;
  }

  async function mutate(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    const actionKey = `${payload.action}-${payload.id ?? payload.documentId ?? "new"}`;
    setBusyAction(actionKey);
    const response = await secureFetch("/api/admin", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      toast.error(result.error ?? "Não foi possível salvar a alteração.");
    } else {
      toast.success(successMessage);
      router.refresh();
    }
    setBusyAction("");
    return response.ok;
  }

  const formKey = editing?.id ?? "new";
  const saving = busyAction === `saveNotice-${formKey}`;

  return (
    <div className="space-y-5">
      <Card className="border-cyan-electric/20">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Editais</CardTitle>
            <p className="mt-1 text-sm leading-6 text-blue-gray">
              Veja os editais publicados. Use criar ou editar para abrir o
              formulário em uma janela.
            </p>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus aria-hidden /> Criar edital
          </Button>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <EmptyState
              title="Nenhum edital cadastrado"
              description="Clique em Criar edital para publicar o primeiro."
            />
          ) : (
            <ul className="grid gap-3">
              {notices.map((notice) => {
                const periodLabel = getNoticePeriodLabel(notice);
                return (
                  <li
                    key={notice.id}
                    className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-ice-white">
                          {notice.title}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn(
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
                      <p className="mt-1 text-sm text-blue-gray">
                        {notice.registration}
                      </p>
                      {notice.description ? (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-blue-gray">
                          {notice.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-xs text-blue-gray">
                        {notice.documents.length
                          ? `${notice.documents.length} arquivo(s)`
                          : "Sem PDF anexado"}
                        {notice.formUrl ? " · Formulário configurado" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit(notice)}
                      >
                        <PencilLine aria-hidden /> Editar
                      </Button>
                      {notice.formUrl ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          render={
                            <a
                              href={notice.formUrl}
                              target="_blank"
                              rel="noreferrer"
                            />
                          }
                        >
                          <ExternalLink aria-hidden /> Formulário
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={busyAction === `deleteNotice-${notice.id}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Excluir o edital “${notice.title}”?`,
                            )
                          ) {
                            void mutate(
                              { action: "deleteNotice", id: notice.id },
                              "Edital excluído.",
                            );
                          }
                        }}
                      >
                        <Trash2 aria-hidden /> Remover
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar edital" : "Criar edital"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize os dados do edital. O status de inscrição segue as datas automaticamente."
                : "Preencha título, descrição, período, até 2 PDFs e o link do formulário externo."}
            </DialogDescription>
          </DialogHeader>

          <form
            key={formKey}
            encType="multipart/form-data"
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void mutateForm(
                new FormData(event.currentTarget),
                editing ? "Edital atualizado." : "Edital publicado.",
              );
            }}
          >
            <input type="hidden" name="action" value="saveNotice" />
            {editing ? (
              <input type="hidden" name="id" value={editing.id} />
            ) : null}

            <div className="space-y-2">
              <Label htmlFor="notice-title">Título do edital</Label>
              <Input
                id="notice-title"
                name="title"
                required
                maxLength={220}
                defaultValue={editing?.title ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-description">Descrição</Label>
              <Textarea
                id="notice-description"
                name="description"
                required
                maxLength={8000}
                rows={5}
                defaultValue={editing?.description ?? ""}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="notice-starts">Início das inscrições</Label>
                <Input
                  id="notice-starts"
                  name="registrationStartsAt"
                  type="date"
                  required
                  defaultValue={editing?.registrationStartsAt ?? ""}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notice-ends">Encerramento das inscrições</Label>
                <Input
                  id="notice-ends"
                  name="registrationEndsAt"
                  type="date"
                  required
                  defaultValue={editing?.registrationEndsAt ?? ""}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-form">
                Link do formulário de inscrição
              </Label>
              <Input
                id="notice-form"
                name="formUrl"
                type="url"
                placeholder="https://forms.gle/..."
                maxLength={2000}
                defaultValue={editing?.formUrl ?? ""}
              />
            </div>

            {(() => {
              const existingCount = editing?.documents.length ?? 0;
              const freeSlots = Math.max(0, 2 - existingCount);
              return (
                <div className="space-y-3">
                  <div>
                    <Label>Arquivos do edital (PDF)</Label>
                    <p className="mt-1 text-xs leading-5 text-blue-gray">
                      Anexe até 2 editais. Na área pública aparecerá um botão
                      por arquivo anexado.
                      {existingCount
                        ? ` ${existingCount}/2 anexado(s).`
                        : ""}
                    </p>
                  </div>

                  {editing?.documents.length ? (
                    <ul className="grid gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-3">
                      {editing.documents.map((document, index) => (
                        <li
                          key={document.id}
                          className="flex min-w-0 items-center gap-3"
                        >
                          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cyan-electric/10 text-cyan-electric">
                            <FileText className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-blue-gray">
                              Edital {index + 1}
                            </p>
                            <a
                              href={`/api/documents/${document.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="block truncate text-sm font-semibold text-ice-white underline-offset-4 hover:text-cyan-electric hover:underline"
                            >
                              {document.name}
                            </a>
                            <p className="text-xs text-blue-gray">
                              {(document.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="destructive"
                            aria-label={`Remover documento ${document.name}`}
                            onClick={() => {
                              if (
                                window.confirm(`Remover “${document.name}”?`)
                              ) {
                                void mutate(
                                  {
                                    action: "deleteNoticeDocument",
                                    noticeId: editing.id,
                                    documentId: document.id,
                                  },
                                  "Documento removido.",
                                ).then((ok) => {
                                  if (!ok) return;
                                  setEditing((current) =>
                                    current
                                      ? {
                                          ...current,
                                          documents: current.documents.filter(
                                            (item) => item.id !== document.id,
                                          ),
                                        }
                                      : current,
                                  );
                                });
                              }
                            }}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {freeSlots > 0 ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="notice-document">
                          {existingCount === 0
                            ? "1º edital (PDF)"
                            : "Anexar 2º edital (PDF)"}
                        </Label>
                        <Input
                          id="notice-document"
                          name="document"
                          type="file"
                          accept=".pdf,application/pdf"
                          className="pt-1.5"
                        />
                      </div>
                      {freeSlots > 1 ? (
                        <div className="space-y-2">
                          <Label htmlFor="notice-document-2">
                            2º edital (PDF, opcional)
                          </Label>
                          <Input
                            id="notice-document-2"
                            name="document2"
                            type="file"
                            accept=".pdf,application/pdf"
                            className="pt-1.5"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <p className="rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs leading-5 text-amber-200">
                      Limite de 2 anexos atingido. Remova um arquivo para
                      anexar outro.
                    </p>
                  )}
                </div>
              );
            })()}

            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : editing ? (
                  <PencilLine aria-hidden />
                ) : (
                  <Plus aria-hidden />
                )}
                {editing ? "Salvar alterações" : "Publicar edital"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AdminEditaisPanel };
