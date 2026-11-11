import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

async function uploadFile(file: File): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(j.error || "Upload failed");
  }
  const j = (await res.json()) as { url: string };
  return j.url;
}

export function ImageUpload({
  value,
  onChange,
  accept = "image/*",
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {value && (
        <div className="relative inline-block">
          <img src={value} alt="" className="h-24 w-24 rounded-md border border-[#1b4332]/10 object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-0.5 text-white shadow"
            aria-label="Remove"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <Input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr(null);
          setBusy(true);
          try {
            const url = await uploadFile(f);
            onChange(url);
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Upload failed");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      {busy && <p className="text-xs text-[#1b2a22]/60">Uploading…</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  );
}

export function MultiImageUpload({
  values,
  onChange,
  accept = "image/*",
}: {
  values: string[];
  onChange: (urls: string[]) => void;
  accept?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((u, i) => (
            <div key={u + i} className="relative">
              <img src={u} alt="" className="h-20 w-20 rounded-md border border-[#1b4332]/10 object-cover" />
              <button
                type="button"
                onClick={() => onChange(values.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 rounded-full bg-red-600 p-0.5 text-white shadow"
                aria-label="Remove"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <Input
        type="file"
        accept={accept}
        multiple
        disabled={busy}
        onChange={async (e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length === 0) return;
          setErr(null);
          setBusy(true);
          try {
            const urls: string[] = [];
            for (const f of files) urls.push(await uploadFile(f));
            onChange([...values, ...urls]);
          } catch (ex) {
            setErr(ex instanceof Error ? ex.message : "Upload failed");
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      {busy && <p className="text-xs text-[#1b2a22]/60">Uploading…</p>}
      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
