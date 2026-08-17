import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { fileTypeFromBuffer } from "file-type";

import { featuredNotices, upcomingEvents } from "@/config/highlights";
import { partners } from "@/config/partners";
import { mapUsuarioRow } from "@/lib/auth";
import { assertFileIsClean } from "@/lib/clamav";
import { query, transaction, clientQuery, clientExecute } from "@/lib/db";
import { decryptFile, encryptFile } from "@/lib/encryption";
import { normalizeEventDate } from "@/lib/events";
import {
  formatRegistrationPeriod,
  mapNoticeRow,
  resolveNoticeStatus,
} from "@/lib/notices";
import type {
  ManagedNoticeDocument,
  SnctStore,
  StoredUser,
} from "@/lib/snct-types";
import type { RoleCodigo } from "@/lib/snct-types";

const maximumDocumentSize = 10 * 1024 * 1024;
const allowedDocumentTypes: Record<string, Set<string>> = {
  ".pdf": new Set(["application/pdf"]),
  ".doc": new Set(["application/x-cfb"]),
  ".xls": new Set(["application/x-cfb"]),
  ".docx": new Set([
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]),
  ".xlsx": new Set([
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ]),
  ".odt": new Set(["application/vnd.oasis.opendocument.text"]),
};

const defaultSettings = {
  eventEdition: "Paulista 2026",
  heroImageUrl: "/images/cienciasemfundo.png",
  palette: {
    background: "#10002b",
    surface: "#18003d",
    primary: "#6a00ff",
    secondary: "#ff2ed1",
    accent: "#00e5ff",
    text: "#f5f7ff",
  },
};

let domainSeeded = false;

async function ensureDomainSeeded() {
  if (domainSeeded) return;

  const existing = await query(
    "SELECT id FROM snct_site_settings WHERE id = 1 LIMIT 1",
  );
  if (existing.rowCount) {
    domainSeeded = true;
    return;
  }

  await transaction(async (client) => {
    try {
      await clientQuery(client, "SELECT GET_LOCK('snct-seed', 5)");
      const settings = await clientQuery(
        client,
        "SELECT id FROM snct_site_settings WHERE id = 1",
      );
      if (settings.rowCount) {
        domainSeeded = true;
        return;
      }

      await clientQuery(
        client,
        `INSERT INTO snct_site_settings (id, event_edition, hero_image_url)
         VALUES (1, $1, $2)`,
        [defaultSettings.eventEdition, defaultSettings.heroImageUrl],
      );

      for (const [index, event] of upcomingEvents.entries()) {
        await clientQuery(
          client,
          `INSERT INTO snct_events
            (id, event_date, event_time, title, location, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `event-${index + 1}`,
            event.date,
            event.time,
            event.title,
            event.location,
            index,
          ],
        );
      }

      for (const [index, notice] of featuredNotices.entries()) {
        await clientQuery(
          client,
          `INSERT INTO snct_notices
            (id, title, description, registration,
             registration_starts_at, registration_ends_at, form_url,
             status, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            `notice-${index + 1}`,
            notice.title,
            notice.description,
            formatRegistrationPeriod(
              notice.registrationStartsAt,
              notice.registrationEndsAt,
              notice.registration,
            ),
            notice.registrationStartsAt ?? null,
            notice.registrationEndsAt ?? null,
            notice.formUrl ?? "",
            resolveNoticeStatus({
              registrationStartsAt: notice.registrationStartsAt,
              registrationEndsAt: notice.registrationEndsAt,
              status: notice.status,
            }),
            index,
          ],
        );
      }

      for (const [index, partner] of partners.entries()) {
        await clientQuery(
          client,
          `INSERT INTO snct_partners (id, name, logo, sort_order)
           VALUES ($1, $2, $3, $4)`,
          [`partner-${index + 1}`, partner.name, partner.logo, index],
        );
      }
      domainSeeded = true;
    } finally {
      await clientQuery(client, "SELECT RELEASE_LOCK('snct-seed')").catch(
        () => undefined,
      );
    }
  });
}

