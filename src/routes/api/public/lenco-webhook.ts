import { createFileRoute } from "@tanstack/react-router";
import { createHash, createHmac, timingSafeEqual } from "crypto";

export const Route = createFileRoute("/api/public/lenco-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.LENCO_SECRET_KEY;
        if (!token) return new Response("Not configured", { status: 500 });
        const raw = await request.text();
        const sig = request.headers.get("x-lenco-signature") ?? "";
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
        if (payload.event === "collection.successful" && ref && /^(vote|tkt)-[A-Za-z0-9_.-]{1,80}$/.test(ref)) {
          const { ensureSchema } = await import("@/lib/schema.server");
          await ensureSchema();
          const { finalizePayment } = await import("@/lib/lenco.server");
          // Re-checks with Lenco's API before marking anything paid.
          await finalizePayment(ref);
        }
        return new Response("ok");
      },
    },
  },
});
