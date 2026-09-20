export type EmpireAccess = "member" | "admin";

let ready: Promise<void> | null = null;
const encoder = new TextEncoder();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;
const PASSWORD_HASH_ITERATIONS = 100_000;
const JSON_BODY_LIMIT_BYTES = 128 * 1024;
export const MULTIPART_BODY_LIMIT_BYTES = 48 * 1024 * 1024;

export class RequestBodyTooLargeError extends Error {
  constructor() {
    super("Request body is too large.");
    this.name = "RequestBodyTooLargeError";
  }
}

export class InvalidRequestBodyError extends Error {
  constructor() {
    super("Request body is not valid JSON.");
    this.name = "InvalidRequestBodyError";
  }
}

// These one-way hashes keep the original club access codes working without
// retaining a readable password in the client bundle or database. The
// iteration count is the highest value supported by Cloudflare Workers.
// legacyHash lets the first secure deployment migrate the earlier hashes that
// were generated with an unsupported iteration count without overwriting any
// password that an administrator has since chosen.
const initialAccounts: Array<{ access: EmpireAccess; salt: string; hash: string; legacyHash: string }> = [
  {
    access: "admin",
    salt: "7940822b5d17baf44aabf7cf04784a233245",
    hash: "093a25f0c79deb9af5bf413b71f5aad4efe036f6c30294aa3c1097108ab8e21e",
    legacyHash: "cdd0183505e559201772e9f0860840893963904157583b649a5efd9a4a3378cd",
  },
];
const initialCommittee = [
  ["Chairman", "Steve Webster", "07872 111577"],
  ["Secretary", "Ann Norris", "07852 975351"],
  ["Treasurer & Competition Secretary", "Steve Webster", "07872 111577"],
  ["Weekend Captain, Fixtures Secretary & NWK Representative", "Ray Norris", "07706 084755"],
  ["Midweek Captain, Bar Manager & County Representative", "Dave Munday", "07890 853525"],
  ["Head Greenkeeper", "Chris Read", "07976 329351"],
  ["Safeguarding Officer", "Richard Stone", "07980 389398"],
] as const;

type AccountRow = { access: EmpireAccess; salt: string; password_hash: string };
type MemberCredentialRow = {
  member_id: number;
  salt: string;
  code_hash: string;
  encrypted_code: string;
  code_fingerprint: string;
};
type SessionRow = { access: EmpireAccess; expires_at: string };

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password: string, salt: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: PASSWORD_HASH_ITERATIONS },
    key,
    256,
  );
  return hex(new Uint8Array(bits));
}

function memberFirstName(name: string) {
  return name.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
}

function newMemberLoginCode() {
  const random = new Uint32Array(1);
  crypto.getRandomValues(random);
  return String(random[0] % 10000).padStart(4, "0");
}

function bytesFromHex(value: string) {
  if (!/^[a-f0-9]+$/i.test(value) || value.length % 2 !== 0) throw new Error("Invalid encrypted member code.");
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function memberCodeKey(usage: KeyUsage[]) {
  const runtime = await getRuntimeEnv();
  const secret = runtime.EMPIRE_MEMBER_CODE_KEY ?? "";
  if (!/^[a-f0-9]{64}$/i.test(secret)) {
    throw new Error("Member login code encryption is not configured.");
  }
  return crypto.subtle.importKey("raw", bytesFromHex(secret), usage[0] === "sign" ? "HMAC" : "AES-GCM", false, usage);
}

async function encryptMemberLoginCode(code: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await memberCodeKey(["encrypt"]);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(code));
  return `${hex(iv)}:${hex(new Uint8Array(encrypted))}`;
}

async function decryptMemberLoginCode(value: string) {
  const [ivHex, encryptedHex] = value.split(":");
  const key = await memberCodeKey(["decrypt"]);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: bytesFromHex(ivHex ?? "") },
    key,
    bytesFromHex(encryptedHex ?? ""),
  );
  return new TextDecoder().decode(decrypted);
}

