export type EmpireAccess = "member" | "admin";

let ready: Promise<void> | null = null;
const encoder = new TextEncoder();
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_ATTEMPT_LIMIT = 8;

// These one-way hashes keep the original club access codes working without
// retaining a readable password in the client bundle or database. Admins can
// rotate either password later; the replacement is stored only as a hash.
const initialAccounts: Array<{ access: EmpireAccess; salt: string; hash: string }> = [
  {
    access: "member",
    salt: "1e9b6210bd2fbcb3c318658ed323c61a1c99",
    hash: "e00267597e8173b5444e283be12dcedf995feb7c890c56538198fbe059e1ac32",
  },
  {
    access: "admin",
    salt: "7940822b5d17baf44aabf7cf04784a233245",
    hash: "cdd0183505e559201772e9f0860840893963904157583b649a5efd9a4a3378cd",
  },
];

type AccountRow = { access: EmpireAccess; salt: string; password_hash: string };
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
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: 210_000 },
    key,
    256,
  );
  return hex(new Uint8Array(bits));
}

async function fingerprint(request: Request) {
  const url = new URL(request.url);
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
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

export async function authenticateEmpireAccess(request: Request, access: EmpireAccess, password: string) {
  const db = await getEmpireDatabase();
  const visitor = await fingerprint(request);
  const windowStart = new Date(Date.now() - LOGIN_WINDOW_MS).toISOString();
  await db.prepare("DELETE FROM empire_login_attempts WHERE attempted_at < ?").bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).run();
  const count = await db.prepare("SELECT COUNT(*) AS total FROM empire_login_attempts WHERE visitor_hash = ? AND attempted_at >= ?").bind(visitor, windowStart).first<{ total: number }>();
  if ((count?.total ?? 0) >= LOGIN_ATTEMPT_LIMIT) return { ok: false as const, rateLimited: true };

  const account = await db.prepare("SELECT access, salt, password_hash FROM empire_access_accounts WHERE access = ?").bind(access).first<AccountRow>();
  const matches = account && (await passwordHash(password, account.salt)) === account.password_hash;
  if (!matches) {
    await db.prepare("INSERT INTO empire_login_attempts (visitor_hash, attempted_at) VALUES (?, ?)").bind(visitor, new Date().toISOString()).run();
    return { ok: false as const, rateLimited: false };
  }
  await db.prepare("DELETE FROM empire_login_attempts WHERE visitor_hash = ?").bind(visitor).run();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
  const token = crypto.randomUUID();
  await db.prepare("INSERT INTO empire_sessions (token, access, expires_at, created_at) VALUES (?, ?, ?, ?)").bind(token, access, expiresAt.toISOString(), new Date().toISOString()).run();
  return { ok: true as const, token, expiresAt };
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
    ])
      .then(() => undefined)
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

export function apiError(error: unknown) {
  console.error("Empire API error", error);
  return Response.json(
    { error: "We could not complete that request. Please try again." },
    { status: 500 },
  );
}
