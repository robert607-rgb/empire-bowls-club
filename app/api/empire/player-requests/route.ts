import {
  apiError,
  cleanText,
  getEmpireAccess,
  getEmpireDatabase,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

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

function mapRequest(row: PlayerRequestRow) {
  return {
    id: row.id,
    match: row.match_name,
    date: row.match_date,
    playersRequired: row.players_required,
    names: [...new Set(readNames(row.names_json))],
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
) {
  const keepByMatchAndDate = new Map<string, PlayerRequestRow>();
  const duplicateIds = new Set<number>();

  for (const row of rows) {
    if (readNames(row.names_json).length) continue;
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
    await db.batch(
      [...duplicateIds].map((id) =>
        db.prepare("DELETE FROM empire_player_requests WHERE id = ?").bind(id),
      ),
    );
  }
  return rows.filter((row) => !duplicateIds.has(row.id));
}

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, match_name, match_date, players_required, names_json FROM empire_player_requests ORDER BY match_date ASC, id ASC",
      )
      .all<PlayerRequestRow>();
    const requests = await removeDuplicateBlankRequests(db, result.results ?? []);
    return Response.json(
      {
        requests: requests.map(mapRequest),
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
  const access = await getEmpireAccess(request);
  if (!access) return unauthorized();
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
    const current = await db
      .prepare(
        "SELECT id, match_name, match_date, players_required, names_json FROM empire_player_requests WHERE id = ?",
      )
      .bind(id)
      .first<PlayerRequestRow>();
    if (!current) {
      return Response.json({ error: "Player request not found." }, { status: 404 });
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
    if (hasDetails && access !== "admin") {
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
    if (names.length > details.playersRequired) {
      return Response.json(
        { error: "Too many names for this request." },
        { status: 400 },
      );
    }

    await db
      .prepare(
        "UPDATE empire_player_requests SET match_name = ?, match_date = ?, players_required = ?, names_json = ? WHERE id = ?",
      )
      .bind(
        details.match,
        details.date,
        details.playersRequired,
        JSON.stringify(names),
        id,
      )
      .run();
    return Response.json({
      request: mapRequest({
        ...current,
        match_name: details.match,
        match_date: details.date,
        players_required: details.playersRequired,
        names_json: JSON.stringify(names),
      }),
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
    await db
      .prepare("DELETE FROM empire_player_requests WHERE id = ?")
      .bind(id)
      .run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
