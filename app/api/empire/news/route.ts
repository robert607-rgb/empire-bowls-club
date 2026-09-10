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

type NewsRow = {
  id: number;
  title: string;
  summary: string;
  body: string;
  category: string;
  accent: string;
  published_at: string;
  object_key?: string | null;
  asset_created_at?: string | null;
};

type NewsDraft = {
  title: string;
  summary: string;
  body: string;
  category: string;
  accent: string;
  file: File | null;
  removeImage: boolean;
};

const imageTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

function mapNews(item: NewsRow) {
  const version = item.asset_created_at
    ? `&v=${encodeURIComponent(item.asset_created_at)}`
    : "";
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    body: item.body,
    category: item.category,
    accent: item.accent,
    imageUrl: item.object_key
      ? `/api/empire/news/image?id=${encodeURIComponent(String(item.id))}${version}`
      : "",
    publishedAt: item.published_at,
  };
}

function readDraft(form: FormData): NewsDraft {
  const fileValue = form.get("image");
  const accentValue = cleanText(form.get("accent"), 10);
  return {
    title: cleanText(form.get("title"), 160),
    summary: cleanText(form.get("summary"), 320),
    body: cleanText(form.get("body"), 2000),
    category: cleanText(form.get("category"), 40) || "Club life",
    accent: ["gold", "green", "red", "navy"].includes(accentValue)
      ? accentValue
      : "gold",
    file:
      fileValue && typeof fileValue !== "string" && fileValue.size > 0
        ? fileValue
        : null,
    removeImage:
      form.get("removeImage") === "on" || form.get("removeImage") === "true",
  };
}

function validateDraft(draft: NewsDraft) {
  if (!draft.title || !draft.summary || !draft.body) {
    return "Add a headline, short introduction and story.";
  }
  if (draft.file) {
    const extension = draft.file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!imageTypes[extension]) return "Please upload a JPG, PNG or WebP image.";
    if (draft.file.size > 8 * 1024 * 1024) {
      return "Please keep newsroom images to 8MB or less.";
    }
  }
  return "";
}

function uploadedImage(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const contentType = imageTypes[extension] ?? "image/jpeg";
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) ||
    `news-image.${extension}`;
  return {
    contentType,
    safeName,
    objectKey: `empire-news/${crypto.randomUUID()}-${safeName}`,
  };
}

async function listNews() {
  const db = await getEmpireDatabase();
  const result = await db
    .prepare(
      `SELECT n.id, n.title, n.summary, n.body, n.category, n.accent, n.published_at,
        a.object_key, a.created_at AS asset_created_at
       FROM empire_news n
       LEFT JOIN empire_news_assets a ON a.news_id = n.id
       ORDER BY n.published_at DESC, n.id DESC`,
    )
    .all<NewsRow>();
  return (result.results ?? []).map(mapNews);
}

