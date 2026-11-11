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
           COALESCE((SELECT SUM(quantity) FROM votes v WHERE v.campaign_id = c.id AND v.status='valid'),0)::int AS valid_votes,
           COALESCE((SELECT COUNT(*) FROM votes v WHERE v.campaign_id = c.id AND v.status IN ('duplicate','flagged','review')),0)::int AS flagged_votes,
           COALESCE((SELECT COUNT(*) FROM votes v WHERE v.campaign_id = c.id AND v.status='pending'),0)::int AS pending_payments,
           COALESCE((SELECT SUM(amount) FROM votes v WHERE v.campaign_id = c.id AND v.status='valid'),0)::float AS revenue
    FROM campaigns c
    ORDER BY c.id DESC
  `;
  return rows as unknown as Array<{
    id: number; name: string; description: string | null; status: string; price_per_vote: number;
    starts_at: string | null; ends_at: string | null;
    valid_votes: number; flagged_votes: number; pending_payments: number; revenue: number;
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
  // Free votes only: the same voter (email, else IP) voting for the same contestant more than once
  // in a campaign keeps the first vote. Paid votes are never touched — buying more votes is allowed.
  // The contestant's public counter is reduced in the same transaction so totals stay in sync.
  const flagged = await sql.begin(async (tx) => {
    const res = await tx`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (
                 PARTITION BY campaign_id, contestant_id, COALESCE(voter_email, voter_ip)
                 ORDER BY created_at ASC, id ASC
               ) AS rn
        FROM votes
        WHERE status = 'valid' AND payment_ref IS NULL AND amount = 0
          AND (voter_ip IS NOT NULL OR voter_email IS NOT NULL)
      )
      UPDATE votes v
      SET status = 'duplicate'
      FROM ranked r
      WHERE v.id = r.id AND r.rn > 1 AND v.status = 'valid'
      RETURNING v.id, v.contestant_id, v.quantity
    `;
    const rows = res as unknown as { id: number; contestant_id: number; quantity: number }[];
    const perContestant = new Map<number, number>();
    for (const r of rows) perContestant.set(r.contestant_id, (perContestant.get(r.contestant_id) ?? 0) + r.quantity);
    for (const [cid, qty] of perContestant) {
      await tx`UPDATE contestants SET votes = GREATEST(votes - ${qty}, 0), updated_at = NOW() WHERE id = ${cid}`;
    }
    return rows.length;
  });
  await logActivity("voting.dedup", `Marked ${flagged} free votes as duplicates`, { count: flagged });
  return { flagged };
});

export type ContestantVoteReport = {
  id: number;
  full_name: string;
  province: string | null;
  status: string;
  /** Public counter shown on the website. */
  public_votes: number;
  /** Sum of vote quantities with a confirmed (valid) status. */
  confirmed_votes: number;
  transactions: number;
  revenue: number;
};

export const getVotingReports = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();

  const [perContestant, perProvince, daily, totals] = await Promise.all([
    sql`
      SELECT c.id, c.full_name, c.province, c.status, c.votes::int AS public_votes,
             COALESCE(SUM(v.quantity),0)::int AS confirmed_votes,
             COUNT(v.id)::int AS transactions,
             COALESCE(SUM(v.amount),0)::float AS revenue
      FROM contestants c
      LEFT JOIN votes v ON v.contestant_id = c.id AND v.status = 'valid'
      WHERE c.status IN ('approved','active') OR v.id IS NOT NULL
      GROUP BY c.id, c.full_name, c.province, c.status, c.votes
      ORDER BY c.votes DESC, c.id ASC
    `,
    sql`
      SELECT COALESCE(c.province,'Unassigned') AS province, COALESCE(SUM(v.quantity),0)::int AS votes
      FROM contestants c
      JOIN votes v ON v.contestant_id = c.id AND v.status = 'valid'
      GROUP BY 1 ORDER BY votes DESC
    `,
    sql`
      SELECT to_char(date_trunc('day', COALESCE(paid_at, created_at)),'YYYY-MM-DD') AS day,
             COALESCE(SUM(quantity) FILTER (WHERE status='valid'),0)::int AS valid,
             COUNT(*) FILTER (WHERE status IN ('duplicate','flagged','review'))::int AS flagged,
             COALESCE(SUM(amount) FILTER (WHERE status='valid'),0)::float AS revenue
      FROM votes
      WHERE COALESCE(paid_at, created_at) >= NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1
    `,
    sql`
      SELECT
        COALESCE(SUM(quantity) FILTER (WHERE status='valid'),0)::int            AS valid_votes,
        COUNT(*) FILTER (WHERE status='valid' AND payment_ref IS NOT NULL)::int  AS paid_transactions,
        COALESCE(SUM(amount) FILTER (WHERE status='valid'),0)::float            AS revenue,
        COUNT(*) FILTER (WHERE status='pending')::int                           AS pending,
        COUNT(*) FILTER (WHERE status IN ('failed','abandoned'))::int           AS failed,
        COUNT(*) FILTER (WHERE status='review')::int                            AS review,
        COUNT(*) FILTER (WHERE status='duplicate')::int                         AS duplicate,
        COUNT(*) FILTER (WHERE status='flagged')::int                           AS flagged
      FROM votes
    `,
  ]);

  const rows = perContestant as unknown as ContestantVoteReport[];
  return {
    perContestant: rows,
    perProvince: perProvince as unknown as Array<{ province: string; votes: number }>,
    daily: daily as unknown as Array<{ day: string; valid: number; flagged: number; revenue: number }>,
    totals: (totals as unknown as Array<{
      valid_votes: number; paid_transactions: number; revenue: number; pending: number;
      failed: number; review: number; duplicate: number; flagged: number;
    }>)[0],
    /** Public counter total for contestants currently open for voting. */
    publicTotal: rows.filter((r) => ["approved", "active"].includes(r.status)).reduce((n, r) => n + r.public_votes, 0),
    mismatches: rows.filter((r) => r.public_votes !== r.confirmed_votes && ["approved", "active"].includes(r.status)).length,
  };
});

/** Sets a contestant's public counter to the sum of their confirmed votes. */
export const syncContestantVotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ contestant_id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    const admin = await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      UPDATE contestants c
      SET votes = (SELECT COALESCE(SUM(quantity),0)::int FROM votes v WHERE v.contestant_id = c.id AND v.status = 'valid'),
          updated_at = NOW()
      WHERE c.id = ${data.contestant_id}
      RETURNING c.full_name, c.votes`;
    const r = rows[0] as { full_name: string; votes: number } | undefined;
    if (!r) throw new Error("Contestant not found.");
    await logActivity("voting.sync", `Vote total for ${r.full_name} set to ${r.votes} confirmed votes`, {
      contestant_id: data.contestant_id, by: admin.email,
    });
    return { votes: r.votes };
  });

