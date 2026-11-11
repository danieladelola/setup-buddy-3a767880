export const ADMIN_SESSION_CONFIG = {
  password: process.env.SESSION_SECRET ?? "dev-only-fallback-secret-change-me-please-32+chars",
  name: "mz_admin_session",
  maxAge: 60 * 60 * 24 * 7,
  cookie: {
    httpOnly: true,
    // Always None+Secure so the cookie works inside the Lovable preview iframe
    // (cross-site framing strips SameSite=Lax). Browsers allow Secure cookies
    // on localhost over http for local dev.
    sameSite: "none" as const,
    secure: true,
    path: "/",
  },
};

export type AdminSessionData = {
  email?: string;
  loggedInAt?: number;
};