/** Decode each display copy independently; an unreadable copy never resets login access. */
export async function decodeMemberLoginCodes(
  rows: Array<{ member_id: number; encrypted_code: string }>,
  decrypt: (encrypted: string) => Promise<string>,
): Promise<Array<{ memberId: number; code: string; status: "available" | "unavailable" }>> {
  return Promise.all(rows.map(async (row) => {
    try {
      const code = await decrypt(row.encrypted_code);
      if (!/^\d{4}$/.test(code)) throw new Error("Invalid member code display copy");
      return { memberId: row.member_id, code, status: "available" as const };
    } catch {
      return { memberId: row.member_id, code: "", status: "unavailable" as const };
    }
  }));
}
