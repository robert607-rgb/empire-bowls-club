"use client";
import {Competitions} from './competitions';
import Registration from './competition-registration';
import { useCallback, useEffect, useState } from "react";
// The API returns only competition records and the authenticated member ID.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
import type {Competition,PlayingFormat} from '../lib/competition-model';
const playing:Record<string,PlayingFormat>={Singles:'singles',Pairs:'pairs',Triples:'triples',Fours:'rinks',Rinks:'rinks'};
export function competitionViews(data:Row):Competition[] {
 const current=new Map<number,string>((data.directory||[]).map((member:Row)=>[member.id,member.name]));
 return (data.competitions||[]).filter((raw:Row)=>!raw.archived&&raw.status!=='Entries open').flatMap((raw:Row)=>Array.from({length:raw.structure==='League'?Number(raw.league_count||1):1},(_,index)=>{
  const league=index+1,entries=(data.competitionEntries||[]).filter((entry:Row)=>entry.competition_id===raw.id&&Number(entry.league_no||1)===league).map((entry:Row)=>{
   const players=JSON.parse(entry.players_json||'[]').map((player:Row)=>({...player,name:current.get(player.memberId)||player.name}));
   return {memberId:entry.id,name:entry.entry_name||players.map((player:Row)=>player.name).join(' / ')||entry.name,seed:entry.entry_order||entry.id,players};
  }),matches=(data.competitionMatches||[]).filter((match:Row)=>match.competition_id===raw.id&&Number(match.league_no||1)===league).map((match:Row)=>({id:String(match.id),competition_id:String(raw.id),round_no:match.round,position_no:match.slot%64+1,player_one_id:match.entry_a,player_two_id:match.entry_b,source_one_id:match.source_a?String(match.source_a):null,source_two_id:match.source_b?String(match.source_b):null,state:match.state,score_one:match.score_a,score_two:match.score_b,winner_id:match.winner_entry_id,version:match.revision,updated_at:raw.created_at}));
  const final=matches.at(-1);
  return {id:String(raw.id)+(raw.structure==='League'&&raw.league_count>1?':'+league:''),name:raw.title+(raw.structure==='League'&&raw.league_count>1?' — League '+league:''),format:raw.structure==='League'?'league':'knockout',playing_format:playing[raw.format]||'singles',legs:Number(raw.legs||1),win_points:Number(raw.win_points??2),draw_points:Number(raw.draw_points??1),loss_points:Number(raw.loss_points??0),created_at:raw.created_at,updated_at:raw.created_at,entries,matches,complete:matches.length>0&&matches.every((game:Row)=>game.state==='played'||game.state==='bye'),winnerId:raw.structure!=='League'&&final?.state==='played'?final.winner_id:null} as Competition;
 }));
}
export default function CompetitionTool({members, admin=false}:{members:{id:number;name:string;membershipType?:string}[];admin?:boolean}) {
 const [data,setData]=useState<Row | null>(null);
 const [error,setError]=useState("");
 const refresh=useCallback(async()=>{
  try {
   const response=await fetch("/api/empire/competitions", {credentials:"same-origin"});
   const body=await response.json() as Row;
   if(!response.ok) throw new Error(body.error || "Competitions could not be loaded.");
   setData(body);setError("");return true;
  } catch(failure) {setError(failure instanceof Error ? failure.message : "Competitions could not be loaded.");return false;}
 },[]);
 useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),0);return ()=>window.clearTimeout(timer)},[refresh]);
 const directory=members.map(member=>({id:member.id,name:member.name,membership_type:member.membershipType}));
 if(!data) return <section className="competition-panel" aria-live="polite">{error ? <><p role="alert">{error}</p><button className="primary" type="button" onClick={()=>void refresh()}>Try again</button></> : "Loading competitions…"}</section>;
 return <section className="competition-panel">{error && <p role="alert">{error}</p>}<Registration data={{...data,directory,session:{memberId:data.sessionMemberId}}} admin={admin} refresh={refresh}/>{admin&&(data.competitions||[]).filter((c:Row)=>!c.archived&&c.status!=='Entries open').map((c:Row)=><p key={c.id}><button type="button" className="text-link" onClick={async()=>{if(!window.confirm(`Archive ${c.title}? Entries and results will be retained.`))return;try{const response=await fetch('/api/empire/competitions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'archiveCompetition',competitionId:c.id,revision:c.revision})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Could not archive.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Could not archive.')}}}>Archive {c.title}</button></p>)}{admin&&(data.competitions||[]).some((c:Row)=>c.archived)&&<details><summary>Archived competitions</summary>{(data.competitions||[]).filter((c:Row)=>c.archived).map((c:Row)=><p key={c.id}>{c.title} <button type="button" className="text-link" onClick={async()=>{try{const response=await fetch('/api/empire/competitions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'restoreCompetition',competitionId:c.id,revision:c.revision})});const body=await response.json() as {error?:string};if(!response.ok)throw new Error(body.error||'Could not restore.');await refresh()}catch(e){setError(e instanceof Error?e.message:'Could not restore.')}}}>Restore</button></p>)}</details>}{competitionViews({...data,directory}).length>0&&<Competitions allowCreate={false} competitions={competitionViews({...data,directory})} members={directory} self={{memberId:data.sessionMemberId,isTest:!data.sessionMemberId}} admin={admin} refresh={async()=>{await refresh()}}/>}</section>;
}

