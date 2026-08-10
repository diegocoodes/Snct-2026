"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Download,
  LayoutGrid,
  LoaderCircle,
  Pencil,
  Plus,
  Printer,
  Trash2,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import {
  AdminListPagination,
  AdminListSearch,
  useFilteredPagination,
} from "@/components/dashboard/admin-list-toolbar";
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
import { StatusBadge } from "@/components/ui/status-badge";
import { buildStandQrPayload } from "@/lib/qr-payload";
import { secureFetch } from "@/lib/secure-fetch";

export type EstandeStatus = "DISPONIVEL" | "OCUPADO" | "INATIVO";

export type AdminEstande = {
  id: string;
  codigo: string;
  nome: string | null;
  localizacao: string | null;
  status: EstandeStatus;
  qrCodeHash: string;
  projetoId?: string | null;
  projetoTitulo?: string | null;
};

const selectClassName =
  "h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function statusBadgeForEstande(status: EstandeStatus) {
  if (status === "DISPONIVEL")
    return <StatusBadge status="success">Disponível</StatusBadge>;
  if (status === "OCUPADO")
    return <StatusBadge status="info">Ocupado</StatusBadge>;
  return <StatusBadge status="neutral">Inativo</StatusBadge>;
}

function filterEstande(estande: AdminEstande, query: string) {
  const haystack = [
    estande.codigo,
    estande.nome,
    estande.localizacao,
    estande.status,
    estande.projetoTitulo,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

async function downloadStandQr(hash: string, codigo: string) {
  const dataUrl = await QRCode.toDataURL(buildStandQrPayload(hash), {
    width: 1024,
    margin: 2,
    errorCorrectionLevel: "H",
    color: { dark: "#10002b", light: "#f7f7fb" },
  });
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `qrcode-stand-${codigo}.png`;
  link.click();
}

async function printStandQrs(estandes: AdminEstande[]) {
  const printable = estandes
    .filter((item) => item.qrCodeHash)
    .slice()
    .sort((a, b) => {
      const na = Number(a.codigo);
      const nb = Number(b.codigo);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.codigo.localeCompare(b.codigo, "pt-BR", { numeric: true });
    });

  if (printable.length === 0) {
    throw new Error("Nenhum stand com QR Code para imprimir.");
  }

  const qrs = await Promise.all(
    printable.map(async (item) => ({
      ...item,
      src: await QRCode.toDataURL(buildStandQrPayload(item.qrCodeHash), {
        width: 900,
        margin: 2,
        errorCorrectionLevel: "H",
        color: { dark: "#10002b", light: "#ffffff" },
      }),
    })),
  );

  const pages: (typeof qrs)[] = [];
  for (let i = 0; i < qrs.length; i += 4) {
    pages.push(qrs.slice(i, i + 4));
  }

  const printWindow = window.open("", "_blank", "width=900,height=900");
  if (!printWindow) throw new Error("A janela de impressão foi bloqueada.");
  printWindow.document.write(`<!doctype html>
    <html lang="pt-BR"><head><title>QR Codes dos stands</title>
    <style>
      @page { size: A4; margin: 12mm; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: Arial, sans-serif; color: #10002b; }
      .page {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8mm;
        min-height: calc(297mm - 24mm);
        page-break-after: always;
      }
      .page:last-child { page-break-after: auto; }
      article {
        min-height: 125mm;
        display: grid;
        place-items: center;
        align-content: center;
        border: 1px dashed #777;
        border-radius: 10px;
        padding: 8mm;
        break-inside: avoid;
      }
      img { width: 78mm; height: 78mm; }
      h1 { margin: 0 0 4mm; font-size: 22pt; }
      p { margin: 3mm 0 0; font-size: 11pt; text-align: center; }
    </style></head><body>
      ${pages
        .map(
          (page) => `<section class="page">${page
            .map(
              (item) => `<article><h1>Stand ${item.codigo}</h1>
            <img src="${item.src}" alt="QR Code do stand ${item.codigo}">
            <p>${item.projetoTitulo ?? item.nome ?? "SNCT Paulista 2026"}</p>
          </article>`,
            )
            .join("")}</section>`,
        )
        .join("")}
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}</script>
    </body></html>`);
  printWindow.document.close();
}

function StandQrThumb({ hash, codigo }: { hash: string; codigo: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(buildStandQrPayload(hash), {
      width: 180,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#10002b", light: "#f7f7fb" },
    }).then((value) => {
      if (active) setSrc(value);
    });
    return () => {
      active = false;
    };
  }, [hash]);

  if (!src) {
    return (
      <div className="size-16 animate-pulse rounded-lg bg-white/10 motion-reduce:animate-none" />
    );
  }

  return (
    <Image
      src={src}
      alt={`QR Code do stand ${codigo}`}
      width={64}
      height={64}
      className="size-16 rounded-lg"
      unoptimized
    />
  );
}

function AdminEstandesPanel() {
  const [estandes, setEstandes] = useState<AdminEstande[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminEstande | null>(null);
  const [creating, setCreating] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [statusNovo, setStatusNovo] = useState<EstandeStatus>("DISPONIVEL");

  const load = useCallback(async () => {
    const response = await secureFetch("/api/admin");
    const data = (await response.json()) as {
      error?: string;
      estandes?: AdminEstande[];
    };
    if (!response.ok) {
      toast.error(data.error ?? "Não foi possível carregar os stands.");
      return;
    }
    setEstandes(data.estandes ?? []);
  }, []);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function mutate(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusy(true);
    try {
      const response = await secureFetch("/api/admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as {
        error?: string;
        estandes?: AdminEstande[];
      };
      if (!response.ok) {
        toast.error(data.error ?? "Não foi possível concluir a ação.");
        return false;
      }
      if (data.estandes) setEstandes(data.estandes);
      else await load();
      toast.success(successMessage);
      return true;
    } catch {
      toast.error("Falha de rede. Tente novamente.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setCodigo("");
    setStatusNovo("DISPONIVEL");
    setDialogOpen(true);
  }

  function openEdit(estande: AdminEstande) {
    setCreating(false);
    setEditing(estande);
    setCodigo(estande.codigo);
    setStatusNovo(estande.status === "OCUPADO" ? "OCUPADO" : estande.status);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setCreating(false);
    setCodigo("");
    setStatusNovo("DISPONIVEL");
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const ok = creating
      ? await mutate(
          {
            action: "createEstande",
            codigo,
            status: statusNovo,
          },
          "Stand cadastrado.",
        )
      : editing
        ? await mutate(
            {
              action: "updateEstande",
              estandeId: editing.id,
              codigo,
              status: statusNovo,
            },
            "Stand atualizado.",
          )
        : false;
    if (ok) closeDialog();
  }

  async function onDelete(id: string) {
    if (!window.confirm("Excluir este stand?")) return;
    await mutate({ action: "deleteEstande", estandeId: id }, "Stand excluído.");
  }

  const formKey = creating ? "new" : (editing?.id ?? "closed");
  const statusLocked = Boolean(editing && statusNovo === "OCUPADO");
  const filterFn = useCallback(
    (estande: AdminEstande, query: string) => filterEstande(estande, query),
    [],
  );
  const list = useFilteredPagination({ items: estandes, filterFn, pageSize: 20 });

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-blue-gray">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Carregando stands…
      </p>
    );
  }

  return (
    <>
      <Card className="border-cyan-electric/20">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <LayoutGrid className="size-5 text-cyan-electric" aria-hidden />
              Stands
            </CardTitle>
            <p className="mt-1 text-sm leading-6 text-blue-gray">
              Cadastre apenas o número do stand. Um QR Code único é gerado
              automaticamente para o avaliador escanear.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!estandes.some((item) => item.qrCodeHash) || busy}
              onClick={() =>
                void printStandQrs(estandes)
                  .then(() => {
                    const total = estandes.filter((item) => item.qrCodeHash)
                      .length;
                    const folhas = Math.ceil(total / 4);
                    toast.success(
                      `${total} QR Code(s) em ${folhas} folha(s) (4 por página).`,
                    );
                  })
                  .catch((error) =>
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "Não foi possível imprimir.",
                    ),
                  )
              }
            >
              <Printer aria-hidden /> Imprimir 4 QR Codes
            </Button>
            <Button type="button" onClick={openCreate}>
              <Plus aria-hidden /> Criar stand
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminListSearch
            query={list.query}
            onQueryChange={list.setQuery}
            placeholder="Buscar stand, nome ou projeto…"
            resultLabel={`${list.filteredCount} resultado(s)`}
          />
          {list.pageItems.length === 0 ? (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-blue-gray">
              {estandes.length
                ? "Nenhum stand encontrado para esta busca."
                : "Nenhum stand cadastrado."}
            </p>
          ) : (
            <ul className="divide-y divide-white/10">
              {list.pageItems.map((estande) => (
                <li
                  key={estande.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {estande.qrCodeHash ? (
                      <StandQrThumb
                        hash={estande.qrCodeHash}
                        codigo={estande.codigo}
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-ice-white">
                          Stand {estande.codigo}
                        </strong>
                        {statusBadgeForEstande(estande.status)}
                      </div>
                      <p className="mt-1 text-sm text-blue-gray">
                        {estande.nome
                          ? `Nome: ${estande.nome}`
                          : "Sem nome (livre para vínculo)"}
                        {estande.projetoTitulo &&
                        estande.projetoTitulo !== estande.nome
                          ? ` · Projeto: ${estande.projetoTitulo}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 sm:shrink-0">
                    {estande.qrCodeHash ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Baixar QR Code do stand ${estande.codigo}`}
                        onClick={() => {
                          void downloadStandQr(
                            estande.qrCodeHash,
                            estande.codigo,
                          )
                            .then(() =>
                              toast.success(
                                `QR Code do stand ${estande.codigo} baixado.`,
                              ),
                            )
                            .catch(() =>
                              toast.error(
                                "Não foi possível baixar o QR Code.",
                              ),
                            );
                        }}
                      >
                        <Download
                          className="size-4 text-cyan-electric"
                          aria-hidden
                        />
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Editar stand ${estande.codigo}`}
                      onClick={() => openEdit(estande)}
                    >
                      <Pencil className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy || Boolean(estande.projetoId)}
                      aria-label={`Excluir stand ${estande.codigo}`}
                      onClick={() => void onDelete(estande.id)}
                    >
                      <Trash2 className="size-4 text-red-300" aria-hidden />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <AdminListPagination
            page={list.page}
            totalPages={list.totalPages}
            onPageChange={list.setPage}
          />
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) closeDialog();
          else setDialogOpen(true);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {creating ? "Criar stand" : "Editar stand"}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? "Informe o número do stand. O QR Code é gerado automaticamente."
                : `Atualize os dados do stand ${editing?.codigo ?? ""}.`}
            </DialogDescription>
          </DialogHeader>

          <form key={formKey} className="grid gap-4" onSubmit={onSave}>
            <div className="space-y-2">
              <Label htmlFor="estande-numero">Número do stand</Label>
              <Input
                id="estande-numero"
                value={codigo}
                onChange={(event) => setCodigo(event.target.value)}
                placeholder="Ex.: 12"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="estande-status">Status</Label>
              <select
                id="estande-status"
                className={selectClassName}
                value={statusNovo}
                onChange={(event) =>
                  setStatusNovo(event.target.value as EstandeStatus)
                }
                disabled={statusLocked}
              >
                <option value="DISPONIVEL">Disponível</option>
                <option value="INATIVO">Inativo</option>
                {statusNovo === "OCUPADO" ? (
                  <option value="OCUPADO">Ocupado</option>
                ) : null}
              </select>
              {statusLocked ? (
                <p className="text-xs text-blue-gray">
                  Stand ocupado por projeto. Libere o vínculo na aba Projetos
                  para alterar o status.
                </p>
              ) : null}
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : creating ? (
                  <Plus aria-hidden />
                ) : (
                  <Pencil aria-hidden />
                )}
                {creating ? "Criar stand" : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { AdminEstandesPanel };
