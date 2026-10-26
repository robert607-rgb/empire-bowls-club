export const COMPETITION_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS empire_competitions (id INTEGER PRIMARY KEY, title TEXT NOT NULL, season TEXT NOT NULL, format TEXT NOT NULL, structure TEXT NOT NULL, legs INTEGER NOT NULL DEFAULT 1, league_count INTEGER NOT NULL DEFAULT 1, win_points INTEGER NOT NULL DEFAULT 2, draw_points INTEGER NOT NULL DEFAULT 1, loss_points INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 1, archived INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0, mutation_token TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS empire_competition_entries (id INTEGER PRIMARY KEY, competition_id INTEGER NOT NULL, member_id INTEGER NOT NULL, partner_ids TEXT NOT NULL DEFAULT '[]', entry_name TEXT NOT NULL DEFAULT '', entry_order INTEGER NOT NULL DEFAULT 0, players_json TEXT NOT NULL DEFAULT '[]', league_no INTEGER NOT NULL DEFAULT 1, UNIQUE(competition_id,member_id))`,
  `CREATE TABLE IF NOT EXISTS empire_competition_participants (competition_id INTEGER NOT NULL, member_id INTEGER NOT NULL, entry_id INTEGER NOT NULL, PRIMARY KEY(competition_id,member_id))`,
  `CREATE TABLE IF NOT EXISTS empire_competition_matches (id INTEGER PRIMARY KEY, competition_id INTEGER NOT NULL, round INTEGER NOT NULL, slot INTEGER NOT NULL, entry_a INTEGER, entry_b INTEGER, source_a INTEGER, source_b INTEGER, state TEXT NOT NULL DEFAULT '', winner_entry_id INTEGER, score_a INTEGER, score_b INTEGER, league_no INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, reported_by INTEGER, reported_role TEXT NOT NULL DEFAULT '', UNIQUE(competition_id,round,slot))`,
] as const;

export async function ensureCompetitionSchema(db: D1Database) {
  await db.batch(COMPETITION_SCHEMA.map(sql => db.prepare(sql)));
}
