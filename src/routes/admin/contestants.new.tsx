import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { requireAdmin } from "@/lib/admin.functions";
import { createContestant } from "@/lib/contestants.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { ContestantForm } from "@/components/admin/contestant-form";

export const Route = createFileRoute("/admin/contestants/new")({
  head: () => ({
    meta: [{ title: "New contestant | Admin" }, { name: "robots", content: "noindex" }],
  }),
  loader: () => requireAdmin(),
  component: NewContestant,
});

function NewContestant() {
  const { email } = Route.useLoaderData();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const createFn = useServerFn(createContestant);
  const m = useMutation({
    mutationFn: createFn,
    onSuccess: () => navigate({ to: "/admin/contestants" }),
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <AdminShell title="New contestant" subtitle="Add a new contestant profile." email={email}>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <ContestantForm
        submitting={m.isPending}
        submitLabel="Create contestant"
        onSubmit={(data) => m.mutate({ data })}
      />
    </AdminShell>
  );
}