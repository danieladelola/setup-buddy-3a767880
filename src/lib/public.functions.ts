import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";


export type PublicContestant = {
  id: number;
  full_name: string;
  province: string | null;
  district: string | null;
  agri_project: string | null;
  profile_photo: string | null;
  biography: string | null;
  votes: number;
};

export type PublicEvent = {
  id: number;
  title: string;
  type: string;
  location: string | null;
  starts_at: string | null;
  description: string | null;
  banner_url: string | null;
  ticket_price: number;
};

export type PublicMedia = {
  id: number;
  title: string | null;
  description: string | null;
  url: string;
  kind: string;
  category: string;
};

export const listPublicContestants = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({ scope: z.enum(["active", "past"]).default("active") })
      .default({ scope: "active" })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<PublicContestant[]> => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows =
      data.scope === "past"
        ? await sql`
            SELECT id, full_name, province, district, agri_project, profile_photo, biography, votes
            FROM contestants
            WHERE status = 'past'
            ORDER BY votes DESC, id ASC
          `
        : await sql`
            SELECT id, full_name, province, district, agri_project, profile_photo, biography, votes
            FROM contestants
            WHERE status IN ('approved','active')
            ORDER BY votes DESC, id ASC
          `;
    return rows as unknown as PublicContestant[];
  });


export const listPublicEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicEvent[]> => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, title, type, location,
             to_char(starts_at, 'YYYY-MM-DD"T"HH24:MI:SSOF') AS starts_at,
             description, banner_url, ticket_price::float AS ticket_price
      FROM events
      WHERE status IN ('published','draft')
      ORDER BY starts_at ASC NULLS LAST, id ASC
    `;
    const events = rows as unknown as PublicEvent[];

    // Merge audition events with the same date into one card with combined locations
    const merged: PublicEvent[] = [];
    const groups = new Map<string, PublicEvent[]>();
    for (const e of events) {
      if (e.type.toLowerCase().replace(/[\s-]+/g, "_") === "audition") {
        const key = `${e.type}::${e.starts_at ?? ""}`;
        const existing = groups.get(key);
        if (existing) {
          existing.push(e);
        } else {
          groups.set(key, [e]);
        }
      } else {
        merged.push(e);
      }
    }
    for (const group of groups.values()) {
      if (group.length === 1) {
        merged.push(group[0]);
        continue;
      }
      const first = group[0];
      const combinedLocation = group.map((g) => g.location).filter(Boolean).join(" | ");
      const baseTitle = first.title.replace(/\s*[-–—]\s*(Lusaka|Livingstone).*/i, "").trim();
      merged.push({
        ...first,
        title: baseTitle ? `2027 ${baseTitle}` : first.title,
        location: combinedLocation || first.location,
      });
    }

    return merged.sort((a, b) => {
      const ad = a.starts_at ?? "";
      const bd = b.starts_at ?? "";
      if (ad < bd) return -1;
      if (ad > bd) return 1;
      return (a.id ?? 0) - (b.id ?? 0);
    });
  },
);

export const listPublicMedia = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicMedia[]> => {
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, title, description, url, kind, category
      FROM media_assets
      WHERE category IN ('photo','gallery')
      ORDER BY id ASC
    `;
    return rows as unknown as PublicMedia[];
  },
);
