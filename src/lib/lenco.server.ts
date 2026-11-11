import { getDb } from "./db.server";
import { ABANDON_AFTER_MS, decidePayment, type LencoCollection } from "./payment-rules";

const DEFAULT_LENCO_API = "https://api.lenco.co/access/v2";

function lencoApi(): string {
  // LENCO_API_BASE lets a test environment point at a simulated Lenco; production uses the default.
  return (process.env.LENCO_API_BASE || DEFAULT_LENCO_API).replace(/\/$/, "");
}

export function paymentsConfigured(): boolean {
  return Boolean(process.env.LENCO_SECRET_KEY && process.env.LENCO_PUBLIC_KEY);
}

export async function fetchLencoStatus(reference: string): Promise<LencoCollection | null> {
  const token = process.env.LENCO_SECRET_KEY;
  if (!token) throw new Error("Payments are not configured yet.");
  const res = await fetch(`${lencoApi()}/collections/status/${encodeURIComponent(reference)}`, {
    // Lenco's firewall rejects requests without a User-Agent.
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json", "User-Agent": "MissAgricultureZambia/1.0" },
  });
  if (res.status === 404) return null;
  if (res.status === 400) {
    // Lenco returns 400 "Collection details was not found" until the customer starts paying.
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    if (body?.message?.toLowerCase().includes("not found")) return null;
    console.error("Lenco status 400", body);
    throw new Error("Could not check the payment. Please try again.");
  }
  if (!res.ok) {
    console.error("Lenco status error", res.status, await res.text().catch(() => ""));
    throw new Error("Could not reach the payment provider. Please try again.");
  }
  const body = (await res.json()) as { data?: LencoCollection };
  return body.data ?? null;
}

