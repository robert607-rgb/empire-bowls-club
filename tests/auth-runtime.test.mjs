import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync(new URL("../app/api/empire/_server.ts", import.meta.url), "utf8");

test("Empire authentication stays within Workers runtime limits", () => {
  assert.match(source, /PASSWORD_HASH_ITERATIONS\s*=\s*100_000/);
  assert.doesNotMatch(source, /crypto\.subtle\.timingSafeEqual\s*\(/);
  assert.doesNotMatch(source, /crypto\.timingSafeEqual\s*\(/);
  assert.doesNotMatch(source, /iterations\s*:\s*(?:1\d{5,}|\d{3,}_\d{3,})/);
  assert.match(source, /legacyHash/);
});
