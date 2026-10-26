import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

test("public gallery data and server HTML expose real album content safely", async () => {
  const rows = [{ album_id: 1, album_title: "A & B bowls", album_description: "Our club day", album_created_at: "2026-01-01", photo_id: 7, photo_file_name: "day.webp", photo_created_at: "2026-01-02" }];
  let query = "";
  globalThis.__galleryTestDb = { prepare(sql) { query = sql; return { all: async () => ({ results: rows }) }; } };
  const dataBundle = await build({ entryPoints: ["app/api/empire/gallery/gallery-data.ts"], bundle: true, platform: "node", format: "esm", write: false, plugins: [{ name: "test-db", setup(build) { build.onResolve({ filter: /^\.\.\/_server$/ }, () => ({ path: "server", namespace: "test" })); build.onLoad({ filter: /.*/, namespace: "test" }, () => ({ contents: "export const getEmpireDatabase = async () => globalThis.__galleryTestDb", loader: "js" })); } }] });
  const { listGalleryAlbums } = await import(`data:text/javascript;base64,${Buffer.from(dataBundle.outputFiles[0].text).toString("base64")}`);
  const albums = await listGalleryAlbums();
  assert.match(query, /FROM empire_gallery_albums/);
  assert.doesNotMatch(query, /object_key/);
  assert.equal(albums[0].photos[0].imageUrl, "/api/empire/gallery/image?id=7&v=2026-01-02");

  const temp = await mkdtemp(path.join(process.cwd(), "work", "gallery-test-"));
  try {
    const output = path.join(temp, "club-page.cjs");
    await build({ entryPoints: ["app/club-page.tsx"], outfile: output, bundle: true, platform: "node", format: "cjs", external: ["react", "react/*"], loader: { ".css": "empty" } });
    const ClubPage = createRequire(import.meta.url)(output).default;
    const html = renderToStaticMarkup(React.createElement(ClubPage, { initialPage: "Gallery", initialGallery: albums }));
    assert.match(html, /A &amp; B bowls/);
    assert.match(html, /Our club day/);
    assert.match(html, /src="\/api\/empire\/gallery\/image\?id=7&amp;v=2026-01-02"/);
    assert.match(html, /alt="A &amp; B bowls – Empire Bowls Club"/);
    assert.doesNotMatch(html, /Photos from the club will be shared here soon/);
    const unavailable = renderToStaticMarkup(React.createElement(ClubPage, { initialPage: "Gallery", initialGallery: null }));
    assert.match(unavailable, /Loading the gallery/);
    assert.doesNotMatch(unavailable, /Photos from the club will be shared here soon/);
  } finally { await rm(temp, { recursive: true, force: true }); delete globalThis.__galleryTestDb; }
});
