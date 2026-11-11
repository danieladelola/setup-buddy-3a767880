import { createServerFn } from "@tanstack/react-start";

export const getDashboardOverview = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdminSession } = await import("./admin-guard.server");
  await requireAdminSession();
  const { ensureSchema } = await import("./schema.server");
  await ensureSchema();
  const { getDb } = await import("./db.server");
  const sql = getDb();

  const [
    contestantsTotal,
    contestantsActive,
    votesAgg,
    revenueAgg,
    applicantsTotal,
    eventsUpcoming,
    sponsorsTotal,
    mediaTotal,
    regional,
    voteTrend,
    regTrend,
    revenueTrend,
    recent,
  ] = await Promise.all([
    sql`SELECT COUNT(*)::int AS n FROM contestants`,
    sql`SELECT COUNT(*)::int AS n FROM contestants WHERE status = 'approved'`,
    sql`SELECT COUNT(*)::int AS n FROM votes`,
    sql`SELECT COALESCE(SUM(amount),0)::float AS n FROM votes`,
    sql`SELECT COUNT(*)::int AS n FROM applicants`,
    sql`SELECT COUNT(*)::int AS n FROM events WHERE starts_at >= NOW()`,
    sql`SELECT COUNT(*)::int AS n FROM sponsors`,
    sql`SELECT COUNT(*)::int AS n FROM media_assets`,
    sql`SELECT COALESCE(province,'Unassigned') AS province, COUNT(*)::int AS n FROM contestants GROUP BY 1 ORDER BY n DESC LIMIT 10`,
    sql`SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM votes WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`,
    sql`SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day, COUNT(*)::int AS n FROM applicants WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`,
    sql`SELECT to_char(date_trunc('day', created_at),'YYYY-MM-DD') AS day, COALESCE(SUM(amount),0)::float AS n FROM votes WHERE created_at >= NOW() - INTERVAL '14 days' GROUP BY 1 ORDER BY 1`,
    sql`SELECT id, kind, message, to_char(created_at,'YYYY-MM-DD"T"HH24:MI:SSOF') AS created_at FROM activities ORDER BY id DESC LIMIT 10`,
  ]);

  return {
    counters: {
      contestants: (contestantsTotal[0] as { n: number }).n,
      activeContestants: (contestantsActive[0] as { n: number }).n,
      votes: (votesAgg[0] as { n: number }).n,
      revenue: (revenueAgg[0] as { n: number }).n,
      applicants: (applicantsTotal[0] as { n: number }).n,
      upcomingEvents: (eventsUpcoming[0] as { n: number }).n,
      sponsors: (sponsorsTotal[0] as { n: number }).n,
      mediaAssets: (mediaTotal[0] as { n: number }).n,
    },
    regional: regional as unknown as Array<{ province: string; n: number }>,
    voteTrend: voteTrend as unknown as Array<{ day: string; n: number }>,
    registrationTrend: regTrend as unknown as Array<{ day: string; n: number }>,
    revenueTrend: revenueTrend as unknown as Array<{ day: string; n: number }>,
    recent: recent as unknown as Array<{ id: number; kind: string; message: string; created_at: string }>,
  };
});