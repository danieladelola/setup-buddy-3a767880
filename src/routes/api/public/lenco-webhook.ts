import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { PAYMENT_REF_PATTERN } from "@/lib/payment-rules";

// Lenco calls this for collection events. The signature is checked first, then the payment is
// re-verified against Lenco's status API before anything is marked paid (the event body is never trusted).
const HANDLED_EVENTS = new Set(["collection.successful", "collection.failed", "collection.settled"]);

export const Route = createFileRoute("/api/public/lenco-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.LENCO_SECRET_KEY;
        if (!token) return new Response("Not configured", { status: 500 });
        const raw = await request.text();
        if (raw.length > 100_000) return new Response("Too large", { status: 413 });
        const sig = (request.headers.get("x-lenco-signature") ?? "").trim().toLowerCase();
        let payload: { event?: string; data?: { reference?: string } };
        try {
          payload = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const hashKey = createHash("sha256").update(token).digest("hex");
        const ok = [raw, JSON.stringify(payload)].some((body) => {
          const expected = createHmac("sha512", hashKey).update(body).digest("hex");
          return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
        });
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const ref = payload.data?.reference;
        if (!payload.event || !HANDLED_EVENTS.has(payload.event) || !ref || !PAYMENT_REF_PATTERN.test(ref)) {
          // Acknowledge events we don't act on so Lenco stops retrying them.
          return new Response("ignored");
        }
        const { ensureSchema } = await import("@/lib/schema.server");
        await ensureSchema();
        const { finalizePayment } = await import("@/lib/lenco.server");
        // A thrown error returns 500 so Lenco retries later (every 30 minutes for 24 hours).
        const result = await finalizePayment(ref);
        return Response.json({ ok: true, state: result.state });
      },
    },
  },
});
