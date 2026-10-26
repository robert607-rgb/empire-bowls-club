import { getEmpireDatabase } from "../_server";

export type GalleryPhoto = { id: number; fileName: string; imageUrl: string; createdAt: string };
export type GalleryAlbum = { id: number; title: string; description: string; createdAt: string; photos: GalleryPhoto[] };
type AlbumRow = {
  album_id: number; album_title: string; album_description: string; album_created_at: string;
  photo_id: number | null; photo_file_name: string | null; photo_created_at: string | null;
};

// The same public data is used by the page and the gallery API. Object keys and
// all other storage details remain on the server.
export async function listGalleryAlbums(): Promise<GalleryAlbum[]> {
  const db = await getEmpireDatabase();
  const result = await db.prepare(
    `SELECT a.id AS album_id, a.title AS album_title, a.description AS album_description,
       a.created_at AS album_created_at, p.id AS photo_id, p.file_name AS photo_file_name,
       p.created_at AS photo_created_at
     FROM empire_gallery_albums a
     LEFT JOIN empire_gallery_photos p ON p.album_id = a.id
     ORDER BY a.created_at DESC, a.id DESC, p.sort_order ASC, p.id ASC`,
  ).all<AlbumRow>();
  const albums = new Map<number, GalleryAlbum>();
  for (const row of result.results ?? []) {
    let album = albums.get(row.album_id);
    if (!album) {
      album = { id: row.album_id, title: row.album_title, description: row.album_description, createdAt: row.album_created_at, photos: [] };
      albums.set(row.album_id, album);
    }
    if (row.photo_id !== null && row.photo_file_name && row.photo_created_at) {
      album.photos.push({ id: row.photo_id, fileName: row.photo_file_name, imageUrl: `/api/empire/gallery/image?id=${row.photo_id}&v=${encodeURIComponent(row.photo_created_at)}`, createdAt: row.photo_created_at });
    }
  }
  return [...albums.values()];
}
