import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ContestantInput } from "@/lib/contestants.functions";
import { ImageUpload, MultiImageUpload } from "@/components/admin/file-upload";
import { GeneratePortraitButton } from "@/components/admin/generate-portrait-button";


const ZAMBIAN_PROVINCES = [
  "Central",
  "Copperbelt",
  "Eastern",
  "Luapula",
  "Lusaka",
  "Muchinga",
  "Northern",
  "North-Western",
  "Southern",
  "Western",
];

export type ContestantFormValues = ContestantInput;

export function ContestantForm({
  initial,
  onSubmit,
  submitting,
  submitLabel = "Save contestant",
}: {
  initial?: Partial<ContestantFormValues> & { gallery_images?: string[] };
  onSubmit: (v: ContestantFormValues) => void;
  submitting?: boolean;
  submitLabel?: string;
}) {
  const [v, setV] = useState<ContestantFormValues>({
    full_name: initial?.full_name ?? "",
    age: initial?.age ?? null,
    province: initial?.province ?? "",
    district: initial?.district ?? "",
    biography: initial?.biography ?? "",
    profile_photo: initial?.profile_photo ?? "",
    gallery_images: initial?.gallery_images ?? [],
    social_links: initial?.social_links ?? {},
    agri_project: initial?.agri_project ?? "",
    education: initial?.education ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    status: (initial?.status as ContestantFormValues["status"]) ?? "pending",
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(v);
  }

  const card = "rounded-xl border border-[#1b4332]/10 bg-white p-6 shadow-sm";

  return (
    <form onSubmit={submit} className="space-y-6">
      <section className={card}>
        <h3 className="font-serif text-lg text-[#1b2a22]">Identity</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Full name" required>
            <Input
              required
              value={v.full_name}
              onChange={(e) => setV({ ...v, full_name: e.target.value })}
            />
          </Field>
          <Field label="Age">
            <Input
              type="number"
              min={16}
              max={60}
              value={v.age ?? ""}
              onChange={(e) =>
                setV({ ...v, age: e.target.value ? Number(e.target.value) : null })
              }
            />
          </Field>
          <Field label="Province">
            <Select
              value={v.province ?? ""}
              onValueChange={(val) => setV({ ...v, province: val })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {ZAMBIAN_PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="District">
            <Input
              value={v.district ?? ""}
              onChange={(e) => setV({ ...v, district: e.target.value })}
            />
          </Field>
          <Field label="Status">
            <Select
              value={v.status}
              onValueChange={(val) =>
                setV({ ...v, status: val as ContestantFormValues["status"] })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>

      <section className={card}>
        <h3 className="font-serif text-lg text-[#1b2a22]">Biography and project</h3>
        <div className="mt-4 grid gap-4">
          <Field label="Biography">
            <Textarea
              rows={5}
              value={v.biography ?? ""}
              onChange={(e) => setV({ ...v, biography: e.target.value })}
            />
          </Field>
          <Field label="Agricultural project">
            <Textarea
              rows={4}
              value={v.agri_project ?? ""}
              onChange={(e) => setV({ ...v, agri_project: e.target.value })}
            />
          </Field>
          <Field label="Education">
            <Input
              value={v.education ?? ""}
              onChange={(e) => setV({ ...v, education: e.target.value })}
            />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h3 className="font-serif text-lg text-[#1b2a22]">Media</h3>
        <div className="mt-4 grid gap-4">
          <Field label="Profile photo">
            <ImageUpload
              value={v.profile_photo ?? null}
              onChange={(url) => setV({ ...v, profile_photo: url ?? "" })}
            />
            <GeneratePortraitButton
              sourceUrl={v.profile_photo ?? ""}
              onGenerated={(url) => setV({ ...v, profile_photo: url })}
            />
          </Field>

          <Field label="Gallery images">
            <MultiImageUpload
              values={v.gallery_images ?? []}
              onChange={(urls) => setV({ ...v, gallery_images: urls })}
            />
          </Field>
        </div>
      </section>

      <section className={card}>
        <h3 className="font-serif text-lg text-[#1b2a22]">Contact and social</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Email">
            <Input
              type="email"
              value={v.email ?? ""}
              onChange={(e) => setV({ ...v, email: e.target.value })}
            />
          </Field>
          <Field label="Phone">
            <Input
              value={v.phone ?? ""}
              onChange={(e) => setV({ ...v, phone: e.target.value })}
            />
          </Field>
          {(["facebook", "instagram", "twitter", "tiktok"] as const).map((key) => (
            <Field key={key} label={key[0].toUpperCase() + key.slice(1)}>
              <Input
                placeholder={`https://${key}.com/...`}
                value={(v.social_links as Record<string, string>)?.[key] ?? ""}
                onChange={(e) =>
                  setV({
                    ...v,
                    social_links: { ...(v.social_links ?? {}), [key]: e.target.value },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={submitting}
          className="bg-[#1b4332] hover:bg-[#163828] text-white"
        >
          {submitting ? "Saving..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label className="mb-1.5 block text-xs uppercase tracking-wider text-[#1b2a22]/60">
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </Label>
      {children}
    </div>
  );
}