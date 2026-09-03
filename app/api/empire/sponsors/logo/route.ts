import { apiError, getEmpireDatabase, getRuntimeEnv } from "../../_server";

type SponsorLogoRow = { logo_object_key: string; logo_file_name: string; logo_content_type: string };

export async function GET(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) return Response.json({ error: "Invalid sponsor logo." }, { status: 400 });
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "Image storage is not available yet." }, { status: 503 });
    const db = await getEmpireDatabase();
    const row = await db
      .prepare("SELECT logo_object_key, logo_file_name, logo_content_type FROM empire_sponsors WHERE id = ?")
      .bind(id)
      .first<SponsorLogoRow>();
    if (!row) return new Response("Not found", { status: 404 });
    const object = await BUCKET.get(row.logo_object_key);
    if (!object) return new Response("Not found", { status: 404 });
    const filename = row.logo_file_name.replace(/[\"\\]/g, "-");
    return new Response(object.body, {
      headers: {
        "content-type": row.logo_content_type,
        "content-disposition": `inline; filename="${filename}"`,
        // Sponsor URLs include the record creation version and therefore remain
        // safe to cache until the logo is replaced with a new record version.
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
