import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const sponsorInput = z.object({
  name: z.string().trim().min(1).max(200),
  tier: z.string().trim().max(40).nullable().optional(),
  logo_url: z.string().trim().max(1000).nullable().optional(),
  website: z.string().trim().max(500).nullable().optional(),
});

export type SponsorInput = z.infer<typeof sponsorInput>;

export type SponsorRow = {
  id: number;
  name: string;
  tier: string | null;
  logo_url: string | null;
  website: string | null;
  created_at: string;
};

export const listSponsors = createServerFn({ method: "GET" }).handler(
  async (): Promise<SponsorRow[]> => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, tier, logo_url, website,
             to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
      FROM sponsors ORDER BY id ASC
    `;
    return rows as unknown as SponsorRow[];
  },
);

export const createSponsor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => sponsorInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      INSERT INTO sponsors (name, tier, logo_url, website)
      VALUES (${data.name}, ${data.tier ?? null}, ${data.logo_url ?? null}, ${data.website ?? null})
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("sponsor.created", `Sponsor added: ${data.name}`, { id });
    return { id };
  });

export const updateSponsor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    sponsorInput.extend({ id: z.coerce.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`
      UPDATE sponsors
         SET name = ${data.name},
             tier = ${data.tier ?? null},
             logo_url = ${data.logo_url ?? null},
             website = ${data.website ?? null}
       WHERE id = ${data.id}
    `;
    await logActivity("sponsor.updated", `Sponsor #${data.id} updated`, { id: data.id });
    return { ok: true as const };
  });

export const deleteSponsor = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM sponsors WHERE id = ${data.id}`;
    await logActivity("sponsor.deleted", `Sponsor #${data.id} deleted`, { id: data.id });
    return { ok: true as const };
  });

export type PublicSponsor = {
  id: number;
  name: string;
  tier: string | null;
  logo_url: string | null;
  website: string | null;
};

export const listPublicSponsors = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicSponsor[]> => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, name, tier, logo_url, website
      FROM sponsors
      ORDER BY id ASC
    `;
    return rows as unknown as PublicSponsor[];
  },
);
