import { apiError, cleanText, getEmpireDatabase, getEmpireSession, readJson, sameOrigin, unauthorized } from "../_server";
import { ensureMemberOwnership } from "../member-ownership";

const slots = new Set(["10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00", "18:00–21:00"]);
type BookingRow = { id: number; rink_number: number; time_slot: string; booking_name: string; fixture_key: string | null; owner_id: number | null };
type BookingView = { id: number | null; rinkNumber: number; timeSlot: string; bookingName: string; fixtureKey?: string | null; canCancel?: boolean };

function isFriday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
}

function isMaintenanceSlot(date: string, timeSlot: string) {
  return isFriday(date) && timeSlot === "10:00–12:00";
}

export async function GET(request: Request) {
  const session = await getEmpireSession(request);
  if (!session) return unauthorized();
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Choose a valid booking date." }, { status: 400 });
  try {
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    const result = await db.prepare("SELECT b.id, b.rink_number, b.time_slot, b.booking_name, b.fixture_key, o.member_id AS owner_id FROM empire_bookings b LEFT JOIN empire_booking_owners o ON o.booking_id = b.id WHERE b.booking_date = ? ORDER BY b.rink_number, b.time_slot").bind(date).all<BookingRow>();
    const bookings: BookingView[] = (result.results ?? [])
      .filter((booking) => !isMaintenanceSlot(date, booking.time_slot))
      .map((booking) => ({ id: booking.id, rinkNumber: booking.rink_number, timeSlot: booking.time_slot, bookingName: booking.booking_name, fixtureKey: booking.fixture_key, canCancel: !booking.fixture_key && (session.access === "admin" || (session.member_id !== null && session.member_id === booking.owner_id)) }));
    if (isFriday(date)) {
      bookings.push(...[1, 2, 3, 4, 5, 6].map((rinkNumber) => ({
        id: null,
        rinkNumber,
        timeSlot: "10:00–12:00",
        bookingName: "Green maintenance · Friday maintenance",
      })));
    }
    return Response.json(
      { bookings },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) { return apiError(error); }
}

export async function POST(request: Request) {
  const session = await getEmpireSession(request);
  if (!session) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const bookingDate = cleanText(input.bookingDate, 10), timeSlot = cleanText(input.timeSlot, 20);
    const rinkNumber = typeof input.rinkNumber === "number" ? input.rinkNumber : Number(input.rinkNumber);
    const bookingType = cleanText(input.bookingType, 20);
    const bookingNameInput = cleanText(input.bookingName, 100);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !slots.has(timeSlot) || !Number.isInteger(rinkNumber) || rinkNumber < 1 || rinkNumber > 6 || !bookingNameInput || (bookingType && !["Roll Up", "League", "Competition", "Neutral"].includes(bookingType))) return Response.json({ error: "Please choose a valid date, rink, session and booking details." }, { status: 400 });
    if (isMaintenanceSlot(bookingDate, timeSlot)) return Response.json({ error: "Friday 10am–12pm is reserved for green maintenance." }, { status: 409 });
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    if (session.access === "member" && session.member_id === null) return Response.json({ error: "Sign in with your own member details to book a rink." }, { status: 403 });
    const member = session.access === "member" ? await db.prepare("SELECT name FROM empire_members WHERE id = ?").bind(session.member_id).first<{ name: string }>() : null;
    if (session.access === "member" && !member) return unauthorized();
    const bookingName = bookingType ? `${bookingNameInput} · ${bookingType}` : bookingNameInput;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(6))).reduce((number, byte) => number * 256 + byte, 0) + 1;
    try { const statements = [db.prepare("INSERT INTO empire_bookings (id, booking_date, rink_number, time_slot, booking_name, created_at) VALUES (?, ?, ?, ?, ?, ?)").bind(id, bookingDate, rinkNumber, timeSlot, bookingName, new Date().toISOString())]; if (session.access === "member") statements.push(db.prepare("INSERT INTO empire_booking_owners (booking_id, member_id) VALUES (?, ?)").bind(id, session.member_id)); await db.batch(statements); }
    catch (error) { if (String(error).toLowerCase().includes("unique")) return Response.json({ error: "That rink has just been booked. Please choose another available session." }, { status: 409 }); throw error; }
    return Response.json({ booking: { bookingDate, rinkNumber, timeSlot, bookingName } }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  const session = await getEmpireSession(request);
  if (!session) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid booking to remove." }, { status: 400 });
    const db = await getEmpireDatabase();
    await ensureMemberOwnership(db);
    const booking = await db.prepare("SELECT b.fixture_key, o.member_id AS owner_id FROM empire_bookings b LEFT JOIN empire_booking_owners o ON o.booking_id = b.id WHERE b.id = ?").bind(id).first<{ fixture_key: string | null; owner_id: number | null }>();
    if (!booking) return Response.json({ error: "That booking no longer exists." }, { status: 404 });
    if (booking?.fixture_key) {
      return Response.json({ error: "This rink is reserved by a fixture. Remove the fixture from the Admin Zone to release its rinks." }, { status: 409 });
    }
    if (session.access !== "admin" && (session.member_id === null || session.member_id !== booking.owner_id)) return Response.json({ error: "Only the member who made this booking or an administrator can remove it." }, { status: 403 });
    const result = await db.batch([db.prepare("DELETE FROM empire_bookings WHERE id = ? AND fixture_key IS NULL AND (? = 'admin' OR EXISTS (SELECT 1 FROM empire_booking_owners WHERE booking_id = ? AND member_id = ?))").bind(id, session.access, id, session.member_id), db.prepare("DELETE FROM empire_booking_owners WHERE booking_id = ? AND NOT EXISTS (SELECT 1 FROM empire_bookings WHERE id = ?)").bind(id, id)]);
    if (!result[0].meta.changes) return Response.json({ error: "The booking changed. Refresh and try again." }, { status: 409 });
    return Response.json({ removed: true });
  } catch (error) { return apiError(error); }
}
