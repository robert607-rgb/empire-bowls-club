import { apiError, assertRequestSize, cleanText, getEmpireDatabase, getRuntimeEnv, hasEmpireAccess, MULTIPART_BODY_LIMIT_BYTES, sameOrigin, unauthorized } from "../_server";

const categories = new Set(["team_sheet", "club_document", "players_required"]);
const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "jpg", "jpeg", "png"]);
const contentTypes: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};
type UploadRow = { id: number; category: "team_sheet" | "club_document" | "players_required"; title: string; description: string; file_name: string; created_at: string };

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db.prepare("SELECT id, category, title, description, file_name, created_at FROM empire_uploads ORDER BY created_at DESC").all<UploadRow>();
    return Response.json({ files: (result.results ?? []).map((file) => ({ id: file.id, category: file.category, title: file.title, description: file.description, fileName: file.file_name, createdAt: file.created_at })) });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "File storage is not available yet." }, { status: 503 });
    assertRequestSize(request, MULTIPART_BODY_LIMIT_BYTES);
    const form = await request.formData(); const category = cleanText(form.get("category"), 40); const title = cleanText(form.get("title"), 160); const description = cleanText(form.get("description"), 500); const file = form.get("file");
    if (!categories.has(category) || !title || !file || typeof file === "string") return Response.json({ error: "Please select a file, title and update type." }, { status: 400 });
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension) || file.size > 8 * 1024 * 1024) return Response.json({ error: "Use a PDF, Word, Excel, JPG or PNG file of 8MB or less." }, { status: 400 });
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `upload.${extension}`; const objectKey = `empire/${crypto.randomUUID()}-${safeName}`; const contentType = contentTypes[extension];
    await BUCKET.put(objectKey, file.stream(), { httpMetadata: { contentType, contentDisposition: `attachment; filename=\"${safeName}\"` } });
    const db = await getEmpireDatabase();
    try { await db.prepare("INSERT INTO empire_uploads (category, title, description, file_name, object_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(category, title, description, safeName, objectKey, contentType, new Date().toISOString()).run(); }
    catch (error) { await BUCKET.delete(objectKey); throw error; }
    return Response.json({ file: { title } }, { status: 201 });
  } catch (error) { return apiError(error); }
}
