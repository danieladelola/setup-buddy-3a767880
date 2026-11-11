import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/lib/db.server";
import { ensureSchema } from "@/lib/schema.server";

const MAX_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"];

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
}

export const Route = createFileRoute("/api/public/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "No file" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        const mime = file.type || "application/octet-stream";
        if (!ALLOWED.includes(mime)) {
          return new Response(JSON.stringify({ error: "Unsupported file type" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        if (file.size > MAX_SIZE) {
          return new Response(JSON.stringify({ error: "File too large (max 8MB)" }), {
            status: 400, headers: { "content-type": "application/json" },
          });
        }
        try {
          await ensureSchema();
          const sql = getDb();
          const bytes = new Uint8Array(await file.arrayBuffer());
          const name = safeName(file.name || "file");
          const rows = await sql<{ id: number }[]>`
            INSERT INTO uploaded_files (name, mime_type, size, data)
            VALUES (${name}, ${mime}, ${file.size}, ${bytes})
            RETURNING id
          `;
          return Response.json({ url: `/api/files/${rows[0].id}` });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          console.error("[public upload]", msg);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500, headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
