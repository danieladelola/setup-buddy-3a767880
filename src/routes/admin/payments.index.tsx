import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Download, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listVotePayments,
  reconcilePayments,
  recheckVotePayment,
  type VotePaymentRow,
} from "@/lib/voting.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/payments/")({
  head: () => ({ meta: [{ title: "Vote payments | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: PaymentsPage,
});

type StatusFilter = "all" | "valid" | "pending" | "failed" | "review" | "duplicate";

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "valid", label: "Paid & counted" },
  { value: "pending", label: "Awaiting payment" },
  { value: "failed", label: "Failed / abandoned" },
  { value: "review", label: "Needs review" },
  { value: "duplicate", label: "Duplicates" },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  valid: { label: "Paid · counted", cls: "bg-emerald-100 text-emerald-900" },
  pending: { label: "Awaiting payment", cls: "bg-amber-100 text-amber-900" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-900" },
  abandoned: { label: "Abandoned", cls: "bg-slate-200 text-slate-800" },
  review: { label: "Needs review", cls: "bg-orange-100 text-orange-900" },
  duplicate: { label: "Duplicate", cls: "bg-slate-200 text-slate-800" },
  flagged: { label: "Flagged", cls: "bg-red-100 text-red-900" },
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}
const money = (n: number | null | undefined) =>
  (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function toCsv(rows: VotePaymentRow[]): string {
  const head = ["Date", "Paid at", "Reference", "Lenco reference", "Contestant", "Campaign", "Votes", "Amount (ZMW)", "Paid (ZMW)", "Email", "Channel", "Status", "Note"];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    // Prevent spreadsheet formula injection and quote every cell.
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  return [head, ...rows.map((r) => [
    r.created_at, r.paid_at, r.payment_ref, r.lenco_ref, r.contestant_name, r.campaign_name, r.quantity,
    r.amount, r.paid_amount, r.voter_email, r.payment_channel, r.status, r.failure_reason,
  ])].map((line) => line.map(esc).join(",")).join("\n");
}

function PaymentsPage() {
  const { email } = Route.useLoaderData();
  const qc = useQueryClient();
  const listFn = useServerFn(listVotePayments);
  const recheckFn = useServerFn(recheckVotePayment);
  const reconcileFn = useServerFn(reconcilePayments);

  const [status, setStatus] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const list = useQuery({
    queryKey: ["admin", "vote-payments", status, q, page],
    queryFn: () => listFn({ data: { status, q, page, pageSize: 50 } }),
    placeholderData: keepPreviousData,
    refetchInterval: 15000,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "vote-payments"] });
    qc.invalidateQueries({ queryKey: ["admin", "voting-reports"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
  };

  const recheck = useMutation({
    mutationFn: (reference: string) => recheckFn({ data: { reference } }),
    onSuccess: (r) => {
      const msg = {
        paid: "Payment confirmed — votes counted.",
        pending: "Still waiting for the customer to pay.",
        failed: "Payment failed or was not made. No votes counted.",
        review: "Lenco reports a payment that doesn't match the order. Needs manual review.",
        not_found: "Order not found.",
      }[r.state];
      (r.state === "paid" ? toast.success : toast.info)(msg);
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check the payment."),
  });

  const reconcile = useMutation({
    mutationFn: () => reconcileFn(),
    onSuccess: (r) => {
      toast.success(
        r.checked === 0
          ? "No pending payments to check."
          : `Checked ${r.checked}: ${r.paid} paid, ${r.failed} failed, ${r.pending} still pending${r.review ? `, ${r.review} need review` : ""}${r.errors ? `, ${r.errors} could not be checked` : ""}.`,
      );
      refresh();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not check payments."),
  });

  const exportCsv = useMutation({
    mutationFn: async () => {
      const all: VotePaymentRow[] = [];
      for (let p = 1; p <= 200; p++) {
        const res = await listFn({ data: { status, q, page: p, pageSize: 500 } });
        all.push(...res.rows);
        if (all.length >= res.total || res.rows.length === 0) break;
      }
      const blob = new Blob([toCsv(all)], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `vote-payments-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      return all.length;
    },
    onError: () => toast.error("Could not export payments."),
  });

  const summary = list.data?.summary ?? [];
  const sumOf = (...st: string[]) => summary.filter((s) => st.includes(s.status));
  const paid = sumOf("valid");
  const paidVotes = paid.reduce((n, s) => n + s.votes, 0);
  const paidAmount = paid.reduce((n, s) => n + s.amount, 0);
  const pendingCount = sumOf("pending").reduce((n, s) => n + s.n, 0);
  const failedCount = sumOf("failed", "abandoned").reduce((n, s) => n + s.n, 0);
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / list.data.pageSize)) : 1;

  return (
    <AdminShell
      title="Vote payments"
      subtitle="Every vote order, its Lenco reference and payment status."
      email={email}
      actions={
        <>
          <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>
            <Download className="mr-2 h-4 w-4" />{exportCsv.isPending ? "Exporting..." : "Export CSV"}
          </Button>
          <Button onClick={() => reconcile.mutate()} disabled={reconcile.isPending} className="bg-[#1b4332] hover:bg-[#163828] text-white">
            <RefreshCw className={`mr-2 h-4 w-4 ${reconcile.isPending ? "animate-spin" : ""}`} />
            {reconcile.isPending ? "Checking..." : "Re-check pending payments"}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Paid votes counted" value={paidVotes.toLocaleString()} />
        <Stat label="Paid revenue (ZMW)" value={money(paidAmount)} />
        <Stat label="Awaiting payment" value={pendingCount.toLocaleString()} />
        <Stat label="Failed / abandoned" value={failedCount.toLocaleString()} />
      </div>

      <div className="mt-6 rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#1b4332]/10 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <Button key={f.value} size="sm" variant={status === f.value ? "default" : "outline"} aria-pressed={status === f.value}
                className={status === f.value ? "bg-[#1b4332] hover:bg-[#163828] text-white" : ""}
                onClick={() => { setStatus(f.value); setPage(1); }}>
                {f.label}
              </Button>
            ))}
          </div>
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#1b2a22]/40" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference, email or contestant" className="pl-9" aria-label="Search payments" />
          </div>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Contestant</th>
                <th className="px-4 py-3 text-right">Votes</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Voter</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1b4332]/10">
              {list.isLoading && <tr><td colSpan={8} className="px-4 py-10 text-center text-[#1b2a22]/60">Loading...</td></tr>}
              {list.error && <tr><td colSpan={8} className="px-4 py-10 text-center text-red-700">{(list.error as Error).message}</td></tr>}
              {list.data?.rows.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-[#1b2a22]/60">No payments match.</td></tr>}
              {list.data?.rows.map((r) => (
                <tr key={r.id} className="align-top hover:bg-[#F5F4EE]/60">
                  <td className="px-4 py-3 whitespace-nowrap text-[#1b2a22]/80">
                    {fmtDate(r.created_at)}
                    {r.paid_at && <div className="text-xs text-emerald-800">Paid {fmtDate(r.paid_at)}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-[#1b2a22]">{r.payment_ref ?? "Free vote"}</div>
                    {r.lenco_ref && <div className="font-mono text-xs text-[#1b2a22]/50">Lenco: {r.lenco_ref}</div>}
                  </td>
                  <td className="px-4 py-3">{r.contestant_name ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.quantity}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    ZMW {money(r.amount)}
                    {r.payment_channel && <div className="text-xs text-[#1b2a22]/50">{r.payment_channel}</div>}
                  </td>
                  <td className="px-4 py-3 break-all text-[#1b2a22]/80">{r.voter_email ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                    {r.failure_reason && r.status !== "valid" && <div className="mt-1 max-w-[220px] text-xs text-[#1b2a22]/60">{r.failure_reason}</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.payment_ref && r.status !== "valid" && r.status !== "duplicate" && (
                      <Button size="sm" variant="outline" disabled={recheck.isPending} onClick={() => recheck.mutate(r.payment_ref!)}>
                        <RefreshCw className="mr-1 h-3.5 w-3.5" />Re-check
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y divide-[#1b4332]/10 md:hidden">
          {list.isLoading && <p className="p-6 text-center text-sm text-[#1b2a22]/60">Loading...</p>}
          {list.data?.rows.length === 0 && <p className="p-6 text-center text-sm text-[#1b2a22]/60">No payments match.</p>}
          {list.data?.rows.map((r) => (
            <div key={r.id} className="space-y-2 p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-[#1b2a22]">{r.contestant_name ?? "—"}</p>
                  <p className="text-xs text-[#1b2a22]/60">{fmtDate(r.created_at)}</p>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="flex justify-between tabular-nums"><span>{r.quantity} vote{r.quantity === 1 ? "" : "s"}</span><span>ZMW {money(r.amount)}</span></div>
              <p className="font-mono text-xs break-all text-[#1b2a22]/70">{r.payment_ref ?? "Free vote"}</p>
              {r.voter_email && <p className="text-xs break-all text-[#1b2a22]/70">{r.voter_email}</p>}
              {r.failure_reason && r.status !== "valid" && <p className="text-xs text-[#1b2a22]/60">{r.failure_reason}</p>}
              {r.payment_ref && r.status !== "valid" && r.status !== "duplicate" && (
                <Button size="sm" variant="outline" className="w-full" disabled={recheck.isPending} onClick={() => recheck.mutate(r.payment_ref!)}>
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />Re-check with Lenco
                </Button>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#1b4332]/10 px-4 py-3 text-xs text-[#1b2a22]/70">
          <span>{list.data ? `${list.data.total.toLocaleString()} record${list.data.total === 1 ? "" : "s"}` : ""}</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <span className="tabular-nums">Page {page} of {totalPages}</span>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_LABEL[status] ?? { label: status, cls: "bg-slate-200 text-slate-800" };
  return <Badge className={`whitespace-nowrap ${s.cls}`}>{s.label}</Badge>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#1b4332]/10 bg-white p-5 shadow-sm">
      <p className="text-xs uppercase tracking-wider text-[#1b2a22]/60">{label}</p>
      <p className="mt-3 font-serif text-3xl text-[#1b4332] tabular-nums">{value}</p>
    </div>
  );
}
