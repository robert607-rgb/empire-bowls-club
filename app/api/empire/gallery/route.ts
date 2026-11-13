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
import { listGalleryAlbums } from "./gallery-data";

const MAX_PHOTOS_PER_UPLOAD = 24;
const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

function readPhotos(form: FormData) {
  return form.getAll("photos").filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
}

function safePhoto(file: File) {
  if (file.type !== "image/webp" || !file.name.toLowerCase().endsWith(".webp") || file.size > MAX_PHOTO_BYTES) {
    return null;
  }
  const baseName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/\.webp$/i, "").slice(-100) || "gallery-photo";
  return { fileName: `${baseName}.webp`, contentType: "image/webp" };
}

export async function GET() {
  try {
    return Response.json(
      { albums: await listGalleryAlbums() },
      { headers: { "cache-control": "no-store" } },
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
    const rawAlbumId = form.get("albumId");
    const albumIdFromForm = rawAlbumId === null
      ? null
      : typeof rawAlbumId === "string" && rawAlbumId.trim()
        ? Number(rawAlbumId)
        : Number.NaN;
    if (albumIdFromForm !== null && !Number.isInteger(albumIdFromForm)) {
      return Response.json({ error: "Choose a valid gallery album." }, { status: 400 });
    }
    const title = cleanText(form.get("title"), 160);
    const description = cleanText(form.get("description"), 500);
    const photos = readPhotos(form);
    const appending = albumIdFromForm !== null;
    if ((!appending && !title) || !photos.length || photos.length > MAX_PHOTOS_PER_UPLOAD) {
      return Response.json({ error: `Add an album title and between 1 and ${MAX_PHOTOS_PER_UPLOAD} photos.` }, { status: 400 });
    }
    const photoDetails = photos.map(safePhoto);
    if (photoDetails.some((photo) => !photo)) {
      return Response.json({ error: "Photos must be WebP images of 15MB or less. JPG and PNG files are converted before upload." }, { status: 400 });
    }
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "Image storage is not available yet." }, { status: 503 });
    const db = await getEmpireDatabase();
    const createdAt = new Date().toISOString();
    let albumId: number;
    let createdNewAlbum = false;
    if (appending) {
      const existingAlbum = await db
        .prepare("SELECT id FROM empire_gallery_albums WHERE id = ?")
        .bind(albumIdFromForm)
        .first<{ id: number }>();
      if (!existingAlbum) return Response.json({ error: "That gallery album no longer exists." }, { status: 404 });
      albumId = albumIdFromForm;
    } else {
      const created = await db.prepare(
        "INSERT INTO empire_gallery_albums (title, description, created_at) VALUES (?, ?, ?)",
      ).bind(title, description, createdAt).run();
      albumId = Number(created.meta.last_row_id);
      createdNewAlbum = true;
    }
    const objectKeys: string[] = [];
    try {
      const lastPhoto = await db
        .prepare("SELECT COALESCE(MAX(sort_order), 0) AS sort_order FROM empire_gallery_photos WHERE album_id = ?")
        .bind(albumId)
        .first<{ sort_order: number }>();
      const sortOffset = Number(lastPhoto?.sort_order ?? 0);
      const inserts: D1PreparedStatement[] = [];
      for (const [index, file] of photos.entries()) {
        const detail = photoDetails[index];
        if (!detail) throw new Error("The image could not be prepared.");
        const objectKey = `empire/gallery/${albumId}/${crypto.randomUUID()}-${detail.fileName}`;
        await BUCKET.put(objectKey, file.stream(), {
          httpMetadata: { contentType: detail.contentType, contentDisposition: `inline; filename="${detail.fileName}"` },
        });
        objectKeys.push(objectKey);
        inserts.push(db.prepare(
          "INSERT INTO empire_gallery_photos (album_id, object_key, file_name, content_type, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        ).bind(albumId, objectKey, detail.fileName, detail.contentType, sortOffset + index + 1, createdAt));
      }
      await db.batch(inserts);
      const albums = await listGalleryAlbums();
      return Response.json({ album: albums.find((album) => album.id === albumId) }, { status: 201 });
    } catch (error) {
      const cleanup: D1PreparedStatement[] = [];
      if (createdNewAlbum) {
        cleanup.push(
          db.prepare("DELETE FROM empire_gallery_photos WHERE album_id = ?").bind(albumId),
          db.prepare("DELETE FROM empire_gallery_albums WHERE id = ?").bind(albumId),
        );
      } else if (objectKeys.length) {
        cleanup.push(
          db.prepare(`DELETE FROM empire_gallery_photos WHERE album_id = ? AND object_key IN (${objectKeys.map(() => "?").join(", ")})`).bind(albumId, ...objectKeys),
        );
      }
      if (cleanup.length) await db.batch(cleanup);
      await Promise.all(objectKeys.map((key) => BUCKET.delete(key).catch((cleanupError) => console.error("Empire gallery cleanup failed", cleanupError))));
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
    const db = await getEmpireDatabase();
    if ("photoId" in input) {
      const photoId = Number(input.photoId);
      if (!Number.isInteger(photoId)) return Response.json({ error: "Choose a valid gallery photo." }, { status: 400 });
      const photo = await db.prepare(
        "SELECT id, album_id, object_key FROM empire_gallery_photos WHERE id = ?",
      ).bind(photoId).first<{ id: number; album_id: number; object_key: string }>();
      if (!photo) return Response.json({ error: "That gallery photo no longer exists." }, { status: 404 });
      const photoCount = await db.prepare(
        "SELECT COUNT(*) AS count FROM empire_gallery_photos WHERE album_id = ?",
      ).bind(photo.album_id).first<{ count: number }>();
      const albumRemoved = Number(photoCount?.count ?? 0) <= 1;
      const removals: D1PreparedStatement[] = [
        db.prepare("DELETE FROM empire_gallery_photos WHERE id = ?").bind(photo.id),
      ];
      if (albumRemoved) {
        removals.push(db.prepare("DELETE FROM empire_gallery_albums WHERE id = ?").bind(photo.album_id));
      }
      await db.batch(removals);
      try {
        const { BUCKET } = await getRuntimeEnv();
        if (BUCKET) await BUCKET.delete(photo.object_key);
      } catch (error) {
        console.error("Empire gallery photo deletion cleanup failed", error);
      }
      return Response.json({ removed: true, albumRemoved });
    }

    const id = Number(input.albumId ?? input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid gallery album." }, { status: 400 });
    const album = await db.prepare("SELECT id FROM empire_gallery_albums WHERE id = ?").bind(id).first<{ id: number }>();
    if (!album) return Response.json({ error: "That gallery album no longer exists." }, { status: 404 });
    const photos = await db.prepare("SELECT object_key FROM empire_gallery_photos WHERE album_id = ?").bind(id).all<{ object_key: string }>();
    await db.batch([
      db.prepare("DELETE FROM empire_gallery_photos WHERE album_id = ?").bind(id),
      db.prepare("DELETE FROM empire_gallery_albums WHERE id = ?").bind(id),
    ]);
    try {
      const { BUCKET } = await getRuntimeEnv();
      if (BUCKET) await Promise.all((photos.results ?? []).map((photo) => BUCKET.delete(photo.object_key)));
    } catch (error) {
      console.error("Empire gallery deletion cleanup failed", error);
    }
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request), albumId = Number(input.albumId), db = await getEmpireDatabase();
    if (!Number.isSafeInteger(albumId) || albumId < 1) return Response.json({ error: "Choose an album." }, { status: 400 });
    if (input.action === "cover") {
      const photoId = Number(input.photoId);
      if (!Number.isSafeInteger(photoId) || photoId < 1 || !await db.prepare("SELECT id FROM empire_gallery_photos WHERE id=? AND album_id=?").bind(photoId, albumId).first()) return Response.json({ error: "Choose a photo from this album." }, { status: 400 });
      await db.prepare("UPDATE empire_gallery_photos SET sort_order=(SELECT COALESCE(MIN(sort_order),0)-1 FROM empire_gallery_photos WHERE album_id=?) WHERE id=? AND album_id=?").bind(albumId,photoId,albumId).run();
    } else if (input.action === "order") {
      const ids = input.photoIds;
      if (!Array.isArray(ids) || !ids.length || ids.length > 2000 || ids.some(id => !Number.isSafeInteger(id) || id < 1) || new Set(ids).size !== ids.length) return Response.json({error:"Choose a valid photo order."},{status:400});
      const sorted = [...ids].sort((a,b) => a-b);
      const result = await db.prepare(`UPDATE empire_gallery_photos SET sort_order=(SELECT CAST(key AS INTEGER) FROM json_each(?) WHERE value=empire_gallery_photos.id) WHERE album_id=? AND (SELECT json_group_array(id) FROM (SELECT id FROM empire_gallery_photos WHERE album_id=? ORDER BY id))=?`).bind(JSON.stringify(ids),albumId,albumId,JSON.stringify(sorted)).run();
      if (!result.meta.changes) return Response.json({error:"The album has changed. Refresh and try again."},{status:409});
    } else if (input.action === "edit") {
      const title = cleanText(input.title,160), description = cleanText(input.description,500);
      if (!title) return Response.json({ error: "Enter an album title." }, { status: 400 });
      const result = await db.prepare("UPDATE empire_gallery_albums SET title=?,description=? WHERE id=?").bind(title,description,albumId).run();
      if (!result.meta.changes) return Response.json({error:"That album no longer exists."},{status:404});
    } else return Response.json({error:"Choose an album action."},{status:400});
    const albums = await listGalleryAlbums(); return Response.json({album:albums.find(album=>album.id===albumId)});
  } catch (error) { return apiError(error); }
}
