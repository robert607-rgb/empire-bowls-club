import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { registerHooks } from "node:module";

// Public rendering does not need production bindings. Node lacks this Workers-only module.
registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === "cloudflare:workers") return { url: "data:text/javascript,export const env = {};", shortCircuit: true };
  return nextResolve(specifier, context);
} });

test("public homepage has no dead tracker and all display copies are packaged", async () => {
  const { default: worker } = await import("../dist/server/index.js");
  const response = await worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<h1\b/i);
  assert.doesNotMatch(html, /website-usage-dashboard\.robert607\.chatgpt\.site/);
  assert.doesNotMatch(html, /https:\/\/[^"\s<>]+\.(?:sites\.chatgpt\.com|sites\.openai\.com)/);
  for (const match of html.matchAll(/(?:src|href)="([^"<>]*\/usage-assets\/[^"<>]+)"/g)) {
    const path = new URL(match[1], "http://localhost").pathname;
    assert.ok(existsSync(resolve("dist/client", `.${path}`)), `Missing rendered asset: ${path}`);
  }
  if (existsSync("public/usage-assets")) for (const file of readdirSync("public/usage-assets")) {
    assert.deepEqual(readFileSync(resolve("dist/client/usage-assets", file)), readFileSync(resolve("public/usage-assets", file)));
  }
});

test("long cache rules cover only hashed public assets, never pages or APIs", () => {
  const headers = readFileSync("dist/client/_headers", "utf8");
  const paths = headers.split("\n").filter(line => line.startsWith("/"));
  assert.ok(paths.length > 1);
  assert.ok(paths.length <= 100, "Stay within the static header rules limit");
  for (const path of paths) {
    if (path === "/usage-assets/*") continue;
    assert.match(path, /^\/assets\/[^\n]+-[A-Za-z0-9_-]{8}\.(?:js|css|woff2?)$/);
    assert.ok(existsSync(resolve("dist/client", `.${path}`)));
  }
});
