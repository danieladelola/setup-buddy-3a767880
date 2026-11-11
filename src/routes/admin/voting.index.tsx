import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
import { Play, Pause, Square, Trash2, ShieldAlert, Pencil, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listCampaigns,
  createCampaign,
  updateCampaign,
  setCampaignStatus,
  deleteCampaign,
  detectDuplicates,
  getVotingReports,
  syncContestantVotes,
} from "@/lib/voting.functions";
import { Link } from "@tanstack/react-router";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/voting/")({
  head: () => ({ meta: [{ title: "Voting | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: VotingPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  active: "bg-emerald-100 text-emerald-900",
  paused: "bg-amber-100 text-amber-900",
  ended: "bg-red-100 text-red-900",
};

function VotingPage() {
  const { email } = Route.useLoaderData();
  const router = useRouter();
  const qc = useQueryClient();
  const listFn = useServerFn(listCampaigns);
  const reportsFn = useServerFn(getVotingReports);
  const createFn = useServerFn(createCampaign);
  const updateFn = useServerFn(updateCampaign);
  const setStatusFn = useServerFn(setCampaignStatus);
  const delFn = useServerFn(deleteCampaign);
  const dedupFn = useServerFn(detectDuplicates);

  const campaigns = useQuery({
    queryKey: ["admin", "campaigns"],
    queryFn: () => listFn(),
    refetchInterval: 15000,
  });
  const reports = useQuery({
    queryKey: ["admin", "voting-reports"],
    queryFn: () => reportsFn(),
    refetchInterval: 15000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "campaigns"] });
    qc.invalidateQueries({ queryKey: ["admin", "voting-reports"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    router.invalidate();
  };

  const setStatus = useMutation({
    mutationFn: (vars: { id: number; status: "draft" | "active" | "paused" | "ended" }) =>
      setStatusFn({ data: vars }),
    onSuccess: refresh,
  });
  const del = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: refresh,
  });
  const syncFn = useServerFn(syncContestantVotes);
  const dedup = useMutation({
    mutationFn: () => dedupFn(),
    onSuccess: (r) => { refresh(); alert(r.flagged === 0 ? "No duplicate free votes found." : `${r.flagged} duplicate free votes removed from totals.`); },
  });
  const sync = useMutation({
    mutationFn: (contestant_id: number) => syncFn({ data: { contestant_id } }),
    onSuccess: refresh,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    starts_at: "",
    ends_at: "",
    price_per_vote: "0",
    status: "draft" as "draft" | "active" | "paused" | "ended",
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const emptyForm = { name: "", description: "", starts_at: "", ends_at: "", price_per_vote: "0", status: "draft" as "draft" | "active" | "paused" | "ended" };
  const create = useMutation({
    mutationFn: async (vars: { data: import("@/lib/voting.functions").CampaignInput }): Promise<unknown> =>
      editingId ? updateFn({ data: { ...vars.data, id: editingId } }) : createFn(vars),
    onSuccess: () => {
      setEditingId(null);
      setOpen(false);
      setForm({ name: "", description: "", starts_at: "", ends_at: "", price_per_vote: "0", status: "draft" });
      refresh();
    },
  });

  const totals = reports.data?.totals;

  return (
    <AdminShell
      title="Voting settings"
      subtitle="Voting dates, price per vote, analytics and fraud checks."
      email={email}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() => dedup.mutate()}
            disabled={dedup.isPending}
          >
            <ShieldAlert className="mr-2 h-4 w-4" />
            {dedup.isPending ? "Scanning..." : "Scan free votes for duplicates"}
          </Button>
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditingId(null); setForm(emptyForm); create.reset(); } }}>
            <DialogTrigger asChild>
              <Button className="bg-[#1b4332] hover:bg-[#163828] text-white">
                + New campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Edit voting settings" : "New voting campaign"}</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  create.mutate({
                    data: {
                      name: form.name,
                      description: form.description || null,
                      starts_at: form.starts_at || null,
                      ends_at: form.ends_at || null,
                      price_per_vote: Number(form.price_per_vote) || 0,
                      status: form.status,
                    },
                  });
                }}
              >
                <div>
                  <Label>Name</Label>
                  <Input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Starts at</Label>
                    <Input
                      type="datetime-local"
                      value={form.starts_at}
                      onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Ends at</Label>
                    <Input
                      type="datetime-local"
                      value={form.ends_at}
                      onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Price per vote (ZMW)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price_per_vote}
                    onChange={(e) => setForm({ ...form, price_per_vote: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <select
                    className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                  >
                    <option value="draft">Draft (not visible)</option>
                    <option value="active">Active (voting open within window)</option>
                    <option value="paused">Paused</option>
                    <option value="ended">Ended</option>
                  </select>
                  <p className="mt-1 text-xs text-[#1b2a22]/60">
                    Public voting is open only when status is Active and the current time is between start and end. Set price to 0 for free votes.
                  </p>
                </div>
                {create.error && (
                  <p className="text-sm text-red-700">{(create.error as Error).message}</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={create.isPending}
                    className="bg-[#1b4332] hover:bg-[#163828] text-white"
                  >
                    {create.isPending ? "Saving..." : editingId ? "Save changes" : "Create campaign"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Counter label="Confirmed votes" value={(totals?.valid_votes ?? 0).toLocaleString()} accent="#1b4332" />
        <Counter label="Paid transactions" value={(totals?.paid_transactions ?? 0).toLocaleString()} accent="#2d6a4f" />
        <Counter label="Awaiting payment" value={(totals?.pending ?? 0).toLocaleString()} accent="#b45309" />
        <Counter
          label="Revenue (ZMW)"
          value={(totals?.revenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          accent="#d4af37"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#1b2a22]/70">
        <span>Failed / abandoned: <b className="tabular-nums">{totals?.failed ?? 0}</b></span>
        <span>Needs review: <b className="tabular-nums">{totals?.review ?? 0}</b></span>
        <span>Duplicates: <b className="tabular-nums">{totals?.duplicate ?? 0}</b></span>
        <span>Public total (website): <b className="tabular-nums">{(reports.data?.publicTotal ?? 0).toLocaleString()}</b></span>
        <Link to="/admin/payments" className="font-medium text-[#1b4332] underline underline-offset-2">View all payment records →</Link>
      </div>
      {reports.data && (
        reports.data.mismatches > 0 ? (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{reports.data.mismatches} contestant{reports.data.mismatches === 1 ? "" : "s"} show a website total that differs from their confirmed votes. Review them in the table below.</span>
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            Website totals match confirmed votes for every contestant.
          </div>
        )
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <ChartCard title="Daily votes (last 30 days)">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={reports.data?.daily ?? []}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis dataKey="day" stroke="#6b7280" fontSize={11} />
              <YAxis stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Line type="monotone" dataKey="valid" stroke="#1b4332" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="flagged" stroke="#b91c1c" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Votes by province">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={reports.data?.perProvince ?? []} layout="vertical" margin={{ left: 12 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
              <XAxis type="number" stroke="#6b7280" fontSize={11} />
              <YAxis dataKey="province" type="category" width={110} stroke="#6b7280" fontSize={11} />
              <Tooltip />
              <Bar dataKey="votes" fill="#1b4332" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <SectionCard title="Campaigns" className="mt-6">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Window</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Confirmed votes</th>
              <th className="px-4 py-3">Awaiting payment</th>
              <th className="px-4 py-3">Flagged</th>
              <th className="px-4 py-3">Revenue</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b4332]/10">
            {campaigns.isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-[#1b2a22]/60">Loading...</td></tr>
            )}
            {campaigns.data?.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-[#1b2a22]/60">No campaigns yet.</td></tr>
            )}
            {campaigns.data?.map((c) => (
              <tr key={c.id} className="hover:bg-[#F5F4EE]/60">
                <td className="px-4 py-3 font-medium text-[#1b2a22]">{c.name}</td>
                <td className="px-4 py-3"><Badge className={STATUS_COLORS[c.status]}>{c.status}</Badge></td>
                <td className="px-4 py-3 text-[#1b2a22]/70">
                  {(c.starts_at?.replace("T", " ") ?? "-") + " -> " + (c.ends_at?.replace("T", " ") ?? "-")}
                </td>
                <td className="px-4 py-3 tabular-nums">ZMW {Number(c.price_per_vote).toFixed(2)}</td>
                <td className="px-4 py-3 tabular-nums">{c.valid_votes}</td>
                <td className="px-4 py-3 tabular-nums">{c.pending_payments}</td>
                <td className="px-4 py-3 tabular-nums">{c.flagged_votes}</td>
                <td className="px-4 py-3 tabular-nums">ZMW {Number(c.revenue).toLocaleString()}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Edit"
                      onClick={() => {
                        setEditingId(c.id);
                        setForm({
                          name: c.name,
                          description: c.description ?? "",
                          starts_at: c.starts_at ?? "",
                          ends_at: c.ends_at ?? "",
                          price_per_vote: String(c.price_per_vote),
                          status: c.status as typeof form.status,
                        });
                        setOpen(true);
                      }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Activate"
                      onClick={() => setStatus.mutate({ id: c.id, status: "active" })}>
                      <Play className="h-4 w-4 text-emerald-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Pause"
                      onClick={() => setStatus.mutate({ id: c.id, status: "paused" })}>
                      <Pause className="h-4 w-4 text-amber-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="End"
                      onClick={() => setStatus.mutate({ id: c.id, status: "ended" })}>
                      <Square className="h-4 w-4 text-red-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Delete"
                      onClick={() => { if (confirm(`Delete "${c.name}"?`)) del.mutate(c.id); }}>
                      <Trash2 className="h-4 w-4 text-red-700" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SectionCard>

      <SectionCard title="Votes per contestant" className="mt-6">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Contestant</th>
              <th className="px-4 py-3">Website total</th>
              <th className="px-4 py-3">Confirmed votes</th>
              <th className="px-4 py-3">Transactions</th>
              <th className="px-4 py-3">Revenue (ZMW)</th>
              <th className="px-4 py-3 text-right">Check</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b4332]/10">
            {reports.data?.perContestant?.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-[#1b2a22]/60">No contestants open for voting.</td></tr>
            )}
            {reports.data?.perContestant?.map((r, i) => {
              const live = r.status === "approved" || r.status === "active";
              const match = r.public_votes === r.confirmed_votes;
              return (
                <tr key={r.id}>
                  <td className="px-4 py-3 tabular-nums text-[#1b2a22]/60">{i + 1}</td>
                  <td className="px-4 py-3">
                    {r.full_name}
                    {!live && <span className="ml-2 text-xs text-[#1b2a22]/50">({r.status})</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{r.public_votes.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">{r.confirmed_votes.toLocaleString()}</td>
                  <td className="px-4 py-3 tabular-nums">{r.transactions}</td>
                  <td className="px-4 py-3 tabular-nums">{Number(r.revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3 text-right">
                    {match ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-800"><CheckCircle2 className="h-3.5 w-3.5" />Matches</span>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={sync.isPending}
                        title="Set the website total to the confirmed votes"
                        onClick={() => {
                          if (confirm(`Set ${r.full_name}'s website total from ${r.public_votes} to ${r.confirmed_votes} confirmed votes?`)) sync.mutate(r.id);
                        }}
                      >
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />Match to {r.confirmed_votes}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SectionCard>
    </AdminShell>
  );
}

function Counter({ label, value, accent }: { label: string; value: number | string; accent: string }) {
  return (
    <div className="rounded-xl border border-[#1b4332]/10 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60">{label}</p>
      <p className="mt-3 font-serif text-3xl" style={{ color: accent }}>{value}</p>
    </div>
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
function SectionCard({
  title, className, children,
}: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm ${className ?? ""}`}>
      <div className="border-b border-[#1b4332]/10 px-4 py-3">
        <h2 className="font-serif text-base text-[#1b2a22]">{title}</h2>
      </div>
      {children}
    </div>
  );
}