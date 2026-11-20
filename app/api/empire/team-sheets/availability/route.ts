import { clubToday, isClubDate } from "../../../../../lib/club-date";
import { apiError, getEmpireDatabase, getEmpireSession, readJson, sameOrigin, unauthorized } from "../../_server";

const headers = { "cache-control": "private, no-store", vary: "Cookie", "x-robots-tag": "noindex" };

export async function GET(request: Request) {
  try {
    const session = await getEmpireSession(request);
    if (!session) return unauthorized();
    const db = await getEmpireDatabase();
    const date = new URL(request.url).searchParams.get("date");
    if (date !== null) {
      if (session.access !== "admin") return unauthorized();
      if (!isClubDate(date)) return Response.json({ error: "Choose a valid match date." }, { status: 400, headers });
      const rows = await db.prepare("SELECT member_id FROM empire_member_unavailability WHERE match_date = ?").bind(date).all<{ member_id: number }>();
      return Response.json({ memberIds: rows.results.map(row => row.member_id) }, { headers });
    }
    if (session.member_id === null) return unauthorized();
    const rows = await db.prepare("SELECT match_date FROM empire_member_unavailability WHERE member_id = ? AND match_date >= ? ORDER BY match_date").bind(session.member_id, clubToday()).all<{ match_date: string }>();
    return Response.json({ dates: rows.results.map(row => row.match_date) }, { headers });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403, headers });
  try {
    const session = await getEmpireSession(request);
    if (!session || session.member_id === null || session.access !== "member") return unauthorized();
    const { available, unavailable } = await readJson(request);
    const today = clubToday();
    if (!Array.isArray(available) || !Array.isArray(unavailable) || available.length + unavailable.length > 366
      || ![...available, ...unavailable].every(date => isClubDate(date) && date >= today)
      || available.some(date => unavailable.includes(date))) {
      return Response.json({ error: "Choose valid future dates and save up to 366 changes at once." }, { status: 400, headers });
    }
    const db = await getEmpireDatabase();
    await db.batch([
      db.prepare("DELETE FROM empire_member_unavailability WHERE member_id = ? AND match_date IN (SELECT value FROM json_each(?))").bind(session.member_id, JSON.stringify(available)),
      db.prepare("INSERT OR IGNORE INTO empire_member_unavailability (member_id, match_date) SELECT ?, value FROM json_each(?)").bind(session.member_id, JSON.stringify(unavailable)),
    ]);
    return GET(new Request(request.url, { headers: request.headers }));
  } catch (error) {
    return apiError(error);
  }
}
