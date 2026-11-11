import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Check, X, Trash2 } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listContestants,
  setContestantStatus,
  deleteContestant,
} from "@/lib/contestants.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/admin/contestants/")({
  head: () => ({ meta: [{ title: "Contestants | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: ContestantsList,
});

const statusColor: Record<string, string> = {
  pending: "bg-amber-100 text-amber-900",
  approved: "bg-emerald-100 text-emerald-900",
  active: "bg-emerald-100 text-emerald-900",
  rejected: "bg-red-100 text-red-900",
  inactive: "bg-slate-200 text-slate-800",
};

function ContestantsList() {
  const { email } = Route.useLoaderData();
  const router = useRouter();
  const qc = useQueryClient();
  const listFn = useServerFn(listContestants);
  const statusFn = useServerFn(setContestantStatus);
  const deleteFn = useServerFn(deleteContestant);

  const q = useQuery({ queryKey: ["admin", "contestants"], queryFn: () => listFn() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "contestants"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    router.invalidate();
  };

  const setStatus = useMutation({
    mutationFn: (vars: { id: number; status: "approved" | "rejected" }) =>
      statusFn({ data: vars }),
    onSuccess: refresh,
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });

  return (
    <AdminShell
      title="Contestants"
      subtitle="Create, approve, and manage all contestants."
      email={email}
      actions={
        <Button asChild className="bg-[#1b4332] hover:bg-[#163828] text-white">
          <Link to="/admin/contestants/new">+ New contestant</Link>
        </Button>
      }
    >
      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm lg:block">
        <table className="w-full text-sm">
          <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
            <tr>
              <th className="px-4 py-3">Contestant</th>
              <th className="px-4 py-3">Region</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Votes</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b4332]/10">
            {q.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#1b2a22]/60">
                  Loading contestants...
                </td>
              </tr>
            )}
            {q.error && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-red-700">
                  {q.error instanceof Error ? q.error.message : "Failed to load"}
                </td>
              </tr>
            )}
            {q.data?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-[#1b2a22]/60">
                  No contestants yet.{" "}
                  <Link
                    to="/admin/contestants/new"
                    className="text-[#1b4332] underline underline-offset-2"
                  >
                    Create the first one
                  </Link>
                  .
                </td>
              </tr>
            )}
            {q.data?.map((c) => (
              <tr key={c.id} className="hover:bg-[#F5F4EE]/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {c.profile_photo ? (
                      <img
                        src={c.profile_photo}
                        alt={c.full_name}
                        className="h-9 w-9 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="h-9 w-9 shrink-0 rounded-full bg-[#1b4332]/10" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[#1b2a22]">{c.full_name}</p>
                      <p className="text-xs text-[#1b2a22]/60">
                        {c.age ? `${c.age} yrs` : "Age -"}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-[#1b2a22]/80">
                  {[c.province, c.district].filter(Boolean).join(" - ") || "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge className={statusColor[c.status] ?? "bg-slate-100 text-slate-800"}>
                    {c.status}
                  </Badge>
                </td>
                <td className="px-4 py-3 tabular-nums text-[#1b2a22]">{c.votes}</td>
                <td className="px-4 py-3 text-[#1b2a22]/60">{c.created_at}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Approve"
                      onClick={() => setStatus.mutate({ id: c.id, status: "approved" })}
                      disabled={setStatus.isPending}
                    >
                      <Check className="h-4 w-4 text-emerald-700" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Reject"
                      onClick={() => setStatus.mutate({ id: c.id, status: "rejected" })}
                      disabled={setStatus.isPending}
                    >
                      <X className="h-4 w-4 text-red-700" />
                    </Button>
                    <Button size="sm" variant="ghost" asChild title="Edit">
                      <Link to="/admin/contestants/$id" params={{ id: String(c.id) }}>
                        <Pencil className="h-4 w-4 text-[#1b4332]" />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Delete"
                      onClick={() => {
                        if (confirm(`Delete contestant "${c.full_name}"?`)) del.mutate(c.id);
                      }}
                      disabled={del.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-700" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {q.isLoading && (
          <div className="rounded-xl border border-[#1b4332]/10 bg-white px-4 py-8 text-center text-sm text-[#1b2a22]/60 shadow-sm">
            Loading contestants...
          </div>
        )}
        {q.error && (
          <div className="rounded-xl border border-[#1b4332]/10 bg-white px-4 py-8 text-center text-sm text-red-700 shadow-sm">
            {q.error instanceof Error ? q.error.message : "Failed to load"}
          </div>
        )}
        {q.data?.length === 0 && (
          <div className="rounded-xl border border-[#1b4332]/10 bg-white px-4 py-12 text-center text-sm text-[#1b2a22]/60 shadow-sm">
            No contestants yet.{" "}
            <Link
              to="/admin/contestants/new"
              className="text-[#1b4332] underline underline-offset-2"
            >
              Create the first one
            </Link>
            .
          </div>
        )}
        {q.data?.map((c) => (
          <div
            key={c.id}
            className="rounded-xl border border-[#1b4332]/10 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              {c.profile_photo ? (
                <img
                  src={c.profile_photo}
                  alt={c.full_name}
                  className="h-12 w-12 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-full bg-[#1b4332]/10" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-[#1b2a22]">{c.full_name}</p>
                <p className="text-xs text-[#1b2a22]/60">
                  {c.age ? `${c.age} yrs` : "Age -"} ·{" "}
                  {[c.province, c.district].filter(Boolean).join(" - ") || "-"}
                </p>
              </div>
              <Badge className={statusColor[c.status] ?? "bg-slate-100 text-slate-800 shrink-0"}>
                {c.status}
              </Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#1b4332]/10 pt-3 text-sm">
              <div>
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/50">Votes</p>
                <p className="mt-0.5 tabular-nums font-medium text-[#1b2a22]">{c.votes}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-[#1b2a22]/50">Created</p>
                <p className="mt-0.5 text-[#1b2a22]/80">{c.created_at}</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 border-t border-[#1b4332]/10 pt-3">
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setStatus.mutate({ id: c.id, status: "approved" })}
                disabled={setStatus.isPending}
              >
                <Check className="mr-1 h-3.5 w-3.5 text-emerald-700" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => setStatus.mutate({ id: c.id, status: "rejected" })}
                disabled={setStatus.isPending}
              >
                <X className="mr-1 h-3.5 w-3.5 text-red-700" />
                Reject
              </Button>
              <Button size="sm" variant="outline" className="flex-1 text-xs" asChild>
                <Link to="/admin/contestants/$id" params={{ id: String(c.id) }}>
                  <Pencil className="mr-1 h-3.5 w-3.5 text-[#1b4332]" />
                  Edit
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 text-xs"
                onClick={() => {
                  if (confirm(`Delete contestant "${c.full_name}"?`)) del.mutate(c.id);
                }}
                disabled={del.isPending}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5 text-red-700" />
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}