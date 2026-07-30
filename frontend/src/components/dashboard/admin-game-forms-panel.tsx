"use client";

import { useEffect, useState } from "react";
import { Copy, FilePlus2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { secureFetch } from "@/lib/secure-fetch";

type FieldType =
  | "text"
  | "email"
  | "number"
  | "select"
  | "textarea"
  | "checkbox";

type GameField = {
  id: string;
  label: string;
  type: FieldType;
  required: boolean;
  options: string[];
};

type GameForm = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  fields: GameField[];
};

const selectClassName =
  "h-11 rounded-xl border border-input bg-[#111329] px-3 text-sm text-ice-white outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30";

function AdminGameFormsPanel() {
  const [forms, setForms] = useState<GameForm[]>([]);
  const [fields, setFields] = useState<GameField[]>([
    {
      id: crypto.randomUUID(),
      label: "Nome do jogador",
      type: "text",
      required: true,
      options: [],
    },
  ]);
  const [busy, setBusy] = useState(false);

  async function load() {
    const response = await secureFetch("/api/admin?resource=game-forms");
    const data = (await response.json()) as { forms?: GameForm[] };
    if (response.ok) setForms(data.forms ?? []);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  function updateField(id: string, patch: Partial<GameField>) {
    setFields((current) =>
      current.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="border-cyan-electric/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FilePlus2 className="size-5 text-cyan-electric" aria-hidden />
            Criar formulário para games
          </CardTitle>
          <p className="text-sm text-blue-gray">
            Monte a estrutura adicionando campos, escolhendo o tipo e definindo
            quais respostas são obrigatórias.
          </p>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-5"
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              setBusy(true);
              const response = await secureFetch("/api/admin", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "saveGameForm",
                  title: form.get("title"),
                  slug: form.get("slug"),
                  description: form.get("description"),
                  fields,
                }),
              });
              const data = (await response.json()) as { error?: string };
              setBusy(false);
              if (!response.ok) {
                toast.error(data.error ?? "Não foi possível criar o formulário.");
                return;
              }
              toast.success("Formulário de games criado.");
              event.currentTarget.reset();
              setFields([
                {
                  id: crypto.randomUUID(),
                  label: "Nome do jogador",
                  type: "text",
                  required: true,
                  options: [],
                },
              ]);
              await load();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="game-form-title">Nome do formulário</Label>
                <Input id="game-form-title" name="title" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="game-form-slug">Identificador/URL</Label>
                <Input
                  id="game-form-slug"
                  name="slug"
                  placeholder="torneio-de-free-fire"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="game-form-description">Descrição</Label>
              <Textarea id="game-form-description" name="description" rows={3} />
            </div>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 md:grid-cols-[1fr_10rem_auto_auto] md:items-end"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor={`${field.id}-label`}>
                      Campo {index + 1}
                    </Label>
                    <Input
                      id={`${field.id}-label`}
                      value={field.label}
                      onChange={(event) =>
                        updateField(field.id, { label: event.target.value })
                      }
                      placeholder="Ex.: Nick no jogo"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`${field.id}-type`}>Tipo</Label>
                    <select
                      id={`${field.id}-type`}
                      className={selectClassName}
                      value={field.type}
                      onChange={(event) =>
                        updateField(field.id, {
                          type: event.target.value as FieldType,
                        })
                      }
                    >
                      <option value="text">Texto</option>
                      <option value="email">E-mail</option>
                      <option value="number">Número</option>
                      <option value="select">Lista</option>
                      <option value="textarea">Texto longo</option>
                      <option value="checkbox">Confirmação</option>
                    </select>
                  </div>
                  <label className="flex h-11 items-center gap-2 text-sm text-blue-gray">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) =>
                        updateField(field.id, {
                          required: event.target.checked,
                        })
                      }
                    />
                    Obrigatório
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover campo ${index + 1}`}
                    disabled={fields.length === 1}
                    onClick={() =>
                      setFields((current) =>
                        current.filter((item) => item.id !== field.id),
                      )
                    }
                  >
                    <Trash2 aria-hidden />
                  </Button>
                  {field.type === "select" ? (
                    <div className="space-y-1.5 md:col-span-4">
                      <Label htmlFor={`${field.id}-options`}>
                        Opções separadas por vírgula
                      </Label>
                      <Input
                        id={`${field.id}-options`}
                        value={field.options.join(", ")}
                        onChange={(event) =>
                          updateField(field.id, {
                            options: event.target.value
                              .split(",")
                              .map((item) => item.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFields((current) => [
                    ...current,
                    {
                      id: crypto.randomUUID(),
                      label: "",
                      type: "text",
                      required: false,
                      options: [],
                    },
                  ])
                }
              >
                <Plus aria-hidden /> Adicionar campo
              </Button>
              <Button type="submit" variant="glow" disabled={busy}>
                <Save aria-hidden /> Criar formulário
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formulários criados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {forms.length ? (
            forms.map((form) => (
              <div
                key={form.id}
                className="rounded-xl border border-white/10 bg-white/[0.025] p-4"
              >
                <p className="font-semibold text-ice-white">{form.title}</p>
                <p className="mt-1 text-xs text-blue-gray">
                  {form.fields.length} campo(s) · /formularios/{form.slug}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      void navigator.clipboard.writeText(
                        `${window.location.origin}/formularios/${form.slug}`,
                      );
                      toast.success("Link copiado.");
                    }}
                  >
                    <Copy aria-hidden /> Copiar link
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="destructive"
                    aria-label={`Excluir ${form.title}`}
                    onClick={async () => {
                      if (!window.confirm(`Excluir “${form.title}”?`)) return;
                      await secureFetch("/api/admin", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "deleteGameForm",
                          id: form.id,
                        }),
                      });
                      await load();
                    }}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-blue-gray">
              Nenhum formulário de games criado.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export { AdminGameFormsPanel };
