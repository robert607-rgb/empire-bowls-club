import {
  apiError,
  cleanText,
  getEmpireDatabase,
  hasEmpireAccess,
  readJson,
  sameOrigin,
  unauthorized,
} from "../_server";

const timeSlots = [
  { label: "10:00–12:00", start: 10 * 60, end: 12 * 60 },
  { label: "12:00–14:00", start: 12 * 60, end: 14 * 60 },
  { label: "14:00–16:00", start: 14 * 60, end: 16 * 60 },
  { label: "16:00–18:00", start: 16 * 60, end: 18 * 60 },
  { label: "18:00–21:00", start: 18 * 60, end: 21 * 60 },
] as const;

type FixtureRow = {
  id: number;
  fixture_date: string;
  start_time: string;
  opponent: string;
  competition: string;
  rink_count: number;
  rinks_json: string;
  time_slot: string;
  booking_key: string;
  created_at: string;
};

type ImportFixture = {
  date: string;
  time: string;
  opponent: string;
  competition: string;
  rinks: number | number[];
};

function readRinks(value: unknown): number | number[] | null {
  if (Array.isArray(value)) {
    const rinks = [...new Set(value.map(Number))].sort((a, b) => a - b);
    return rinks.length && rinks.every((rink) => Number.isInteger(rink) && rink >= 1 && rink <= 6)
      ? rinks
      : null;
  }
  const count = Number(value);
  return Number.isInteger(count) && count >= 1 && count <= 6 ? count : null;
}

function fixtureSlot(time: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const minutes = Number(match[1]) * 60 + Number(match[2]);
  return timeSlots.find((slot) => minutes >= slot.start && minutes < slot.end)?.label ?? null;
}

function isFriday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
}

function isMaintenanceSlot(date: string, timeSlot: string) {
  return isFriday(date) && timeSlot === "10:00–12:00";
}

function parseStoredRinks(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.map(Number).filter((rink) => Number.isInteger(rink) && rink >= 1 && rink <= 6)
      : [];
  } catch {
    return [];
  }
}

function mapFixture(row: FixtureRow) {
  return {
    id: row.id,
    date: row.fixture_date,
    time: row.start_time,
    opponent: row.opponent,
    competition: row.competition,
    rinkCount: row.rink_count,
    rinks: parseStoredRinks(row.rinks_json),
  };
}

function readImportFixture(value: unknown): ImportFixture | null {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const date = cleanText(input.date, 10);
  const time = cleanText(input.time, 5);
  const opponent = cleanText(input.opponent, 160);
  const competition = cleanText(input.competition, 160);
  const rinks = readRinks(input.rinks);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !/^\d{2}:\d{2}$/.test(time) ||
    !fixtureSlot(time) ||
    !opponent ||
    !competition ||
    rinks === null
  ) {
    return null;
  }
  return { date, time, opponent, competition, rinks };
}

