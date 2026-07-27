import { Suspense } from "react";
import { redirect } from "next/navigation";

import { AvaliadorPanel } from "@/components/avaliador/avaliador-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AvaliadorAvaliarPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "avaliador" && session.role !== "admin") {
    redirect("/perfil");
  }

  return (
    <DashboardShell session={session}>
      <Suspense fallback={<p className="text-blue-gray">Carregando…</p>}>
        <AvaliadorPanel />
      </Suspense>
    </DashboardShell>
  );
}
