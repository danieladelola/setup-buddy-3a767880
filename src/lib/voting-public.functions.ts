import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";
import { z } from "zod";
import { voteAmount } from "./payment-rules";

// ---------- Public types ----------

export type ActiveCampaign = {
  id: number;
  name: string;
  description: string | null;
  price_per_vote: number;
  starts_at: string | null;
  ends_at: string | null;
};

export type LeaderboardRow = {
  id: number;
  full_name: string;
  province: string | null;
  profile_photo: string | null;
  votes: number;
};

// ---------- Rate limiting (best-effort, in-memory) ----------

const VOTE_WINDOW_MS = 10_000; // 10s
const VOTE_MAX_PER_WINDOW = 5;
const ipHits = new Map<string, number[]>();

function checkRate(ip: string | null): void {
  if (!ip) return;
  const now = Date.now();
  const arr = (ipHits.get(ip) ?? []).filter((t) => now - t < VOTE_WINDOW_MS);
  if (arr.length >= VOTE_MAX_PER_WINDOW) {
    throw new Error("Too many vote attempts. Please wait a moment and try again.");
  }
  arr.push(now);
  ipHits.set(ip, arr);
}

// ---------- Active campaign resolver (server-only) ----------

async function getActiveCampaign(): Promise<ActiveCampaign> {
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT id, name, description, price_per_vote::float AS price_per_vote,
           starts_at, ends_at
    FROM campaigns
    WHERE status = 'active'
      AND (starts_at IS NULL OR starts_at <= NOW())
      AND (ends_at   IS NULL OR ends_at   >= NOW())
    ORDER BY starts_at DESC NULLS LAST, id DESC
    LIMIT 1
  `;
  const row = rows[0] as ActiveCampaign | undefined;
  if (!row) {
    throw new Error("Voting is currently closed. No active campaign is running.");
  }
  return row;
}

// ---------- Public reads ----------

export const getPublicActiveCampaign = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveCampaign | null> => {
    try {
      return await getActiveCampaign();
    } catch {
      return null;
    }
  },
);

export type Leaderboard = { rows: LeaderboardRow[]; totalVotes: number; contestants: number };

export const getLeaderboard = createServerFn({ method: "GET" }).handler(
  async (): Promise<Leaderboard> => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, full_name, province, profile_photo, votes
      FROM contestants
      WHERE status IN ('approved','active')
      ORDER BY votes DESC, id ASC
    `;
    const all = rows as unknown as LeaderboardRow[];
    return {
      rows: all.slice(0, 10),
      totalVotes: all.reduce((n, r) => n + Number(r.votes), 0),
      contestants: all.length,
    };
  },
);

// ---------- castVote ----------

const castVoteInput = z.object({
  contestant_id: z.number().int().positive(),
  quantity: z.number().int().positive().max(1000),
  voter_email: z
    .string()
    .trim()
    .max(200)
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type CastVoteResult = {
  vote_id: number;
  quantity: number;
  amount: number;
  status: "valid" | "pending";
  payment_ref: string | null;
  contestant: { id: number; full_name: string; votes: number };
  campaign: { id: number; name: string; price_per_vote: number };
};

export const castVote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => castVoteInput.parse(input))
  .handler(async ({ data }): Promise<CastVoteResult> => {
    // 1) Resolve active campaign on the server. Never trust client input.
    const campaign = await getActiveCampaign();

    // 2) Rate limit by IP (best-effort, in-memory).
    let voter_ip: string | null = null;
    try {
      voter_ip = getRequestIP({ xForwardedFor: true }) ?? null;
    } catch {
      voter_ip = null;
    }
    checkRate(voter_ip);

    const { getDb } = await import("./db.server");
    const sql = getDb();

    // 3) Validate contestant exists and is approved/active.
    const cRows = await sql`
      SELECT id, full_name, status, votes
      FROM contestants
      WHERE id = ${data.contestant_id}
      LIMIT 1
    `;
    const contestant = cRows[0] as
      | { id: number; full_name: string; status: string; votes: number }
      | undefined;
    if (!contestant) throw new Error("Contestant not found.");
    if (!["approved", "active"].includes(contestant.status)) {
      throw new Error("This contestant is not currently accepting votes.");
    }

    // 4) Compute amount server-side.
    const amount = voteAmount(data.quantity, campaign.price_per_vote);

    // 5) Free campaigns count immediately. Paid votes stay 'pending' (never counted) until
    //    finalizePayment confirms the payment with Lenco.
    const paymentConfirmed = campaign.price_per_vote === 0;
    const status: "valid" | "pending" = paymentConfirmed ? "valid" : "pending";
    if (!paymentConfirmed && !data.voter_email) throw new Error("Please enter your email to pay for votes.");
    const { newReference, paymentsConfigured } = await import("./lenco.server");
    if (!paymentConfirmed && !paymentsConfigured()) {
      throw new Error("Online payments are not available right now. Please try again later.");
    }
    const payment_ref = paymentConfirmed ? null : newReference("vote");

    // 6) Atomic insert + counter bump.
    const { vote_id, newVotes } = await sql.begin(async (tx) => {
      const inserted = await tx`
        INSERT INTO votes (
          campaign_id, contestant_id, quantity, amount,
          voter_email, voter_ip, status, payment_ref
        ) VALUES (
          ${campaign.id}, ${data.contestant_id}, ${data.quantity}, ${amount},
          ${data.voter_email ?? null}, ${voter_ip}, ${status}, ${payment_ref}
        )
        RETURNING id
      `;
      const vid = (inserted[0] as { id: number }).id;

      // Only bump the public counter when the vote is final.
      let newVotes = contestant.votes;
      if (status === "valid") {
        const upd = await tx`
          UPDATE contestants
          SET votes = votes + ${data.quantity}, updated_at = NOW()
          WHERE id = ${data.contestant_id}
          RETURNING votes
        `;
        newVotes = (upd[0] as { votes: number }).votes;
      }
      return { vote_id: vid, newVotes };
    });

    return {
      vote_id,
      quantity: data.quantity,
      amount,
      status,
      payment_ref,
      contestant: { id: contestant.id, full_name: contestant.full_name, votes: newVotes },
      campaign: { id: campaign.id, name: campaign.name, price_per_vote: campaign.price_per_vote },
    };
  });
