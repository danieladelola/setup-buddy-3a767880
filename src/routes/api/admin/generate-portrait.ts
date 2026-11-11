import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import { ADMIN_SESSION_CONFIG, type AdminSessionData } from "@/lib/admin-session";
import { getDb } from "@/lib/db.server";
import { ensureSchema } from "@/lib/schema.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash-image";

const PROMPT = `Create a high-end official pageant portrait of the person in the FIRST image, restyled exactly like the SECOND reference image.

Strict requirements:
- Preserve the person's face, skin tone, hair, age and identity from the first image exactly. Do not change facial features.
- Studio portrait, soft warm beige/taupe gradient backdrop, professional softbox lighting.
- Dress the person in an elegant emerald-green evening gown with intricate gold beaded leaf detailing on the bodice (matching the reference).
- Place a tall ornate gold and emerald crystal pageant crown on her head.
- Drape a white satin sash with gold trim diagonally from the right shoulder to the left hip. The sash must clearly read "MISS AGRICULTURE ZAMBIA" in bold green capital letters, with the official Miss Agriculture Zambia logo near the top of the sash.
- Pose: confident, one hand on hip, slight smile, three-quarter body shot.
- Polished, magazine-quality, photorealistic. No watermarks, no extra text.`;

async function fetchAsDataUrl(url: string): Promise<string> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${url} (${r.status})`);
  const mime = r.headers.get("content-type") || "image/png";
  const buf = new Uint8Array(await r.arrayBuffer());
  let bin = "";
  for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
  const b64 = btoa(bin);
  return `data:${mime};base64,${b64}`;
}

export const Route = createFileRoute("/api/admin/generate-portrait")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
        if (!session.data.email) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const apiKey = process.env.LOVABLE_API_KEY;
        if (!apiKey) {
          return Response.json(
            { error: "LOVABLE_API_KEY not configured" },
            { status: 500 },
          );
        }

        let body: { contestant_id?: number; source_url?: string };
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const origin = new URL(request.url).origin;

        // Resolve source photo URL
        let sourceUrl = body.source_url;
        if (!sourceUrl && body.contestant_id) {
          await ensureSchema();
          const sql = getDb();
          const rows = await sql<{ profile_photo: string | null }[]>`
            SELECT profile_photo FROM contestants WHERE id = ${body.contestant_id} LIMIT 1
          `;
          sourceUrl = rows[0]?.profile_photo ?? undefined;
        }
        if (!sourceUrl) {
          return Response.json(
            { error: "No source photo. Upload a profile photo first." },
            { status: 400 },
          );
        }

        const sourceAbs = sourceUrl.startsWith("http") ? sourceUrl : `${origin}${sourceUrl}`;
        const referenceAbs = `${origin}/brand/miss-agri-reference.png`;

        let sourceDataUrl: string;
        let refDataUrl: string;
        try {
          [sourceDataUrl, refDataUrl] = await Promise.all([
            fetchAsDataUrl(sourceAbs),
            fetchAsDataUrl(referenceAbs),
          ]);
        } catch (e) {
          return Response.json(
            { error: e instanceof Error ? e.message : "Image fetch failed" },
            { status: 500 },
          );
        }

        const gwRes = await fetch(GATEWAY_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            model: MODEL,
            modalities: ["image", "text"],
            messages: [
              {
                role: "user",
                content: [
                  { type: "text", text: PROMPT },
                  { type: "image_url", image_url: { url: sourceDataUrl } },
                  { type: "image_url", image_url: { url: refDataUrl } },
                ],
              },
            ],
          }),
        });

        if (!gwRes.ok) {
          const txt = await gwRes.text();
          console.error("[generate-portrait] gateway error", gwRes.status, txt);
          return Response.json(
            { error: `AI gateway error (${gwRes.status})` },
            { status: 502 },
          );
        }

        const data = (await gwRes.json()) as {
          choices?: Array<{
            message?: {
              images?: Array<{ image_url?: { url?: string } }>;
              content?: string;
            };
          }>;
        };
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imageUrl || !imageUrl.startsWith("data:")) {
          return Response.json(
            { error: "Model returned no image" },
            { status: 502 },
          );
        }

        const [, b64] = imageUrl.split(";base64,");
        const mime = imageUrl.substring(5, imageUrl.indexOf(";")) || "image/png";
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

        await ensureSchema();
        const sql = getDb();
        const rows = await sql<{ id: number }[]>`
          INSERT INTO uploaded_files (name, mime_type, size, data)
          VALUES (${"portrait.png"}, ${mime}, ${bytes.length}, ${bytes})
          RETURNING id
        `;
        const id = rows[0].id;
        return Response.json({ url: `/api/files/${id}` });
      },
    },
  },
});
