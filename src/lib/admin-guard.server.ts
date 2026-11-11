import { redirect } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import { ADMIN_SESSION_CONFIG, type AdminSessionData } from "./admin-session";

export async function requireAdminSession(): Promise<{ email: string }> {
  const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
  if (!session.data.email) {
    throw redirect({ to: "/admin/login" });
  }
  return { email: session.data.email };
}