import { matchLocations, parseRoster, publishedRoster, rinkLocations, validateRoster, type MatchLocation, type RinkLocation } from "../../../../lib/team-roster";
import { clubToday, isClubDate } from "../../../../lib/club-date";
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
type RinkDraft = { format: TeamFormat; memberIds: number[]; venue?: RinkLocation };
type TeamSheetRow = {
  id: number;
  opponent: string;
  competition: string;
  match_date: string;
  rink_count: number;
  rinks_json: string;
  created_at: string;
  archived?: number;
};
type MemberRow = { id: number; name: string };

function readRinks(value: unknown): RinkDraft[] {
  if (!Array.isArray(value)) return [];
  return value.map((rink) => {
    const record = rink && typeof rink === "object" ? rink as Record<string, unknown> : {};
    const format = typeof record.format === "string" && Object.hasOwn(formats, record.format)
      ? record.format as TeamFormat
      : "Fours";
    const memberIds = Array.isArray(record.memberIds)
      ? record.memberIds.map(Number)
      : [];
    return { format, memberIds, venue: rinkLocations.find(venue => venue === record.venue) };
  });
}

function readDetails(input: Record<string, unknown>) {
  return {
    fixtureId: input.fixtureId ? Number(input.fixtureId) : null,
    draft: input.draft === true,
    startTime: cleanText(input.startTime, 5),
    venue: matchLocations.find(venue => venue === input.venue) as MatchLocation | undefined,
    opponent: cleanText(input.opponent, 160),
    competition: cleanText(input.competition, 160),
    matchDate: cleanText(input.matchDate, 10),
    rinkCount: Number(input.rinkCount),
    rinks: readRinks(input.rinks),
    reserveIds: Array.isArray(input.reserveIds) ? input.reserveIds.map(Number) : [],
  };
}

function validateDetails(details: ReturnType<typeof readDetails>) {
  if (
    !details.opponent ||
    !details.competition ||
    !isClubDate(details.matchDate) ||
    !Number.isInteger(details.rinkCount) ||
    details.rinkCount < 1 ||
    details.rinkCount > 6 ||
    details.rinks.length !== details.rinkCount
  ) {
    return "Add the opponent, competition, match date and every rink.";
  }
  if (details.venue === "Home & Away" && details.rinks.some(rink => !rink.venue)) return "Choose a venue for every rink.";
  if (details.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(details.startTime)) return "Choose a valid start time.";
  for (const rink of details.rinks) {
    if (rink.memberIds.length !== formats[rink.format].length || (!details.draft && rink.memberIds.includes(0))) {
      return "Choose a member for every position in each rink.";
    }
  }
  if (!validateRoster(details.rinks.map(rink => ({ ...rink, memberIds: rink.memberIds.filter(id => id !== 0) })), details.reserveIds)) {
    return "A member can only be selected once in the same team sheet.";
  }
  return "";
}

