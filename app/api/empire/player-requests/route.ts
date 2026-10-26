import {
  apiError,
  cleanText,
  getEmpireDatabase,
  getEmpireSession,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";
import { ensureMemberOwnership } from "../member-ownership";

type PlayerRequestRow = {
  id: number;
  match_name: string;
  match_date: string;
  players_required: number;
  names_json: string;
};

function readNames(value: string) {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed)
      ? parsed.map((name) => cleanText(name, 120)).filter(Boolean)
      : [];
  } catch {
    return [];
  }
}

type Signup = { request_id: number; member_id: number; member_name: string };
function mapRequest(row: PlayerRequestRow, signups: Signup[] = [], memberId: number | null = null, admin = false) {
  return {
    id: row.id,
    match: row.match_name,
    date: row.match_date,
    playersRequired: row.players_required,
    names: [...readNames(row.names_json), ...signups.filter((signup) => signup.request_id === row.id).map((signup) => signup.member_name)],
    joined: memberId !== null && signups.some((signup) => signup.request_id === row.id && signup.member_id === memberId),
    ...(admin ? { legacyNames: readNames(row.names_json), registered: signups.filter((signup) => signup.request_id === row.id).map((signup) => ({ memberId: signup.member_id, name: signup.member_name })) } : {}),
  };
}

function readDetails(input: Record<string, unknown>) {
  return {
    match: cleanText(input.match, 160),
    date: cleanText(input.date, 10),
    playersRequired: Number(input.playersRequired),
  };
}

function validateDetails(details: ReturnType<typeof readDetails>) {
  if (
    !details.match ||
    !/^\d{4}-\d{2}-\d{2}$/.test(details.date) ||
    !Number.isInteger(details.playersRequired) ||
    details.playersRequired < 1 ||
    details.playersRequired > 40
  ) {
    return "Please enter a match, date and number of players required.";
  }
  return "";
}

async function removeDuplicateBlankRequests(
  db: Awaited<ReturnType<typeof getEmpireDatabase>>,
  rows: PlayerRequestRow[],
  signups: Signup[],
) {
  const keepByMatchAndDate = new Map<string, PlayerRequestRow>();
  const duplicateIds = new Set<number>();

  for (const row of rows) {
    if (readNames(row.names_json).length || signups.some((signup) => signup.request_id === row.id)) continue;
    const key = `${row.match_name.trim().toLowerCase()}\u0000${row.match_date}`;
    const current = keepByMatchAndDate.get(key);
    if (!current) {
      keepByMatchAndDate.set(key, row);
      continue;
    }
    const keepCurrent =
      current.players_required > row.players_required ||
      (current.players_required === row.players_required && current.id < row.id);
    const kept = keepCurrent ? current : row;
    const duplicate = keepCurrent ? row : current;
    keepByMatchAndDate.set(key, kept);
    duplicateIds.add(duplicate.id);
  }

  if (duplicateIds.size) {
    const candidates = [...duplicateIds];
    const deleted = await db.batch(
      candidates.map((id) =>
        db.prepare("DELETE FROM empire_player_requests WHERE id = ? AND NOT EXISTS (SELECT 1 FROM empire_player_signups WHERE request_id = ?) AND (CASE WHEN json_valid(names_json) THEN json_array_length(names_json) ELSE 0 END) = 0").bind(id, id),
      ),
    );
    candidates.forEach((id, index) => { if (!deleted[index].meta.changes) duplicateIds.delete(id); });
  }
  return rows.filter((row) => !duplicateIds.has(row.id));
}

