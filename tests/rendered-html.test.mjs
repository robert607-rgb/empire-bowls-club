import assert from "node:assert/strict";
import test from "node:test";

const seoMetadata = /<link(?=[^>]*\brel=["']canonical["'])(?=[^>]*\bhref=["']https:\/\/empirebowlsclub\.co\.uk\/["'])[^>]*>/i;
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

test("old Google links redirect once and public pages have their own canonical URLs", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  for (const [old, target] of [["home", "/"], ["about-our-club", "/about"], ["the-committee", "/about"], ["2025-club-champions1", "/about"], ["2022-club-achievements", "/about"], ["empires-sponsors", "/sponsors"], ["contact", "/contact"], ["fixtures", "/fixtures"]]) {
    for (const origin of ["http://www.empirebowlsclub.co.uk", "https://empirebowlsclub.co.uk"]) {
      const response = await worker.fetch(new Request(`${origin}/community/empire-bowls-club-14829/${old}/`), env, ctx);
      assert.equal(response.status, 301);
      assert.equal(response.headers.get("location"), `https://empirebowlsclub.co.uk${target}`);
    }
  }
  for (const path of ["/about", "/news", "/sponsors", "/fixtures", "/honours", "/play-bowls", "/contact"]) {
    const response = await worker.fetch(new Request(`https://empirebowlsclub.co.uk${path}`, { headers: { accept: "text/html" } }), env, ctx);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assert.ok(html.includes(`href="https://empirebowlsclub.co.uk${path}"`), `canonical ${path}`);
    assert.ok(html.includes(`href="/contact"`), "crawlable navigation");
  }
  const www = await worker.fetch(new Request("https://www.empirebowlsclub.co.uk/about?ref=google"), env, ctx);
  assert.equal(www.headers.get("location"), "https://empirebowlsclub.co.uk/about?ref=google");
  const missing = await worker.fetch(new Request("https://empirebowlsclub.co.uk/not-a-real-page"), env, ctx);
  assert.equal(missing.status, 404);
});


test("crawler files are served without relying on static asset fallback", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const env = { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } };
  const ctx = { waitUntil() {}, passThroughOnException() {} };
  for (const path of ["/sitemap.xml", "/robots.txt"]) {
    const response = await worker.fetch(new Request(`https://empirebowlsclub.co.uk${path}`), env, ctx);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), path.endsWith("xml") ? /application\/xml/ : /text\/plain/);
    const body = await response.text();
    assert.ok(body.includes("https://empirebowlsclub.co.uk/"));
    assert.ok(!body.includes("<html"));
    if (path.endsWith("xml")) assert.equal((body.match(/<loc>/g) || []).length, 8);
    const head = await worker.fetch(new Request(`https://empirebowlsclub.co.uk${path}`, { method: "HEAD" }), env, ctx);
    assert.equal(head.status, 200);
    assert.equal(await head.text(), "");
  }
});
