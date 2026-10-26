import assert from "node:assert/strict";
import test from "node:test";
import { decodeMemberLoginCodes } from "../app/api/empire/member-code-display.ts";

test("unreadable display copies do not hide other members or change credentials", async () => {
  const rows = [
    { member_id: 1, encrypted_code: "first" },
    { member_id: 2, encrypted_code: "damaged" },
    { member_id: 3, encrypted_code: "invalid" },
  ];
  const snapshot = structuredClone(rows);
  const result = await decodeMemberLoginCodes(rows, async (value) => {
    if (value === "damaged") throw new Error("decrypt failed");
    return value === "first" ? "0042" : "invalid";
  });
  assert.deepEqual(result, [
    { memberId: 1, code: "0042", status: "available" },
    { memberId: 2, code: "", status: "unavailable" },
    { memberId: 3, code: "", status: "unavailable" },
  ]);
  assert.deepEqual(rows, snapshot);
});
