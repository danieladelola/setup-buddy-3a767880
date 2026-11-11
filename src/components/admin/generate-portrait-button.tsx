import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";

export function GeneratePortraitButton({
  sourceUrl,
  onGenerated,
}: {
  sourceUrl: string;
  onGenerated: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setErr(null);
    if (!sourceUrl) {
      setErr("Upload a profile photo first.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/generate-portrait", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ source_url: sourceUrl }),
      });
      const j = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || "Generation failed");
      onGenerated(j.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-2 space-y-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy || !sourceUrl}
        onClick={run}
        className="gap-2"
      >
        <Sparkles className="h-4 w-4" />
        {busy ? "Generating official portrait…" : "Generate official portrait"}
      </Button>
      <p className="text-xs text-[#1b2a22]/60">
        Restyles the uploaded photo into the Miss Agriculture Zambia sash, crown and emerald gown. May take ~30 seconds.
      </p>
      {err && <p className="text-xs text-red-700">{err}</p>}
    </div>
  );
}
