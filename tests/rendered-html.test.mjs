import assert from "node:assert/strict";
import test from "node:test";

const seoMetadata = /<link(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/empire-bowls-club\.robert607\.chatgpt\.site\/["'])[^>]*>/i;
const pageTitle = /<title>Empire Bowls Club Greenhithe \| Lawn bowls in Kent<\/title>/i;
const pageDescription = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']*Greenhithe[^"']*lawn bowls[^"']*["'][^>]*>/i;

test("renders club search metadata and security headers", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(response.headers.get("content-security-policy") ?? "", /default-src 'self'/);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  const html = await response.text();
  assert.match(html, seoMetadata);
  assert.match(html, pageTitle);
  assert.match(html, pageDescription);
  assert.match(html, /application\/ld\+json/);
  assert.match(html, /optimized\/club\/empire-green-clubhouse\.webp/);
});
