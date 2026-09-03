import { apiError, cleanText, getEmpireDatabase, hasEmpireAccess, readJson, sameOrigin, unauthorized } from "../_server";

const slots = new Set(["10:00–12:00", "12:00–14:00", "14:00–16:00", "16:00–18:00", "18:00–21:00"]);
type BookingRow = { id: number; rink_number: number; time_slot: string; booking_name: string; fixture_key: string | null };

function isFriday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay() === 5;
}

function isMaintenanceSlot(date: string, timeSlot: string) {
  return isFriday(date) && timeSlot === "10:00–12:00";
}

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Choose a valid booking date." }, { status: 400 });
  try {
    const db = await getEmpireDatabase();
    const result = await db.prepare("SELECT id, rink_number, time_slot, booking_name, fixture_key FROM empire_bookings WHERE booking_date = ? ORDER BY rink_number, time_slot").bind(date).all<BookingRow>();
    const bookings = (result.results ?? [])
      .filter((booking) => !isMaintenanceSlot(date, booking.time_slot))
      .map((booking) => ({ id: booking.id, rinkNumber: booking.rink_number, timeSlot: booking.time_slot, bookingName: booking.booking_name, fixtureKey: booking.fixture_key }));
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
  if (!(await hasEmpireAccess(request))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const bookingDate = cleanText(input.bookingDate, 10), timeSlot = cleanText(input.timeSlot, 20), bookingName = cleanText(input.bookingName, 100);
    const rinkNumber = typeof input.rinkNumber === "number" ? input.rinkNumber : Number(input.rinkNumber);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(bookingDate) || !slots.has(timeSlot) || !Number.isInteger(rinkNumber) || rinkNumber < 1 || rinkNumber > 6 || !bookingName) return Response.json({ error: "Please choose a valid date, rink, session and name." }, { status: 400 });
    if (isMaintenanceSlot(bookingDate, timeSlot)) return Response.json({ error: "Friday 10am–12pm is reserved for green maintenance." }, { status: 409 });
    const db = await getEmpireDatabase();
    try { await db.prepare("INSERT INTO empire_bookings (booking_date, rink_number, time_slot, booking_name, created_at) VALUES (?, ?, ?, ?, ?)").bind(bookingDate, rinkNumber, timeSlot, bookingName, new Date().toISOString()).run(); }
    catch (error) { if (String(error).toLowerCase().includes("unique")) return Response.json({ error: "That rink has just been booked. Please choose another available session." }, { status: 409 }); throw error; }
    return Response.json({ booking: { bookingDate, rinkNumber, timeSlot, bookingName } }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const input = await readJson(request);
    const id = Number(input.id);
    if (!Number.isInteger(id)) return Response.json({ error: "Choose a valid booking to remove." }, { status: 400 });
    const db = await getEmpireDatabase();
    const booking = await db.prepare("SELECT fixture_key FROM empire_bookings WHERE id = ?").bind(id).first<{ fixture_key: string | null }>();
    if (booking?.fixture_key) {
      return Response.json({ error: "This rink is reserved by a fixture. Remove the fixture from the Admin Zone to release its rinks." }, { status: 409 });
    }
    await db.prepare("DELETE FROM empire_bookings WHERE id = ?").bind(id).run();
    return Response.json({ removed: true });
  } catch (error) { return apiError(error); }
}
