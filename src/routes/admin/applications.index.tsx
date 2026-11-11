import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CheckCircle2, XCircle, Clock, Eye, ExternalLink, Mail, Phone, Trash2, Search,
} from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listApplications, updateApplicationStatus, deleteApplication, type ApplicationRow,
} from "@/lib/applications.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/admin/applications/")({
  head: () => ({ meta: [{ title: "Applications | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: ApplicationsAdminPage,
});

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 border-amber-200",
  approved: "bg-green-100 text-green-800 border-green-200",
  declined: "bg-red-100 text-red-800 border-red-200",
};

function StatusBadge({ s }: { s: string }) {
  const cls = STATUS_STYLES[s] ?? "bg-gray-100 text-gray-700 border-gray-200";
  const Icon = s === "approved" ? CheckCircle2 : s === "declined" ? XCircle : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs capitalize ${cls}`}>
      <Icon className="h-3 w-3" /> {s}
    </span>
  );
}

function ApplicationsAdminPage() {
  const { email } = Route.useLoaderData();
  const qc = useQueryClient();
  const router = useRouter();
  const listFn = useServerFn(listApplications);
  const updateFn = useServerFn(updateApplicationStatus);
  const deleteFn = useServerFn(deleteApplication);

  const apps = useQuery({ queryKey: ["admin", "applications"], queryFn: () => listFn() });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "declined">("all");
  const [viewing, setViewing] = useState<ApplicationRow | null>(null);
  const [note, setNote] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "applications"] });
    router.invalidate();
  };

  const update = useMutation({
    mutationFn: updateFn,
    onSuccess: () => { setViewing(null); setNote(""); refresh(); },
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });

  const rows = apps.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.phone, r.province, r.occupation, r.payment_reference]
        .some((v) => (v ?? "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => ({
    total: rows.length,
    pending: rows.filter((r) => r.status === "pending").length,
    approved: rows.filter((r) => r.status === "approved").length,
    declined: rows.filter((r) => r.status === "declined").length,
  }), [rows]);

  function openView(r: ApplicationRow) {
    setViewing(r);
    setNote(r.admin_note ?? "");
  }

  function changeStatus(status: "pending" | "approved" | "declined") {
    if (!viewing) return;
    update.mutate({ data: { id: viewing.id, status, admin_note: note || null } });
  }

  return (
    <AdminShell
      title="Contestant Applications"
      subtitle="Review applications, verify proof of payment and approve or decline."
      email={email}
    >
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 mb-6">
        <Stat label="Total" value={stats.total} />
        <Stat label="Pending" value={stats.pending} tone="amber" />
        <Stat label="Approved" value={stats.approved} tone="green" />
        <Stat label="Declined" value={stats.declined} tone="red" />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#1b2a22]/40" />
          <Input
            placeholder="Search name, email, phone, reference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {apps.isLoading ? (
        <p className="text-sm text-[#1b2a22]/60">Loading applications…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1b4332]/20 bg-white p-10 text-center">
          <p className="text-sm text-[#1b2a22]/60">No applications match your filters.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-[#F5F4EE] text-xs uppercase tracking-wider text-[#1b2a22]/60">
              <tr>
                <th className="px-4 py-3 text-left">Applicant</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Province</th>
                <th className="px-4 py-3 text-left">Payment</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b4332]/5">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-[#F5F4EE]/40">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {r.photo_url && (
                        <img src={r.photo_url} alt="" className="h-9 w-9 rounded-full object-cover border" />
                      )}
                      <div>
                        <p className="font-medium text-[#1b2a22]">{r.full_name}</p>
                        <p className="text-xs text-[#1b2a22]/60">#{r.id} · {r.occupation ?? "—"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{r.email}</div>}
                    {r.phone && <div className="flex items-center gap-1 mt-0.5"><Phone className="h-3 w-3" />{r.phone}</div>}
                  </td>
                  <td className="px-4 py-3">{r.province ?? "—"}</td>
                  <td className="px-4 py-3 text-xs">
                    <p>{r.payment_method ?? "—"}</p>
                    <p className="text-[#1b2a22]/60">{r.payment_reference ?? ""}</p>
                  </td>
                  <td className="px-4 py-3"><StatusBadge s={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-[#1b2a22]/60">{r.created_at}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openView(r)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost"
                      onClick={() => { if (confirm(`Delete application from ${r.full_name}?`)) del.mutate(r.id); }}>
                      <Trash2 className="h-4 w-4 text-red-700" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!viewing} onOpenChange={(v) => { if (!v) { setViewing(null); setNote(""); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Application #{viewing?.id} — {viewing?.full_name}</DialogTitle>
          </DialogHeader>
          {viewing && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <StatusBadge s={viewing.status} />
                <p className="text-xs text-[#1b2a22]/60">Submitted {viewing.created_at}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Info label="Category" value={viewing.category} />
                <Info label="Gender" value={viewing.gender} />
                <Info label="Date of birth" value={viewing.date_of_birth} />
                <Info label="NRC / Passport" value={viewing.nrc_number} />
                <Info label="Phone" value={viewing.phone} />
                <Info label="Email" value={viewing.email} />
                <Info label="Province" value={viewing.province} />
                <Info label="Occupation/School" value={viewing.occupation} />
                <Info label="Involved in agriculture" value={viewing.agri_involved == null ? null : viewing.agri_involved ? "Yes" : "No"} />
                <Info label="Roles" value={(viewing.agri_roles ?? []).join(", ") || null} />
                <Info label="Payment method" value={viewing.payment_method} />
                <Info label="Payment reference" value={viewing.payment_reference} />
                <Info label="Agreement" value={viewing.agreed ? "Confirmed" : "Not confirmed"} />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60 mb-1">Short bio</p>
                <p className="rounded-md bg-[#F5F4EE] p-3 text-sm whitespace-pre-wrap">{viewing.motivation ?? "—"}</p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <FilePreview label="Headshot" url={viewing.headshot_url ?? viewing.photo_url} />
                <FilePreview label="Full body" url={viewing.fullbody_url} />
                <FilePreview label="NRC / Proof of age" url={viewing.nrc_url} />
                <FilePreview label="Proof of payment" url={viewing.proof_url} />
              </div>


              <div>
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60 mb-1">Admin note (optional — shown on decline)</p>
                <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason for decline or internal note…" />
              </div>

              <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                <Button variant="outline" disabled={update.isPending} onClick={() => changeStatus("pending")}>
                  Mark pending
                </Button>
                <Button
                  disabled={update.isPending}
                  onClick={() => changeStatus("declined")}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <XCircle className="h-4 w-4 mr-1" /> Decline
                </Button>
                <Button
                  disabled={update.isPending}
                  onClick={() => changeStatus("approved")}
                  className="bg-[#1b4332] hover:bg-[#163828] text-white"
                >
                  <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "amber" | "green" | "red" }) {
  const toneCls =
    tone === "amber" ? "text-amber-700" :
    tone === "green" ? "text-green-700" :
    tone === "red" ? "text-red-700" : "text-[#1b2a22]";
  return (
    <div className="rounded-xl border border-[#1b4332]/10 bg-white p-4 shadow-sm">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#1b2a22]/50">{label}</p>
      <p className={`mt-1 font-display text-2xl ${toneCls}`}>{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.2em] text-[#1b2a22]/50">{label}</p>
      <p className="text-sm text-[#1b2a22]">{value || "—"}</p>
    </div>
  );
}

function FilePreview({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60">{label}</p>
        {url && (
          <a href={url} target="_blank" rel="noreferrer" download
            className="inline-flex items-center gap-1 text-xs text-[#1b4332] hover:underline">
            Open <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="block">
          <img src={url} alt={label} className="w-full max-h-64 rounded-md object-contain border bg-[#F5F4EE]" />
        </a>
      ) : (
        <div className="rounded-md border border-dashed border-[#1b4332]/20 p-6 text-center text-xs text-[#1b2a22]/50">No file</div>
      )}
    </div>
  );
}
