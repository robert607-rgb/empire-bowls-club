import {
  apiError,
  cleanText,
  getEmpireDatabase,
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
  emoji: string;
  published_at: string;
};

function mapNews(item: NewsRow) {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    category: item.category,
    accent: item.accent,
    emoji: item.emoji,
    publishedAt: item.published_at,
  };
}

export async function GET() {
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, title, summary, body, category, accent, emoji, published_at FROM empire_news ORDER BY published_at DESC, id DESC",
      )
      .all<NewsRow>();
    return Response.json({ news: (result.results ?? []).map(mapNews) });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!hasEmpireAccess(request, true)) return unauthorized();
  try {
    const input = (await request.json()) as Record<string, unknown>;
    const title = cleanText(input.title, 160),
      summary = cleanText(input.summary, 320),
      body = cleanText(input.body, 2000);
    const category = cleanText(input.category, 40) || "Club life";
    const accent = ["gold", "green", "red", "navy"].includes(
      cleanText(input.accent, 10),
    )
      ? cleanText(input.accent, 10)
      : "gold";
    const emoji = cleanText(input.emoji, 8) || "📰";
    if (!title || !summary || !body)
      return Response.json(
        { error: "Add a headline, short introduction and story." },
        { status: 400 },
      );
    const publishedAt = new Date().toISOString(),
      db = await getEmpireDatabase();
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
        emoji,
        publishedAt,
        publishedAt,
      )
      .run();
    return Response.json(
      {
        news: {
          id: result.meta.last_row_id,
          title,
          summary,
          body,
          category,
          accent,
          emoji,
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
    const input = (await request.json()) as Record<string, unknown>,
      id = Number(input.id);
    if (!Number.isInteger(id))
      return Response.json(
        { error: "Choose a valid news item." },
        { status: 400 },
      );
    const db = await getEmpireDatabase();
    await db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
