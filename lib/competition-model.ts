// Adapted from the Bowls Club Website Holland source kit and its maintained competition extension.
export const playingFormats = { singles: { label: "Singles", positions: ["Player"] }, pairs: { label: "Pairs", positions: ["Lead", "Skip"] }, triples: { label: "Triples", positions: ["Lead", "Second", "Skip"] }, rinks: { label: "Fours / Rinks", positions: ["Lead", "Second", "Third", "Skip"] } } as const;
export type PlayingFormat = keyof typeof playingFormats;
export type CompetitionPlayer = { memberId: number; name: string; position: string };
// The first player's ID identifies this entry within its competition, including teams.
// All participating players are held in the roster; the ID alone never grants team access.
export type CompetitionEntry = { memberId: number; name: string; seed: number; players: CompetitionPlayer[] };
export const entryIncludesMember = (entry: CompetitionEntry, memberId: number) => entry.players.some(player => player.memberId === memberId);
export const matchIncludesMember = (competition: Competition, match: CompetitionMatch, memberId: number) => competition.entries.some(entry => [match.player_one_id, match.player_two_id].includes(entry.memberId) && entryIncludesMember(entry, memberId));
export type CompetitionMatch = {
  id: string; competition_id: string; round_no: number; position_no: number;
  player_one_id: number | null; player_two_id: number | null; source_one_id: string | null; source_two_id: string | null;
  state: "waiting" | "ready" | "bye" | "played"; score_one: number | null; score_two: number | null; winner_id: number | null; version: number; updated_at: string; league_no?:number;
};
export type Competition = {
  id: string; name: string; format: "knockout" | "league"; playing_format: PlayingFormat; legs: number;
  win_points: number; draw_points: number; loss_points: number; created_at: string; updated_at: string;
  entries: CompetitionEntry[]; matches: CompetitionMatch[]; complete: boolean; winnerId: number | null;
};
export const competitionLimits = { knockout: 64, league: 24 };

export function shuffle<T>(values: T[]): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const bound = index + 1, ceiling = 0x100000000 - (0x100000000 % bound);
    let value: number;
    do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= ceiling);
    const selected = value % bound;
    [result[index],result[selected]] = [result[selected],result[index]];
  }
  return result;
}
const match = (competitionId: string, round: number, position: number, one: number | null, two: number | null, timestamp: string): CompetitionMatch => ({
  id: crypto.randomUUID(), competition_id: competitionId, round_no: round, position_no: position,
  player_one_id: one, player_two_id: two, source_one_id: null, source_two_id: null,
  state: one !== null && two !== null ? "ready" : one !== null ? "bye" : "waiting",
  score_one: null, score_two: null, winner_id: one !== null && two === null ? one : null, version: 0, updated_at: timestamp,
});
export function knockoutDraw(competitionId: string, memberIds: number[], timestamp: string): CompetitionMatch[] {
  const players = shuffle(memberIds), size = 2 ** Math.ceil(Math.log2(players.length));
  const byes = new Set(shuffle(Array.from({ length: size / 2 },(_,index) => index)).slice(0,size - players.length));
  const matches: CompetitionMatch[] = [];
  let cursor = 0;
  let prior = Array.from({ length: size / 2 },(_,index) => match(competitionId,1,index + 1,players[cursor++],byes.has(index) ? null : players[cursor++],timestamp));
  matches.push(...prior);
  for (let round = 2; prior.length > 1; round++) {
    const next: CompetitionMatch[] = [];
    for (let index = 0; index < prior.length; index += 2) {
      const one = prior[index], two = prior[index + 1];
      const current = match(competitionId,round,index / 2 + 1,one.winner_id,two.winner_id,timestamp);
      current.source_one_id = one.id; current.source_two_id = two.id;
      current.state = current.player_one_id !== null && current.player_two_id !== null ? "ready" : "waiting";
      current.winner_id = null;
      next.push(current);
    }
    matches.push(...next); prior = next;
  }
  return matches;
}
export function leagueDraw(competitionId: string, memberIds: number[], legs: number, timestamp: string): CompetitionMatch[] {
  let players: (number | null)[] = shuffle(memberIds);
  if (players.length % 2) players.push(null);
  const matches: CompetitionMatch[] = [], rounds = players.length - 1;
  for (let round = 0; round < rounds; round++) {
    let position = 0;
    for (let index = 0; index < players.length / 2; index++) {
      const left = players[index], right = players[players.length - 1 - index];
      if (left === null || right === null) continue;
      matches.push(match(competitionId,round + 1,++position,round % 2 ? right : left,round % 2 ? left : right,timestamp));
    }
    players = [players[0],players[players.length - 1],...players.slice(1,-1)];
  }
  const firstLeg=[...matches];
  for(let leg=1;leg<legs;leg++)matches.push(...firstLeg.map(original=>match(competitionId,original.round_no+rounds*leg,original.position_no,leg%2?original.player_two_id:original.player_one_id,leg%2?original.player_one_id:original.player_two_id,timestamp)));
  return matches;
}
export function leagueStandings(competition: Competition) {
  const rows = new Map(competition.entries.map(entry => [entry.memberId,{ ...entry, played: 0, won: 0, drawn: 0, lost: 0, for: 0, against: 0, difference: 0, points: 0 }]));
  for (const game of competition.matches) {
    if (game.state !== "played" || game.score_one === null || game.score_two === null) continue;
    const one = rows.get(game.player_one_id!), two = rows.get(game.player_two_id!);
    if (!one || !two) continue;
    one.played++; two.played++; one.for += game.score_one; one.against += game.score_two; two.for += game.score_two; two.against += game.score_one;
    if (game.score_one === game.score_two) { one.drawn++; two.drawn++; one.points += competition.draw_points; two.points += competition.draw_points; }
    else {
      const winner = game.score_one > game.score_two ? one : two, loser = winner === one ? two : one;
      winner.won++; loser.lost++; winner.points += competition.win_points; loser.points += competition.loss_points;
    }
  }
  for (const row of rows.values()) row.difference = row.for - row.against;
  return [...rows.values()].sort((one,two) => two.points - one.points || two.difference - one.difference || two.for - one.for || one.name.localeCompare(two.name));
}
