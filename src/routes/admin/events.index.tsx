import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, FileEdit, Pencil, Trash2, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/admin.functions";
import {
  listEvents,
  createEvent,
  setEventStatus,
  deleteEvent,
  getEvent,
  updateEvent,
} from "@/lib/events.functions";
import { AdminShell } from "@/components/admin/admin-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUpload } from "@/components/admin/file-upload";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/events/")({
  head: () => ({ meta: [{ title: "Events | Admin" }, { name: "robots", content: "noindex" }] }),
  loader: () => requireAdmin(),
  component: EventsPage,
});

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-slate-200 text-slate-800",
  published: "bg-emerald-100 text-emerald-900",
  cancelled: "bg-red-100 text-red-900",
};

function EventsPage() {
  const { email } = Route.useLoaderData();
  const qc = useQueryClient();
  const router = useRouter();
  const listFn = useServerFn(listEvents);
  const createFn = useServerFn(createEvent);
  const setStatusFn = useServerFn(setEventStatus);
  const delFn = useServerFn(deleteEvent);
  const getFn = useServerFn(getEvent);
  const updateFn = useServerFn(updateEvent);

  const q = useQuery({ queryKey: ["admin", "events"], queryFn: () => listFn() });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin", "events"] });
    qc.invalidateQueries({ queryKey: ["admin", "overview"] });
    router.invalidate();
  };

  const setStatus = useMutation({
    mutationFn: (vars: { id: number; status: "draft" | "published" | "cancelled" }) =>
      setStatusFn({ data: vars }),
    onSuccess: refresh,
  });
  const del = useMutation({
    mutationFn: (id: number) => delFn({ data: { id } }),
    onSuccess: refresh,
  });

  type FormState = {
    title: string;
    type: string;
    location: string;
    starts_at: string;
    ends_at: string;
    capacity: string;
    ticket_price: string;
    banner_url: string;
    description: string;
    status: "draft" | "published" | "cancelled";
  };
  const emptyForm: FormState = {
    title: "", type: "workshop", location: "", starts_at: "", ends_at: "",
    capacity: "", ticket_price: "0", banner_url: "", description: "", status: "draft",
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<FormState | null>(null);

  const openEdit = async (id: number) => {
    setEditId(id);
    setEditForm(null);
    const ev = await getFn({ data: { id } });
    setEditForm({
      title: ev.title,
      type: ev.type,
      location: ev.location ?? "",
      starts_at: ev.starts_at ?? "",
      ends_at: ev.ends_at ?? "",
      capacity: ev.capacity != null ? String(ev.capacity) : "",
      ticket_price: String(ev.ticket_price ?? "0"),
      banner_url: ev.banner_url ?? "",
      description: ev.description ?? "",
      status: ev.status as FormState["status"],
    });
  };

  const update = useMutation({
    mutationFn: (vars: { id: number; data: FormState }) =>
      updateFn({
        data: {
          id: vars.id,
          title: vars.data.title,
          type: vars.data.type,
          location: vars.data.location || null,
          starts_at: vars.data.starts_at,
          ends_at: vars.data.ends_at || null,
          description: vars.data.description || null,
          capacity: vars.data.capacity ? Number(vars.data.capacity) : null,
          ticket_price: Number(vars.data.ticket_price) || 0,
          banner_url: vars.data.banner_url || null,
          status: vars.data.status,
        },
      }),
    onSuccess: () => {
      setEditId(null);
      setEditForm(null);
      refresh();
    },
  });

  const create = useMutation({
    mutationFn: createFn,
    onSuccess: () => {
      setOpen(false);
      refresh();
      setForm(emptyForm);
    },
  });

  return (
    <AdminShell
      title="Events"
      subtitle="Auditions, workshops, finales, and sponsorship events."
      email={email}
      actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#1b4332] hover:bg-[#163828] text-white">+ New event</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                create.mutate({
                  data: {
                    title: form.title,
                    type: form.type,
                    location: form.location || null,
                    starts_at: form.starts_at,
                    ends_at: form.ends_at || null,
                    description: form.description || null,
                    capacity: form.capacity ? Number(form.capacity) : null,
                    ticket_price: Number(form.ticket_price) || 0,
                    banner_url: form.banner_url || null,
                    status: form.status,
                  },
                });
              }}
            >
              <Row><Label>Title</Label>
                <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </Row>
              <Row><Label>Type</Label>
                <Input required placeholder="e.g. Audition, Workshop, Gala, Grand Finale"
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} />
              </Row>
              <Row><Label>Location</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <Row><Label>Starts at</Label>
                  <Input required type="datetime-local" value={form.starts_at}
                    onChange={(e) => setForm({ ...form, starts_at: e.target.value })} />
                </Row>
                <Row><Label>Ends at</Label>
                  <Input type="datetime-local" value={form.ends_at}
                    onChange={(e) => setForm({ ...form, ends_at: e.target.value })} />
                </Row>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Row><Label>Capacity</Label>
                  <Input type="number" min={1} value={form.capacity}
                    onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
                </Row>
                <Row><Label>Ticket price (ZMW)</Label>
                  <Input type="number" step="0.01" value={form.ticket_price}
                    onChange={(e) => setForm({ ...form, ticket_price: e.target.value })} />
                </Row>
              </div>
              <Row><Label>Banner image</Label>
                <ImageUpload
                  value={form.banner_url || null}
                  onChange={(url) => setForm({ ...form, banner_url: url ?? "" })}
                />
              </Row>
              <Row><Label>Description</Label>
                <Textarea rows={3} value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </Row>
              <Row><Label>Status</Label>
                <Select value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as typeof form.status })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="flex justify-end">
                <Button type="submit" disabled={create.isPending}
                  className="bg-[#1b4332] hover:bg-[#163828] text-white">
                  {create.isPending ? "Creating..." : "Create event"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-[#1b4332]/10 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#F5F4EE] text-left text-xs uppercase tracking-wider text-[#1b2a22]/60">
            <tr>
              <th className="px-4 py-3">Event</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tickets</th>
              <th className="px-4 py-3">RSVPs</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1b4332]/10">
            {q.isLoading && <tr><td colSpan={8} className="px-4 py-8 text-center text-[#1b2a22]/60">Loading...</td></tr>}
            {q.data?.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-[#1b2a22]/60">No events yet.</td></tr>
            )}
            {q.data?.map((e) => (
              <tr key={e.id} className="hover:bg-[#F5F4EE]/60">
                <td className="px-4 py-3 font-medium">{e.title}</td>
                <td className="px-4 py-3 capitalize">{e.type.replace(/_/g, " ")}</td>
                <td className="px-4 py-3 text-[#1b2a22]/70">{e.starts_at ?? "-"}</td>
                <td className="px-4 py-3 text-[#1b2a22]/70">{e.location ?? "-"}</td>
                <td className="px-4 py-3"><Badge className={STATUS_COLORS[e.status]}>{e.status}</Badge></td>
                <td className="px-4 py-3 tabular-nums">
                  {e.tickets_sold}{e.capacity ? `/${e.capacity}` : ""}
                </td>
                <td className="px-4 py-3 tabular-nums">{e.rsvps}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" title="Edit"
                      onClick={() => openEdit(e.id)}>
                      <Pencil className="h-4 w-4 text-[#1b4332]" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Publish"
                      onClick={() => setStatus.mutate({ id: e.id, status: "published" })}>
                      <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Draft"
                      onClick={() => setStatus.mutate({ id: e.id, status: "draft" })}>
                      <FileEdit className="h-4 w-4 text-slate-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Cancel"
                      onClick={() => setStatus.mutate({ id: e.id, status: "cancelled" })}>
                      <XCircle className="h-4 w-4 text-amber-700" />
                    </Button>
                    <Button size="sm" variant="ghost" title="Delete"
                      onClick={() => { if (confirm(`Delete "${e.title}"?`)) del.mutate(e.id); }}>
                      <Trash2 className="h-4 w-4 text-red-700" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>



      <Dialog open={editId !== null} onOpenChange={(o) => { if (!o) { setEditId(null); setEditForm(null); } }}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit event</DialogTitle></DialogHeader>
          {!editForm ? (
            <div className="py-8 text-center text-[#1b2a22]/60">Loading…</div>
          ) : (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (editId != null && editForm) update.mutate({ id: editId, data: editForm });
              }}
            >
              <Row><Label>Title</Label>
                <Input required value={editForm.title}
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </Row>
              <Row><Label>Type</Label>
                <Input required placeholder="e.g. Audition, Workshop, Gala, Grand Finale"
                  value={editForm.type}
                  onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} />
              </Row>
              <Row><Label>Location</Label>
                <Input value={editForm.location}
                  onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} />
              </Row>
              <div className="grid grid-cols-2 gap-3">
                <Row><Label>Starts at</Label>
                  <Input required type="datetime-local" value={editForm.starts_at}
                    onChange={(e) => setEditForm({ ...editForm, starts_at: e.target.value })} />
                </Row>
                <Row><Label>Ends at</Label>
                  <Input type="datetime-local" value={editForm.ends_at}
                    onChange={(e) => setEditForm({ ...editForm, ends_at: e.target.value })} />
                </Row>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Row><Label>Capacity</Label>
                  <Input type="number" min={1} value={editForm.capacity}
                    onChange={(e) => setEditForm({ ...editForm, capacity: e.target.value })} />
                </Row>
                <Row><Label>Ticket price (ZMW)</Label>
                  <Input type="number" step="0.01" value={editForm.ticket_price}
                    onChange={(e) => setEditForm({ ...editForm, ticket_price: e.target.value })} />
                </Row>
              </div>
              <Row><Label>Banner image</Label>
                <ImageUpload
                  value={editForm.banner_url || null}
                  onChange={(url) => setEditForm({ ...editForm, banner_url: url ?? "" })}
                />
              </Row>
              <Row><Label>Description</Label>
                <Textarea rows={3} value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </Row>
              <Row><Label>Status</Label>
                <Select value={editForm.status}
                  onValueChange={(v) => setEditForm({ ...editForm, status: v as FormState["status"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </Row>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost"
                  onClick={() => { setEditId(null); setEditForm(null); }}>Cancel</Button>
                <Button type="submit" disabled={update.isPending}
                  className="bg-[#1b4332] hover:bg-[#163828] text-white">
                  {update.isPending ? "Saving..." : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </AdminShell>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1.5">{children}</div>;
}