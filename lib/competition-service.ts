/* eslint-disable @typescript-eslint/no-explicit-any */
// Empire persistence adapter for the Bowls Club Website maintained competition
// source: whole-entry draws, roster permissions and atomic revision/token writes.
import {knockoutDraw,leagueDraw,shuffle,playingFormats,competitionLimits,type PlayingFormat,type CompetitionMatch} from './competition-model';
type Row=Record<string,any>;
type Session={role:string;member_id:number|null;permissions:string[]};
export class CompetitionError extends Error {status:number;constructor(status:number,message:string){super(message);this.status=status}}
function fail(status:number,message:string):never{throw new CompetitionError(status,message)}
const rows=async(db:D1Database,sql:string,...args:unknown[])=>(await db.prepare(sql).bind(...args).all<Row>()).results;
const key=()=>Array.from(crypto.getRandomValues(new Uint8Array(6))).reduce((n,b)=>n*256+b,0)+1;
const admin=(s:Session)=>s.role==='admin'&&s.permissions.includes('competitions');
const requireAdmin=(s:Session)=>{if(!admin(s))fail(403,'Competition administrator access is required.')};
const numberId=(value:unknown)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):0;
const formats:Record<string,PlayingFormat>={Singles:'singles',Pairs:'pairs',Triples:'triples',Fours:'rinks',Rinks:'rinks'};
const storedFormat:Record<PlayingFormat,string>={singles:'Singles',pairs:'Pairs',triples:'Triples',rinks:'Fours'};
function configuration(input:Row){
 const format=String(input.format||'knockout').toLowerCase();if(!['knockout','league'].includes(format))fail(400,'Choose Knockout or League.');
 const choice=String(input.playingFormat||'singles'),drawn=choice.startsWith('drawn_');const playingFormat=(drawn?choice.slice(6):choice) as PlayingFormat;if(drawn&&playingFormat==='singles'||!Object.hasOwn(playingFormats,playingFormat))fail(400,'Choose Singles, Pairs, Triples or Rinks.');
 const legs=format==='league'?Number(input.legs??1):1,leagues=format==='league'?Number(input.leagueCount??1):1;
 if(!Number.isInteger(legs)||legs<1||legs>4)fail(400,'Choose 1 to 4 matches against each opponent.');
 if(!Number.isInteger(leagues)||leagues<1||leagues>8)fail(400,'Choose 1 to 8 leagues.');
 const win=Number(input.winPoints??2),draw=Number(input.drawPoints??1),loss=Number(input.lossPoints??0);
 if([win,draw,loss].some(n=>!Number.isInteger(n)||n<0||n>100)||win<=draw||draw<loss)fail(400,'Win points must exceed draw points, with draw points at least loss points.');
 return {format:format as 'knockout'|'league',playingFormat,drawn,legs,leagues,win,draw,loss};
}
function gamesFor(comp:Row,entryIds:number[]) {
 const max=competitionLimits[comp.structure==='League'?'league':'knockout'];
 if(entryIds.length<2||entryIds.length>max)fail(400,`Choose between 2 and ${max} complete entries.`);
 if(comp.structure==='League'&&entryIds.length<comp.league_count*2)fail(400,'Each league needs at least two entries.');
 const groups=comp.structure==='League'?Array.from({length:comp.league_count},()=>[] as number[]):[entryIds];
 if(comp.structure==='League')shuffle(entryIds).forEach((id,index)=>groups[index%groups.length].push(id));
 const all:CompetitionMatch[]=[],assignment=new Map<number,number>();
 groups.forEach((ids,index)=>{ids.forEach(id=>assignment.set(id,index+1));const games=comp.structure==='League'?leagueDraw(String(comp.id),ids,comp.legs,new Date().toISOString()):knockoutDraw(String(comp.id),ids,new Date().toISOString());for(const game of games)all.push({...game,league_no:index+1})});
 const ids=new Map(all.map(game=>[game.id,key()]));
 const matches=all.map(game=>({id:ids.get(game.id),round:game.round_no,slot:(Number(game.league_no||1)-1)*64+game.position_no-1,entry_a:game.player_one_id,entry_b:game.player_two_id,source_a:game.source_one_id?ids.get(game.source_one_id):null,source_b:game.source_two_id?ids.get(game.source_two_id):null,state:game.state,winner_entry_id:game.winner_id,score_a:null,score_b:null,league_no:game.league_no||1}));
 return {matches,assignment};
}
function insertMatches(db:D1Database,competitionId:number,matches:Row[],guard?:{revision:number;token:string}) {
 const columns=['id','round','slot','entry_a','entry_b','source_a','source_b','state','winner_entry_id','score_a','score_b','league_no'];
 return db.prepare(`INSERT INTO empire_competition_matches(competition_id,${columns.join(',')}) SELECT ?,${columns.map(column=>`json_extract(value,'$.${column}')`).join(',')} FROM json_each(?)${guard?" WHERE EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)":''}`).bind(competitionId,JSON.stringify(matches),...(guard?[competitionId,guard.revision,guard.token]:[]));
}
export async function competitionMutation(db:D1Database,s:Session,p:Row,today:string):Promise<{ok:boolean;id?:number}> {
 if(p.action==='createCompetition') {
  requireAdmin(s);const config=configuration(p),title=String(p.name||'').trim();if(title.length<3||title.length>100)fail(400,'Give the competition a name of 3 to 100 characters.');
  if(p.openEntries===true){
   const id=key();await db.prepare("INSERT INTO empire_competitions(id,title,season,format,structure,legs,league_count,win_points,draw_points,loss_points,status,published,entry_mode) VALUES(?,?,?,?,?,?,?,?,?,?,'Entries open',1,?)").bind(id,title,today.slice(0,4),storedFormat[config.playingFormat],config.format==='league'?'League':'Knockout',config.legs,config.leagues,config.win,config.draw,config.loss,config.drawn?'drawn':'fixed').run();return {ok:true,id};
  }
  const positions=playingFormats[config.playingFormat].positions;
  const teams:Row[]=config.playingFormat==='singles'?(Array.isArray(p.memberIds)?p.memberIds.map((id:unknown)=>({name:'',memberIds:[numberId(id)]})):[]):Array.isArray(p.teams)?p.teams.map((team:Row)=>({name:String(team?.name||'').trim(),memberIds:Array.isArray(team?.memberIds)?team.memberIds.map(numberId):[]})):[];
  if(teams.length<2||teams.length>competitionLimits[config.format])fail(400,`Choose 2 to ${competitionLimits[config.format]} entries.`);
  if(teams.some(team=>team.name.length>100||team.memberIds.length!==positions.length||team.memberIds.some((id:number)=>!id)))fail(400,`Fill all ${positions.length} positions in every entry; team names can contain up to 100 characters.`);
  const selected:number[]=teams.flatMap(team=>team.memberIds);if(new Set(selected).size!==selected.length)fail(400,'Each member can appear only once in this competition.');
  const empire_members=await rows(db,"SELECT id,name FROM empire_members WHERE id IN (SELECT value FROM json_each(?))",JSON.stringify(selected));if(empire_members.length!==selected.length)fail(400,'Choose active directory members for every position.');
  const names=new Map(empire_members.map(m=>[m.id,m.name])),id=key(),comp={id,structure:config.format==='league'?'League':'Knockout',league_count:config.leagues,legs:config.legs};
  const entries=teams.map((team,index)=>({id:key(),member_id:team.memberIds[0],partner_ids:JSON.stringify(team.memberIds.slice(1)),entry_name:team.name,entry_order:index+1,players_json:JSON.stringify(team.memberIds.map((memberId:number,position:number)=>({memberId,name:names.get(memberId),position:positions[position]})))}));
  const {matches,assignment}=gamesFor(comp,entries.map(e=>e.id));
  const payload=entries.map(entry=>({...entry,league_no:assignment.get(entry.id)||1}));
  await db.batch([
   db.prepare("INSERT INTO empire_competitions(id,title,season,format,structure,legs,league_count,win_points,draw_points,loss_points,status,published) VALUES(?,?,?,?,?,?,?,?,?,?,'In progress',1)").bind(id,title,today.slice(0,4),storedFormat[config.playingFormat],comp.structure,config.legs,config.leagues,config.win,config.draw,config.loss),
   db.prepare("INSERT INTO empire_competition_entries(id,competition_id,member_id,partner_ids,entry_name,entry_order,players_json,league_no) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.member_id'),json_extract(value,'$.partner_ids'),json_extract(value,'$.entry_name'),json_extract(value,'$.entry_order'),json_extract(value,'$.players_json'),json_extract(value,'$.league_no') FROM json_each(?)").bind(id,JSON.stringify(payload)),
   db.prepare("INSERT INTO empire_competition_participants(competition_id,member_id,entry_id) SELECT ?,CAST(json_extract(player.value,'$.memberId') AS INTEGER),CAST(json_extract(entry.value,'$.id') AS INTEGER) FROM json_each(?) entry,json_each(json_extract(entry.value,'$.players_json')) player").bind(id,JSON.stringify(payload)),
   insertMatches(db,id,matches)
  ]);return {ok:true,id};
 }
 if(p.action==='competitionResult')return recordResult(db,s,p);
 if(p.action==='withdrawEntry') {
  const entry=await db.prepare('SELECT e.*,c.status,c.published,c.archived FROM empire_competition_entries e JOIN empire_competitions c ON c.id=e.competition_id WHERE e.id=?').bind(numberId(p.id)).first<Row>();if(!entry)fail(404,'Entry not found.');
  if(s.role==='admin')requireAdmin(s);else if(!s.member_id||entry.member_id!==s.member_id||!entry.published||entry.archived)fail(403,'Only the entrant or competition administrator can withdraw.');
  if(entry.status!=='Entries open')fail(409,'The draw is already locked.');
  const removed=await db.batch([db.prepare("DELETE FROM empire_competition_participants WHERE entry_id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND status='Entries open')").bind(entry.id,entry.competition_id),db.prepare("DELETE FROM empire_competition_entries WHERE id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND status='Entries open')").bind(entry.id,entry.competition_id),db.prepare("UPDATE empire_competitions SET revision=revision+1 WHERE id=? AND status='Entries open'").bind(entry.competition_id)]);if(!removed[1].meta.changes)fail(409,'The competition changed. Reload before withdrawing.');return {ok:true};
 }
 const competitionId=numberId(p.competitionId),comp=await db.prepare('SELECT * FROM empire_competitions WHERE id=? AND archived=0').bind(competitionId).first<Row>();
 if(!comp)fail(404,'Competition not found.');
 if(p.action==='competitionEntry') {
  if(s.role==='admin')requireAdmin(s);else if(!comp.published||!s.member_id)fail(403,'Use your individual member account.');
  if(comp.status!=='Entries open'||comp.deadline&&comp.deadline<today)fail(409,'Entries are closed.');
  const memberIds=[s.role==='member'?s.member_id:numberId(p.memberId),...(Array.isArray(p.partnerIds)?p.partnerIds.map(numberId):[])],format=formats[comp.format];
  if(!format||memberIds.length!==(comp.entry_mode==='drawn'?1:playingFormats[format].positions.length)||memberIds.some(id=>!id)||new Set(memberIds).size!==memberIds.length)fail(400,'Fill the correct playing positions with different members.');
  const empire_members=await rows(db,"SELECT id,name FROM empire_members WHERE id IN(SELECT value FROM json_each(?))",JSON.stringify(memberIds));if(empire_members.length!==memberIds.length)fail(400,'Choose active directory members.');
  const names=new Map(empire_members.map(m=>[m.id,m.name])),entryId=key(),players=memberIds.map((memberId,index)=>({memberId,name:names.get(memberId),position:playingFormats[format].positions[index]}));
  let inserted;try{inserted=await db.batch([db.prepare("INSERT INTO empire_competition_entries(id,competition_id,member_id,partner_ids,players_json) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND status='Entries open' AND archived=0)").bind(entryId,comp.id,memberIds[0],JSON.stringify(memberIds.slice(1)),JSON.stringify(players),comp.id),...memberIds.map(memberId=>db.prepare('INSERT INTO empire_competition_participants(competition_id,member_id,entry_id) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM empire_competition_entries WHERE id=?)').bind(comp.id,memberId,entryId,entryId)),db.prepare('UPDATE empire_competitions SET revision=revision+1 WHERE id=? AND EXISTS(SELECT 1 FROM empire_competition_entries WHERE id=?)').bind(comp.id,entryId)]);}catch(error){if(String(error).includes('UNIQUE constraint failed'))fail(409,'A selected member is already entered.');throw error;}if(!inserted[0].meta.changes)fail(409,'Entries closed while saving.');return {ok:true};
 }
 requireAdmin(s);
 if(p.action==='competitionDraw') {
  if(comp.status!=='Entries open')fail(409,'A draw already exists or entries are closed.');
  const entries=await rows(db,'SELECT * FROM empire_competition_entries WHERE competition_id=? ORDER BY id',comp.id);
  let finalEntries=entries,drawnChanges: D1PreparedStatement[]=[];
  if(comp.entry_mode==='drawn'){
   const positions=playingFormats[formats[comp.format]].positions,teams=Array.isArray(p.teams)?p.teams.map((t:Row)=>({name:String(t.name||'').trim(),ids:Array.isArray(t.memberIds)?t.memberIds.map(numberId):[]})):[];
   const ids=teams.flatMap((t:Row)=>t.ids),registered=entries.map(e=>e.member_id);
   if(teams.some((t:Row)=>t.ids.length!==positions.length||t.name.length>100)||ids.length!==registered.length||new Set(ids).size!==ids.length||ids.some((id:number)=>!registered.includes(id)))fail(400,'Assign every registered member once to a complete team.');
   const empire_members=await rows(db,"SELECT id,name FROM empire_members WHERE id IN(SELECT value FROM json_each(?))",JSON.stringify(ids));if(empire_members.length!==ids.length)fail(400,'All registered members must be active.');
   const names=new Map(empire_members.map(m=>[m.id,m.name]));finalEntries=teams.map((t:Row,i:number)=>({id:entries.find(e=>e.member_id===t.ids[0])!.id,member_id:t.ids[0],entry_name:t.name,entry_order:i+1,partner_ids:JSON.stringify(t.ids.slice(1)),players_json:JSON.stringify(t.ids.map((memberId:number,j:number)=>({memberId,name:names.get(memberId),position:positions[j]})))}));
  }
  const {matches,assignment}=gamesFor(comp,finalEntries.map(e=>e.id)),token=crypto.randomUUID(),guard={revision:comp.revision+1,token};
  if(comp.entry_mode==='drawn'){
   drawnChanges=[db.prepare('DELETE FROM empire_competition_participants WHERE competition_id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)').bind(comp.id,comp.id,guard.revision,token),db.prepare('DELETE FROM empire_competition_entries WHERE competition_id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)').bind(comp.id,comp.id,guard.revision,token),db.prepare("INSERT INTO empire_competition_entries(id,competition_id,member_id,partner_ids,entry_name,entry_order,players_json) SELECT json_extract(value,'$.id'),?,json_extract(value,'$.member_id'),json_extract(value,'$.partner_ids'),json_extract(value,'$.entry_name'),json_extract(value,'$.entry_order'),json_extract(value,'$.players_json') FROM json_each(?) WHERE EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)").bind(comp.id,JSON.stringify(finalEntries),comp.id,guard.revision,token),db.prepare("INSERT INTO empire_competition_participants(competition_id,member_id,entry_id) SELECT ?,CAST(json_extract(player.value,'$.memberId') AS INTEGER),CAST(json_extract(entry.value,'$.id') AS INTEGER) FROM json_each(?) entry,json_each(json_extract(entry.value,'$.players_json')) player WHERE EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)").bind(comp.id,JSON.stringify(finalEntries),comp.id,guard.revision,token)];
  }
  const result=await db.batch([db.prepare("UPDATE empire_competitions SET status='In progress',revision=revision+1,mutation_token=? WHERE id=? AND status='Entries open' AND revision=?").bind(token,comp.id,comp.revision),...drawnChanges,insertMatches(db,comp.id,matches,guard),db.prepare("UPDATE empire_competition_entries SET league_no=(SELECT json_extract(value,'$.league') FROM json_each(?) WHERE json_extract(value,'$.id')=empire_competition_entries.id) WHERE competition_id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)").bind(JSON.stringify([...assignment].map(([id,league])=>({id,league}))),comp.id,comp.id,guard.revision,token)]);
  if(!result[0].meta.changes)fail(409,'Competition entries changed. Reload before creating the draw.');return {ok:true,id:comp.id};
 }
 fail(400,'Unknown competition action.');
}
async function recordResult(db:D1Database,s:Session,p:Row) {
 const match=await db.prepare('SELECT * FROM empire_competition_matches WHERE id=?').bind(numberId(p.id)).first<Row>();if(!match)fail(404,'Match not found.');
 const comp=await db.prepare('SELECT * FROM empire_competitions WHERE id=? AND archived=0').bind(match.competition_id).first<Row>();if(!comp)fail(404,'Competition not found.');
 if(!admin(s)) {
  if(s.role!=='member'||!s.member_id||!comp.published)fail(403,'You can enter results only for your own competition matches.');
  const entries=await rows(db,'SELECT member_id,partner_ids,players_json FROM empire_competition_entries WHERE competition_id=? AND id IN(?,?)',comp.id,match.entry_a,match.entry_b);
  if(!entries.some(entry=>JSON.parse(entry.players_json||'[]').some((player:Row)=>player.memberId===s.member_id)))fail(403,'You can enter results only for your own competition matches.');
  if(match.state==='played'||match.score_a!==null)fail(403,'This result is saved. Ask an administrator to correct it.');
 }
 if(!Number.isInteger(p.revision)||p.revision!==match.revision)fail(409,'This match changed. Refresh before saving.');
 if(!match.entry_a||!match.entry_b||!['ready','played'].includes(match.state))fail(400,'Both entries must be confirmed before entering a result.');
 const a=p.scoreA,b=p.scoreB;if([a,b].some(n=>typeof n!=='number'||!Number.isInteger(n)||n<0||n>999))fail(400,'Enter whole-number scores from 0 to 999.');
 if(comp.structure!=='League'&&a===b)fail(400,'A knockout match needs a winner.');
 const winner=a===b?null:a>b?match.entry_a:match.entry_b;if(p.winnerEntryId!==undefined&&numberId(p.winnerEntryId)!==(winner||0))fail(400,'The winning entry must match the scores.');
 const original=await rows(db,'SELECT * FROM empire_competition_matches WHERE competition_id=? ORDER BY round,slot',comp.id),known=new Map(original.map(game=>[game.id,{...game}])),changed=new Map<number,Row>(),added:Row[]=[];
 known.set(match.id,{...match,state:'played',score_a:a,score_b:b,winner_entry_id:winner});changed.set(match.id,known.get(match.id)!);
 if(comp.structure!=='League') {
  // Older Harrogate draws stored later rounds only after the previous round.
  // Fill missing placeholders while retaining every existing match ID/result.
  let prior=[...known.values()].filter(game=>game.round===1).sort((a,b)=>a.slot-b.slot);
  for(let round=2;prior.length>1;round++) {
   const next:Row[]=[];
   for(let position=0;position<prior.length;position+=2) {
    const one=prior[position],two=prior[position+1],slot=position/2,existing=original.find(game=>game.round===round&&game.slot===slot);
    const game:Row=existing?{...known.get(existing.id)}:{id:key(),competition_id:comp.id,round,slot,entry_a:null,entry_b:null,winner_entry_id:null,score_a:null,score_b:null,revision:0,state:'waiting',league_no:1};
    const entryA=one.winner_entry_id||null,entryB=two?.winner_entry_id||null;
    if(game.entry_a!==entryA||game.entry_b!==entryB) {
     if(game.state==='played')fail(409,'A later round has already been played. This correction would change its players.');
     Object.assign(game,{entry_a:entryA,entry_b:entryB,winner_entry_id:null,score_a:null,score_b:null,state:entryA&&entryB?'ready':'waiting'});
     if(existing)changed.set(game.id,game);
    }
    game.source_a=one.id;game.source_b=two?.id||null;
    if(!existing)added.push(game);
    known.set(game.id,game);next.push(game);
   }
   prior=next;
  }
 }
 const games=[...known.values()],final=games.filter(game=>game.round===Math.max(...games.map(game=>game.round)))[0],complete=comp.structure==='League'?games.every(game=>game.state==='played'):final?.state==='played',token=crypto.randomUUID(),guard={revision:comp.revision+1,token};
 const statements=[db.prepare('UPDATE empire_competitions SET revision=revision+1,mutation_token=?,status=? WHERE id=? AND revision=?').bind(token,complete?'Completed':'In progress',comp.id,comp.revision)];
 for(const game of changed.values())statements.push(db.prepare('UPDATE empire_competition_matches SET entry_a=?,entry_b=?,source_a=?,source_b=?,state=?,score_a=?,score_b=?,winner_entry_id=?,revision=revision+1,reported_by=?,reported_role=? WHERE id=? AND EXISTS(SELECT 1 FROM empire_competitions WHERE id=? AND revision=? AND mutation_token=?)').bind(game.entry_a,game.entry_b,game.source_a??null,game.source_b??null,game.state,game.score_a,game.score_b,game.winner_entry_id,game.id===match.id?s.member_id:null,game.id===match.id?s.role:'',game.id,comp.id,guard.revision,token));
 if(added.length)statements.push(insertMatches(db,comp.id,added,guard));
 const saved=await db.batch(statements);if(!saved[0].meta.changes)fail(409,'Another competition update was saved. Refresh before trying again.');return {ok:true};
}

