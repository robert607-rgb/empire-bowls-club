export type EmpireAccess = "member" | "admin";

let ready: Promise<void> | null = null;

export async function getRuntimeEnv() {
  // Deferred so the packaged worker can also be inspected by the local artifact validator.
  return (await import("cloudflare:workers")).env as unknown as {
    DB: D1Database;
    BUCKET: R2Bucket;
  };
}

export function hasEmpireAccess(request: Request, adminOnly = false): boolean {
  const supplied = request.headers.get("x-empire-access") ?? "";
  if (supplied === "admin:empireadmin") return true;
  return !adminOnly && supplied === "member:empire";
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
  const message =
    error instanceof Error ? error.message : "Unexpected server error";
  return Response.json({ error: message }, { status: 500 });
}