async function memberCodeFingerprint(code: string) {
  const runtime = await getRuntimeEnv();
  const secret = runtime.EMPIRE_MEMBER_CODE_KEY ?? "";
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${secret}:${code}`));
  return hex(new Uint8Array(digest));
}

async function saveMemberLoginCode(
  db: D1Database,
  memberId: number,
  code: string,
  replace = false,
) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(18)));
  const hash = await passwordHash(code, salt);
  const encryptedCode = await encryptMemberLoginCode(code);
  const codeFingerprint = await memberCodeFingerprint(code);
  const conflict = await db
    .prepare("SELECT member_id FROM empire_member_credentials WHERE code_fingerprint = ?")
    .bind(codeFingerprint)
    .first<{ member_id: number }>();
  if (conflict && conflict.member_id !== memberId) return { code, inserted: false };
  const now = new Date().toISOString();
  if (replace) {
    await db
      .prepare("UPDATE empire_member_credentials SET salt = ?, code_hash = ?, encrypted_code = ?, code_fingerprint = ?, updated_at = ? WHERE member_id = ?")
      .bind(salt, hash, encryptedCode, codeFingerprint, now, memberId)
      .run();
    return { code, inserted: true };
  }
  const result = await db
    .prepare("INSERT OR IGNORE INTO empire_member_credentials (member_id, salt, code_hash, encrypted_code, code_fingerprint, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(memberId, salt, hash, encryptedCode, codeFingerprint, now, now)
    .run();
  return { code, inserted: Number(result.meta.changes ?? 0) > 0 };
}

async function createUniqueMemberLoginCode(db: D1Database, memberId: number, replace = false) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const code = newMemberLoginCode();
    const saved = await saveMemberLoginCode(db, memberId, code, replace);
    if (saved.inserted) return code;
  }
  throw new Error("Could not create a unique member login code.");
}

export async function ensureMemberLoginCode(memberId: number) {
  const db = await getEmpireDatabase();
  const existing = await db
    .prepare("SELECT member_id FROM empire_member_credentials WHERE member_id = ?")
    .bind(memberId)
    .first<{ member_id: number }>();
  if (existing) return null;
  return createUniqueMemberLoginCode(db, memberId);
}

export async function issueMemberLoginCode(memberId: number) {
  const db = await getEmpireDatabase();
  const member = await db
    .prepare("SELECT id FROM empire_members WHERE id = ?")
    .bind(memberId)
    .first<{ id: number }>();
  if (!member) return null;
  return createUniqueMemberLoginCode(db, memberId, true);
}

export async function ensureMissingMemberLoginCodes(memberIds: number[]) {
  if (!memberIds.length) return [] as Array<{ memberId: number; code: string }>;
  const db = await getEmpireDatabase();
  const existing = await db
    .prepare(`SELECT member_id FROM empire_member_credentials WHERE member_id IN (${memberIds.map(() => "?").join(", ")})`)
    .bind(...memberIds)
    .all<{ member_id: number }>();
  const existingIds = new Set((existing.results ?? []).map((row) => row.member_id));
  const created: Array<{ memberId: number; code: string }> = [];
  for (const memberId of memberIds) {
    if (existingIds.has(memberId)) continue;
    created.push({ memberId, code: await createUniqueMemberLoginCode(db, memberId) });
  }
  return created;
}

export async function readMemberLoginCodes(memberIds: number[]) {
  if (!memberIds.length) return [] as Array<{ memberId: number; code: string }>;
  const db = await getEmpireDatabase();
  const result = await db
    .prepare(`SELECT member_id, encrypted_code FROM empire_member_credentials WHERE member_id IN (${memberIds.map(() => "?").join(", ")})`)
    .bind(...memberIds)
    .all<{ member_id: number; encrypted_code: string }>();
  const codes: Array<{ memberId: number; code: string }> = [];
  for (const row of result.results ?? []) {
    codes.push({ memberId: row.member_id, code: await decryptMemberLoginCode(row.encrypted_code) });
  }
  return codes;
}

function timingSafeStringEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.byteLength !== rightBytes.byteLength) {
    return false;
  }
  // Web Crypto in the Workers runtime does not expose Node's
  // crypto.timingSafeEqual helper. Compare every byte without returning early.
  let difference = 0;
  for (let index = 0; index < leftBytes.byteLength; index += 1) {
    difference |= leftBytes[index] ^ rightBytes[index];
  }
  return difference === 0;
}

async function fingerprint(request: Request) {
  const url = new URL(request.url);
  // Only trust the address Cloudflare supplies. x-forwarded-for is client
  // controlled when the Worker is run outside Cloudflare.
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(`${url.host}:${ip.trim()}`));
  return hex(new Uint8Array(bytes));
}

function readCookie(request: Request, name: string) {
  const value = request.headers.get("cookie") ?? "";
  for (const part of value.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}

export function sessionCookie(token: string, expiresAt: Date) {
  return `empire_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}; Expires=${expiresAt.toUTCString()}`;
}

export const expiredSessionCookie = "empire_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

export async function getRuntimeEnv() {
  // Deferred so the packaged worker can also be inspected by the local artifact validator.
  return (await import("cloudflare:workers")).env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
    EMPIRE_MEMBER_CODE_KEY?: string;
  };
}

export async function getEmpireAccess(request: Request): Promise<EmpireAccess | null> {
  const token = readCookie(request, "empire_session");
  if (!/^[a-f0-9-]{36}$/i.test(token)) return null;
  const db = await getEmpireDatabase();
  const row = await db
    .prepare("SELECT access, expires_at FROM empire_sessions WHERE token = ?")
    .bind(token)
    .first<SessionRow>();
  if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
    await db.prepare("DELETE FROM empire_sessions WHERE token = ?").bind(token).run();
    return null;
  }
  return row.access;
}

export async function hasEmpireAccess(request: Request, adminOnly = false): Promise<boolean> {
  const access = await getEmpireAccess(request);
  return access === "admin" || (!adminOnly && access === "member");
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

async function loginRateLimit(db: D1Database, visitor: string) {
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  await db
    .prepare("DELETE FROM empire_login_attempts WHERE attempted_at < ?")
    .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
    .run();
  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM empire_login_attempts WHERE visitor_hash = ? AND attempted_at >= ?")
    .bind(visitor, windowStart)
    .first<{ total: number }>();
  return Number(count?.total ?? 0) < LOGIN_ATTEMPT_LIMIT;
}

async function recordFailedLogin(db: D1Database, visitor: string) {
  await db
    .prepare("INSERT INTO empire_login_attempts (visitor_hash, attempted_at) VALUES (?, ?)")
    .bind(visitor, new Date().toISOString())
    .run();
}

async function createEmpireSession(db: D1Database, access: EmpireAccess) {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = crypto.randomUUID();
  await db
    .prepare("INSERT INTO empire_sessions (token, access, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(token, access, expiresAt.toISOString(), new Date().toISOString())
    .run();
  return { token, expiresAt };
}

export async function authenticateEmpireAccess(request: Request, access: EmpireAccess, password: string) {
  const db = await getEmpireDatabase();
  const visitor = await fingerprint(request);
  if (!(await loginRateLimit(db, visitor))) return { ok: false as const, rateLimited: true };

  const account = await db.prepare("SELECT access, salt, password_hash FROM empire_access_accounts WHERE access = ?").bind(access).first<AccountRow>();
  const candidateHash = await passwordHash(password, account?.salt ?? "invalid-account-salt");
  const storedHash = account?.password_hash ?? "0".repeat(candidateHash.length);
  const matches = timingSafeStringEqual(candidateHash, storedHash) && Boolean(account);
  if (!matches) {
    await recordFailedLogin(db, visitor);
    return { ok: false as const, rateLimited: false };
  }
  await db.prepare("DELETE FROM empire_login_attempts WHERE visitor_hash = ?").bind(visitor).run();
  const session = await createEmpireSession(db, access);
  return { ok: true as const, ...session };
}

export async function authenticateEmpireMember(request: Request, firstName: string, code: string) {
  const db = await getEmpireDatabase();
  const visitor = await fingerprint(request);
  if (!(await loginRateLimit(db, visitor))) return { ok: false as const, rateLimited: true };

  const firstNameKey = memberFirstName(firstName);
  const candidates = await db
    .prepare(
      `SELECT m.id, c.salt, c.code_hash
       FROM empire_members m
       INNER JOIN empire_member_credentials c ON c.member_id = m.id
       WHERE lower(substr(trim(m.name), 1, instr(trim(m.name) || ' ', ' ') - 1)) = ?`,
    )
    .bind(firstNameKey)
    .all<MemberCredentialRow & { id: number }>();
  let matches = false;
  for (const candidate of candidates.results ?? []) {
    const candidateHash = await passwordHash(code, candidate.salt);
    matches = timingSafeStringEqual(candidateHash, candidate.code_hash) || matches;
  }
  if (!matches) {
    if (!(candidates.results ?? []).length) {
      await passwordHash(code, "invalid-member-salt");
    }
    await recordFailedLogin(db, visitor);
    return { ok: false as const, rateLimited: false };
  }
  await db.prepare("DELETE FROM empire_login_attempts WHERE visitor_hash = ?").bind(visitor).run();
  const session = await createEmpireSession(db, "member");
  return { ok: true as const, ...session };
}

export async function endEmpireSession(request: Request) {
  const token = readCookie(request, "empire_session");
  if (/^[a-f0-9-]{36}$/i.test(token)) {
    const db = await getEmpireDatabase();
    await db.prepare("DELETE FROM empire_sessions WHERE token = ?").bind(token).run();
  }
}

export async function rotateEmpireAccess(access: EmpireAccess, password: string) {
  const salt = hex(crypto.getRandomValues(new Uint8Array(18)));
  const hash = await passwordHash(password, salt);
  const db = await getEmpireDatabase();
  await db
    .prepare("UPDATE empire_access_accounts SET salt = ?, password_hash = ?, updated_at = ? WHERE access = ?")
    .bind(salt, hash, new Date().toISOString(), access)
    .run();
  await db.prepare("DELETE FROM empire_sessions WHERE access = ?").bind(access).run();
}

export function unauthorized() {
  return Response.json(
    { error: "This area requires the correct Empire access password." },
    { status: 401 },
  );
}

export async function getEmpireDatabase() {
  const runtime = await getRuntimeEnv();
  if (!runtime.DB) throw new Error("The club database is not available yet.");
  if (!ready) {
    ready = runtime.DB.batch([
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_members (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        membership_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_member_credentials (
        member_id INTEGER PRIMARY KEY,
        salt TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        encrypted_code TEXT NOT NULL,
        code_fingerprint TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_committee (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_committee_meta (
        id INTEGER PRIMARY KEY,
        seeded_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_date TEXT NOT NULL,
        rink_number INTEGER NOT NULL,
        time_slot TEXT NOT NULL,
        booking_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(
        "CREATE UNIQUE INDEX IF NOT EXISTS empire_bookings_slot_unique ON empire_bookings (booking_date, rink_number, time_slot)",
      ),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_player_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        match_name TEXT NOT NULL,
        match_date TEXT NOT NULL,
        players_required INTEGER NOT NULL,
        names_json TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        summary TEXT NOT NULL,
        body TEXT NOT NULL,
        category TEXT NOT NULL,
        accent TEXT NOT NULL,
        emoji TEXT NOT NULL,
        published_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_news_assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        news_id INTEGER NOT NULL UNIQUE,
        object_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_uploads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        file_name TEXT NOT NULL,
        object_key TEXT NOT NULL,
        content_type TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_gallery_albums (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_gallery_photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        album_id INTEGER NOT NULL,
        object_key TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        sort_order INTEGER NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_empire_gallery_photos_album_sort ON empire_gallery_photos (album_id, sort_order)",
      ),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_team_sheets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opponent TEXT NOT NULL,
        competition TEXT NOT NULL,
        match_date TEXT NOT NULL,
        rink_count INTEGER NOT NULL,
        rinks_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(
        "CREATE INDEX IF NOT EXISTS idx_empire_team_sheets_date ON empire_team_sheets (match_date)",
      ),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_access_accounts (
        access TEXT PRIMARY KEY,
        salt TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_sessions (
        token TEXT PRIMARY KEY,
        access TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )`),
      runtime.DB.prepare("CREATE INDEX IF NOT EXISTS empire_sessions_expiry ON empire_sessions (expires_at)"),
      runtime.DB.prepare(`CREATE TABLE IF NOT EXISTS empire_login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visitor_hash TEXT NOT NULL,
        attempted_at TEXT NOT NULL
      )`),
      runtime.DB.prepare("CREATE INDEX IF NOT EXISTS empire_login_attempts_visitor_time ON empire_login_attempts (visitor_hash, attempted_at)"),
      ...initialAccounts.map((account) =>
        runtime.DB.prepare("INSERT OR IGNORE INTO empire_access_accounts (access, salt, password_hash, updated_at) VALUES (?, ?, ?, ?)").bind(account.access, account.salt, account.hash, new Date().toISOString()),
      ),
      ...initialAccounts.map((account) =>
        runtime.DB.prepare("UPDATE empire_access_accounts SET salt = ?, password_hash = ?, updated_at = ? WHERE access = ? AND password_hash = ?").bind(account.salt, account.hash, new Date().toISOString(), account.access, account.legacyHash),
      ),
      runtime.DB.prepare("DELETE FROM empire_access_accounts WHERE access = 'member'"),
    ])
      .then(async () => {
        const seededAt = new Date().toISOString();
        const seedMarker = await runtime.DB
          .prepare("INSERT OR IGNORE INTO empire_committee_meta (id, seeded_at) VALUES (1, ?)")
          .bind(seededAt)
          .run();
        if (Number(seedMarker.meta.changes ?? 0) === 0) return;
        const count = await runtime.DB
          .prepare("SELECT COUNT(*) AS total FROM empire_committee")
          .first<{ total: number }>();
        if (Number(count?.total ?? 0) > 0) return;
        await runtime.DB.batch(
          initialCommittee.map(([role, name, phone], index) =>
            runtime.DB
              .prepare(
                "INSERT INTO empire_committee (id, role, name, phone, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              )
              .bind(index + 1, role, name, phone, index + 1, seededAt),
          ),
        );
      })
      .catch((error) => {
        ready = null;
        throw error;
      });
  }
  await ready;
  return runtime.DB;
}

export function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function assertRequestSize(request: Request, maximumBytes: number) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    throw new RequestBodyTooLargeError();
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  assertRequestSize(request, JSON_BODY_LIMIT_BYTES);
  if (!request.body) throw new InvalidRequestBodyError();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > JSON_BODY_LIMIT_BYTES) {
        await reader.cancel();
        throw new RequestBodyTooLargeError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("JSON body must be an object.");
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new InvalidRequestBodyError();
  }
}

export function apiError(error: unknown) {
  if (error instanceof RequestBodyTooLargeError) {
    return Response.json(
      { error: "That request is too large." },
      { status: 413, headers: { "cache-control": "no-store" } },
    );
  }
  if (error instanceof InvalidRequestBodyError) {
    return Response.json(
      { error: "Please send a valid request." },
      { status: 400, headers: { "cache-control": "no-store" } },
    );
  }
  console.error("Empire API error", error);
  return Response.json(
    { error: "We could not complete that request. Please try again." },
    { status: 500 },
  );
}
