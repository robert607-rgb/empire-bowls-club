"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { SVGProps } from "react";
const Icon = ({children, size = 20, strokeWidth = 2, ...props}: SVGProps<SVGSVGElement> & {size?: number}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" {...props}>{children}</svg>;
const Trophy = (props: SVGProps<SVGSVGElement> & {size?: number}) => <Icon {...props}><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4v2a4 4 0 0 0 4 4M17 6h3v2a4 4 0 0 1-4 4"/></Icon>;
const Plus = (props: SVGProps<SVGSVGElement> & {size?: number}) => <Icon {...props}><path d="M12 5v14M5 12h14"/></Icon>;
const Search = (props: SVGProps<SVGSVGElement> & {size?: number}) => <Icon {...props}><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></Icon>;
const Check = (props: SVGProps<SVGSVGElement> & {size?: number}) => <Icon {...props}><path d="m5 12 4 4L19 6"/></Icon>;
const ArrowRight = (props: SVGProps<SVGSVGElement> & {size?: number}) => <Icon {...props}><path d="M4 12h16m-6-6 6 6-6 6"/></Icon>;
import { competitionLimits, leagueStandings, playingFormats, matchIncludesMember, type PlayingFormat, type Competition, type CompetitionEntry, type CompetitionMatch } from "../lib/competition-model";
import { sortMembers } from "../lib/member-names";
const isActiveMember=(member:DirectoryMember)=>member.account_status!=="inactive"&&member.account_status!=="archived"&&member.membership_type!=="RIP";

type DirectoryMember = { id: number; name: string; membership_type?: string; account_status?: string };
type Self = { memberId?: number | null; isTest?: boolean };
type Props = { competitions: Competition[]; members: DirectoryMember[]; self?: Self; admin: boolean; refresh: () => Promise<void>; onDirty?:(dirty:boolean)=>void; allowCreate?:boolean };
async function updateCompetition(payload: Record<string, unknown>) {
  const response = await fetch("/api/empire/competitions", { method: "POST", credentials:"same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload.action==="create"?{...payload,action:"createCompetition"}:{...payload,action:"competitionResult",id:payload.matchId,revision:payload.matchVersion,scoreA:payload.scoreOne,scoreB:payload.scoreTwo}) });
  const data = await response.json() as { id: string; error?: string };
  if (!response.ok) throw new Error(data.error || "The competition could not be saved.");
  return {...data,id:String(data.id)};
}
const roundTitle = (round: number, finalRound: number) => {
  const remaining = finalRound - round;
  return remaining === 0 ? "Final" : remaining === 1 ? "Semi-finals" : remaining === 2 ? "Quarter-finals" : `Round ${round}`;
};

export function Competitions({ competitions, members, self, admin, refresh,onDirty,allowCreate=true }: Props) {
  const [selectedId, setSelectedId] = useState("");
  const [showCreate, setShowCreate] = useState(admin && allowCreate && competitions.length === 0);
  const [message, setMessage] = useState("");
  const competition = competitions.find(item => item.id === selectedId||item.id.startsWith(selectedId+":")) || competitions[0];
  const report = async (match: CompetitionMatch, scoreOne: number, scoreTwo: number) => {
    await updateCompetition({ action: "result", matchId: match.id, matchVersion: match.version, scoreOne, scoreTwo });
    await refresh();
    setMessage("Result saved. The competition has been updated.");
  };
  return <div className="competitions-tool">
    <div className="tool-heading"><div><h2>Club competitions</h2><p className="muted">Follow the draw, find your opponent and keep the scores up to date.</p></div>{admin && allowCreate && <button className="button" aria-expanded={showCreate} aria-controls="competition-builder" onClick={() => setShowCreate(open => !open)}><Plus size={17} aria-hidden="true"/> {showCreate ? "Close form" : "Create a competition"}</button>}</div>
    {admin && allowCreate && showCreate && <CompetitionBuilder members={members} onDirty={onDirty} onCreated={async id => { await refresh(); setSelectedId(id); setShowCreate(false); setMessage("Competition created. The draw is now visible in the Members Zone."); }}/>}
    {message && <div className="notice" role="status">{message}</div>}
    {competitions.length === 0 ? <div className="competition-empty"><Trophy size={32} strokeWidth={1.5} aria-hidden="true"/><h3>The next competition starts here</h3><p>{admin ? "Choose members from the directory and create a knockout draw or a league. The rounds and opponents will be arranged for you." : "Club competitions will appear here as soon as an administrator creates them."}</p></div> : <>
      <label className="field competition-picker">Choose a competition<select aria-label="Choose a competition" value={competition.id} onChange={event => { setSelectedId(event.target.value); setMessage(""); }}>{competitions.map(item => <option key={item.id} value={item.id}>{item.name} · {playingFormats[item.playing_format].label} · {item.format === "knockout" ? "Knockout" : "League"}{item.complete ? " · Complete" : ""}</option>)}</select></label>
      <CompetitionView key={competition.id} competition={competition} admin={admin} self={self} report={report}/>
    </>}
  </div>;
}

export function CompetitionBuilder({ members, onCreated,onDirty }: { members: DirectoryMember[]; onCreated: (id: string) => Promise<void>;onDirty?:(dirty:boolean)=>void }) {
  const [name, setName] = useState("");
  const [format, setFormat] = useState<"knockout" | "league">("knockout");
  const [playingFormat, setPlayingFormat] = useState<PlayingFormat>("singles");
  const [teams, setTeams] = useState<{ name: string; memberIds: number[] }[]>([{ name: "", memberIds: [] }, { name: "", memberIds: [] }]);
  const [legs, setLegs] = useState(1);
  const [leagueCount,setLeagueCount]=useState(1);
  useEffect(()=>()=>onDirty?.(false),[onDirty]);
  const [points, setPoints] = useState({ win: 2, draw: 1, loss: 0 });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const eligible = useMemo(() => sortMembers(members.filter(member => member.account_status ? isActiveMember(member) : !member.membership_type || member.membership_type !== "RIP")), [members]);
  const shown = eligible.filter(member => member.name.toLowerCase().includes(search.toLowerCase().trim()));
  const maximum = competitionLimits[format];
  const positions = playingFormats[playingFormat].positions;
  const assigned = teams.flatMap(team => team.memberIds).filter(Boolean);
  const ready = playingFormat === "singles" ? selected.length >= 2 : teams.length >= 2 && teams.every(team => positions.every((_,index) => team.memberIds[index] > 0));
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const data = await updateCompetition({ action: "create", name, format, playingFormat, legs, leagueCount, winPoints: points.win, drawPoints: points.draw, lossPoints: points.loss, memberIds: selected, teams });
      onDirty?.(false);await onCreated(data.id);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "The competition could not be created."); }
    finally { setBusy(false); }
  };
  return <form id="competition-builder" className="competition-builder form-panel" onChange={()=>onDirty?.(true)} onSubmit={submit}>
    <div className="competition-settings"><div className="panel-heading"><Trophy size={22} strokeWidth={1.6} aria-hidden="true"/><h3>Create a competition</h3></div>
      <label className="field">Competition name<input required minLength={3} maxLength={100} value={name} onChange={event => setName(event.target.value)} placeholder="e.g. Club singles championship"/></label>
      <label className="field">Competition structure<select aria-label="Competition structure" value={format} onChange={event => { const next = event.target.value as typeof format; setFormat(next); setSelected(previous => previous.slice(0, competitionLimits[next])); setTeams(previous => previous.slice(0, competitionLimits[next])); }}><option value="knockout">Knockout</option><option value="league">League</option></select></label>
      <fieldset className="playing-format-options" disabled={busy}><legend>Playing format</legend>{(Object.keys(playingFormats) as PlayingFormat[]).map(key => <label key={key} className={playingFormat === key ? "selected" : ""}><input type="radio" name="playing-format" value={key} checked={playingFormat === key} onChange={() => { setPlayingFormat(key); setError(""); setTeams(previous => previous.map(team => ({ ...team, memberIds: team.memberIds.slice(0, playingFormats[key].positions.length) }))); }}/>{playingFormats[key].label}</label>)}</fieldset>
      {format === "knockout" ? <p className="small muted">A random draw with automatic byes where needed. Winners move into the next round when a result is saved.</p> : <>
        <label className="field">Number of leagues<select value={leagueCount} onChange={event=>setLeagueCount(Number(event.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n}>{n}</option>)}</select></label><label className="field">Times each team plays each other<select value={legs} onChange={event => setLegs(Number(event.target.value))}><option value={1}>Once</option><option value={2}>Twice</option><option value={3}>Three times</option><option value={4}>Four times</option></select></label>
        <div className="competition-points">{(["win", "draw", "loss"] as const).map(key => <label className="field" key={key}>{key[0].toUpperCase() + key.slice(1)} points<input type="number" required min={0} max={100} step={1} value={points[key]} onChange={event => { const value = Number(event.currentTarget.value); setPoints(previous => ({ ...previous, [key]: value })); }}/></label>)}</div>
        <p className="small muted">Entries are drawn evenly into the selected leagues. Each league needs at least two entries. Teams play others in their own league. The table updates from match scores, ordered by points, shot difference and shots scored.</p>
      </>}
    </div>
    {playingFormat === "singles" ? <div className="competition-entrants"><div className="competition-entrant-heading"><h3>Choose club members</h3><span className="member-count">{selected.length} selected</span></div>
      <label className="field">Find a member<div className="search-input"><Search size={17} aria-hidden="true"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name"/></div></label>
      <div className="competition-select-actions"><button type="button" className="text-link" disabled={busy || shown.length === 0} onClick={() => setSelected(previous => [...new Set([...previous, ...shown.map(member => member.id)])].slice(0, maximum))}>Select shown</button><button type="button" className="text-link" disabled={busy || selected.length === 0} onClick={() => setSelected([])}>Clear selection</button><span className="small muted">2–{maximum} members</span></div>
      <fieldset className="competition-member-list" disabled={busy}><legend className="sr-only">Competition entrants</legend>{shown.length ? shown.map(member => <label className="competition-member-choice" key={member.id}><input type="checkbox" checked={selected.includes(member.id)} disabled={!selected.includes(member.id) && selected.length >= maximum} onChange={event => { const checked = event.currentTarget.checked; setSelected(previous => checked ? [...previous, member.id] : previous.filter(id => id !== member.id)); }}/><span><b>{member.name}</b>{member.membership_type && <small>{member.membership_type}</small>}</span></label>) : <p className="small muted">{eligible.length ? "No members match your search." : "Add or reactivate at least two members before creating a competition."}</p>}</fieldset>
      <p className="small muted">Active members only.</p>
    </div> : <div className="competition-entrants"><div className="competition-entrant-heading"><h3>Assign your teams</h3><span className="member-count">{teams.length} teams</span></div><p className="small muted">Assign {positions.length} different members to each team. Each member can play for one team in this competition. Choose 2–{maximum} teams.</p>
      <div className="competition-team-list">{teams.map((team,index) => <fieldset className="competition-team-editor" key={index} disabled={busy}><legend>Team {index + 1}</legend><label className="field">Team {index + 1} name (optional)<input maxLength={100} value={team.name} placeholder="Uses players' names if left blank" onChange={event => { const value = event.currentTarget.value; setTeams(previous => previous.map((item,i) => i === index ? { ...item,name: value } : item)); }}/></label>{positions.map((position,slot) => <label className="field" key={position}>Team {index + 1} — {position}<select aria-label={`Team ${index + 1} — ${position}`} required value={team.memberIds[slot] || ""} onChange={event => { const value = Number(event.currentTarget.value); setTeams(previous => previous.map((item,i) => i === index ? { ...item,memberIds: Array.from({ length: positions.length }, (_,j) => j === slot ? value : item.memberIds[j] || 0) } : item)); }}><option value="">Choose a member</option>{eligible.map(member => <option key={member.id} value={member.id} disabled={assigned.includes(member.id) && team.memberIds[slot] !== member.id}>{member.name}</option>)}</select></label>)}<button className="text-link" type="button" disabled={teams.length <= 2} onClick={() => setTeams(previous => previous.filter((_,i) => i !== index))}>Remove team {index + 1}</button></fieldset>)}</div><button type="button" className="button secondary" disabled={busy || teams.length >= maximum} onClick={() => setTeams(previous => [...previous,{ name: "",memberIds: [] }])}><Plus size={17} aria-hidden="true"/> Add team</button></div>}
    <div className="competition-create-footer">{error && <div className="form-error" role="alert">{error}</div>}<button className="button" disabled={busy || !ready || format==="league"&&(playingFormat==="singles"?selected.length:teams.length)<leagueCount*2}>{busy ? "Creating competition..." : format === "knockout" ? "Save competition & draw" : "Save competition & fixtures"}<ArrowRight size={17} aria-hidden="true"/></button><span className="small muted">Visible to all signed-in members as soon as it is created.</span></div>
  </form>;
}

