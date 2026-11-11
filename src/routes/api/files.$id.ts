import { createFileRoute } from "@tanstack/react-router";
import { getDb } from "@/lib/db.server";
import { ensureSchema } from "@/lib/schema.server";

export const Route = createFileRoute("/api/files/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.id);
        if (!Number.isFinite(id)) return new Response("Bad id", { status: 400 });
        await ensureSchema();
        const sql = getDb();
        const rows = await sql<{ mime_type: string; data: Uint8Array }[]>`
          SELECT mime_type, data FROM uploaded_files WHERE id = ${id} LIMIT 1
        `;
        if (rows.length === 0) return new Response("Not found", { status: 404 });
        const row = rows[0];
        return new Response(row.data as unknown as BodyInit, {
          headers: {
            "content-type": row.mime_type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