async function mapSheet(
  db: Awaited<ReturnType<typeof getEmpireDatabase>>,
  row: TeamSheetRow,
  admin = false,
) {
  const stored = parseRoster(row.rinks_json);
  const rinks = readRinks(stored.rinks);
  const ids = [...new Set([...rinks.flatMap((rink) => rink.memberIds.filter(id => id > 0)), ...stored.reserveIds])];
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
    draft: stored.draft ?? false,
    ...(admin ? { revision: row.rinks_json } : {}),
    startTime: stored.startTime,
    venue: stored.venue,
    fixtureId: stored.fixtureId,
    createdAt: row.created_at,
    archived: Boolean(row.archived),
    reserves: stored.reserveIds.map((memberId) => ({ memberId, name: names.get(memberId) ?? "Former member" })),
    rinks: rinks.map((rink, index) => ({
      rink: index + 1,
      format: rink.format,
      venue: rink.venue,
      players: rink.memberIds.flatMap((memberId, position) => memberId > 0 ? [{
        memberId,
        name: names.get(memberId) ?? "Former member",
        position: formats[rink.format][position],
      }] : []),
    })),
  };
}

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try {
    const db = await getEmpireDatabase();
    const admin = await hasEmpireAccess(request,true);
    const result = await db
      .prepare(
        `SELECT s.id, s.opponent, s.competition, s.match_date, s.rink_count, s.rinks_json, s.created_at, CASE WHEN a.sheet_id IS NULL THEN 0 ELSE 1 END AS archived FROM empire_team_sheets s LEFT JOIN empire_team_sheet_archives a ON a.sheet_id=s.id ${admin ? '' : `WHERE a.sheet_id IS NULL AND ${publishedRoster}`} ORDER BY s.match_date DESC, s.id DESC`,
      )
      .all<TeamSheetRow>();
    return Response.json(
      {
        sheets: await Promise.all(
          ((result.results ?? []) as TeamSheetRow[]).map((row: TeamSheetRow) =>
            mapSheet(db, row, admin),
          ),
        ),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input=await readJson(request),id=Number(input.id);
    if (!Number.isInteger(id) || id < 1) return Response.json({error:'Choose a valid team sheet.'},{status:400});
    const db=await getEmpireDatabase();
    const sheet=await db.prepare('SELECT id,match_date FROM empire_team_sheets WHERE id=?').bind(id).first<{id:number;match_date:string}>();
    if(!sheet) return Response.json({error:'Team sheet not found.'},{status:404});
    if(input.restore===true) await db.prepare('DELETE FROM empire_team_sheet_archives WHERE sheet_id=?').bind(id).run();
    else await db.prepare('INSERT OR IGNORE INTO empire_team_sheet_archives (sheet_id,archived_at) VALUES (?,?)').bind(id,new Date().toISOString()).run();
    return Response.json({ok:true});
  } catch(error) { return apiError(error); }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) {
    return Response.json({ error: "Invalid request origin." }, { status: 403 });
  }
  try {
    const input = await readJson(request);
    const details = readDetails(input);
    const db = await getEmpireDatabase();
    if (details.fixtureId !== null) {
      if (!Number.isSafeInteger(details.fixtureId) || details.fixtureId < 1) return Response.json({ error: "Choose a valid fixture." }, { status: 400 });
      const fixture = await db.prepare("SELECT opponent, competition, fixture_date, start_time FROM empire_fixtures WHERE id = ?")
        .bind(details.fixtureId).first<{ opponent: string; competition: string; fixture_date: string; start_time: string }>();
      if (!fixture) return Response.json({ error: "Fixture no longer exists. Choose another fixture or create a standalone team sheet." }, { status: 409 });
      details.opponent = fixture.opponent;
      details.competition = fixture.competition;
      details.matchDate = fixture.fixture_date;
      details.startTime = fixture.start_time;
    }
    const validationError = validateDetails(details);
    if (validationError) return Response.json({ error: validationError }, { status: 400 });
    const memberIds = [...details.rinks.flatMap(rink => rink.memberIds.filter(id => id > 0)), ...details.reserveIds];
    if (memberIds.length) {
      const members = await db
        .prepare(`SELECT id FROM empire_members WHERE id IN (${memberIds.map(() => "?").join(", ")}) AND EXISTS(SELECT 1 FROM empire_member_credentials credential WHERE credential.member_id=empire_members.id)`)
        .bind(...memberIds)
        .all<{ id: number }>();
      if ((members.results ?? []).length !== memberIds.length) {
        return Response.json({ error: "One or more selected members are no longer in the directory." }, { status: 400 });
      }
    }
    const { opponent, competition, matchDate, rinkCount, rinks, reserveIds, startTime, venue, fixtureId, draft } = details;
    const roster = JSON.stringify({ rinks, reserveIds, startTime, venue, fixtureId, draft, revision: crypto.randomUUID() });
    const fields = [opponent, competition, matchDate, rinkCount, roster];
    if (input.id !== undefined) {
      const id = Number(input.id);
      if (!Number.isSafeInteger(id) || id < 1 || typeof input.revision !== "string") return Response.json({ error: "Reload this team sheet before editing." }, { status: 400 });
      const previous = await db.prepare("SELECT created_at, rinks_json FROM empire_team_sheets WHERE id = ?").bind(id).first<{ created_at: string; rinks_json: string }>();
      if (!previous) return Response.json({ error: "Team sheet not found." }, { status: 404 });
      if (draft && !parseRoster(previous.rinks_json).draft) return Response.json({ error: "This team sheet is already published." }, { status: 409 });
      const result = await db.prepare("UPDATE empire_team_sheets SET opponent = ?, competition = ?, match_date = ?, rink_count = ?, rinks_json = ? WHERE id = ? AND rinks_json = ? AND NOT EXISTS (SELECT 1 FROM empire_team_sheet_archives WHERE sheet_id = ?)")
        .bind(...fields, id, input.revision, id).run();
      if (!result.meta.changes) return Response.json({ error: "The team sheet changed. Reload it before saving." }, { status: 409 });
      const row: TeamSheetRow = { id, opponent, competition, match_date: matchDate, rink_count: rinkCount, rinks_json: roster, created_at: previous.created_at };
      return Response.json({ sheet: await mapSheet(db, row, true) });
    }
    const createdAt = new Date().toISOString();
    const result = await db
      .prepare("INSERT INTO empire_team_sheets (opponent, competition, match_date, rink_count, rinks_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(...fields, createdAt)
      .run();
    const row: TeamSheetRow = { id: Number(result.meta.last_row_id), opponent, competition, match_date: matchDate, rink_count: rinkCount, rinks_json: roster, created_at: createdAt };
    return Response.json({ sheet: await mapSheet(db, row, true) }, { status: 201 });
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
    await db.prepare("DELETE FROM empire_team_sheet_archives WHERE sheet_id = ?").bind(id).run();
    await db.prepare("DELETE FROM empire_team_sheets WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
