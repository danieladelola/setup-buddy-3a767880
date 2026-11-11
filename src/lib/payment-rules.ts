// Pure payment rules shared by the server and tests. No database or network access here.

/** What Lenco reports for a collection (subset of GET /collections/status/:reference). */
export type LencoCollection = {
  status: string;
  amount: string;
  currency: string;
  reference: string | null;
  lencoReference?: string | null;
  type?: string | null;
  reasonForFailure?: string | null;
};

export type PaymentDecision =
  | { outcome: "paid" }
  | { outcome: "pending" }
  | { outcome: "failed"; reason: string }
  /** Lenco says paid but the amount/currency/reference does not match the order. Never counted automatically. */
  | { outcome: "review"; reason: string };

export const PAYMENT_CURRENCY = "ZMW";

/** Unpaid orders with no payment at Lenco after this long are marked abandoned. */
export const ABANDON_AFTER_MS = 2 * 60 * 60 * 1000;

/**
 * Decides what an order's payment state is from Lenco's answer.
 * Only a "successful" collection for the exact reference, in ZMW, for at least the order amount counts as paid.
 */
export function decidePayment(
  lenco: LencoCollection | null,
  order: { reference: string; amount: number },
): PaymentDecision {
  if (!lenco) return { outcome: "pending" };
  const status = String(lenco.status ?? "").toLowerCase();
  if (status === "failed") {
    return { outcome: "failed", reason: lenco.reasonForFailure || "Payment failed at Lenco" };
  }
  if (status !== "successful") return { outcome: "pending" };

  if (lenco.reference != null && lenco.reference !== order.reference) {
    return { outcome: "review", reason: `Reference mismatch (Lenco: ${lenco.reference})` };
  }
  if (String(lenco.currency ?? "").toUpperCase() !== PAYMENT_CURRENCY) {
    return { outcome: "review", reason: `Wrong currency (${lenco.currency})` };
  }
  const paid = Number(lenco.amount);
  if (!Number.isFinite(paid) || Math.round(paid * 100) < Math.round(order.amount * 100)) {
    return { outcome: "review", reason: `Paid ${lenco.amount} but ${order.amount.toFixed(2)} was due` };
  }
  return { outcome: "paid" };
}

/** Price of a vote order in ZMW, rounded to cents. */
export function voteAmount(quantity: number, pricePerVote: number): number {
  return Math.round(quantity * pricePerVote * 100) / 100;
}

export const PAYMENT_REF_PATTERN = /^(vote|tkt)-[A-Za-z0-9_.-]{1,80}$/;
