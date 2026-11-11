import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Trash2, FileText, Film, ImageIcon, Download } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listMedia, createMedia, deleteMedia,
  listPress, createPress, deletePress,
} from "@/lib/media.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/media/")({
  head: () => ({ meta: [{ title: "Media Center | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: MediaPage,
});

const CATEGORIES = ["photo", "video", "gallery", "press", "download"] as const;
type Category = (typeof CATEGORIES)[number];

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  photo: ImageIcon, gallery: ImageIcon, video: Film, press: FileText, download: Download,
};

function MediaPage() {
  const { email } = Route.useLoaderData();
  const qc = useQueryClient();
  const router = useRouter();
  const mediaFn = useServerFn(listMedia);
  const createFn = useServerFn(createMedia);
  const delFn = useServerFn(deleteMedia);
  const pressFn = useServerFn(listPress);
  const createPressFn = useServerFn(createPress);
  const delPressFn = useServerFn(deletePress);

  const media = useQuery({ queryKey: ["admin", "media"], queryFn: () => mediaFn() });
  const press = useQuery({ queryKey: ["admin", "press"], queryFn: () => pressFn() });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "media"] });
    qc.invalidateQueries({ queryKey: ["admin", "press"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    router.invalidate();
  };

  const del = useMutation({ mutationFn: (id: number) => delFn({ data: { id } }), onSuccess: refresh });
  const delPress = useMutation({ mutationFn: (id: number) => delPressFn({ data: { id } }), onSuccess: refresh });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", url: "", category: "photo" as Category, mime_type: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      setOpen(false);
      setForm({ title: "", description: "", url: "", category: "photo", mime_type: "" });
      setFile(null);
      setUploadError(null);
      refresh();
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setUploadError("Please choose a file to upload.");
      return;
    }
    setUploadError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const j = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(j.error || "Upload failed");
      }
      const up = (await res.json()) as { url: string; mime_type: string | null };
      create.mutate({
        data: {
          title: form.title || file.name,
          description: form.description || null,
          url: up.url,
          category: form.category,
          kind: form.category === "video" ? "video" : form.category === "download" ? "file" : "image",
          mime_type: up.mime_type ?? form.mime_type ?? null,
        },
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }


  const [pressOpen, setPressOpen] = useState(false);
  const [pressForm, setPressForm] = useState({ title: "", body: "", published_at: "" });
  const createPressMut = useMutation({
    mutationFn: createPressFn,
    onSuccess: () => {
      setPressOpen(false);
      setPressForm({ title: "", body: "", published_at: "" });
      refresh();
    },
  });

  return (
    <AdminShell
      title="Media Center"
      subtitle="Photos, videos, galleries, press releases and downloads."
      email={email}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1b4332] hover:bg-[#163828] text-white">+ Add media</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add media asset</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={handleSubmit}
            >
              <div><Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div><Label>Category</Label>
                <Select value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as Category })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="video">Video</SelectItem>
                    <SelectItem value="gallery">Gallery</SelectItem>
                    <SelectItem value="download">Download (PDF/Doc)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>File</Label>
                <Input
                  type="file"
                  required
                  accept={
                    form.category === "video" ? "video/*"
                    : form.category === "download" ? ".pdf,.doc,.docx,application/pdf"
                    : "image/*"
                  }
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                {file && (
                  <p className="mt-1 text-xs text-[#1b2a22]/60">
                    {file.name} — {(file.size / 1024).toFixed(0)} KB
                  </p>
                )}
              </div>
              <div><Label>Description</Label>
                <Textarea rows={3} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              {uploadError && (
                <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {uploadError}
                </p>
              )}
              <div className="flex justify-end">
                <Button type="submit" disabled={uploading || create.isPending}
                  className="bg-[#1b4332] hover:bg-[#163828] text-white">
                  {uploading ? "Uploading..." : create.isPending ? "Saving..." : "Upload & add"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >

      <Tabs defaultValue="all" className="w-full">
        <TabsList className="bg-white border border-[#1b4332]/10">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="photo">Photos</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="gallery">Galleries</TabsTrigger>
          <TabsTrigger value="download">Downloads</TabsTrigger>
          <TabsTrigger value="press">Press</TabsTrigger>
        </TabsList>

        {(["all", "photo", "video", "gallery", "download"] as const).map((cat) => (
          <TabsContent key={cat} value={cat} className="mt-6">
            <MediaGrid
              items={(media.data ?? []).filter((m) => cat === "all" ? true : m.category === cat)}
              onDelete={(id) => { if (confirm("Delete media?")) del.mutate(id); }}
            />
          </TabsContent>
        ))}

        <TabsContent value="press" className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Dialog open={pressOpen} onOpenChange={setPressOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#1b4332] hover:bg-[#163828] text-white">+ New press release</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New press release</DialogTitle></DialogHeader>
                <form
                  className="space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    createPressMut.mutate({
                      data: {
                        title: pressForm.title,
                        body: pressForm.body || null,
                        published_at: pressForm.published_at || null,
                      },
                    });
                  }}
                >
                  <div><Label>Title</Label>
                    <Input required value={pressForm.title}
                      onChange={(e) => setPressForm({ ...pressForm, title: e.target.value })} />
                  </div>
                  <div><Label>Published at</Label>
                    <Input type="date" value={pressForm.published_at}
                      onChange={(e) => setPressForm({ ...pressForm, published_at: e.target.value })} />
                  </div>
                  <div><Label>Body</Label>
                    <Textarea rows={6} value={pressForm.body}
                      onChange={(e) => setPressForm({ ...pressForm, body: e.target.value })} />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" disabled={createPressMut.isPending}
                      className="bg-[#1b4332] hover:bg-[#163828] text-white">
                      {createPressMut.isPending ? "Saving..." : "Publish"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
          <div className="overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Published</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1b4332]/10">
                {press.data?.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-[#1b2a22]/60">No press releases yet.</td></tr>
                )}
                {press.data?.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium">{p.title}</td>
                    <td className="px-4 py-3 text-[#1b2a22]/70">{p.published_at ?? "-"}</td>
                    <td className="px-4 py-3 text-[#1b2a22]/70">{p.created_at}</td>
                    <td className="px-4 py-3 text-right">
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm(`Delete "${p.title}"?`)) delPress.mutate(p.id); }}>
                        <Trash2 className="h-4 w-4 text-red-700" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </AdminShell>
  );
}