export async function GET(request: Request) {
  const session = await getEmpireSession(request);
  if (!session) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    const result = await db
      .prepare(
        "SELECT id, match_name, match_date, players_required, names_json FROM empire_player_requests ORDER BY match_date ASC, id ASC",
      )
      .all<PlayerRequestRow>();
    const signups = (await db.prepare("SELECT request_id, member_id, member_name FROM empire_player_signups ORDER BY rowid").all<Signup>()).results ?? [];
    const requests = await removeDuplicateBlankRequests(db, result.results ?? [], signups);
    return Response.json(
      {
        requests: requests.map((row) => mapRequest(row, signups, session.member_id, session.access === "admin")),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const details = readDetails(await readJson(request));
    const validationError = validateDetails(details);
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    const existing = await db
      .prepare(
        "SELECT id FROM empire_player_requests WHERE lower(trim(match_name)) = lower(trim(?)) AND match_date = ?",
      )
      .bind(details.match, details.date)
      .first<{ id: number }>();
    if (existing) {
      return Response.json(
        { error: "A player sign-up sheet for that match and date already exists." },
        { status: 409 },
      );
    }
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO empire_player_requests (match_name, match_date, players_required, names_json, created_at) VALUES (?, ?, ?, ?, ?)",
      )
      .bind(details.match, details.date, details.playersRequired, "[]", createdAt)
      .run();
    return Response.json(
      {
        request: {
          id: Number(result.meta.last_row_id),
          match: details.match,
          date: details.date,
          playersRequired: details.playersRequired,
          names: [],
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const session = await getEmpireSession(request);
  if (!session) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Invalid player request." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    const current = await db
      .prepare(
        "SELECT id, match_name, match_date, players_required, names_json FROM empire_player_requests WHERE id = ?",
      )
      .bind(id)
      .first<PlayerRequestRow>();
    if (!current) {
      return Response.json({ error: "Player request not found." }, { status: 404 });
    }

    if (session.access === "member") {
      if (session.member_id === null || (input.action !== "join" && input.action !== "leave") || "names" in input || "match" in input || "date" in input || "playersRequired" in input) return Response.json({ error: "Choose only your own availability." }, { status: 403 });
      if (input.action === "join") {
        const member = await db.prepare("SELECT name FROM empire_members WHERE id = ?").bind(session.member_id).first<{ name: string }>();
        if (!member) return unauthorized();
        const added = await db.prepare(`INSERT OR IGNORE INTO empire_player_signups (request_id, member_id, member_name)
          SELECT id, ?, ? FROM empire_player_requests WHERE id = ? AND
          (CASE WHEN json_valid(names_json) THEN json_array_length(names_json) ELSE 0 END) + (SELECT COUNT(*) FROM empire_player_signups WHERE request_id = ?) < players_required`).bind(session.member_id, member.name, id, id).run();
        if (!added.meta.changes) return Response.json({ error: "You have already joined or this sign-up sheet is full." }, { status: 409 });
      } else {
        await db.prepare("DELETE FROM empire_player_signups WHERE request_id = ? AND member_id = ?").bind(id, session.member_id).run();
      }
      const signups = (await db.prepare("SELECT request_id, member_id, member_name FROM empire_player_signups WHERE request_id = ? ORDER BY rowid").bind(id).all<Signup>()).results ?? [];
      return Response.json({ request: mapRequest(current, signups, session.member_id) });
    }

    if (input.action === "removeSignup") {
      const memberId = Number(input.memberId);
      if (!Number.isSafeInteger(memberId) || memberId <= 0) return Response.json({ error: "Choose a valid member." }, { status: 400 });
      await db.prepare("DELETE FROM empire_player_signups WHERE request_id = ? AND member_id = ?").bind(id, memberId).run();
      const signups = (await db.prepare("SELECT request_id, member_id, member_name FROM empire_player_signups WHERE request_id = ? ORDER BY rowid").bind(id).all<Signup>()).results ?? [];
      return Response.json({ request: mapRequest(current, signups, null, true) });
    }
    if (input.action === "removeLegacy") {
      const index = Number(input.index), legacy = readNames(current.names_json);
      if (!Number.isInteger(index) || index < 0 || index >= legacy.length || legacy[index] !== input.name) return Response.json({ error: "The sign-up sheet changed. Refresh and try again." }, { status: 409 });
      legacy.splice(index, 1);
      const updated = await db.prepare("UPDATE empire_player_requests SET names_json = ? WHERE id = ? AND names_json = ?").bind(JSON.stringify(legacy), id, current.names_json).run();
      if (!updated.meta.changes) return Response.json({ error: "The sign-up sheet changed. Refresh and try again." }, { status: 409 });
      const signups = (await db.prepare("SELECT request_id, member_id, member_name FROM empire_player_signups WHERE request_id = ? ORDER BY rowid").bind(id).all<Signup>()).results ?? [];
      return Response.json({ request: mapRequest({ ...current, names_json: JSON.stringify(legacy) }, signups, null, true) });
    }

    const hasDetails =
      "match" in input || "date" in input || "playersRequired" in input;
    const details = hasDetails
      ? readDetails(input)
      : {
          match: current.match_name,
          date: current.match_date,
          playersRequired: current.players_required,
        };
    if (hasDetails && session.access !== "admin") {
      return Response.json(
        { error: "Only administrators can edit a player request." },
        { status: 403 },
      );
    }
    const validationError = hasDetails ? validateDetails(details) : "";
    if (validationError) {
      return Response.json({ error: validationError }, { status: 400 });
    }

    const names = Array.isArray(input.names)
      ? [...
          new Set(
            input.names
              .map((name) => cleanText(name, 120))
              .filter(Boolean),
          )]
      : readNames(current.names_json);
    const signupCount = await db.prepare("SELECT COUNT(*) AS count FROM empire_player_signups WHERE request_id = ?").bind(id).first<{ count: number }>();
    if (names.length + Number(signupCount?.count ?? 0) > details.playersRequired) {
      return Response.json(
        { error: "Too many names for this request." },
        { status: 400 },
      );
    }

    const updated = await db
      .prepare(
        "UPDATE empire_player_requests SET match_name = ?, match_date = ?, players_required = ?, names_json = ? WHERE id = ? AND names_json = ? AND ? + (SELECT COUNT(*) FROM empire_player_signups WHERE request_id = ?) <= ?",
      )
      .bind(
        details.match,
        details.date,
        details.playersRequired,
        JSON.stringify(names),
        id,
        current.names_json, names.length, id, details.playersRequired,
      )
      .run();
    if (!updated.meta.changes) return Response.json({ error: "The sign-up sheet changed. Refresh and try again." }, { status: 409 });
    const signups = (await db.prepare("SELECT request_id, member_id, member_name FROM empire_player_signups WHERE request_id = ? ORDER BY rowid").bind(id).all<Signup>()).results ?? [];
    return Response.json({
      request: mapRequest({
        ...current,
        match_name: details.match,
        match_date: details.date,
        players_required: details.playersRequired,
        names_json: JSON.stringify(names),
      }, signups, null, true),
    });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) {
      return Response.json({ error: "Invalid player request." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    await db.batch([db.prepare("DELETE FROM empire_player_signups WHERE request_id = ?").bind(id), db.prepare("DELETE FROM empire_player_requests WHERE id = ?").bind(id)]);
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
