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

const MAX_PHOTOS_PER_ALBUM = 24;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

type AlbumRow = {
  album_id: number;
  album_title: string;
  album_description: string;
  album_created_at: string;
  photo_id: number | null;
  photo_file_name: string | null;
  photo_created_at: string | null;
};

type StoredPhoto = {
  id: number;
  fileName: string;
  imageUrl: string;
  createdAt: string;
};

function mapAlbums(rows: AlbumRow[]) {
  const albums = new Map<number, {
    id: number;
    title: string;
    description: string;
    createdAt: string;
    photos: StoredPhoto[];
  }>();
  for (const row of rows) {
    let album = albums.get(row.album_id);
    if (!album) {
      album = {
        id: row.album_id,
        title: row.album_title,
        description: row.album_description,
        createdAt: row.album_created_at,
        photos: [],
      };
      albums.set(row.album_id, album);
    }
    if (row.photo_id !== null && row.photo_file_name && row.photo_created_at) {
      album.photos.push({
        id: row.photo_id,
        fileName: row.photo_file_name,
        imageUrl: `/api/empire/gallery/image?id=${row.photo_id}&v=${encodeURIComponent(row.photo_created_at)}`,
        createdAt: row.photo_created_at,
      });
    }
  }
  return [...albums.values()];
}

async function listAlbums() {
  const db = await getEmpireDatabase();
  const result = await db.prepare(
    `SELECT a.id AS album_id, a.title AS album_title, a.description AS album_description,
       a.created_at AS album_created_at, p.id AS photo_id, p.file_name AS photo_file_name,
       p.created_at AS photo_created_at
     FROM empire_gallery_albums a
     LEFT JOIN empire_gallery_photos p ON p.album_id = a.id
     ORDER BY a.created_at DESC, a.id DESC, p.sort_order ASC, p.id ASC`,
  ).all<AlbumRow>();
  return mapAlbums(result.results ?? []);
}

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
      { albums: await listAlbums() },
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
    const photos = readPhotos(form);
    if (!title || !photos.length || photos.length > MAX_PHOTOS_PER_ALBUM) {
      return Response.json({ error: `Add an album title and between 1 and ${MAX_PHOTOS_PER_ALBUM} photos.` }, { status: 400 });
    }
    const photoDetails = photos.map(safePhoto);
    if (photoDetails.some((photo) => !photo)) {
      return Response.json({ error: "Photos must be WebP images of 5MB or less. JPG and PNG files are converted before upload." }, { status: 400 });
    }
    const { BUCKET } = await getRuntimeEnv();
    if (!BUCKET) return Response.json({ error: "Image storage is not available yet." }, { status: 503 });
    const db = await getEmpireDatabase();
    const createdAt = new Date().toISOString();
    const created = await db.prepare(
      "INSERT INTO empire_gallery_albums (title, description, created_at) VALUES (?, ?, ?)",
    ).bind(title, description, createdAt).run();
    const albumId = Number(created.meta.last_row_id);
    const objectKeys: string[] = [];
    try {
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
        ).bind(albumId, objectKey, detail.fileName, detail.contentType, index + 1, createdAt));
      }
      await db.batch(inserts);
      const albums = await listAlbums();
      return Response.json({ album: albums.find((album) => album.id === albumId) }, { status: 201 });
    } catch (error) {
      await db.batch([
        db.prepare("DELETE FROM empire_gallery_photos WHERE album_id = ?").bind(albumId),
        db.prepare("DELETE FROM empire_gallery_albums WHERE id = ?").bind(albumId),
      ]);
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
    const id = Number(input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid gallery album." }, { status: 400 });
    const db = await getEmpireDatabase();
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
