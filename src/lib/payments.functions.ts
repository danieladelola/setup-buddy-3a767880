import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getLencoPublicKey = createServerFn({ method: "GET" }).handler(async () => {
  return { key: process.env.LENCO_PUBLIC_KEY ?? null };
});

export const verifyPayment = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().regex(/^(vote|tkt)-[A-Za-z0-9_.-]{1,80}$/) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { finalizePayment } = await import("./lenco.server");
    return finalizePayment(data.reference);
  });

const ticketInput = z.object({
  event_id: z.coerce.number().int().positive(),
  holder_name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("A valid email is required").max(200),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  quantity: z.number().int().min(1).max(20),
});

export const createTicketOrder = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ticketInput.parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const { newReference } = await import("./lenco.server");
    const sql = getDb();
    const ev = await sql`
      SELECT id, title, ticket_price::float AS price, capacity
      FROM events WHERE id = ${data.event_id} AND status = 'published' LIMIT 1`;
    const event = ev[0] as { id: number; title: string; price: number; capacity: number | null } | undefined;
    if (!event) throw new Error("Event not available.");
    if (!(event.price > 0)) throw new Error("This event is free — please register instead.");
    if (event.capacity) {
      const sold = await sql`SELECT COALESCE(SUM(quantity),0)::int AS n FROM tickets WHERE event_id=${event.id} AND status='paid'`;
      if ((sold[0] as { n: number }).n + data.quantity > event.capacity) throw new Error("Not enough tickets left.");
    }
    const amount = Number((event.price * data.quantity).toFixed(2));
    const reference = newReference("tkt");
    await sql`
      INSERT INTO tickets (event_id, holder_name, email, phone, quantity, total_amount, status, payment_ref)
      VALUES (${event.id}, ${data.holder_name}, ${data.email}, ${data.phone || null}, ${data.quantity}, ${amount}, 'pending_payment', ${reference})`;
    return { reference, amount, email: data.email, label: `${event.title} × ${data.quantity}` };
  });
