import {
  apiError,
  assertRequestSize,
  cleanText,
  getEmpireDatabase,
  getRuntimeEnv,
  hasEmpireAccess,
  MULTIPART_BODY_LIMIT_BYTES,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

const allowedImageTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

type SponsorRow = {
  id: number;
  title: string;
  description: string;
  website: string;
  logo_object_key: string;
  logo_file_name: string;
  logo_content_type: string;
  created_at: string;
};

function mapSponsor(sponsor: SponsorRow) {
  return {
    id: sponsor.id,
    title: sponsor.title,
    description: sponsor.description,
    website: sponsor.website,
    logoUrl: `/api/empire/sponsors/logo?id=${sponsor.id}&v=${encodeURIComponent(sponsor.created_at)}`,
    createdAt: sponsor.created_at,
  };
}

function readWebsite(value: FormDataEntryValue | null) {
  const raw = cleanText(value, 300);
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  } catch {
    return "";
  }
}

function readImage(value: FormDataEntryValue | null) {
  return value && typeof value !== "string" && value.size > 0 ? value : null;
}

function validatedImage(file: File | null) {
  if (!file) return null;
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const contentType = allowedImageTypes[extension];
  if (!contentType || file.size > 4 * 1024 * 1024) return null;
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) || `sponsor-logo.${extension}`;
  return { safeName, contentType, objectKey: `empire/sponsors/${crypto.randomUUID()}-${safeName}` };
}

export async function GET() {
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, title, description, website, logo_object_key, logo_file_name, logo_content_type, created_at FROM empire_sponsors ORDER BY created_at DESC, id DESC",
      )
      .all<SponsorRow>();
    return Response.json(
      { sponsors: (result.results ?? []).map(mapSponsor) },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    assertRequestSize(request, MULTIPART_BODY_LIMIT_BYTES);
    const form = await request.formData();
    const title = cleanText(form.get("title"), 160);
    const description = cleanText(form.get("description"), 500);
    const website = readWebsite(form.get("website"));
    const file = readImage(form.get("logo"));
    const image = validatedImage(file);
    if (!title || !description || !website || !image || !file) {
      return Response.json(
        { error: "Add a sponsor name, short description, valid web address and a JPG, PNG or WebP logo (4MB or less)." },
        { status: 400 },
      );
    }
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "Image storage is not available yet." }, { status: 503 });
    await BUCKET.put(image.objectKey, file.stream(), {
      httpMetadata: { contentType: image.contentType, contentDisposition: `inline; filename="${image.safeName}"` },
    });
    const createdAt = new Date().toISOString();
    try {
      const db = await getEmpireDatabase();
      const result = await db
        .prepare(
          "INSERT INTO empire_sponsors (title, description, website, logo_object_key, logo_file_name, logo_content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(title, description, website, image.objectKey, image.safeName, image.contentType, createdAt)
        .run();
      return Response.json(
        {
          sponsor: mapSponsor({
            id: Number(result.meta.last_row_id), title, description, website,
            logo_object_key: image.objectKey, logo_file_name: image.safeName,
            logo_content_type: image.contentType, created_at: createdAt,
          }),
        },
        { status: 201 },
      );
    } catch (error) {
      try { await BUCKET.delete(image.objectKey); } catch (cleanupError) { console.error("Empire sponsor cleanup failed", cleanupError); }
      throw error;
    }
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid sponsor." }, { status: 400 });
    const db = await getEmpireDatabase();
    const current = await db
      .prepare("SELECT logo_object_key FROM empire_sponsors WHERE id = ?")
      .bind(id)
      .first<{ logo_object_key: string }>();
    if (!current) return Response.json({ error: "Sponsor not found." }, { status: 404 });
    await db.prepare("DELETE FROM empire_sponsors WHERE id = ?").bind(id).run();
    try {
      const { BUCKET } = await getRuntimeEnv();
      if (BUCKET) await BUCKET.delete(current.logo_object_key);
    } catch (error) {
      console.error("Empire sponsor cleanup failed", error);
    }
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
