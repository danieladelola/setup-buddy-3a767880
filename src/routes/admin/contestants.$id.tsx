import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { requireAdmin } from "@/lib/admin.functions";
import { getContestant, updateContestant } from "@/lib/contestants.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import {
  ContestantForm,
  type ContestantFormValues,
} from "@/components/admin/contestant-form";

export const Route = createFileRoute("/admin/contestants/$id")({
  head: () => ({
    meta: [{ title: "Edit contestant | Admin" }, { name: "robots", content: "noindex" }],
  }),
  loader: () => requireAdmin(),
  component: EditContestant,
});

function EditContestant() {
  const { email } = Route.useLoaderData();
  const { id } = Route.useParams();
  const numericId = Number(id);
  const navigate = useNavigate();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const getFn = useServerFn(getContestant);
  const updateFn = useServerFn(updateContestant);

  const q = useQuery({
    queryKey: ["admin", "contestant", numericId],
    queryFn: () => getFn({ data: { id: numericId } }),
    enabled: Number.isFinite(numericId),
  });

  const m = useMutation({
    mutationFn: (patch: ContestantFormValues) =>
      updateFn({ data: { id: numericId, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "contestants"] });
      qc.invalidateQueries({ queryKey: ["admin", "contestant", numericId] });
      router.invalidate();
      navigate({ to: "/admin/contestants" });
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Failed to save"),
  });

  return (
    <AdminShell title="Edit contestant" subtitle={`#${id}`} email={email}>
      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {q.isLoading && <p className="text-sm text-[#1b2a22]/60">Loading...</p>}
      {q.error && (
        <p className="text-sm text-red-700">
          {q.error instanceof Error ? q.error.message : "Failed to load"}
        </p>
      )}
      {q.data && (
        <ContestantForm
          initial={{
            ...q.data,
            gallery_images: Array.isArray(q.data.gallery_images)
              ? (q.data.gallery_images as string[])
              : [],
            social_links:
              q.data.social_links && typeof q.data.social_links === "object"
                ? (q.data.social_links as Record<string, string>)
                : {},
          }}
          submitting={m.isPending}
          submitLabel="Save changes"
          onSubmit={(data) => m.mutate(data)}
        />
      )}
    </AdminShell>
  );
}