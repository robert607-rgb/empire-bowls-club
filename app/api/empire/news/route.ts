import {
  apiError,
  cleanText,
  getEmpireDatabase,
  getRuntimeEnv,
  hasEmpireAccess,
  unauthorized,
} from "../_server";

type NewsRow = {
  id: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  accent: string;
  published_at: string;
  object_key?: string | null;
};

function mapNews(item: NewsRow) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    category: item.category,
    accent: item.accent,
    imageUrl: item.object_key
      ? `/api/empire/news/image?id=${encodeURIComponent(String(item.id))}`
      : "",
    publishedAt: item.published_at,
  };
}

async function listNews() {
  const db = await getEmpireDatabase();
  const result = await db
    .prepare(
      `SELECT n.id, n.title, n.summary, n.body, n.category, n.accent, n.published_at,
        a.object_key
       FROM empire_news n
       LEFT JOIN empire_news_assets a ON a.news_id = n.id
       ORDER BY n.published_at DESC, n.id DESC`,
    )
    .all<NewsRow>();
  return (result.results ?? []).map(mapNews);
}

export async function GET() {
  try {
    return Response.json({ news: await listNews() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!hasEmpireAccess(request, true)) return unauthorized();
  try {
    const form = await request.formData();
    const title = cleanText(form.get("title"), 160);
    const summary = cleanText(form.get("summary"), 320);
    const body = cleanText(form.get("body"), 2000);
    const category = cleanText(form.get("category"), 40) || "Club life";
    const accentValue = cleanText(form.get("accent"), 10);
    const accent = ["gold", "green", "red", "navy"].includes(accentValue)
      ? accentValue
      : "gold";
    const fileValue = form.get("image");
    const file =
      fileValue && typeof fileValue !== "string" && fileValue.size > 0
        ? fileValue
        : null;
    if (!title || !summary || !body)
      return Response.json(
        { error: "Add a headline, short introduction and story." },
        { status: 400 },
      );
    if (file) {
      if (!file.type.startsWith("image/"))
        return Response.json(
          { error: "Please upload a JPG, PNG or WebP image." },
          { status: 400 },
        );
      if (file.size > 8 * 1024 * 1024)
        return Response.json(
          { error: "Please keep newsroom images to 8MB or less." },
          { status: 400 },
        );
    }
    const publishedAt = new Date().toISOString();
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "INSERT INTO empire_news (title, summary, body, category, accent, emoji, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        title,
        summary,
        body,
        category,
        accent,
        "",
        publishedAt,
        publishedAt,
      )
      .run();
    const id = Number(result.meta.last_row_id);
    let imageUrl = "";
    if (file) {
      const { BUCKET } = await getRuntimeEnv();
      if (!BUCKET) {
        await db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id).run();
        return Response.json(
          { error: "Image storage is not available yet." },
          { status: 503 },
        );
      }
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeName =
        file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) ||
        `news-image.${extension}`;
      const objectKey = `empire-news/${crypto.randomUUID()}-${safeName}`;
      try {
        await BUCKET.put(objectKey, file.stream(), {
          httpMetadata: {
            contentType: file.type || "image/jpeg",
            contentDisposition: `inline; filename=\"${safeName}\"`,
          },
        });
        await db
          .prepare(
            "INSERT INTO empire_news_assets (news_id, object_key, file_name, content_type, created_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(id, objectKey, safeName, file.type || "image/jpeg", publishedAt)
          .run();
        imageUrl = `/api/empire/news/image?id=${id}`;
      } catch (error) {
        await BUCKET.delete(objectKey);
        await db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id).run();
        throw error;
      }
    }
    return Response.json(
      {
        news: {
          id,
          title,
          summary,
          body,
          category,
          accent,
          imageUrl,
          publishedAt,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!hasEmpireAccess(request, true)) return unauthorized();
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const id = Number(input.id);
    if (!Number.isInteger(id))
      return Response.json(
        { error: "Choose a valid news item." },
        { status: 400 },
      );
    const db = await getEmpireDatabase();
    const asset = await db
      .prepare("SELECT object_key FROM empire_news_assets WHERE news_id = ?")
      .bind(id)
      .first<{ object_key: string }>();
    if (asset?.object_key) {
      const { BUCKET } = await getRuntimeEnv();
      if (BUCKET) await BUCKET.delete(asset.object_key);
    }
    await db.batch([
      db.prepare("DELETE FROM empire_news_assets WHERE news_id = ?").bind(id),
      db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id),
    ]);
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