// ---------- Payment records ----------

const PAYMENT_STATUSES = ["all", "valid", "pending", "failed", "abandoned", "review", "duplicate", "flagged"] as const;

export type VotePaymentRow = {
  id: number;
  payment_ref: string | null;
  lenco_ref: string | null;
  contestant_id: number | null;
  contestant_name: string | null;
  campaign_name: string | null;
  quantity: number;
  amount: number;
  paid_amount: number | null;
  voter_email: string | null;
  payment_channel: string | null;
  status: string;
  lenco_status: string | null;
  failure_reason: string | null;
  created_at: string;
  paid_at: string | null;
  last_checked_at: string | null;
};

export const listVotePayments = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({
      status: z.enum(PAYMENT_STATUSES).default("all"),
      q: z.string().trim().max(120).default(""),
      page: z.coerce.number().int().min(1).max(10_000).default(1),
      pageSize: z.coerce.number().int().min(10).max(500).default(50),
    }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const statusFilter =
      data.status === "all" ? sql`TRUE`
      : data.status === "failed" ? sql`v.status IN ('failed','abandoned')`
      : sql`v.status = ${data.status}`;
    const like = `%${data.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`;
    const search = data.q
      ? sql`(v.payment_ref ILIKE ${like} OR v.lenco_ref ILIKE ${like} OR v.voter_email ILIKE ${like} OR c.full_name ILIKE ${like})`
      : sql`TRUE`;
    const offset = (data.page - 1) * data.pageSize;
    const [rows, count, summary] = await Promise.all([
      sql`
        SELECT v.id, v.payment_ref, v.lenco_ref, v.contestant_id, c.full_name AS contestant_name,
               cp.name AS campaign_name, v.quantity, v.amount::float AS amount, v.paid_amount::float AS paid_amount,
               v.voter_email, v.payment_channel, v.status, v.lenco_status, v.failure_reason,
               to_char(v.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
               to_char(v.paid_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS paid_at,
               to_char(v.last_checked_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') AS last_checked_at
        FROM votes v
        LEFT JOIN contestants c ON c.id = v.contestant_id
        LEFT JOIN campaigns cp ON cp.id = v.campaign_id
        WHERE ${statusFilter} AND ${search}
        ORDER BY v.created_at DESC, v.id DESC
        LIMIT ${data.pageSize} OFFSET ${offset}`,
      sql`SELECT COUNT(*)::int AS n FROM votes v LEFT JOIN contestants c ON c.id = v.contestant_id WHERE ${statusFilter} AND ${search}`,
      sql`SELECT status, COUNT(*)::int AS n, COALESCE(SUM(quantity),0)::int AS votes, COALESCE(SUM(amount),0)::float AS amount
          FROM votes GROUP BY status`,
    ]);
    return {
      rows: rows as unknown as VotePaymentRow[],
      total: (count[0] as { n: number }).n,
      page: data.page,
      pageSize: data.pageSize,
      summary: summary as unknown as Array<{ status: string; n: number; votes: number; amount: number }>,
    };
  });

export const recheckVotePayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().regex(/^vote-[A-Za-z0-9_.-]{1,80}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { finalizePayment } = await import("./lenco.server");
    return finalizePayment(data.reference);
  });

export const reconcilePayments = createServerFn({ method: "POST" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  const admin = await requireAdminSession();
  const { ensureSchema, logActivity } = await import("./schema.server");
  await ensureSchema();
  const { reconcilePendingPayments } = await import("./lenco.server");
  const r = await reconcilePendingPayments(100);
  await logActivity("payments.reconcile", `Re-checked ${r.checked} pending payments: ${r.paid} paid, ${r.failed} failed`, {
    ...r, by: admin.email,
  });
  return r;
});
