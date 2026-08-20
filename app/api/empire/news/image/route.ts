import { apiError, getEmpireDatabase, getRuntimeEnv } from "../../_server";

type AssetRow = { object_key: string; file_name: string; content_type: string };

export async function GET(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id))
      return Response.json({ error: "Invalid news image." }, { status: 400 });
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET)
      return Response.json(
        { error: "Image storage is not available yet." },
        { status: 503 },
      );
    const db = await getEmpireDatabase();
    const row = await db
      .prepare(
        "SELECT object_key, file_name, content_type FROM empire_news_assets WHERE news_id = ?",
      )
      .bind(id)
      .first<AssetRow>();
    if (!row) return new Response("Not found", { status: 404 });
    const object = await BUCKET.get(row.object_key);
    if (!object) return new Response("Not found", { status: 404 });
    const filename = row.file_name.replace(/[\"\\]/g, "-");
    return new Response(object.body, {
      headers: {
        "content-type": row.content_type,
        "content-disposition": `inline; filename=\"${filename}\"`,
        "cache-control": "public, max-age=300",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
