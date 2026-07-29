"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  PencilLine,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import {
  AdminListPagination,
  AdminListSearch,
  useFilteredPagination,
} from "@/components/dashboard/admin-list-toolbar";
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
import { InputMask } from "@/components/ui/input-mask";
import { Label } from "@/components/ui/label";
import { ROLE_LABELS } from "@/lib/roles-constants";
import { ESTADOS_BRASIL } from "@/lib/estados-brasil";
import type { PublicUser, UserRole } from "@/lib/snct-types";
import { secureFetch } from "@/lib/secure-fetch";

const roleSelectClassName =
  "h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

const roleOptions: { value: UserRole; label: string }[] = [
  { value: "staff", label: "Staff" },
  { value: "admin", label: "Administrador" },
  { value: "visitante", label: "Visitante" },
  { value: "aluno", label: "Aluno" },
  { value: "avaliador", label: "Avaliador" },
  { value: "professor", label: "Professor" },
  { value: "participante", label: "Participante" },
];

function formatCpfDisplay(cpf?: string) {
  const digits = (cpf ?? "").replace(/\D/g, "").slice(0, 11);
  if (digits.length !== 11) return cpf ?? "";
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function formatPhoneDisplay(telefone?: string) {
  const digits = (telefone ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return telefone ?? "";
}

function filterUser(user: PublicUser, query: string) {
  const haystack = [
    user.name,
    user.email,
    user.cpf,
    user.telefone,
    user.role,
    ROLE_LABELS[user.role] ?? "",
  ]
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function AdminUsuariosPanel({ users }: { users: PublicUser[] }) {
  const router = useRouter();
  const [busyAction, setBusyAction] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PublicUser | null>(null);
  const [creating, setCreating] = useState(false);
  const filterFn = useCallback(filterUser, []);
  const list = useFilteredPagination({ items: users, filterFn });

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setDialogOpen(true);
  }

  function openEdit(user: PublicUser) {
    setCreating(false);
    setEditing(user);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditing(null);
    setCreating(false);
  }

  async function mutate(
    payload: Record<string, unknown>,
    successMessage: string,
  ) {
    const actionKey = `${payload.action}-${payload.userId ?? payload.id ?? "new"}`;
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
      closeDialog();
      router.refresh();
    }
    setBusyAction("");
    return response.ok;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    if (creating) {
      await mutate({ action: "createUser", ...payload }, "Usuário criado.");
      return;
    }
    if (!editing) return;
    const password = String(payload.password ?? "").trim();
    await mutate(
      {
        action: "updateUser",
        userId: editing.id,
        name: payload.name,
        email: payload.email,
        cpf: payload.cpf,
        telefone: payload.telefone,
        role: payload.role,
        dataNascimento: payload.dataNascimento,
        estado: payload.estado,
        cidade: payload.cidade,
        ...(password ? { password } : {}),
      },
      "Perfil atualizado.",
    );
  }

  const formKey = creating ? "new" : (editing?.id ?? "closed");
  const saving =
    busyAction === `createUser-new` ||
    busyAction === `updateUser-${editing?.id ?? ""}`;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="size-5 text-cyan-electric" aria-hidden />
              Usuários cadastrados
            </CardTitle>
            <p className="mt-1 text-sm text-blue-gray">
              {users.length} conta(s). Clique em editar para abrir o perfil.
            </p>
          </div>
          <Button type="button" onClick={openCreate}>
            <Plus aria-hidden /> Criar usuário
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <AdminListSearch
            query={list.query}
            onQueryChange={list.setQuery}
            placeholder="Buscar por nome, e-mail, CPF ou perfil…"
            resultLabel={`${list.filteredCount} resultado(s)`}
          />
          {list.pageItems.length ? (
            <ul className="divide-y divide-white/10">
              {list.pageItems.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 rounded-xl text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-electric sm:px-2 sm:py-1"
                    onClick={() => openEdit(user)}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-ice-white">{user.name}</p>
                      <Badge
                        variant="outline"
                        className={
                          user.role === "staff" || user.role === "admin"
                            ? "border-purple-vibrant/30 bg-purple-vibrant/10 text-[#BDA5FF]"
                            : "border-cyan-electric/30 bg-cyan-electric/10 text-cyan-electric"
                        }
                      >
                        {ROLE_LABELS[user.role] ?? user.role}
                      </Badge>
                      {user.checkedInAt ? (
                        <Badge className="bg-emerald-500/15 text-emerald-300">
                          Check-in
                        </Badge>
                      ) : null}
                      {user.ativo === false ? (
                        <Badge variant="outline">Inativo</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-blue-gray">
                      {user.email}
                      {user.age ? ` · ${user.age} anos` : ""}
                    </p>
                  </button>
                  <div className="flex flex-wrap gap-2 sm:shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEdit(user)}
                    >
                      <PencilLine aria-hidden /> Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={
                        busyAction === `deleteUser-${user.id}` ||
                        user.role === "admin"
                      }
                      onClick={() => {
                        if (window.confirm(`Excluir ${user.name}?`)) {
                          void mutate(
                            { action: "deleteUser", userId: user.id },
                            "Usuário excluído.",
                          );
                        }
                      }}
                    >
                      <Trash2 aria-hidden /> Excluir
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-xl border border-dashed border-white/15 p-6 text-center text-sm text-blue-gray">
              {users.length
                ? "Nenhum usuário encontrado para esta busca."
                : "Nenhum usuário cadastrado ainda."}
            </p>
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
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {creating ? "Criar usuário" : "Editar perfil"}
            </DialogTitle>
            <DialogDescription>
              {creating
                ? "Cadastre visitantes ou delegue acesso à equipe."
                : `Atualize os dados de ${editing?.name ?? "usuário"}.`}
            </DialogDescription>
          </DialogHeader>

          <form key={formKey} className="grid gap-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="user-name">Nome</Label>
              <Input
                id="user-name"
                name="name"
                required
                defaultValue={editing?.name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-email">E-mail</Label>
              <Input
                id="user-email"
                name="email"
                type="email"
                required
                defaultValue={editing?.email ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-cpf">CPF</Label>
                <InputMask
                  id="user-cpf"
                  name="cpf"
                  mask="cpf"
                  required
                  defaultValue={formatCpfDisplay(editing?.cpf)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-telefone">Telefone</Label>
                <InputMask
                  id="user-telefone"
                  name="telefone"
                  mask="phone"
                  required
                  defaultValue={formatPhoneDisplay(editing?.telefone)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-role">Perfil</Label>
                <select
                  id="user-role"
                  name="role"
                  defaultValue={editing?.role ?? "staff"}
                  className={roleSelectClassName}
                  required
                >
                  {roleOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="user-birth">Data de nascimento</Label>
                <Input
                  id="user-birth"
                  name="dataNascimento"
                  type="date"
                  required
                  defaultValue={editing?.dataNascimento ?? ""}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="user-estado">Estado</Label>
                <select
                  id="user-estado"
                  name="estado"
                  required
                  defaultValue={editing?.estado ?? ""}
                  className={roleSelectClassName}
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
              <div className="space-y-2">
                <Label htmlFor="user-cidade">Cidade</Label>
                <Input
                  id="user-cidade"
                  name="cidade"
                  required
                  minLength={2}
                  maxLength={120}
                  defaultValue={editing?.cidade ?? ""}
                  placeholder="Digite a cidade"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-password">
                {creating ? "Senha temporária" : "Nova senha (opcional)"}
              </Label>
              <Input
                id="user-password"
                name="password"
                type="password"
                minLength={creating ? 12 : undefined}
                maxLength={128}
                required={creating}
              />
              <p className="text-xs text-blue-gray">
                {creating
                  ? "Mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo."
                  : "Deixe em branco para manter a senha atual."}
              </p>
            </div>

            <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : creating ? (
                  <Plus aria-hidden />
                ) : (
                  <PencilLine aria-hidden />
                )}
                {creating ? "Criar usuário" : "Salvar perfil"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AdminUsuariosPanel };
