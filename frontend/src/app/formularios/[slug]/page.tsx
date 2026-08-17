import { GameFormClient } from "@/components/forms/game-form-client";

export default async function GameFormPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <GameFormClient slug={slug} />;
}