function MediaGrid({
  items, onDelete,
}: {
  items: Array<{ id: number; title: string | null; description: string | null; url: string; category: string; mime_type: string | null }>;
  onDelete: (id: number) => void;
}) {
  if (items.length === 0) {
    return <p className="rounded-xl border border-dashed border-[#1b4332]/20 bg-white p-8 text-center text-sm text-[#1b2a22]/60">No items in this category.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
      {items.map((m) => {
        const Icon = ICONS[m.category] ?? ImageIcon;
        const isImage = m.category === "photo" || m.category === "gallery";
        const isVideo = m.category === "video";
        return (
          <div key={m.id} className="overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
            <div className="relative aspect-video bg-[#F5F4EE]">
              {isImage && <img src={m.url} alt={m.title ?? ""} className="h-full w-full object-cover" />}
              {isVideo && <video src={m.url} className="h-full w-full object-cover" muted controls={false} />}
              {!isImage && !isVideo && (
                <div className="flex h-full items-center justify-center text-[#1b4332]/40">
                  <Icon className="h-10 w-10" />
                </div>
              )}
              <Badge className="absolute left-2 top-2 bg-white/90 capitalize text-[#1b2a22]">{m.category}</Badge>
            </div>
            <div className="p-3">
              <p className="truncate text-sm font-medium text-[#1b2a22]">{m.title ?? "Untitled"}</p>
              {m.description && <p className="mt-1 line-clamp-2 text-xs text-[#1b2a22]/60">{m.description}</p>}
              <div className="mt-2 flex items-center justify-between">
                <a href={m.url} target="_blank" rel="noreferrer"
                  className="text-xs text-[#1b4332] underline underline-offset-2">Open</a>
                <Button size="sm" variant="ghost" onClick={() => onDelete(m.id)}>
                  <Trash2 className="h-4 w-4 text-red-700" />
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}