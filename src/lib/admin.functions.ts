import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ADMIN_SESSION_CONFIG, type AdminSessionData } from "./admin-session";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => loginSchema.parse(input))
  .handler(async ({ data }) => {
    const { ensureSchema } = await import("./schema.server");
    const { getDb } = await import("./db.server");
    const bcrypt = await import("bcryptjs");
    await ensureSchema();
    const sql = getDb();
    const rows = await sql`SELECT id, email, password_hash FROM admins WHERE email = ${data.email.toLowerCase()} LIMIT 1`;
    const row = rows[0] as { id: number; email: string; password_hash: string } | undefined;
    if (!row) {
      throw new Error("Invalid email or password");
    }
    const ok = await bcrypt.compare(data.password, row.password_hash);
    if (!ok) {
      throw new Error("Invalid email or password");
    }
    const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
    await session.update({ email: row.email, loggedInAt: Date.now() });
    return { ok: true as const };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
  await session.clear();
  return { ok: true as const };
});

export const getAdminSession = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
  return { email: session.data.email ?? null };
});

export const requireAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
  if (!session.data.email) {
    throw redirect({ to: "/admin/login" });
  }
  return { email: session.data.email };
});

export const adminDbPing = createServerFn({ method: "GET" }).handler(async () => {
  const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
  if (!session.data.email) throw redirect({ to: "/admin/login" });
  const { getDb } = await import("./db.server");
  const sql = getDb();
  const rows = await sql`select now() as now, current_database() as db, version() as version`;
  const row = rows[0] as { now: Date; db: string; version: string };
  return {
    now: row.now instanceof Date ? row.now.toISOString() : String(row.now),
    db: row.db,
    version: row.version,
  };
});