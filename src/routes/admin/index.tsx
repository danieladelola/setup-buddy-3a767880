import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  UserCheck,
  Vote,
  DollarSign,
  ClipboardList,
  CalendarDays,
  Handshake,
  Image as ImageIcon,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import { getDashboardOverview } from "@/lib/dashboard.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/")({
  head: () => ({ meta: [{ title: "Admin Dashboard" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: AdminDashboard,
});

type Counter = {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  accent: string;
};

function AdminDashboard() {
  const { email } = Route.useLoaderData();
  const overviewFn = useServerFn(getDashboardOverview);
  const q = useQuery({
    queryKey: ["admin", "overview"],
    queryFn: () => overviewFn(),
    refetchInterval: 15000,
  });

  const c = q.data?.counters;
  const counters: Counter[] = [
    { label: "Total Contestants", value: c?.contestants ?? 0, icon: Users, accent: "#1b4332" },
    { label: "Active Contestants", value: c?.activeContestants ?? 0, icon: UserCheck, accent: "#2d6a4f" },
    { label: "Votes Received", value: c?.votes ?? 0, icon: Vote, accent: "#40916c" },
    {
      label: "Revenue Generated",
      value: `ZMW ${(c?.revenue ?? 0).toLocaleString()}`,
      icon: DollarSign,
      accent: "#d4af37",
    },
    { label: "Registered Applicants", value: c?.applicants ?? 0, icon: ClipboardList, accent: "#1b4332" },
    { label: "Upcoming Events", value: c?.upcomingEvents ?? 0, icon: CalendarDays, accent: "#2d6a4f" },
    { label: "Sponsors", value: c?.sponsors ?? 0, icon: Handshake, accent: "#40916c" },
    { label: "Media Assets", value: c?.mediaAssets ?? 0, icon: ImageIcon, accent: "#d4af37" },
  ];

  return (
    <AdminShell
      title="Dashboard"
      subtitle="Live overview of contestants, votes, revenue and events."
      email={email}
      actions={
        <Button asChild className="bg-[#1b4332] hover:bg-[#163828] text-white">
          <Link to="/admin/contestants/new">+ New contestant</Link>
        </Button>
      }
    >
      {q.error && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {q.error instanceof Error ? q.error.message : "Failed to load dashboard"}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {counters.map((k) => {
          const Icon = k.icon;
          return (
            <div
              key={k.label}
              className="rounded-xl border border-[#1b4332]/10 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60">{k.label}</p>
                <Icon className="h-4 w-4" style={{ color: k.accent }} />
              </div>
              <p className="mt-3 font-serif text-3xl text-[#1b2a22]">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Vote trend (last 14 days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={q.data?.voteTrend ?? []}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="n" stroke="#1b4332" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Registration trend (last 14 days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={q.data?.registrationTrend ?? []}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="n" stroke="#d4af37" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Revenue (last 14 days, ZMW)">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={q.data?.revenueTrend ?? []}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Bar dataKey="n" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Contestants by province">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={q.data?.regional ?? []} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#6b7280" fontSize={11} />
              <YAxis dataKey="province" type="category" width={110} stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Bar dataKey="n" fill="#1b4332" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="mt-8 rounded-xl border border-[#1b4332]/10 bg-white p-6 shadow-sm">
        <h2 className="font-serif text-lg text-[#1b2a22]">Recent activities</h2>
        <ul className="mt-4 divide-y divide-[#1b4332]/10">
          {(q.data?.recent ?? []).length === 0 && (
            <li className="py-6 text-sm text-[#1b2a22]/60">No activity yet.</li>
          )}
          {q.data?.recent?.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-4 py-3">
              <div>
                <p className="text-sm text-[#1b2a22]">{a.message}</p>
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/50">{a.kind}</p>
              </div>
              <time className="whitespace-nowrap text-xs text-[#1b2a22]/50">
                {new Date(a.created_at).toLocaleString()}
              </time>
            </li>
          ))}
        </ul>
      </div>
    </AdminShell>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#1b4332]/10 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-medium text-[#1b2a22]">{title}</h3>
      {children}
    </div>
  );
}