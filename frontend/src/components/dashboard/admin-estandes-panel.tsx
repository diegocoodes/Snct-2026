"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  Check,
  LayoutGrid,
  LoaderCircle,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  const [codigo, setCodigo] = useState("");
  const [statusNovo, setStatusNovo] = useState<EstandeStatus>("DISPONIVEL");
  const [editingId, setEditingId] = useState<string | null>(null);

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

  function resetForm() {
    setEditingId(null);
    setCodigo("");
    setStatusNovo("DISPONIVEL");
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    const ok = editingId
      ? await mutate(
          {
            action: "updateEstande",
            estandeId: editingId,
            codigo,
            status: statusNovo,
          },
          "Stand atualizado.",
        )
      : await mutate(
          {
            action: "createEstande",
            codigo,
            status: statusNovo,
          },
          "Stand cadastrado.",
        );
    if (ok) resetForm();
  }

  function startEdit(estande: AdminEstande) {
    setEditingId(estande.id);
    setCodigo(estande.codigo);
    setStatusNovo(estande.status === "OCUPADO" ? "OCUPADO" : estande.status);
  }

  async function onDelete(id: string) {
    if (!window.confirm("Excluir este stand?")) return;
    await mutate({ action: "deleteEstande", estandeId: id }, "Stand excluído.");
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-blue-gray">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        Carregando stands…
      </p>
    );
  }

  return (
    <Card className="border-cyan-electric/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="size-5 text-cyan-electric" aria-hidden />
          Stands
        </CardTitle>
        <p className="text-sm leading-6 text-blue-gray">
          Cadastre apenas o número do stand. Um QR Code único é gerado
          automaticamente para o avaliador escanear.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <form
          onSubmit={onSave}
          className="grid gap-3 rounded-2xl border border-dashed border-cyan-electric/25 bg-cyan-electric/[0.03] p-4 sm:grid-cols-[1fr_1fr_auto]"
        >
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
              disabled={editingId != null && statusNovo === "OCUPADO"}
            >
              <option value="DISPONIVEL">Disponível</option>
              <option value="INATIVO">Inativo</option>
              {statusNovo === "OCUPADO" ? (
                <option value="OCUPADO">Ocupado</option>
              ) : null}
            </select>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={busy}>
              {editingId ? (
                <>
                  <Check aria-hidden /> Salvar
                </>
              ) : (
                <>
                  <Plus aria-hidden /> Cadastrar
                </>
              )}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" onClick={resetForm}>
                <X aria-hidden />
              </Button>
            ) : null}
          </div>
        </form>

        {estandes.length === 0 ? (
          <p className="text-sm text-blue-gray">Nenhum stand cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {estandes.map((estande) => (
              <li
                key={estande.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3"
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
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Editar stand ${estande.codigo}`}
                    onClick={() => startEdit(estande)}
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
      </CardContent>
    </Card>
  );
}

export { AdminEstandesPanel };
