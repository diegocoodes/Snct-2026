"use client";

import { FormEvent, useEffect, useState } from "react";
import { Gamepad2, LoaderCircle, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { secureFetch } from "@/lib/secure-fetch";

type GameField = {
  id: string;
  label: string;
  type: "text" | "email" | "number" | "select" | "textarea" | "checkbox";
  required: boolean;
  options: string[];
};

type GameForm = {
  title: string;
  description: string | null;
  fields: GameField[];
};

function GameFormClient({ slug }: { slug: string }) {
  const [form, setForm] = useState<GameForm | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    void secureFetch(`/api/formularios/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        const data = (await response.json()) as {
          form?: GameForm;
          error?: string;
        };
        if (!response.ok || !data.form) {
          setError(data.error ?? "Formulário não encontrado.");
          return;
        }
        setForm(data.form);
      })
      .catch(() => setError("Não foi possível carregar o formulário."));
  }, [slug]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const data = new FormData(event.currentTarget);
    const answers = Object.fromEntries(
      form.fields.map((field) => [
        field.id,
        field.type === "checkbox" ? data.get(field.id) === "on" : data.get(field.id),
      ]),
    );
    setBusy(true);
    setError("");
    const response = await secureFetch(
      `/api/formularios/${encodeURIComponent(slug)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      },
    );
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Não foi possível enviar.");
      return;
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center px-5 py-12">
      <Card className="w-full max-w-2xl border-cyan-electric/20">
        <CardHeader>
          <Gamepad2 className="size-9 text-cyan-electric" aria-hidden />
          <CardTitle className="mt-3 text-2xl">
            {form?.title ?? "Formulário de games"}
          </CardTitle>
          {form?.description ? (
            <p className="text-sm leading-6 text-blue-gray">
              {form.description}
            </p>
          ) : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <p role="alert" className="mb-4 text-sm text-red-300">
              {error}
            </p>
          ) : null}
          {sent ? (
            <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-5 text-emerald-200">
              Resposta enviada com sucesso.
            </p>
          ) : form ? (
            <form className="space-y-5" onSubmit={submit}>
              {form.fields.map((field) => (
                <div key={field.id} className="space-y-2">
                  {field.type === "checkbox" ? (
                    <label className="flex items-start gap-3 text-sm text-ice-white">
                      <input
                        name={field.id}
                        type="checkbox"
                        required={field.required}
                      />
                      {field.label}
                    </label>
                  ) : (
                    <>
                      <Label htmlFor={field.id}>{field.label}</Label>
                      {field.type === "textarea" ? (
                        <Textarea
                          id={field.id}
                          name={field.id}
                          required={field.required}
                        />
                      ) : field.type === "select" ? (
                        <select
                          id={field.id}
                          name={field.id}
                          required={field.required}
                          className="h-11 w-full rounded-xl border border-input bg-[#111329] px-3 text-sm text-ice-white"
                        >
                          <option value="">Selecione</option>
                          {field.options.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Input
                          id={field.id}
                          name={field.id}
                          type={field.type}
                          required={field.required}
                        />
                      )}
                    </>
                  )}
                </div>
              ))}
              <Button type="submit" variant="glow" disabled={busy}>
                {busy ? (
                  <LoaderCircle className="animate-spin" aria-hidden />
                ) : (
                  <Send aria-hidden />
                )}
                Enviar formulário
              </Button>
            </form>
          ) : (
            <p className="text-sm text-blue-gray">Carregando formulário…</p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

export { GameFormClient };
