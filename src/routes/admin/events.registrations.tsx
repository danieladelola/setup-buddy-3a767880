import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Download, RefreshCw, Users, CalendarCheck, Building2, Mail } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import { listAllRsvps } from "@/lib/rsvp.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/events/registrations")({
  head: () => ({ meta: [{ title: "Event Registrations | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: RegistrationsPage,
});

type Row = {
  id: number; full_name: string; email: string | null; phone: string | null;
  industry: string | null; company: string | null;
  status: string; created_at: string;
  event_id: number | null; event_title: string | null;
  event_location: string | null; event_starts_at: string | null;
};

const CSV_COLUMNS: Array<{ key: keyof Row; label: string }> = [
  { key: "id", label: "ID" },
  { key: "full_name", label: "Full Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "industry", label: "Industry" },
  { key: "company", label: "Company" },
  { key: "event_title", label: "Event" },
  { key: "event_location", label: "Event Location" },
  { key: "event_starts_at", label: "Event Date" },
  { key: "status", label: "Status" },
  { key: "created_at", label: "Submitted" },
];

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadBlob(filename: string, mime: string, content: BlobPart) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function toCsv(rows: Row[]): string {
  const header = CSV_COLUMNS.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => CSV_COLUMNS.map((c) => csvEscape(r[c.key])).join(","))
    .join("\r\n");
  // BOM for Excel UTF-8 friendliness
  return "\uFEFF" + header + "\r\n" + body;
}

function todayStamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

function RegistrationsPage() {
  const { email } = Route.useLoaderData();
  const fn = useServerFn(listAllRsvps);
  const q = useQuery({ queryKey: ["admin", "rsvps"], queryFn: () => fn(), refetchInterval: 15000 });

  const [search, setSearch] = useState("");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<"created_desc" | "created_asc" | "name_asc" | "event_asc">("created_desc");

  const rows = (q.data ?? []) as Row[];

  const eventOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of rows) {
      if (r.event_id && r.event_title) map.set(r.event_id, r.event_title);
    }
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [rows]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.status) set.add(r.status);
    return Array.from(set);
  }, [rows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const out = rows.filter((r) => {
      if (eventFilter !== "all" && String(r.event_id) !== eventFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!s) return true;
      return (
        r.full_name.toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.phone ?? "").toLowerCase().includes(s) ||
        (r.industry ?? "").toLowerCase().includes(s) ||
        (r.company ?? "").toLowerCase().includes(s) ||
        (r.event_title ?? "").toLowerCase().includes(s)
      );
    });
    const sorted = [...out];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "created_asc": return a.created_at.localeCompare(b.created_at);
        case "name_asc": return a.full_name.localeCompare(b.full_name);
        case "event_asc": return (a.event_title ?? "").localeCompare(b.event_title ?? "");
        case "created_desc":
        default: return b.created_at.localeCompare(a.created_at);
      }
    });
    return sorted;
  }, [rows, search, eventFilter, statusFilter, sortKey]);

  const stats = useMemo(() => {
    const total = rows.length;
    const events = new Set(rows.map((r) => r.event_id).filter(Boolean)).size;
    const withEmail = rows.filter((r) => r.email && r.email.trim()).length;
    const withCompany = rows.filter((r) => r.company && r.company.trim()).length;
    return { total, events, withEmail, withCompany };
  }, [rows]);

  const handleExport = (scope: "filtered" | "all", format: "csv" | "json") => {
    const data = scope === "filtered" ? filtered : rows;
    if (data.length === 0) {
      toast.error("Nothing to export");
      return;
    }
    const base = `event-registrations-${scope}-${todayStamp()}`;
    if (format === "csv") {
      downloadBlob(`${base}.csv`, "text/csv;charset=utf-8;", toCsv(data));
    } else {
      downloadBlob(`${base}.json`, "application/json", JSON.stringify(data, null, 2));
    }
    toast.success(`Exported ${data.length} registration${data.length === 1 ? "" : "s"}`);
  };

  const copyEmails = async () => {
    const emails = Array.from(
      new Set(filtered.map((r) => r.email).filter((e): e is string => !!e && e.includes("@"))),
    );
    if (emails.length === 0) {
      toast.error("No emails in current view");
      return;
    }
    try {
      await navigator.clipboard.writeText(emails.join(", "));
      toast.success(`Copied ${emails.length} email${emails.length === 1 ? "" : "s"}`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <AdminShell
      title="Event registrations"
      subtitle="People who registered for upcoming events."
      email={email}
    >
      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={<Users className="h-4 w-4" />} label="Total" value={stats.total} />
        <StatCard icon={<CalendarCheck className="h-4 w-4" />} label="Events" value={stats.events} />
        <StatCard icon={<Mail className="h-4 w-4" />} label="With email" value={stats.withEmail} />
        <StatCard icon={<Building2 className="h-4 w-4" />} label="With company" value={stats.withCompany} />
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search name, email, phone, industry, company, event..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:max-w-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {eventOptions.map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {statusOptions.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_desc">Newest first</SelectItem>
              <SelectItem value="created_asc">Oldest first</SelectItem>
              <SelectItem value="name_asc">Name (A–Z)</SelectItem>
              <SelectItem value="event_asc">Event (A–Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <span className="text-sm text-[#1b2a22]/60">
            {filtered.length} of {rows.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => q.refetch()}
            disabled={q.isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={copyEmails}>
            <Mail className="h-4 w-4" />
            Copy emails
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Download className="h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("filtered", "csv")}>
                CSV — current view ({filtered.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("all", "csv")}>
                CSV — all registrations ({rows.length})
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("filtered", "json")}>
                JSON — current view
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("all", "json")}>
                JSON — all registrations
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {q.isError && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Failed to load registrations. <button className="underline" onClick={() => q.refetch()}>Try again</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Industry / Company</th>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Submitted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b4332]/10">
            {q.isLoading && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[#1b2a22]/60">Loading...</td></tr>
            )}
            {!q.isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-[#1b2a22]/60">
                {rows.length === 0 ? "No registrations yet." : "No registrations match your filters."}
              </td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="hover:bg-[#F5F4EE]/60">
                <td className="px-4 py-3 font-medium">{r.full_name}</td>
                <td className="px-4 py-3 text-[#1b2a22]/80">
                  <div>
                    {r.email ? (
                      <a href={`mailto:${r.email}`} className="hover:underline">{r.email}</a>
                    ) : <span className="text-[#1b2a22]/40">—</span>}
                  </div>
                  <div className="text-xs text-[#1b2a22]/60">
                    {r.phone ? <a href={`tel:${r.phone}`} className="hover:underline">{r.phone}</a> : ""}
                  </div>
                </td>
                <td className="px-4 py-3 text-[#1b2a22]/80">
                  <div>{r.industry ?? <span className="text-[#1b2a22]/40">—</span>}</div>
                  <div className="text-xs text-[#1b2a22]/60">{r.company ?? ""}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{r.event_title ?? <span className="text-[#1b2a22]/40">deleted</span>}</div>
                  <div className="text-xs text-[#1b2a22]/60">{r.event_location ?? ""}</div>
                </td>
                <td className="px-4 py-3 text-[#1b2a22]/70 whitespace-nowrap">{r.event_starts_at ?? "-"}</td>
                <td className="px-4 py-3">
                  <Badge className="bg-emerald-100 text-emerald-900">{r.status}</Badge>
                </td>
                <td className="px-4 py-3 text-[#1b2a22]/70 whitespace-nowrap">{r.created_at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-xl border border-[#1b4332]/10 bg-white px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-[#1b2a22]/60">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-[#1b2a22]">{value}</div>
    </div>
  );
}
