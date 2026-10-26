import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { decodeMemberLoginCodes } from "../app/api/empire/member-code-display.ts";

const route = (await readFile(new URL("../app/api/empire/members/route.ts", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const mapped = route.replace(/import \{([\s\S]*?)\} from "\.\.\/_server";/, "const {$1} = globalThis.__memberRouteDependencies;");
assert.notEqual(mapped, route, "route dependency mapping must succeed");
const js = ts.transpileModule(mapped, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const fixture = { id: 1, name: "Example Member", date_of_birth: null, address: "example", phone: "example", email: "example@example.invalid", membership_type: "Full member", created_at: "2026-01-01" };
let role = "admin";
let decodeCalls = 0;
globalThis.__memberRouteDependencies = {
  getEmpireAccess: async () => role,
  getEmpireDatabase: async () => ({prepare: () => ({all: async () => ({results: [fixture]})})}),
  readMemberLoginCodes: async () => {
    decodeCalls++;
    return decodeMemberLoginCodes([{member_id:1, encrypted_code:"broken"}], async () => {throw new Error("unreadable");});
  },
  apiError: () => new Response(null, {status:500}),
  unauthorized: () => new Response(null,{status:401}),
};
const { GET } = await import(`data:text/javascript;base64,${Buffer.from(js).toString("base64")}`);

test("admin still sees the member when its display code is unreadable", async () => {
  role = "admin";
  const response = await GET(new Request("https://example.invalid/api/empire/members"));
  const data = await response.json();
  assert.equal(response.status, 200);
  assert.equal(data.members[0].name, fixture.name);
  assert.equal(data.members[0].loginCodeStatus, "unavailable");
  assert.equal(data.members[0].loginCode, "");
  assert.equal(decodeCalls, 1);
});

test("ordinary members receive no private code status", async () => {
  role = "member";
  const response = await GET(new Request("https://example.invalid/api/empire/members"));
  const data = await response.json();
  assert.equal(data.members[0].loginCodeStatus, undefined);
  assert.equal(data.members[0].address, undefined);
  assert.equal(decodeCalls, 1);
});
