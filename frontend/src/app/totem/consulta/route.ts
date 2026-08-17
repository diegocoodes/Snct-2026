import {
  getUsuarioByQrHash,
  registrarCheckin,
} from "@/lib/checkins";
import {
  enforceRateLimit,
  securityErrorResponse,
} from "@/lib/request-security";

export async function GET(request: Request) {
  try {
    await enforceRateLimit({
      request,
      scope: "totem-public-lookup",
      limit: 40,
      windowSeconds: 60,
    });

    const qrCodeHash = new URL(request.url).searchParams
      .get("qr")
      ?.trim()
      .slice(0, 255);

    if (!qrCodeHash) {
      return Response.json({ error: "QR Code inválido." }, { status: 400 });
    }

    const person = await getUsuarioByQrHash(qrCodeHash);
    if (!person) {
      return Response.json(
        { error: "Pessoa não encontrada." },
        { status: 404 },
      );
    }

    if (!person.ativo) {
      return Response.json({ error: "Usuário inativo." }, { status: 403 });
    }

    const checkin = await registrarCheckin({
      usuarioId: person.id,
      metodo: "QRCODE",
      realizadoPorUsuarioId: person.id,
      request,
    });

    // Já fez check-in hoje: ainda libera a tela de sucesso e a impressão.
    if (!checkin.ok && checkin.status !== 409) {
      return Response.json(
        { error: checkin.error ?? "Não foi possível registrar o check-in." },
        { status: checkin.status },
      );
    }

    return Response.json({
      usuario: {
        id: person.id,
        nomeCompleto: person.nomeCompleto,
        roleNome: person.roleNome,
        checkinHoje: true,
        jaRegistrado: checkin.ok === false && checkin.status === 409,
      },
    });
  } catch (error) {
    return securityErrorResponse(error);
  }
}
