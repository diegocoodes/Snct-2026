import { AuthFrame } from "@/components/auth/auth-frame";
import { FormularioArenaTime } from "@/components/forms/formulario-arena-time";

export default function Page() {
  return (
    <AuthFrame
      wide
      eyebrow="Arena Gamer"
      title="Inscrição de time"
      description="Cadastre os 5 integrantes do time em League of Legends, Valorant ou Free Fire. Quem ainda não tiver conta será criado como Participante."
    >
      <FormularioArenaTime />
    </AuthFrame>
  );
}
