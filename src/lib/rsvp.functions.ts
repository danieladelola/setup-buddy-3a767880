import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const rsvpInput = z.object({
  event_id: z.coerce.number().int().positive(),
  full_name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  industry: z.string().trim().max(120).optional().or(z.literal("")),
  company: z.string().trim().max(160).optional().or(z.literal("")),
});

export const submitRsvp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => rsvpInput.parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const ev = await sql`SELECT id, title FROM events WHERE id = ${data.event_id} AND status='published' LIMIT 1`;
    if (!ev.length) throw new Error("Event not available");
    const rows = await sql`
      INSERT INTO rsvps (event_id, full_name, email, phone, industry, company, status)
      VALUES (${data.event_id}, ${data.full_name}, ${data.email || null}, ${data.phone || null}, ${data.industry || null}, ${data.company || null}, 'confirmed')
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    const title = (ev[0] as { title: string }).title;
    await logActivity("rsvp.created", `New registration for ${title}: ${data.full_name}`, {
      id,
      event_id: data.event_id,
    });
    return { ok: true as const, id };
  });

export const listAllRsvps = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`
    SELECT r.id, r.full_name, r.email, r.phone, r.industry, r.company, r.status,
           to_char(r.created_at,'YYYY-MM-DD HH24:MI') AS created_at,
           r.event_id, e.title AS event_title, e.location AS event_location,
           to_char(e.starts_at,'YYYY-MM-DD HH24:MI') AS event_starts_at
    FROM rsvps r
    LEFT JOIN events e ON e.id = r.event_id
    ORDER BY r.id DESC
  `;
  return rows as unknown as Array<{
    id: number; full_name: string; email: string | null; phone: string | null;
    industry: string | null; company: string | null;
    status: string; created_at: string;
    event_id: number | null; event_title: string | null;
    event_location: string | null; event_starts_at: string | null;
  }>;
});
