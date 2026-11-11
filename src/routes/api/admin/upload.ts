import { createFileRoute } from "@tanstack/react-router";
import { useSession } from "@tanstack/react-start/server";
import { ADMIN_SESSION_CONFIG, type AdminSessionData } from "@/lib/admin-session";
import { getDb } from "@/lib/db.server";
import { ensureSchema } from "@/lib/schema.server";

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120);
}

export const Route = createFileRoute("/api/admin/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const session = await useSession<AdminSessionData>(ADMIN_SESSION_CONFIG);
        if (!session.data.email) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) {
          return new Response(JSON.stringify({ error: "No file" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        try {
          await ensureSchema();
          const sql = getDb();
          const bytes = new Uint8Array(await file.arrayBuffer());
          const mime = file.type || "application/octet-stream";
          const name = safeName(file.name || "file");
          const rows = await sql<{ id: number }[]>`
            INSERT INTO uploaded_files (name, mime_type, size, data)
            VALUES (${name}, ${mime}, ${file.size}, ${bytes})
            RETURNING id
          `;
          const id = rows[0].id;
          return Response.json({
            url: `/api/files/${id}`,
            path: String(id),
            mime_type: mime,
            size: file.size,
            name: file.name,
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Upload failed";
          console.error("[upload] failed:", msg);
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
