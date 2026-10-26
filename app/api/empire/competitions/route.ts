import { apiError, getEmpireDatabase, getEmpireSession, readJson, sameOrigin, unauthorized } from "../_server";
import { ensureCompetitionSchema } from "../../../../lib/competition-schema";
import { CompetitionError, competitionMutation } from "../../../../lib/competition-service";

const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie", "x-robots-tag": "noindex" };

export async function GET(request: Request) {
  try {
    const session = await getEmpireSession(request);
    if (!session) return unauthorized();
    const db = await getEmpireDatabase();
    await ensureCompetitionSchema(db);
    const visible = session.access === "admin" ? "" : "WHERE published=1 AND archived=0";
    const competitions = (await db.prepare(`SELECT * FROM empire_competitions ${visible} ORDER BY created_at DESC, id DESC`).all()).results ?? [];
    const clause = session.access === "admin" ? "" : "WHERE c.published=1 AND c.archived=0";
    const competitionEntries = (await db.prepare(`SELECT e.* FROM empire_competition_entries e JOIN empire_competitions c ON c.id=e.competition_id ${clause} ORDER BY e.entry_order,e.id`).all()).results ?? [];
    const competitionMatches = (await db.prepare(`SELECT m.* FROM empire_competition_matches m JOIN empire_competitions c ON c.id=m.competition_id ${clause} ORDER BY m.round,m.slot`).all()).results ?? [];
    return Response.json({ competitions, competitionEntries, competitionMatches, sessionMemberId: session.access === "member" ? session.member_id : null }, { headers: privateHeaders });
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  try {
    const session = await getEmpireSession(request);
    if (!session) return unauthorized();
    if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403, headers: privateHeaders });
    const input = await readJson(request);
    const db = await getEmpireDatabase();
    await ensureCompetitionSchema(db);
    const result = await competitionMutation(db, { role: session.access, member_id: session.member_id, permissions: session.access === "admin" ? ["competitions"] : [] }, input, new Date().toISOString().slice(0, 10));
    return Response.json(result, { headers: privateHeaders });
  } catch (error) {
    if (error instanceof CompetitionError) return Response.json({ error: error.message }, { status: error.status, headers: privateHeaders });
    return apiError(error);
  }
}
