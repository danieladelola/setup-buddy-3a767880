import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const CATEGORIES = ["photo", "video", "gallery", "press", "download"] as const;

const mediaInput = z.object({
  title: z.string().trim().max(160).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  url: z.string().trim().min(1).max(1000),
  kind: z.string().trim().max(40).default("image"),
  category: z.enum(CATEGORIES).default("photo"),
  mime_type: z.string().trim().max(80).nullable().optional(),
  file_size: z.number().int().nonnegative().nullable().optional(),
});

export type MediaInput = z.infer<typeof mediaInput>;

export const listMedia = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT id, title, description, url, kind, category, mime_type, file_size,
           to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
    FROM media_assets ORDER BY id DESC
  `;
  return rows as unknown as Array<{
    id: number; title: string | null; description: string | null;
    url: string; kind: string; category: string;
    mime_type: string | null; file_size: number | null; created_at: string;
  }>;
});

export const createMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => mediaInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const kind =
      data.kind ||
      (data.category === "video" ? "video" : data.category === "download" ? "file" : "image");
    const rows = await sql`
      INSERT INTO media_assets (title, description, url, kind, category, mime_type, file_size)
      VALUES (${data.title ?? null}, ${data.description ?? null}, ${data.url},
              ${kind}, ${data.category}, ${data.mime_type ?? null}, ${data.file_size ?? null})
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("media.created", `Media added: ${data.title ?? data.url}`, { id });
    return { id };
  });

export const deleteMedia = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM media_assets WHERE id = ${data.id}`;
    await logActivity("media.deleted", `Media #${data.id} deleted`, { id: data.id });
    return { ok: true as const };
  });

const pressInput = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().max(20000).nullable().optional(),
  published_at: z.string().nullable().optional(),
});

export type PressInput = z.infer<typeof pressInput>;

export const listPress = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT id, title,
           to_char(published_at,'YYYY-MM-DD') AS published_at,
           to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
    FROM press_releases ORDER BY id DESC
  `;
  return rows as unknown as Array<{
    id: number; title: string; published_at: string | null; created_at: string;
  }>;
});

export const createPress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => pressInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      INSERT INTO press_releases (title, body, published_at)
      VALUES (${data.title}, ${data.body ?? null}, ${data.published_at || null})
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("press.created", `Press release: ${data.title}`, { id });
    return { id };
  });

export const deletePress = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM press_releases WHERE id = ${data.id}`;
    await logActivity("press.deleted", `Press release #${data.id} deleted`, { id: data.id });
    return { ok: true as const };
  });