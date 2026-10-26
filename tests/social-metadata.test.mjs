import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function metadata(html) {
  const fields = new Map();
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = Object.fromEntries(
      [...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1].toLowerCase(), match[2]]),
    );
    const key = attributes.name || attributes.property;
    if (key) fields.set(key, attributes.content);
  }
  return fields;
}

test("public section pages have matching page-specific sharing metadata", async () => {
  const image = "https://empirebowlsclub.co.uk/optimized/og-empire-clubhouse.jpg";
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  const titles = new Set();

  for (const path of ["/about", "/news", "/gallery", "/sponsors", "/fixtures", "/honours", "/play-bowls", "/contact"]) {
    const response = await worker.fetch(new Request(`https://empirebowlsclub.co.uk${path}`, { headers: { accept: "text/html" } }), env, ctx);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
    const fields = metadata(html);
    assert.ok(title, `page title for ${path}`);
    assert.ok(fields.get("description"), `description for ${path}`);
    assert.equal(fields.get("og:title"), title, `Open Graph title for ${path}`);
    assert.equal(fields.get("twitter:title"), title, `Twitter title for ${path}`);
    assert.equal(fields.get("og:description"), fields.get("description"), `Open Graph description for ${path}`);
    assert.equal(fields.get("twitter:description"), fields.get("description"), `Twitter description for ${path}`);
    assert.equal(fields.get("og:url"), `https://empirebowlsclub.co.uk${path}`, `Open Graph URL for ${path}`);
    assert.equal(fields.get("og:image"), image, `Open Graph image for ${path}`);
    assert.equal(fields.get("twitter:image"), image, `Twitter image for ${path}`);
    assert.equal(fields.get("twitter:card"), "summary_large_image", `Twitter card for ${path}`);
    titles.add(title);
  }

  assert.equal(titles.size, 8, "each public section has its own title");
  const bytes = await readFile(new URL("../public/optimized/og-empire-clubhouse.jpg", import.meta.url));
  assert.equal(bytes.subarray(0, 3).toString("hex"), "ffd8ff", "social image exists and is a JPEG");
});