async function readStore(client?: PoolConnection) {
  const run = <T extends RowDataPacket>(text: string, values: unknown[] = []) =>
    client ? clientQuery<T>(client, text, values) : query<T>(text, values);

  const [users, events, notices, documents, managedPartners, settings] =
    await Promise.all([
      run<{
        id: number;
        role_id: number;
        nome_completo: string;
        email: string;
        telefone: string;
        cpf: string;
        senha_hash: string;
        data_nascimento: Date | string;
        estado: string;
        cidade: string;
        foto: string | null;
        aceitou_direito_imagem: number | boolean;
        data_aceite_direito_imagem: Date | null;
        qr_code_hash: string;
        ativo: number | boolean;
        created_at: Date;
        role_codigo: RoleCodigo;
        role_nome: string;
      } & RowDataPacket>(`
        SELECT u.id, u.role_id, u.nome_completo, u.email, u.telefone, u.cpf,
               u.senha_hash, u.data_nascimento, u.estado, u.cidade, u.foto,
               u.aceitou_direito_imagem,
               u.data_aceite_direito_imagem, u.qr_code_hash, u.ativo, u.created_at,
               r.codigo AS role_codigo, r.nome AS role_nome
        FROM usuarios u
        INNER JOIN roles r ON r.id = u.role_id
        ORDER BY u.created_at ASC
      `),
      run<{
        id: string;
        event_date: string;
        event_time: string;
        title: string;
        location: string;
      } & RowDataPacket>(`
        SELECT id, event_date, event_time, title, location
        FROM snct_events ORDER BY sort_order, created_at
      `),
      run<{
        id: string;
        title: string;
        description: string | null;
        registration: string;
        registration_starts_at: Date | string | null;
        registration_ends_at: Date | string | null;
        form_url: string | null;
        status: "aberto" | "encerrado";
      } & RowDataPacket>(`
        SELECT id, title, description, registration,
               registration_starts_at, registration_ends_at, form_url, status
        FROM snct_notices ORDER BY sort_order, created_at
      `),
      run<{
        id: string;
        notice_id: string;
        original_name: string;
        storage_name: string;
        mime_type: string;
        byte_size: number;
      } & RowDataPacket>(`
        SELECT id, notice_id, original_name, storage_name, mime_type, byte_size
        FROM snct_notice_documents
        WHERE notice_id IS NOT NULL AND scan_status = 'clean'
        ORDER BY created_at
      `),
      run<{ id: string; name: string; logo: string; hidden: number | boolean } & RowDataPacket>(`
        SELECT id, name, logo, hidden FROM snct_partners ORDER BY sort_order, created_at
      `),
      run<{
        event_edition: string;
        hero_image_url: string;
        color_background: string;
        color_surface: string;
        color_primary: string;
        color_secondary: string;
        color_accent: string;
        color_text: string;
      } & RowDataPacket>(`
        SELECT event_edition, hero_image_url, color_background, color_surface,
               color_primary, color_secondary, color_accent, color_text
        FROM snct_site_settings WHERE id = 1
      `),
    ]);

  const publicUsers: StoredUser[] = users.rows.map((row) => mapUsuarioRow(row));

  return {
    users: publicUsers,
    events: events.rows.map((row) => ({
      id: row.id,
      date: normalizeEventDate(row.event_date) ?? row.event_date,
      time: row.event_time,
      title: row.title,
      location: row.location,
    })),
    notices: notices.rows.map((notice) => {
      const mapped = mapNoticeRow(notice);
      return {
        ...mapped,
        documents: documents.rows
          .filter((document) => document.notice_id === notice.id)
          .map((document) => ({
            id: document.id,
            name: document.original_name,
            storageName: document.storage_name,
            mimeType: document.mime_type,
            size: document.byte_size,
          })),
      };
    }),
    partners: managedPartners.rows.map((partner) => ({
      id: partner.id,
      name: partner.name,
      logo: partner.logo,
      hidden: Boolean(partner.hidden),
    })),
    settings: settings.rows[0]
      ? {
          eventEdition: settings.rows[0].event_edition,
          heroImageUrl: settings.rows[0].hero_image_url,
          palette: {
            background: settings.rows[0].color_background,
            surface: settings.rows[0].color_surface,
            primary: settings.rows[0].color_primary,
            secondary: settings.rows[0].color_secondary,
            accent: settings.rows[0].color_accent,
            text: settings.rows[0].color_text,
          },
        }
      : defaultSettings,
  } satisfies SnctStore;
}