export function CompetitionView({ competition, admin, self, report }: { competition: Competition; admin: boolean; self?: Self; report: (match: CompetitionMatch, one: number, two: number) => Promise<void> }) {
  const [onlyMine, setOnlyMine] = useState(false);
  const names = new Map(competition.entries.map(entry => [entry.memberId, entry.name]));
  const played = competition.matches.filter(match => match.state === "played").length;
  const total = competition.matches.filter(match => match.state !== "bye").length;
  const finalRound = Math.max(...competition.matches.map(match => match.round_no));
  const rounds = Array.from({ length: finalRound }, (_, index) => index + 1);
  const myMatches = competition.matches.filter(match => matchIncludesMember(competition, match, self?.memberId ?? -1));
  const listed = onlyMine ? myMatches : competition.matches;
  const card = (match: CompetitionMatch) => <MatchCard key={match.id+"-"+match.version} match={match} competition={competition} names={names} admin={admin} self={self} report={report}/>;
  return <section className="competition-view" aria-label={competition.name}>
    <div className="competition-banner"><div><div className="competition-kind">{playingFormats[competition.playing_format].label} · {competition.format === "knockout" ? "Knockout championship" : "Club league"}</div><h3>{competition.name}</h3><p>{competition.entries.length} {competition.playing_format === "singles" ? "players" : "teams"} · {played}/{total} matches played{competition.complete ? " · Complete" : ""}</p></div><Trophy size={36} strokeWidth={1.5} aria-hidden="true"/></div>
    {competition.playing_format !== "singles" && <details className="competition-rosters"><summary>Teams and players</summary><div>{competition.entries.map(entry => <div key={entry.memberId}><strong>{entry.name}</strong><Roster entry={entry}/></div>)}</div></details>}
    {competition.winnerId !== null && <div className="competition-champion"><Trophy size={24} aria-hidden="true"/><div><span>Competition winner</span><strong>{names.get(competition.winnerId)}</strong></div></div>}
    {!admin && <p className="small competition-result-help">{self?.isTest ? "Sign in with your own first name and passcode to enter results for matches you play in." : "You can enter a result for your own match. Contact an administrator if a saved result needs correcting."}</p>}
    {competition.format === "knockout" ? <><p className="small muted competition-scroll-hint">Scroll across the draw to follow the rounds.</p><div className="knockout-bracket" tabIndex={0} aria-label="Knockout rounds">{rounds.map(round => <section className="knockout-round" key={round}><h4>{roundTitle(round, finalRound)}</h4><div className="knockout-round-matches">{competition.matches.filter(match => match.round_no === round).map(card)}</div></section>)}</div></> : <>
      <LeagueTable competition={competition}/>
      <div className="competition-fixture-heading"><h3>League fixtures</h3>{!admin && !self?.isTest && <label className="competition-own-filter"><input type="checkbox" checked={onlyMine} onChange={event => setOnlyMine(event.target.checked)}/> My matches only</label>}</div>
      {!listed.length && <p className="muted">You are not entered in this league.</p>}
      <div className="league-rounds">{rounds.filter(round => listed.some(match => match.round_no === round)).map(round => <section key={round} className="league-round"><h4>Round {round}</h4><div className="league-matches">{listed.filter(match => match.round_no === round).map(card)}</div></section>)}</div>
    </>}
  </section>;
}

