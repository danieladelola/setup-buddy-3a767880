import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STATUSES = ["draft", "published", "cancelled"] as const;

export const eventInput = z.object({
  title: z.string().trim().min(1).max(160),
  type: z.string().trim().min(1, "Type is required").max(60).default("workshop"),
  location: z.string().trim().max(200).nullable().optional(),
  starts_at: z.string().min(1),
  ends_at: z.string().nullable().optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  capacity: z.coerce.number().int().positive().nullable().optional(),
  ticket_price: z.number().nonnegative().default(0),
  banner_url: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(STATUSES).default("draft"),
});

export type EventInput = z.infer<typeof eventInput>;

export const listEvents = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT e.id, e.title, e.type, e.status, e.location, e.capacity, e.ticket_price,
           to_char(e.starts_at,'YYYY-MM-DD HH24:MI') AS starts_at,
           COALESCE((SELECT SUM(quantity) FROM tickets t WHERE t.event_id = e.id),0)::int AS tickets_sold,
           COALESCE((SELECT COUNT(*) FROM rsvps r WHERE r.event_id = e.id),0)::int AS rsvps
    FROM events e
    ORDER BY e.starts_at DESC NULLS LAST
  `;
  return rows as unknown as Array<{
    id: number; title: string; type: string; status: string;
    location: string | null; capacity: number | null; ticket_price: number;
    starts_at: string | null; tickets_sold: number; rsvps: number;
  }>;
});

export const createEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => eventInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      INSERT INTO events (title, type, location, starts_at, ends_at, description, capacity, ticket_price, banner_url, status)
      VALUES (${data.title}, ${data.type}, ${data.location ?? null},
        ${data.starts_at}, ${data.ends_at || null}, ${data.description ?? null},
        ${data.capacity ?? null}, ${data.ticket_price}, ${data.banner_url ?? null}, ${data.status})
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("event.created", `Event created: ${data.title}`, { id });
    return { id };
  });

export const getEvent = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, title, type, status, location, capacity, ticket_price, banner_url, description,
             to_char(starts_at,'YYYY-MM-DD"T"HH24:MI') AS starts_at,
             to_char(ends_at,'YYYY-MM-DD"T"HH24:MI') AS ends_at
      FROM events WHERE id = ${data.id} LIMIT 1
    `;
    if (!rows.length) throw new Error("Event not found");
    return rows[0] as unknown as {
      id: number; title: string; type: string; status: string;
      location: string | null; capacity: number | null; ticket_price: number;
      banner_url: string | null; description: string | null;
      starts_at: string | null; ends_at: string | null;
    };
  });

export const updateEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    eventInput.extend({ id: z.coerce.number().int().positive() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`
      UPDATE events SET
        title = ${data.title},
        type = ${data.type},
        location = ${data.location ?? null},
        starts_at = ${data.starts_at},
        ends_at = ${data.ends_at || null},
        description = ${data.description ?? null},
        capacity = ${data.capacity ?? null},
        ticket_price = ${data.ticket_price},
        banner_url = ${data.banner_url ?? null},
        status = ${data.status},
        updated_at = NOW()
      WHERE id = ${data.id}
    `;
    await logActivity("event.updated", `Event updated: ${data.title}`, { id: data.id });
    return { ok: true as const, id: data.id };
  });

export const setEventStatus = createServerFn({ method: "POST" })
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
    await sql`UPDATE events SET status = ${data.status} WHERE id = ${data.id}`;
    await logActivity(`event.${data.status}`, `Event #${data.id} -> ${data.status}`, { id: data.id });
    return { ok: true as const };
  });

export const deleteEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM events WHERE id = ${data.id}`;
    await logActivity("event.deleted", `Event #${data.id} deleted`, { id: data.id });
    return { ok: true as const };
  });

export const listTickets = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ event_id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, holder_name, email, quantity, total_amount, status,
             to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
      FROM tickets WHERE event_id = ${data.event_id} ORDER BY id DESC
    `;
    return rows as unknown as Array<{
      id: number; holder_name: string; email: string | null; quantity: number;
      total_amount: number; status: string; created_at: string;
    }>;
  });

export const listRsvps = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ event_id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, full_name, email, phone, status,
             to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at
      FROM rsvps WHERE event_id = ${data.event_id} ORDER BY id DESC
    `;
    return rows as unknown as Array<{
      id: number; full_name: string; email: string | null; phone: string | null;
      status: string; created_at: string;
    }>;
  });