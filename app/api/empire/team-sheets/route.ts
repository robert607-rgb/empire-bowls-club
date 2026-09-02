import {
  apiError,
  cleanText,
  getEmpireDatabase,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

const formats = {
  Singles: ["Player"],
  Pairs: ["Lead", "Skip"],
  Triples: ["Lead", "Second", "Skip"],
  Fours: ["Lead", "Second", "Third", "Skip"],
} as const;

type TeamFormat = keyof typeof formats;
type RinkDraft = { format: TeamFormat; memberIds: number[] };
type TeamSheetRow = {
  id: number;
  opponent: string;
  competition: string;
  match_date: string;
  rink_count: number;
  rinks_json: string;
  created_at: string;
};
type MemberRow = { id: number; name: string };

function readRinks(value: unknown): RinkDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((rink) => {
    const record = rink && typeof rink === "object" ? rink as Record<string, unknown> : {};
    const format = typeof record.format === "string" && record.format in formats
      ? record.format as TeamFormat
      : "Fours";
    const memberIds = Array.isArray(record.memberIds)
      ? record.memberIds.map(Number).filter((id) => Number.isInteger(id) && id > 0)
      : [];
    return { format, memberIds };
  });
}

function readStoredRinks(value: string): RinkDraft[] {
  try {
    return readRinks(JSON.parse(value || "[]"));
  } catch {
    return [];
  }
}

function readDetails(input: Record<string, unknown>) {
  return {
    opponent: cleanText(input.opponent, 160),
    competition: cleanText(input.competition, 160),
    matchDate: cleanText(input.matchDate, 10),
    rinkCount: Number(input.rinkCount),
    rinks: readRinks(input.rinks),
  };
}

function validateDetails(details: ReturnType<typeof readDetails>) {
  if (
    !details.opponent ||
    !details.competition ||
    !/^\d{4}-\d{2}-\d{2}$/.test(details.matchDate) ||
    !Number.isInteger(details.rinkCount) ||
    details.rinkCount < 1 ||
    details.rinkCount > 6 ||
    details.rinks.length !== details.rinkCount
  ) {
    return "Add the opponent, competition, match date and every rink.";
  }
  for (const rink of details.rinks) {
    if (rink.memberIds.length !== formats[rink.format].length) {
      return "Choose a member for every position in each rink.";
    }
  }
  const ids = details.rinks.flatMap((rink) => rink.memberIds);
  if (new Set(ids).size !== ids.length) {
    return "A member can only be selected once in the same team sheet.";
  }
  return "";
}

async function mapSheet(
  db: Awaited<ReturnType<typeof getEmpireDatabase>>,
  row: TeamSheetRow,
) {
  const rinks = readStoredRinks(row.rinks_json);
  const ids = [...new Set(rinks.flatMap((rink) => rink.memberIds))];
  const members = ids.length
    ? await db
        .prepare(`SELECT id, name FROM empire_members WHERE id IN (${ids.map(() => "?").join(", ")})`)
        .bind(...ids)
        .all<MemberRow>()
    : { results: [] as MemberRow[] };
  const memberRows = (members.results ?? []) as MemberRow[];
  const names = new Map(
    memberRows.map((member: MemberRow) => [member.id, member.name]),
  );
  return {
    id: row.id,
    opponent: row.opponent,
    competition: row.competition,
    matchDate: row.match_date,
    rinkCount: row.rink_count,
    createdAt: row.created_at,
    rinks: rinks.map((rink, index) => ({
      rink: index + 1,
      format: rink.format,
      players: rink.memberIds.map((memberId, position) => ({
        memberId,
        name: names.get(memberId) ?? "Former member",
        position: formats[rink.format][position],
      })),
    })),
  };
}

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, opponent, competition, match_date, rink_count, rinks_json, created_at FROM empire_team_sheets ORDER BY match_date DESC, id DESC",
      )
      .all<TeamSheetRow>();
    return Response.json(
      {
        sheets: await Promise.all(
          ((result.results ?? []) as TeamSheetRow[]).map((row: TeamSheetRow) =>
            mapSheet(db, row),
          ),
        ),
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
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const db = await getEmpireDatabase();
    const memberIds = details.rinks.flatMap((rink) => rink.memberIds);
    const members = await db
      .prepare(`SELECT id FROM empire_members WHERE id IN (${memberIds.map(() => "?").join(", ")})`)
      .bind(...memberIds)
      .all<{ id: number }>();
    if ((members.results ?? []).length !== memberIds.length) {
      return Response.json({ error: "One or more selected members are no longer in the directory." }, { status: 400 });
    }
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare(
        "INSERT INTO empire_team_sheets (opponent, competition, match_date, rink_count, rinks_json, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      )
      .bind(
        details.opponent,
        details.competition,
        details.matchDate,
        details.rinkCount,
        JSON.stringify(details.rinks),
        createdAt,
      )
      .run();
    const row: TeamSheetRow = {
      id: Number(result.meta.last_row_id),
      opponent: details.opponent,
      competition: details.competition,
      match_date: details.matchDate,
      rink_count: details.rinkCount,
      rinks_json: JSON.stringify(details.rinks),
      created_at: createdAt,
    };
    return Response.json({ sheet: await mapSheet(db, row) }, { status: 201 });
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
      return Response.json({ error: "Choose a valid team sheet." }, { status: 400 });
    }
    const db = await getEmpireDatabase();
    await db.prepare("DELETE FROM empire_team_sheets WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
