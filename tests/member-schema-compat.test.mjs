import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";

const source = (await readFile(new URL("../app/api/empire/_server.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const match = source.match(/async function ensureEmpireSchemaCompatibility\(db: D1Database\) \{[\s\S]*?\n\}\n\nexport function cleanText/);
assert.ok(match, "schema compatibility function must remain available");
const snippet = match[0].replace("async function ensureEmpireSchemaCompatibility", "export async function ensureEmpireSchemaCompatibility").replace(/\n\nexport function cleanText$/, "");
const js = ts.transpileModule(snippet, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { ensureEmpireSchemaCompatibility } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

function adapter(sqlite) {
  return { prepare(sql) { return {
    async all() { return { results: sqlite.prepare(sql).all() }; },
    async run() { sqlite.exec(sql); return {}; },
  }; } };
}

test("upgrades an old members table without changing existing records and remains idempotent", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE empire_members (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO empire_members VALUES (7, 'Fake member')");
  const db = adapter(sqlite);
  await ensureEmpireSchemaCompatibility(db);
  await ensureEmpireSchemaCompatibility(db);
  const row = sqlite.prepare("SELECT id, name, date_of_birth FROM empire_members").get();
  assert.deepEqual({ ...row }, { id: 7, name: "Fake member", date_of_birth: null });
  sqlite.close();
});

test("does not conceal an unsuccessful schema alteration", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE empire_members (id INTEGER PRIMARY KEY)");
  const db = adapter(sqlite);
  const prepare = db.prepare;
  db.prepare = (sql) => sql.startsWith("ALTER") ? { run: async () => { throw new Error("write failed"); } } : prepare(sql);
  await assert.rejects(ensureEmpireSchemaCompatibility(db), /write failed/);
  sqlite.close();
});
