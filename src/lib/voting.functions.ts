import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STATUSES = ["draft", "active", "paused", "ended"] as const;

const campaignInput = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).nullable().optional(),
  starts_at: z.string().nullable().optional(),
  ends_at: z.string().nullable().optional(),
  price_per_vote: z.number().nonnegative().default(0),
  status: z.enum(STATUSES).default("draft"),
});

export type CampaignInput = z.infer<typeof campaignInput>;

export const listCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT c.id, c.name, c.description, c.status, c.price_per_vote::float AS price_per_vote,
           to_char(c.starts_at,'YYYY-MM-DD"T"HH24:MI') AS starts_at,
           to_char(c.ends_at,'YYYY-MM-DD"T"HH24:MI')   AS ends_at,
           COALESCE((SELECT COUNT(*) FROM votes v WHERE v.campaign_id = c.id AND v.status='valid'),0)::int AS valid_votes,
           COALESCE((SELECT COUNT(*) FROM votes v WHERE v.campaign_id = c.id AND v.status<>'valid'),0)::int AS flagged_votes,
           COALESCE((SELECT SUM(amount) FROM votes v WHERE v.campaign_id = c.id AND v.status='valid'),0)::float AS revenue
    FROM campaigns c
    ORDER BY c.id DESC
  `;
  return rows as unknown as Array<{
    id: number; name: string; description: string | null; status: string; price_per_vote: number;
    starts_at: string | null; ends_at: string | null;
    valid_votes: number; flagged_votes: number; revenue: number;
  }>;
});

export const createCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => campaignInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      INSERT INTO campaigns (name, description, starts_at, ends_at, price_per_vote, status)
      VALUES (${data.name}, ${data.description ?? null},
        ${data.starts_at || null}, ${data.ends_at || null},
        ${data.price_per_vote}, ${data.status})
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("campaign.created", `Campaign created: ${data.name}`, { id });
    return { id };
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    campaignInput.extend({ id: z.coerce.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    if (data.starts_at && data.ends_at && data.ends_at <= data.starts_at) {
      throw new Error("End time must be after the start time.");
    }
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`
      UPDATE campaigns SET name = ${data.name}, description = ${data.description ?? null},
        starts_at = ${data.starts_at || null}, ends_at = ${data.ends_at || null},
        price_per_vote = ${data.price_per_vote}, status = ${data.status}
      WHERE id = ${data.id}
    `;
    await logActivity("campaign.updated", `Campaign updated: ${data.name}`, { id: data.id });
    return { ok: true as const };
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
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
    await sql`UPDATE campaigns SET status = ${data.status} WHERE id = ${data.id}`;
    await logActivity(`campaign.${data.status}`, `Campaign #${data.id} -> ${data.status}`, { id: data.id });
    return { ok: true as const };
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM campaigns WHERE id = ${data.id}`;
    await logActivity("campaign.deleted", `Campaign #${data.id} deleted`, { id: data.id });
    return { ok: true as const };
  });

export const detectDuplicates = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema, logActivity } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  // Mark votes as duplicate when same (contestant_id, voter_ip|voter_email) appears more than once, keep first.
  const res = await sql`
    WITH ranked AS (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY contestant_id, COALESCE(voter_email, voter_ip)
               ORDER BY created_at ASC
             ) AS rn
      FROM votes
      WHERE voter_ip IS NOT NULL OR voter_email IS NOT NULL
    )
    UPDATE votes v
    SET status = 'duplicate'
    FROM ranked r
    WHERE v.id = r.id AND r.rn > 1 AND v.status = 'valid'
    RETURNING v.id
  `;
  const n = (res as unknown as { id: number }[]).length;
  await logActivity("voting.dedup", `Marked ${n} votes as duplicates`, { count: n });
  return { flagged: n };
});

export const getVotingReports = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();

  const [perContestant, perProvince, daily, revenue, fraud] = await Promise.all([
    sql`
      SELECT c.id, c.full_name, COUNT(v.id)::int AS votes,
             COALESCE(SUM(v.amount),0)::float AS revenue
      FROM contestants c
      LEFT JOIN votes v ON v.contestant_id = c.id AND v.status = 'valid'
      GROUP BY c.id, c.full_name
      ORDER BY votes DESC
      LIMIT 20
    `,
    sql`
      SELECT COALESCE(c.province,'Unassigned') AS province, COUNT(v.id)::int AS votes
      FROM contestants c
      LEFT JOIN votes v ON v.contestant_id = c.id AND v.status = 'valid'
      GROUP BY 1 ORDER BY votes DESC
    `,
    sql`
      SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day,
             COUNT(*) FILTER (WHERE status='valid')::int AS valid,
             COUNT(*) FILTER (WHERE status<>'valid')::int AS flagged,
             COALESCE(SUM(amount) FILTER (WHERE status='valid'),0)::float AS revenue
      FROM votes
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,
    sql`SELECT COALESCE(SUM(amount),0)::float AS total FROM votes WHERE status = 'valid'`,
    sql`
      SELECT
        COUNT(*) FILTER (WHERE status='valid')::int AS valid,
        COUNT(*) FILTER (WHERE status='duplicate')::int AS duplicate,
        COUNT(*) FILTER (WHERE status='flagged')::int AS flagged
      FROM votes
    `,
  ]);

  return {
    perContestant: perContestant as unknown as Array<{ id: number; full_name: string; votes: number; revenue: number }>,
    perProvince: perProvince as unknown as Array<{ province: string; votes: number }>,
    daily: daily as unknown as Array<{ day: string; valid: number; flagged: number; revenue: number }>,
    revenueTotal: ((revenue as unknown as { total: number }[])[0]).total,
    fraud: (fraud as unknown as { valid: number; duplicate: number; flagged: number }[])[0],
  };
});