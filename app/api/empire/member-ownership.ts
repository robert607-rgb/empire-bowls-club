
// Separate ownership records preserve legacy bookings and sign-up names without
// guessing identities from names. Old records remain administrator-managed.
export async function ensureMemberOwnership(db: D1Database) {
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS empire_booking_owners (booking_id INTEGER PRIMARY KEY, member_id INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS empire_player_signups (request_id INTEGER NOT NULL, member_id INTEGER NOT NULL, member_name TEXT NOT NULL, PRIMARY KEY (request_id, member_id))"),
  ]);
}
