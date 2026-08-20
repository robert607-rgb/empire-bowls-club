import { apiError, getEmpireDatabase, getRuntimeEnv, hasEmpireAccess, unauthorized } from "../../_server";

type UploadRow = { object_key: string; file_name: string; content_type: string };

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  const { id } = await context.params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Invalid file." }, { status: 400 });
  try {
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "File storage is not available yet." }, { status: 503 });
    const db = await getEmpireDatabase();
    const row = await db.prepare("SELECT object_key, file_name, content_type FROM empire_uploads WHERE id = ?").bind(Number(id)).first<UploadRow>();
    if (!row) return Response.json({ error: "That file is no longer available." }, { status: 404 });
    const object = await BUCKET.get(row.object_key);
    if (!object) return Response.json({ error: "That file is no longer available." }, { status: 404 });
    const filename = row.file_name.replace(/[\"\\]/g, "-");
    return new Response(object.body, { headers: { "content-type": row.content_type, "content-disposition": `attachment; filename=\"${filename}\"`, "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) { return apiError(error); }
}
