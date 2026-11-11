import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STATUSES = ["pending", "approved", "rejected", "active", "inactive"] as const;

const contestantInput = z.object({
  full_name: z.string().trim().min(1).max(120),
  age: z.number().int().min(16).max(60).nullable().optional(),
  province: z.string().trim().max(80).nullable().optional(),
  district: z.string().trim().max(80).nullable().optional(),
  biography: z.string().trim().max(4000).nullable().optional(),
  profile_photo: z.string().trim().max(1000).nullable().optional(),
  gallery_images: z.array(z.string().trim().max(1000)).max(20).optional(),
  social_links: z
    .object({
      facebook: z.string().trim().max(300).optional(),
      instagram: z.string().trim().max(300).optional(),
      twitter: z.string().trim().max(300).optional(),
      tiktok: z.string().trim().max(300).optional(),
    })
    .partial()
    .optional(),
  agri_project: z.string().trim().max(2000).nullable().optional(),
  education: z.string().trim().max(500).nullable().optional(),
  email: z.string().trim().max(200).email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().max(50).nullable().optional(),
  status: z.enum(STATUSES).default("pending"),
});

export type ContestantInput = z.infer<typeof contestantInput>;

export const listContestants = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT id, full_name, age, province, district, status, votes, profile_photo,
           to_char(created_at,'YYYY-MM-DD') AS created_at
    FROM contestants
    WHERE status <> 'past'
    ORDER BY id DESC
  `;


  return rows as unknown as Array<{
    id: number;
    full_name: string;
    age: number | null;
    province: string | null;
    district: string | null;
    status: string;
    votes: number;
    profile_photo: string | null;
    created_at: string;
  }>;
});

export const getContestant = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`SELECT * FROM contestants WHERE id = ${data.id} LIMIT 1`;
    const row = rows[0];
    if (!row) throw new Error("Contestant not found");
    return row as unknown as ContestantInput & { id: number; votes: number; created_at: string };
  });

export const createContestant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => contestantInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const gallery = data.gallery_images ?? [];
    const social = data.social_links ?? {};
    const rows = await sql`
      INSERT INTO contestants (
        full_name, age, province, district, biography, profile_photo,
        gallery_images, social_links, agri_project, education, email, phone, status
      ) VALUES (
        ${data.full_name}, ${data.age ?? null}, ${data.province ?? null}, ${data.district ?? null},
        ${data.biography ?? null}, ${data.profile_photo ?? null},
        ${sql.json(gallery as never)}, ${sql.json(social as never)},
        ${data.agri_project ?? null}, ${data.education ?? null},
        ${data.email || null}, ${data.phone ?? null}, ${data.status}
      ) RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("contestant.created", `Created contestant ${data.full_name}`, { id });
    return { id };
  });

export const updateContestant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.coerce.number().int().positive(), patch: contestantInput.partial() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const p = data.patch;
    await sql`
      UPDATE contestants SET
        full_name      = COALESCE(${p.full_name ?? null}, full_name),
        age            = ${p.age ?? null},
        province       = ${p.province ?? null},
        district       = ${p.district ?? null},
        biography      = ${p.biography ?? null},
        profile_photo  = ${p.profile_photo ?? null},
        gallery_images = ${p.gallery_images ? sql.json(p.gallery_images as never) : sql`gallery_images`},
        social_links   = ${p.social_links ? sql.json(p.social_links as never) : sql`social_links`},
        agri_project   = ${p.agri_project ?? null},
        education      = ${p.education ?? null},
        email          = ${p.email || null},
        phone          = ${p.phone ?? null},
        status         = COALESCE(${p.status ?? null}, status),
        updated_at     = NOW()
      WHERE id = ${data.id}
    `;
    await logActivity("contestant.updated", `Updated contestant #${data.id}`, { id: data.id });
    return { ok: true as const };
  });

export const deleteContestant = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM contestants WHERE id = ${data.id}`;
    await logActivity("contestant.deleted", `Deleted contestant #${data.id}`, { id: data.id });
    return { ok: true as const };
  });

export const setContestantStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.coerce.number().int().positive(), status: z.enum(STATUSES) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`UPDATE contestants SET status = ${data.status}, updated_at = NOW() WHERE id = ${data.id}`;
    await logActivity(`contestant.${data.status}`, `Set contestant #${data.id} to ${data.status}`, {
      id: data.id,
    });
    return { ok: true as const };
  });