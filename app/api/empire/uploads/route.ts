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

const categories = new Set(["team_sheet", "club_document", "players_required"]);
const allowedExtensions = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "jpg",
  "jpeg",
  "png",
]);
const contentTypes: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

type UploadRow = {
  id: number;
  category: "team_sheet" | "club_document" | "players_required";
  title: string;
  description: string;
  file_name: string;
  object_key: string;
  content_type: string;
  created_at: string;
};

type UploadDraft = {
  category: string;
  title: string;
  description: string;
  file: File | null;
};

function mapFile(file: UploadRow) {
  return {
    id: file.id,
    category: file.category,
    title: file.title,
    description: file.description,
    fileName: file.file_name,
    createdAt: file.created_at,
  };
}

function readDraft(form: FormData): UploadDraft {
  const fileValue = form.get("file");
  return {
    category: cleanText(form.get("category"), 40),
    title: cleanText(form.get("title"), 160),
    description: cleanText(form.get("description"), 500),
    file:
      fileValue && typeof fileValue !== "string" && fileValue.size > 0
        ? fileValue
        : null,
  };
}

function validateDraft(draft: UploadDraft, requiresFile: boolean) {
  if (
    !categories.has(draft.category) ||
    !draft.title ||
    (requiresFile && !draft.file)
  ) {
    return "Please select a file, title and update type.";
  }
  if (draft.file) {
    const extension = draft.file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!allowedExtensions.has(extension) || draft.file.size > 8 * 1024 * 1024) {
      return "Use a PDF, Word, Excel, JPG or PNG file of 8MB or less.";
    }
  }
  return "";
}

function uploadedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const safeName =
    file.name.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-120) ||
    `upload.${extension}`;
  return {
    safeName,
    contentType: contentTypes[extension],
    objectKey: `empire/${crypto.randomUUID()}-${safeName}`,
  };
}

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, category, title, description, file_name, object_key, content_type, created_at FROM empire_uploads ORDER BY created_at DESC, id DESC",
      )
      .all<UploadRow>();
    return Response.json(
      { files: (result.results ?? []).map(mapFile) },
      { headers: { "cache-control": "no-store" } },
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
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) {
      return Response.json(
        { error: "File storage is not available yet." },
        { status: 503 },
      );
    }
    assertRequestSize(request, MULTIPART_BODY_LIMIT_BYTES);
    const draft = readDraft(await request.formData());
    const validationError = validateDraft(draft, true);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const file = draft.file as File;
    const uploaded = uploadedFile(file);
    const createdAt = new Date().toISOString();
    await BUCKET.put(uploaded.objectKey, file.stream(), {
      httpMetadata: {
        contentType: uploaded.contentType,
        contentDisposition: `attachment; filename=\"${uploaded.safeName}\"`,
      },
    });
    try {
      const db = await getEmpireDatabase();
      const result = await db
        .prepare(
          "INSERT INTO empire_uploads (category, title, description, file_name, object_key, content_type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          draft.category,
          draft.title,
          draft.description,
          uploaded.safeName,
          uploaded.objectKey,
          uploaded.contentType,
          createdAt,
        )
        .run();
      return Response.json(
        {
          file: mapFile({
            id: Number(result.meta.last_row_id),
            category: draft.category as UploadRow["category"],
            title: draft.title,
            description: draft.description,
            file_name: uploaded.safeName,
            object_key: uploaded.objectKey,
            content_type: uploaded.contentType,
            created_at: createdAt,
          }),
        },
        { status: 201 },
      );
    } catch (error) {
      try {
        await BUCKET.delete(uploaded.objectKey);
      } catch (cleanupError) {
        console.error("Empire upload cleanup failed", cleanupError);
      }
      throw error;
    }
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
      return Response.json({ error: "Choose a valid file." }, { status: 400 });
    }
    const draft = readDraft(form);
    const validationError = validateDraft(draft, false);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const db = await getEmpireDatabase();
    const current = await db
      .prepare(
        "SELECT id, category, title, description, file_name, object_key, content_type, created_at FROM empire_uploads WHERE id = ?",
      )
      .bind(id)
      .first<UploadRow>();
    if (!current) {
      return Response.json({ error: "That file no longer exists." }, { status: 404 });
    }

    let bucket: R2Bucket | undefined;
    let replacement: ReturnType<typeof uploadedFile> | null = null;
    if (draft.file) {
      ({ BUCKET: bucket } = await getRuntimeEnv());
      if (!bucket) {
        return Response.json(
          { error: "File storage is not available yet." },
          { status: 503 },
        );
      }
      replacement = uploadedFile(draft.file);
      try {
        await bucket.put(replacement.objectKey, draft.file.stream(), {
          httpMetadata: {
            contentType: replacement.contentType,
            contentDisposition: `attachment; filename=\"${replacement.safeName}\"`,
          },
        });
      } catch (error) {
        try {
          await bucket.delete(replacement.objectKey);
        } catch (cleanupError) {
          console.error("Empire upload cleanup failed", cleanupError);
        }
        throw error;
      }
    }

    try {
      await db
        .prepare(
          "UPDATE empire_uploads SET category = ?, title = ?, description = ?, file_name = ?, object_key = ?, content_type = ? WHERE id = ?",
        )
        .bind(
          draft.category,
          draft.title,
          draft.description,
          replacement?.safeName ?? current.file_name,
          replacement?.objectKey ?? current.object_key,
          replacement?.contentType ?? current.content_type,
          id,
        )
        .run();
    } catch (error) {
      if (replacement && bucket) {
        try {
          await bucket.delete(replacement.objectKey);
        } catch (cleanupError) {
          console.error("Empire upload cleanup failed", cleanupError);
        }
      }
      throw error;
    }

    if (replacement && bucket) {
      try {
        await bucket.delete(current.object_key);
      } catch (error) {
        console.error("Empire upload cleanup failed", error);
      }
    }

    return Response.json({
      file: mapFile({
        ...current,
        category: draft.category as UploadRow["category"],
        title: draft.title,
        description: draft.description,
        file_name: replacement?.safeName ?? current.file_name,
        object_key: replacement?.objectKey ?? current.object_key,
        content_type: replacement?.contentType ?? current.content_type,
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
      return Response.json({ error: "Choose a valid file." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const current = await db
      .prepare("SELECT object_key FROM empire_uploads WHERE id = ?")
      .bind(id)
      .first<{ object_key: string }>();
    if (!current) {
      return Response.json({ error: "That file no longer exists." }, { status: 404 });
    }
    await db.prepare("DELETE FROM empire_uploads WHERE id = ?").bind(id).run();
    try {
      const { BUCKET } = await getRuntimeEnv();
      if (BUCKET) await BUCKET.delete(current.object_key);
    } catch (error) {
      console.error("Empire upload cleanup failed", error);
    }
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