export async function readSnctStore(): Promise<SnctStore> {
  await ensureDomainSeeded();
  return readStore();
}

async function deleteMissingIds(
  client: PoolConnection,
  table: string,
  ids: string[],
) {
  if (ids.length === 0) {
    await clientExecute(client, `DELETE FROM ${table}`);
    return;
  }
  const placeholders = ids.map((_, index) => `$${index + 1}`).join(", ");
  await clientExecute(
    client,
    `DELETE FROM ${table} WHERE id NOT IN (${placeholders})`,
    ids,
  );
}

async function syncContent(client: PoolConnection, store: SnctStore) {
  for (const [index, event] of store.events.entries()) {
    await clientQuery(
      client,
      `INSERT INTO snct_events
        (id, event_date, event_time, title, location, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON DUPLICATE KEY UPDATE
         event_date = VALUES(event_date), event_time = VALUES(event_time),
         title = VALUES(title), location = VALUES(location),
         sort_order = VALUES(sort_order), updated_at = now()`,
      [event.id, normalizeEventDate(event.date) ?? event.date, event.time, event.title, event.location, index],
    );
  }
  await deleteMissingIds(
    client,
    "snct_events",
    store.events.map((event) => event.id),
  );

  for (const [index, notice] of store.notices.entries()) {
    const status = resolveNoticeStatus(notice);
    const registration = formatRegistrationPeriod(
      notice.registrationStartsAt,
      notice.registrationEndsAt,
      notice.registration,
    );
    await clientQuery(
      client,
      `INSERT INTO snct_notices
        (id, title, description, registration,
         registration_starts_at, registration_ends_at, form_url,
         status, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON DUPLICATE KEY UPDATE
         title = VALUES(title), description = VALUES(description),
         registration = VALUES(registration),
         registration_starts_at = VALUES(registration_starts_at),
         registration_ends_at = VALUES(registration_ends_at),
         form_url = VALUES(form_url), status = VALUES(status),
         sort_order = VALUES(sort_order), updated_at = now()`,
      [
        notice.id,
        notice.title,
        notice.description ?? "",
        registration,
        notice.registrationStartsAt ?? null,
        notice.registrationEndsAt ?? null,
        notice.formUrl ?? "",
        status,
        index,
      ],
    );
    for (const document of notice.documents) {
      await clientQuery(
        client,
        "UPDATE snct_notice_documents SET notice_id = $1 WHERE id = $2",
        [notice.id, document.id],
      );
    }
  }
  await deleteMissingIds(
    client,
    "snct_notices",
    store.notices.map((notice) => notice.id),
  );

  for (const [index, partner] of store.partners.entries()) {
    await clientQuery(
      client,
      `INSERT INTO snct_partners
        (id, name, logo, hidden, sort_order, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name), logo = VALUES(logo),
         hidden = VALUES(hidden),
         sort_order = VALUES(sort_order), updated_at = now()`,
      [
        partner.id,
        partner.name,
        partner.logo,
        partner.hidden ? 1 : 0,
        index,
      ],
    );
  }
  await deleteMissingIds(
    client,
    "snct_partners",
    store.partners.map((partner) => partner.id),
  );

  await clientQuery(
    client,
    `UPDATE snct_site_settings
     SET event_edition = $1, hero_image_url = $2, color_background = $3,
         color_surface = $4, color_primary = $5, color_secondary = $6,
         color_accent = $7, color_text = $8, updated_at = now()
     WHERE id = 1`,
    [
      store.settings.eventEdition,
      store.settings.heroImageUrl,
      store.settings.palette.background,
      store.settings.palette.surface,
      store.settings.palette.primary,
      store.settings.palette.secondary,
      store.settings.palette.accent,
      store.settings.palette.text,
    ],
  );
}