function MatchCard({ match, competition, names, admin, self, report }: { match: CompetitionMatch; competition: Competition; names: Map<number, string>; admin: boolean; self?: Self; report: (match: CompetitionMatch, one: number, two: number) => Promise<void> }) {
  const cardRef = useRef<HTMLElement>(null);
  const [open, setOpen] = useState(false);
  const [scores, setScores] = useState({ one: match.score_one?.toString() ?? "", two: match.score_two?.toString() ?? "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { if (open) cardRef.current?.scrollIntoView({ block: "nearest", inline: "center" }); }, [open]);
  const name = (playerId: number | null, sourceId: string | null) => {
    if (playerId !== null) return names.get(playerId) || "Club member";
    const feeder = competition.matches.find(item => item.id === sourceId);
    return feeder ? `Winner of match ${feeder.round_no}.${feeder.position_no}` : "Bye";
  };
  const one = name(match.player_one_id, match.source_one_id), two = name(match.player_two_id, match.source_two_id);
  const mine = matchIncludesMember(competition, match, self?.memberId ?? -1);
  const canReport = (admin || mine) && (match.state === "ready" || admin && match.state === "played");
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError("");
    try { await report(match, Number(scores.one), Number(scores.two)); setOpen(false); }
    catch (failure) { setError(failure instanceof Error ? failure.message : "The result could not be saved."); }
    finally { setBusy(false); }
  };
  return <article ref={cardRef} className={`competition-match ${mine ? "your-match" : ""}`}>
    <div className="competition-match-label"><span>Match {match.round_no}.{match.position_no}</span><span>{match.state === "played" ? "Played" : match.state === "bye" ? "Bye" : match.state === "waiting" ? "Awaiting players" : mine ? "Your match" : "To play"}</span></div>
    <div className={`competition-player ${match.winner_id === match.player_one_id && match.player_one_id !== null ? "match-winner" : ""}`}><span>{one}<Roster entry={competition.entries.find(entry => entry.memberId === match.player_one_id)}/>{match.winner_id === match.player_one_id && match.player_one_id !== null && <Check size={15} aria-label="Winner"/>}</span><strong>{match.score_one ?? "–"}</strong></div>
    <div className={`competition-player ${match.winner_id === match.player_two_id && match.player_two_id !== null ? "match-winner" : ""}`}><span>{two}<Roster entry={competition.entries.find(entry => entry.memberId === match.player_two_id)}/>{match.winner_id === match.player_two_id && match.player_two_id !== null && <Check size={15} aria-label="Winner"/>}</span><strong>{match.score_two ?? "–"}</strong></div>
    {match.state === "bye" && <p className="competition-match-note">Advances automatically</p>}
    {canReport && <button type="button" className="text-link competition-result-button" aria-expanded={open} aria-controls={`result-${match.id}`} onClick={() => { setOpen(previous => !previous); setError(""); }}>{open ? "Cancel" : match.state === "played" ? "Correct result" : "Enter result"}</button>}
    {open && <form id={`result-${match.id}`} className="competition-result-form" onSubmit={submit}><div className="competition-score-inputs"><label>{one}<input aria-label={`${one} score`} type="number" required min={0} max={999} step={1} value={scores.one} onChange={event => { const value = event.currentTarget.value; setScores(previous => ({ ...previous, one:value })); }}/></label><label>{two}<input aria-label={`${two} score`} type="number" required min={0} max={999} step={1} value={scores.two} onChange={event => { const value = event.currentTarget.value; setScores(previous => ({ ...previous, two:value })); }}/></label></div>{competition.format === "knockout" && <p className="small muted">Use the final score after any deciding end.</p>}{error && <div className="form-error" role="alert">{error}</div>}<button className="button" disabled={busy}>{busy ? "Saving..." : "Save result"}</button></form>}
  </article>;
}

function Roster({ entry }: { entry?: CompetitionEntry }) {
  if (!entry || entry.players.length < 2) return null;
  return <small className="competition-roster">{entry.players.map(player => `${player.position}: ${player.name}`).join(" · ")}</small>;
}

function LeagueTable({ competition }: { competition: Competition }) {
  const standings = leagueStandings(competition);
  return <div className="league-table-section"><h3>League table</h3><p className="small muted">Win {competition.win_points} points · Draw {competition.draw_points} · Loss {competition.loss_points}. Ties are ordered by shot difference, then shots scored.</p><div className="league-table-wrap" tabIndex={0} aria-label="Scrollable league table"><table className="league-table"><caption className="sr-only">{competition.name} standings</caption><thead><tr><th scope="col">Pos</th><th scope="col">{competition.playing_format === "singles" ? "Member" : "Team"}</th><th scope="col"><abbr title="Played">P</abbr></th><th scope="col"><abbr title="Won">W</abbr></th><th scope="col"><abbr title="Drawn">D</abbr></th><th scope="col"><abbr title="Lost">L</abbr></th><th scope="col">For</th><th scope="col">Against</th><th scope="col">Diff</th><th scope="col">Points</th></tr></thead><tbody>{standings.map((entry, index) => <tr key={entry.memberId}><td>{index + 1}</td><th scope="row">{entry.name}<Roster entry={entry}/></th><td>{entry.played}</td><td>{entry.won}</td><td>{entry.drawn}</td><td>{entry.lost}</td><td>{entry.for}</td><td>{entry.against}</td><td>{entry.difference > 0 ? "+" : ""}{entry.difference}</td><td className="league-points">{entry.points}</td></tr>)}</tbody></table></div></div>;
}