export async function GET() {
  try {
    return Response.json(
      { news: await listNews() },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    assertRequestSize(request, MULTIPART_BODY_LIMIT_BYTES);
    const draft = readDraft(await request.formData());
    const validationError = validateDraft(draft);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const publishedAt = new Date().toISOString();
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "INSERT INTO empire_news (title, summary, body, category, accent, emoji, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        draft.title,
        draft.summary,
        draft.body,
        draft.category,
        draft.accent,
        "",
        publishedAt,
        publishedAt,
      )
      .run();
    const id = Number(result.meta.last_row_id);
    let imageUrl = "";

    if (draft.file) {
      const { BUCKET } = await getRuntimeEnv();
      if (!BUCKET) {
        await db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id).run();
        return Response.json(
          { error: "Image storage is not available yet." },
          { status: 503 },
        );
      }
      const image = uploadedImage(draft.file);
      try {
        await BUCKET.put(image.objectKey, draft.file.stream(), {
          httpMetadata: {
            contentType: image.contentType,
            contentDisposition: `inline; filename=\"${image.safeName}\"`,
          },
        });
        await db
          .prepare(
            "INSERT INTO empire_news_assets (news_id, object_key, file_name, content_type, created_at) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(
            id,
            image.objectKey,
            image.safeName,
            image.contentType,
            publishedAt,
          )
          .run();
        imageUrl = `/api/empire/news/image?id=${id}&v=${encodeURIComponent(publishedAt)}`;
      } catch (error) {
        try {
          await BUCKET.delete(image.objectKey);
        } catch (cleanupError) {
          console.error("Empire news image cleanup failed", cleanupError);
        }
        await db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id).run();
        throw error;
      }
    }

    return Response.json(
      {
        news: {
          id,
          title: draft.title,
          summary: draft.summary,
          body: draft.body,
          category: draft.category,
          accent: draft.accent,
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

export async function PUT(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    assertRequestSize(request, MULTIPART_BODY_LIMIT_BYTES);
    const form = await request.formData();
    const id = Number(form.get("id"));
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Choose a valid news item." }, { status: 400 });
    }
    const draft = readDraft(form);
    const validationError = validateDraft(draft);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const db = await getEmpireDatabase();
    const current = await db
      .prepare(
        `SELECT n.id, n.title, n.summary, n.body, n.category, n.accent, n.published_at,
          a.object_key, a.created_at AS asset_created_at
         FROM empire_news n
         LEFT JOIN empire_news_assets a ON a.news_id = n.id
         WHERE n.id = ?`,
      )
      .bind(id)
      .first<NewsRow>();
    if (!current) {
      return Response.json(
        { error: "That news story no longer exists." },
        { status: 404 },
      );
    }

    const oldObjectKey = current.object_key ?? null;
    let bucket: R2Bucket | undefined;
    let uploadedKey = "";
    let replacement: ReturnType<typeof uploadedImage> | null = null;
    const nextAssetCreatedAt = draft.file
      ? new Date().toISOString()
      : draft.removeImage
        ? null
        : current.asset_created_at ?? null;

    if (draft.file) {
      ({ BUCKET: bucket } = await getRuntimeEnv());
      if (!bucket) {
        return Response.json(
          { error: "Image storage is not available yet." },
          { status: 503 },
        );
      }
      replacement = uploadedImage(draft.file);
      uploadedKey = replacement.objectKey;
      try {
        await bucket.put(uploadedKey, draft.file.stream(), {
          httpMetadata: {
            contentType: replacement.contentType,
            contentDisposition: `inline; filename=\"${replacement.safeName}\"`,
          },
        });
      } catch (error) {
        try {
          await bucket.delete(uploadedKey);
        } catch (cleanupError) {
          console.error("Empire news image cleanup failed", cleanupError);
        }
        throw error;
      }
    } else if (draft.removeImage && oldObjectKey) {
      ({ BUCKET: bucket } = await getRuntimeEnv());
    }

    const nextObjectKey = replacement?.objectKey ??
      (draft.removeImage ? null : oldObjectKey);
    try {
      const statements = [
        db
          .prepare(
            "UPDATE empire_news SET title = ?, summary = ?, body = ?, category = ?, accent = ? WHERE id = ?",
          )
          .bind(
            draft.title,
            draft.summary,
            draft.body,
            draft.category,
            draft.accent,
            id,
          ),
      ];
      if (replacement && oldObjectKey) {
        statements.push(
          db
            .prepare(
              "UPDATE empire_news_assets SET object_key = ?, file_name = ?, content_type = ?, created_at = ? WHERE news_id = ?",
            )
            .bind(
              replacement.objectKey,
              replacement.safeName,
              replacement.contentType,
              nextAssetCreatedAt,
              id,
            ),
        );
      } else if (replacement) {
        statements.push(
          db
            .prepare(
              "INSERT INTO empire_news_assets (news_id, object_key, file_name, content_type, created_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(
              id,
              replacement.objectKey,
              replacement.safeName,
              replacement.contentType,
              nextAssetCreatedAt,
            ),
        );
      } else if (draft.removeImage && oldObjectKey) {
        statements.push(
          db
            .prepare("DELETE FROM empire_news_assets WHERE news_id = ?")
            .bind(id),
        );
      }
      await db.batch(statements);
    } catch (error) {
      if (uploadedKey && bucket) {
        try {
          await bucket.delete(uploadedKey);
        } catch (cleanupError) {
          console.error("Empire news image cleanup failed", cleanupError);
        }
      }
      throw error;
    }

    if (oldObjectKey && (replacement || draft.removeImage) && bucket) {
      try {
        await bucket.delete(oldObjectKey);
      } catch (error) {
        console.error("Empire news image cleanup failed", error);
      }
    }

    return Response.json({
      news: mapNews({
        ...current,
        title: draft.title,
        summary: draft.summary,
        body: draft.body,
        category: draft.category,
        accent: draft.accent,
        object_key: nextObjectKey,
        asset_created_at: nextAssetCreatedAt,
      }),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Choose a valid news item." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const asset = await db
      .prepare("SELECT object_key FROM empire_news_assets WHERE news_id = ?")
      .bind(id)
      .first<{ object_key: string }>();
    await db.batch([
      db.prepare("DELETE FROM empire_news_assets WHERE news_id = ?").bind(id),
      db.prepare("DELETE FROM empire_news WHERE id = ?").bind(id),
    ]);
    if (asset?.object_key) {
      try {
        const { BUCKET } = await getRuntimeEnv();
        if (BUCKET) await BUCKET.delete(asset.object_key);
      } catch (error) {
        console.error("Empire news image cleanup failed", error);
      }
    }
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
