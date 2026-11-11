import { getDb } from "./db.server";

const LENCO_API = "https://api.lenco.co/access/v2";

type LencoStatus = { status: string; amount: string; currency: string; reference: string };

export async function fetchLencoStatus(reference: string): Promise<LencoStatus | null> {
  const token = process.env.LENCO_SECRET_KEY;
  if (!token) throw new Error("Payments are not configured yet.");
  const res = await fetch(`${LENCO_API}/collections/status/${encodeURIComponent(reference)}`, {
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
  const body = (await res.json()) as { data?: LencoStatus };
  return body.data ?? null;
}

export function newReference(prefix: "vote" | "tkt"): string {
  const rand = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${Date.now()}-${rand}`;
}

export type FinalizeResult =
  | { state: "paid"; kind: "vote" | "ticket" }
  | { state: "pending" | "failed" | "not_found" };

/** Checks Lenco for the reference and, if paid with the right amount, marks the order paid (idempotent). */
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
      ? await sql`SELECT id, amount::float AS amount, status FROM votes WHERE payment_ref = ${reference} LIMIT 1`
      : await sql`SELECT id, total_amount::float AS amount, status FROM tickets WHERE payment_ref = ${reference} LIMIT 1`;
  const order = rows[0] as { id: number; amount: number; status: string } | undefined;
  if (!order) return { state: "not_found" };
  if (order.status === "valid" || order.status === "paid") return { state: "paid", kind };

  const st = await fetchLencoStatus(reference);
  if (!st) return { state: "pending" };
  if (st.status === "failed") {
    if (kind === "vote") await sql`UPDATE votes SET status='failed' WHERE id=${order.id} AND status='pending'`;
    else await sql`UPDATE tickets SET status='failed' WHERE id=${order.id} AND status='pending_payment'`;
    return { state: "failed" };
  }
  if (st.status !== "successful") return { state: "pending" };
  if (st.currency !== "ZMW" || Number(st.amount) + 0.001 < order.amount) {
    console.error("Lenco amount mismatch", reference, st.amount, st.currency, order.amount);
    return { state: "failed" };
  }

  await sql.begin(async (tx) => {
    if (kind === "vote") {
      const upd = await tx`
        UPDATE votes SET status='valid' WHERE id=${order.id} AND status='pending'
        RETURNING contestant_id, quantity`;
      const v = upd[0] as { contestant_id: number; quantity: number } | undefined;
      if (v) {
        await tx`UPDATE contestants SET votes = votes + ${v.quantity}, updated_at = NOW() WHERE id = ${v.contestant_id}`;
      }
    } else {
      await tx`UPDATE tickets SET status='paid' WHERE id=${order.id} AND status='pending_payment'`;
    }
  });
  return { state: "paid", kind };
}
