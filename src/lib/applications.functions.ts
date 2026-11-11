import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const applicationInput = z.object({
  category: z.enum(["Miss Agriculture Zambia", "Mister Agriculture Zambia"]),
  full_name: z.string().trim().min(2).max(160),
  date_of_birth: z.string().trim().min(1).max(40),
  nrc_number: z.string().trim().min(2).max(60),
  gender: z.enum(["Female", "Male"]),
  phone: z.string().trim().min(5).max(40),
  email: z.string().trim().email().max(200),
  province: z.string().trim().min(1).max(120),
  occupation: z.string().trim().max(200).optional().default(""),
  agri_involved: z.boolean(),
  agri_roles: z.array(z.string().trim().min(1).max(80)).max(10).default([]),
  motivation: z.string().trim().min(10).max(2000),
  payment_method: z.enum(["Airtel Money", "MTN Money", "Bank Card", "Bank Transfer"]),
  payment_reference: z.string().trim().max(120).optional().default(""),
  proof_url: z.string().trim().max(1000).optional().default(""),
  headshot_url: z.string().trim().min(1).max(1000),
  fullbody_url: z.string().trim().min(1).max(1000),
  nrc_url: z.string().trim().min(1).max(1000),
  agreed: z.literal(true),
});

export type ApplicationInput = z.infer<typeof applicationInput>;

export type ApplicationRow = {
  id: number;
  category: string | null;
  full_name: string;
  date_of_birth: string | null;
  nrc_number: string | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  occupation: string | null;
  agri_involved: boolean | null;
  agri_roles: string[];
  motivation: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  proof_url: string | null;
  photo_url: string | null;
  headshot_url: string | null;
  fullbody_url: string | null;
  nrc_url: string | null;
  agreed: boolean;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
};

export const submitApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => applicationInput.parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      INSERT INTO contestant_applications
        (category, full_name, date_of_birth, nrc_number, gender, phone, email,
         province, occupation, agri_involved, agri_roles, motivation,
         payment_method, payment_reference, proof_url, photo_url,
         headshot_url, fullbody_url, nrc_url, agreed, status)
      VALUES
        (${data.category}, ${data.full_name}, ${data.date_of_birth},
         ${data.nrc_number}, ${data.gender}, ${data.phone}, ${data.email},
         ${data.province}, ${data.occupation}, ${data.agri_involved},
         ${sql.json(data.agri_roles as never)}, ${data.motivation},
         ${data.payment_method}, ${data.payment_reference},
         ${data.proof_url}, ${data.headshot_url},
         ${data.headshot_url}, ${data.fullbody_url}, ${data.nrc_url},
         ${data.agreed}, 'pending')
      RETURNING id
    `;
    const id = (rows[0] as { id: number }).id;
    await logActivity("application.created", `New ${data.category} application: ${data.full_name}`, { id });
    return { ok: true as const, id };
  });

export const listApplications = createServerFn({ method: "GET" }).handler(
  async (): Promise<ApplicationRow[]> => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    const rows = await sql`
      SELECT id, category, full_name,
             to_char(date_of_birth,'YYYY-MM-DD') AS date_of_birth,
             nrc_number, gender, phone, email, province, occupation,
             agri_involved, COALESCE(agri_roles, '[]'::jsonb) AS agri_roles,
             motivation, payment_method, payment_reference,
             proof_url, photo_url, headshot_url, fullbody_url, nrc_url,
             agreed, status, admin_note,
             to_char(created_at,'YYYY-MM-DD HH24:MI') AS created_at,
             to_char(updated_at,'YYYY-MM-DD HH24:MI') AS updated_at
      FROM contestant_applications
      ORDER BY id DESC
    `;
    return rows as unknown as ApplicationRow[];
  },
);

export const updateApplicationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({
      id: z.coerce.number().int().positive(),
      status: z.enum(["pending", "approved", "declined"]),
      admin_note: z.string().trim().max(1000).optional().nullable(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema, logActivity } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`
      UPDATE contestant_applications
         SET status = ${data.status},
             admin_note = ${data.admin_note ?? null},
             updated_at = NOW()
       WHERE id = ${data.id}
    `;
    await logActivity("application.status", `Application #${data.id} → ${data.status}`, { id: data.id });
    return { ok: true as const };
  });

export const deleteApplication = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ id: z.coerce.number().int().positive() }).parse(input))
  .handler(async ({ data }) => {
    const { requireAdminSession } = await import("./admin-guard.server");
    await requireAdminSession();
    const { ensureSchema } = await import("./schema.server");
    await ensureSchema();
    const { getDb } = await import("./db.server");
    const sql = getDb();
    await sql`DELETE FROM contestant_applications WHERE id = ${data.id}`;
    return { ok: true as const };
  });
