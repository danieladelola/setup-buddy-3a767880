import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, Pencil, ExternalLink, ImagePlus } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listSponsors,
  createSponsor,
  updateSponsor,
  deleteSponsor,
  type SponsorRow,
} from "@/lib/sponsors.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/sponsors/")({
  head: () => ({ meta: [{ title: "Sponsors | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: SponsorsAdminPage,
});

const TIERS = ["platinum", "gold", "silver", "bronze", "partner"] as const;
type Tier = (typeof TIERS)[number];

type FormState = {
  name: string;
  tier: Tier;
  website: string;
  logo_url: string;
};

const EMPTY_FORM: FormState = { name: "", tier: "gold", website: "", logo_url: "" };

function SponsorsAdminPage() {
  const { email } = Route.useLoaderData();
  const qc = useQueryClient();
  const router = useRouter();
  const listFn = useServerFn(listSponsors);
  const createFn = useServerFn(createSponsor);
  const updateFn = useServerFn(updateSponsor);
  const deleteFn = useServerFn(deleteSponsor);

  const sponsors = useQuery({ queryKey: ["admin", "sponsors"], queryFn: () => listFn() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "sponsors"] });
    qc.invalidateQueries({ queryKey: ["public", "sponsors"] });
    router.invalidate();
  };

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SponsorRow | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function resetAndClose() {
    setOpen(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setErr(null);
  }

  const create = useMutation({ mutationFn: createFn, onSuccess: () => { resetAndClose(); refresh(); } });
  const update = useMutation({ mutationFn: updateFn, onSuccess: () => { resetAndClose(); refresh(); } });
  const del = useMutation({
    mutationFn: (id: number) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });

  function openNew() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFile(null);
    setErr(null);
    setOpen(true);
  }

  function openEdit(s: SponsorRow) {
    setEditing(s);
    setForm({
      name: s.name,
      tier: (TIERS.includes((s.tier ?? "gold") as Tier) ? (s.tier ?? "gold") : "gold") as Tier,
      website: s.website ?? "",
      logo_url: s.logo_url ?? "",
    });
    setFile(null);
    setErr(null);
    setOpen(true);
  }

  async function uploadFile(): Promise<string | null> {
    if (!file) return form.logo_url || null;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || "Upload failed");
      }
      const up = (await res.json()) as { url: string };
      return up.url;
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!form.name.trim()) {
      setErr("Sponsor name is required.");
      return;
    }
    try {
      const logo_url = await uploadFile();
      const payload = {
        name: form.name.trim(),
        tier: form.tier,
        website: form.website.trim() || null,
        logo_url: logo_url || null,
      };
      if (editing) {
        update.mutate({ data: { id: editing.id, ...payload } });
      } else {
        create.mutate({ data: payload });
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    }
  }

  const rows = sponsors.data ?? [];
  const pending = create.isPending || update.isPending || uploading;

  return (
    <AdminShell
      title="Sponsors & Partners"
      subtitle="Upload logos and manage sponsors that appear on the public sponsors page."
      email={email}
      actions={
        <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : resetAndClose())}>
          <DialogTrigger asChild>
            <Button className="bg-[#1b4332] hover:bg-[#163828] text-white" onClick={openNew}>
              + Add sponsor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Edit sponsor" : "Add sponsor"}</DialogTitle>
            </DialogHeader>
            <form className="space-y-3" onSubmit={handleSubmit}>
              <div>
                <Label>Name</Label>
                <Input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Zambia National Commercial Bank"
                />
              </div>
              <div>
                <Label>Tier</Label>
                <Select value={form.tier} onValueChange={(v) => setForm({ ...form, tier: v as Tier })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIERS.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Website</Label>
                <Input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <Label>Logo</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file ? (
                  <p className="mt-1 text-xs text-[#1b2a22]/60">
                    {file.name} — {(file.size / 1024).toFixed(0)} KB
                  </p>
                ) : form.logo_url ? (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={form.logo_url} alt="" className="h-10 w-10 rounded bg-white object-contain border" />
                    <span className="truncate text-xs text-[#1b2a22]/60">Current logo</span>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[#1b2a22]/50">PNG / JPG / SVG recommended.</p>
                )}
              </div>
              {err && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{err}</p>
              )}
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={resetAndClose}>Cancel</Button>
                <Button type="submit" disabled={pending}
                  className="bg-[#1b4332] hover:bg-[#163828] text-white">
                  {uploading ? "Uploading..." : pending ? "Saving..." : editing ? "Save changes" : "Add sponsor"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {sponsors.isLoading ? (
        <p className="text-sm text-[#1b2a22]/60">Loading sponsors…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1b4332]/20 bg-white p-10 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-[#1b4332]/40" />
          <p className="mt-3 text-sm text-[#1b2a22]/60">No sponsors yet. Click <strong>Add sponsor</strong> to upload your first logo.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((s) => (
            <div key={s.id} className="rounded-xl border border-[#1b4332]/10 bg-white shadow-sm overflow-hidden">
              <div className="aspect-square bg-[#F5F4EE] flex items-center justify-center p-6">
                {s.logo_url ? (
                  <img src={s.logo_url} alt={`${s.name} logo`} className="max-h-32 max-w-full object-contain" />
                ) : (
                  <span className="text-sm font-medium text-[#1b2a22]/70 text-center">{s.name}</span>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium text-[#1b2a22]">{s.name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-[#1b2a22]/60">
                  {s.tier && <span className="capitalize rounded-full bg-[#1b4332]/10 px-2 py-0.5">{s.tier}</span>}
                  {s.website && (
                    <a href={s.website} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1 underline underline-offset-2">
                      Site <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost"
                    onClick={() => { if (confirm(`Delete "${s.name}"?`)) del.mutate(s.id); }}>
                    <Trash2 className="h-4 w-4 text-red-700" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