export function newReference(prefix: "vote" | "tkt"): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${Date.now()}-${rand}`;
}

export type PaymentState = "paid" | "pending" | "failed" | "review" | "not_found";
export type FinalizeResult = { state: PaymentState; kind?: "vote" | "ticket" };

type Order = { id: number; amount: number; status: string; created_at: Date };

const VOTE_UNPAID = ["pending", "failed", "abandoned"];
const TICKET_UNPAID = ["pending_payment", "failed", "abandoned"];

/**
 * Checks Lenco for the reference and updates the order. Idempotent and safe to call concurrently:
 * votes are counted only by the single UPDATE that moves the row to 'valid'.
 */
export async function finalizePayment(reference: string): Promise<FinalizeResult> {
  const sql = getDb();
  const kind: "vote" | "ticket" | null = reference.startsWith("vote-")
    ? "vote"
    : reference.startsWith("tkt-")
      ? "ticket"
      : null;
  if (!kind) return { state: "not_found" };

  const rows =
    kind === "vote"
      ? await sql`SELECT id, amount::float AS amount, status, created_at FROM votes WHERE payment_ref = ${reference} LIMIT 1`
      : await sql`SELECT id, total_amount::float AS amount, status, created_at FROM tickets WHERE payment_ref = ${reference} LIMIT 1`;
  const order = rows[0] as Order | undefined;
  if (!order) return { state: "not_found" };
  if (order.status === "valid" || order.status === "paid") return { state: "paid", kind };
  if (order.status === "review") return { state: "review", kind };
  const unpaid = kind === "vote" ? VOTE_UNPAID : TICKET_UNPAID;
  // Duplicate / flagged / refunded rows are never re-opened automatically.
  if (!unpaid.includes(order.status)) return { state: "failed", kind };

  const lenco = await fetchLencoStatus(reference);
  const decision = decidePayment(lenco, { reference, amount: order.amount });
  const lencoStatus = lenco?.status ?? "not_found";
  const lencoRef = lenco?.lencoReference ?? null;
  const channel = lenco?.type ?? null;
  const table = sql(kind === "vote" ? "votes" : "tickets");

  if (decision.outcome === "pending") {
    const age = Date.now() - new Date(order.created_at).getTime();
    if (!lenco && age > ABANDON_AFTER_MS) {
      const pendingStatus = kind === "vote" ? "pending" : "pending_payment";
      await sql`UPDATE ${table} SET status='abandoned', lenco_status=${lencoStatus}, last_checked_at=NOW(),
                failure_reason='No payment received' WHERE id=${order.id} AND status=${pendingStatus}`;
      return { state: "failed", kind };
    }
    await sql`UPDATE ${table} SET lenco_status=${lencoStatus}, last_checked_at=NOW() WHERE id=${order.id}`;
    return { state: order.status === "failed" || order.status === "abandoned" ? "failed" : "pending", kind };
  }

  if (decision.outcome === "failed") {
    await sql`UPDATE ${table} SET status='failed', lenco_status=${lencoStatus}, lenco_ref=${lencoRef},
              failure_reason=${decision.reason}, last_checked_at=NOW()
              WHERE id=${order.id} AND status = ANY(${unpaid})`;
    return { state: "failed", kind };
  }

  if (decision.outcome === "review") {
    console.error("Lenco payment needs review", reference, decision.reason);
    await sql`UPDATE ${table} SET status='review', lenco_status=${lencoStatus}, lenco_ref=${lencoRef},
              payment_channel=${channel}, paid_amount=${Number(lenco?.amount) || null},
              failure_reason=${decision.reason}, last_checked_at=NOW()
              WHERE id=${order.id} AND status = ANY(${unpaid})`;
    return { state: "review", kind };
  }

  // Paid. A payment Lenco confirms late still counts, even if we had marked it failed/abandoned.
  await sql.begin(async (tx) => {
    if (kind === "vote") {
      const upd = await tx`
        UPDATE votes SET status='valid', paid_at=NOW(), lenco_status=${lencoStatus}, lenco_ref=${lencoRef},
               payment_channel=${channel}, paid_amount=${Number(lenco!.amount)}, failure_reason=NULL, last_checked_at=NOW()
        WHERE id=${order.id} AND status = ANY(${VOTE_UNPAID})
        RETURNING contestant_id, quantity`;
      const v = upd[0] as { contestant_id: number; quantity: number } | undefined;
      if (v) {
        await tx`UPDATE contestants SET votes = votes + ${v.quantity}, updated_at = NOW() WHERE id = ${v.contestant_id}`;
      }
    } else {
      await tx`
        UPDATE tickets SET status='paid', paid_at=NOW(), lenco_status=${lencoStatus}, lenco_ref=${lencoRef},
               payment_channel=${channel}, paid_amount=${Number(lenco!.amount)}, failure_reason=NULL, last_checked_at=NOW()
        WHERE id=${order.id} AND status = ANY(${TICKET_UNPAID})`;
    }
  });
  return { state: "paid", kind };
}

/** Re-checks unpaid orders with Lenco (oldest first). Used by the admin "Re-check pending" button. */
export async function reconcilePendingPayments(limit = 50): Promise<{
  checked: number; paid: number; failed: number; review: number; pending: number; errors: number;
}> {
  const sql = getDb();
  const refs = (await sql`
    SELECT payment_ref FROM (
      SELECT payment_ref, created_at FROM votes
        WHERE status = 'pending' AND payment_ref IS NOT NULL AND created_at < NOW() - INTERVAL '1 minute'
      UNION ALL
      SELECT payment_ref, created_at FROM tickets
        WHERE status = 'pending_payment' AND payment_ref IS NOT NULL AND created_at < NOW() - INTERVAL '1 minute'
    ) t ORDER BY created_at ASC LIMIT ${limit}`) as unknown as { payment_ref: string }[];
  const out = { checked: 0, paid: 0, failed: 0, review: 0, pending: 0, errors: 0 };
  for (const { payment_ref } of refs) {
    out.checked++;
    try {
      const r = await finalizePayment(payment_ref);
      if (r.state === "paid") out.paid++;
      else if (r.state === "failed") out.failed++;
      else if (r.state === "review") out.review++;
      else out.pending++;
    } catch (e) {
      console.error("reconcile failed", payment_ref, e);
      out.errors++;
    }
  }
  return out;
}