export async function updateSnctStore<T>(
  mutate: (store: SnctStore) => T | Promise<T>,
): Promise<T> {
  await ensureDomainSeeded();
  return transaction(async (client) => {
    try {
      await clientQuery(client, "SELECT GET_LOCK('snct-store', 5)");
      const store = await readStore(client);
      const result = await mutate(store);
      await syncContent(client, store);
      return result;
    } finally {
      await clientQuery(client, "SELECT RELEASE_LOCK('snct-store')").catch(
        () => undefined,
      );
    }
  });
}

export async function saveNoticeDocument(
  file: File,
): Promise<ManagedNoticeDocument> {
  const originalName = path.basename(file.name).slice(0, 140);
  const extension = path.extname(originalName).toLowerCase();
  if (
    !originalName ||
    !allowedDocumentTypes[extension] ||
    file.size < 1 ||
    file.size > maximumDocumentSize
  ) {
    throw new Error(
      "Use um arquivo PDF, DOC, DOCX, ODT, XLS ou XLSX de até 10 MB.",
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const detected = await fileTypeFromBuffer(buffer);
  const mimeType = detected?.mime ?? "";
  if (!allowedDocumentTypes[extension].has(mimeType)) {
    throw new Error(
      "O conteúdo do arquivo não corresponde à extensão informada.",
    );
  }

  await assertFileIsClean(buffer);

  const id = `document-${randomUUID()}`;
  const storageName = `${id}${extension}`;
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const encrypted = encryptFile(buffer);
  await query(
    `INSERT INTO snct_notice_documents
      (id, original_name, storage_name, mime_type, byte_size, sha256,
       scan_status, encryption_iv, encryption_tag, encryption_key_version,
       file_data)
     VALUES ($1, $2, $3, $4, $5, $6, 'clean', $7, $8, $9, $10)`,
    [
      id,
      originalName,
      storageName,
      mimeType,
      buffer.byteLength,
      sha256,
      encrypted.iv,
      encrypted.tag,
      encrypted.keyVersion,
      encrypted.encrypted,
    ],
  );

  return {
    id,
    name: originalName,
    storageName,
    mimeType,
    size: buffer.byteLength,
  };
}

export async function readNoticeDocument(storageName: string) {
  if (!/^[a-z0-9._-]+$/i.test(storageName)) {
    throw new Error("Nome de arquivo inválido.");
  }
  const result = await query<{
    file_data: Buffer;
    encryption_iv: Buffer;
    encryption_tag: Buffer;
    encryption_key_version: number;
  } & RowDataPacket>(
    `SELECT file_data, encryption_iv, encryption_tag, encryption_key_version
     FROM snct_notice_documents
     WHERE storage_name = $1 AND scan_status = 'clean'`,
    [storageName],
  );
  if (!result.rows[0]) throw new Error("Arquivo não encontrado.");
  const file = result.rows[0];
  return decryptFile(
    file.file_data,
    file.encryption_iv,
    file.encryption_tag,
    file.encryption_key_version,
  );
}

export async function deleteNoticeDocumentFile(storageName: string) {
  if (!/^[a-z0-9._-]+$/i.test(storageName)) return;
  await query("DELETE FROM snct_notice_documents WHERE storage_name = $1", [
    storageName,
  ]);
}

export async function rotateVisitorQr(userId: string) {
  const visitorHash = randomUUID().replaceAll("-", "") + randomUUID().replaceAll("-", "");
  await query(
    `UPDATE usuarios SET qr_code_hash = $2, updated_at = NOW(3) WHERE id = $1`,
    [userId, visitorHash],
  );
  return {
    visitorHash,
    qrCodeHash: visitorHash,
    qrExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