export async function GET() {
  try {
    const db = await getEmpireDatabase();
    const result = await db
      .prepare(
        "SELECT id, fixture_date, start_time, opponent, competition, rink_count, rinks_json, time_slot, booking_key, created_at FROM empire_fixtures ORDER BY fixture_date ASC, start_time ASC, opponent ASC",
      )
      .all<FixtureRow>();
    return Response.json(
      { fixtures: (result.results ?? []).map(mapFixture) },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    if (!Array.isArray(input.fixtures) || !input.fixtures.length || input.fixtures.length > 200) {
      return Response.json({ error: "Upload between 1 and 200 fixture rows at a time." }, { status: 400 });
    }
    const fixtures = input.fixtures.map(readImportFixture);
    const invalidRow = fixtures.findIndex((fixture) => !fixture);
    if (invalidRow >= 0) {
      return Response.json({ error: `Row ${invalidRow + 2} needs a valid date, time, opponent, competition and 1–6 rinks.` }, { status: 400 });
    }
    const validFixtures = fixtures as ImportFixture[];
    const duplicateRows = new Set<string>();
    for (const fixture of validFixtures) {
      const key = `${fixture.date}\u0000${fixture.time}\u0000${fixture.opponent.trim().toLowerCase()}\u0000${fixture.competition.trim().toLowerCase()}`;
      if (duplicateRows.has(key)) return Response.json({ error: `The spreadsheet includes the same fixture more than once (${fixture.opponent} on ${fixture.date}).` }, { status: 400 });
      duplicateRows.add(key);
    }

    const db = await getEmpireDatabase();
    const dates = [...new Set(validFixtures.map((fixture) => fixture.date))];
    const placeholders = dates.map(() => "?").join(", ");
    const [existingBookings, existingFixtures] = await Promise.all([
      db.prepare(`SELECT booking_date, rink_number, time_slot FROM empire_bookings WHERE booking_date IN (${placeholders})`).bind(...dates).all<{ booking_date: string; rink_number: number; time_slot: string }>(),
      db.prepare(`SELECT fixture_date, start_time, opponent, competition FROM empire_fixtures WHERE fixture_date IN (${placeholders})`).bind(...dates).all<Pick<FixtureRow, "fixture_date" | "start_time" | "opponent" | "competition">>(),
    ]);
    const occupied = new Map<string, Set<number>>();
    for (const booking of existingBookings.results ?? []) {
      const key = `${booking.booking_date}\u0000${booking.time_slot}`;
      const rinks = occupied.get(key) ?? new Set<number>();
      rinks.add(booking.rink_number);
      occupied.set(key, rinks);
    }
    const existingFixtureKeys = new Set(
      (existingFixtures.results ?? []).map((fixture) =>
        `${fixture.fixture_date}\u0000${fixture.start_time}\u0000${fixture.opponent.trim().toLowerCase()}\u0000${fixture.competition.trim().toLowerCase()}`,
      ),
    );
    const prepared: Array<ImportFixture & { slot: string; rinks: number[]; bookingKey: string }> = [];
    for (const fixture of validFixtures) {
      const slot = fixtureSlot(fixture.time);
      if (!slot || isMaintenanceSlot(fixture.date, slot)) {
        return Response.json({ error: `${fixture.opponent} on ${fixture.date} falls in the protected Friday maintenance session.` }, { status: 409 });
      }
      const fixtureKey = `${fixture.date}\u0000${fixture.time}\u0000${fixture.opponent.trim().toLowerCase()}\u0000${fixture.competition.trim().toLowerCase()}`;
      if (existingFixtureKeys.has(fixtureKey)) {
        return Response.json({ error: `${fixture.opponent} on ${fixture.date} is already in the fixture list.` }, { status: 409 });
      }
      const occupiedRinks = occupied.get(`${fixture.date}\u0000${slot}`) ?? new Set<number>();
      const rinks = Array.isArray(fixture.rinks)
        ? fixture.rinks
        : [1, 2, 3, 4, 5, 6].filter((rink) => !occupiedRinks.has(rink)).slice(0, fixture.rinks);
      if (rinks.length !== (Array.isArray(fixture.rinks) ? fixture.rinks.length : fixture.rinks) || rinks.some((rink) => occupiedRinks.has(rink))) {
        return Response.json({ error: `There are not enough free rinks for ${fixture.opponent} on ${fixture.date} at ${fixture.time}. No fixtures were added.` }, { status: 409 });
      }
      rinks.forEach((rink) => occupiedRinks.add(rink));
      occupied.set(`${fixture.date}\u0000${slot}`, occupiedRinks);
      prepared.push({ ...fixture, slot, rinks, bookingKey: crypto.randomUUID() });
    }
    const createdAt = new Date().toISOString();
    await db.batch(prepared.flatMap((fixture) => [
      db.prepare("INSERT INTO empire_fixtures (fixture_date, start_time, opponent, competition, rink_count, rinks_json, time_slot, booking_key, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .bind(fixture.date, fixture.time, fixture.opponent, fixture.competition, fixture.rinks.length, JSON.stringify(fixture.rinks), fixture.slot, fixture.bookingKey, createdAt),
      ...fixture.rinks.map((rink) =>
        db.prepare("INSERT INTO empire_bookings (booking_date, rink_number, time_slot, booking_name, fixture_key, created_at) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(fixture.date, rink, fixture.slot, `${fixture.competition}: v ${fixture.opponent}`, fixture.bookingKey, createdAt),
      ),
    ]));
    return Response.json({ imported: prepared.length, fixtures: prepared.map((fixture) => ({ date: fixture.date, opponent: fixture.opponent })) }, { status: 201 });
  } catch (error) {
    if (String(error).toLowerCase().includes("unique")) {
      return Response.json({ error: "One of those fixtures or rink slots was just added. Refresh the bookings and try again." }, { status: 409 });
    }
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid fixture." }, { status: 400 });
    const db = await getEmpireDatabase();
    const fixture = await db.prepare("SELECT booking_key FROM empire_fixtures WHERE id = ?").bind(id).first<{ booking_key: string }>();
    if (!fixture) return Response.json({ error: "Fixture not found." }, { status: 404 });
    await db.batch([
      db.prepare("DELETE FROM empire_bookings WHERE fixture_key = ?").bind(fixture.booking_key),
      db.prepare("DELETE FROM empire_fixtures WHERE id = ?").bind(id),
    ]);
    return Response.json({ removed: true });
  } catch (error) {
    return apiError(error);
  }
}
