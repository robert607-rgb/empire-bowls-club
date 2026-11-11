export type Champion={competition:string;winner:string;runnerUp:string};
export type Champions={year:number;entries:Champion[]};
export const defaultChampions:Champions={year:2025,entries:[
 {competition:'Men’s Championship',winner:'Max Fisher',runnerUp:'Bruce Woodington'},
 {competition:'Ladies Championship',winner:'Jan Munday',runnerUp:'Jenny Hands'},
 {competition:'Men’s Pairs',winner:'Ken Boswell & Gary Carpenter',runnerUp:'Martin Thomas & Bruce Woodington'},
 {competition:'Ladies Pairs',winner:'Ann Norris & Elaine Horrigan',runnerUp:'Linda Lawrence & Janet Turner'},
 {competition:'Mixed Triples',winner:'Ann Norris, Terry Bland / Geoff Puncheon & Gary Carpenter',runnerUp:'Martin Thomas, Alan Hands & Roger Gladman'},
 {competition:'Frost Cup',winner:'Linda Lawrence & Bruce Woodington',runnerUp:'Ken Boswell & Ray Norris'},
 {competition:'101',winner:'Max Fisher',runnerUp:'Bruce Woodington'},
 {competition:'Cliff Hunter Handicap',winner:'Richard Gausby',runnerUp:'Max Fisher'}
]};
export function validChampions(value:unknown):value is Champions{
 if(!value||typeof value!=='object')return false;const data=value as Champions;
 return Number.isInteger(data.year)&&data.year>=1910&&data.year<=2200&&Array.isArray(data.entries)&&data.entries.length<=60&&data.entries.every(row=>row&&[row.competition,row.winner,row.runnerUp].every(text=>typeof text==='string'&&text.length<=250)&&row.competition.trim()&&row.winner.trim());
}
