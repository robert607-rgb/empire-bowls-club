import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
// Adapted from the Holland-on-Sea admin-access source reference; Empire storage only.
export const ADMIN_SECTIONS = [
 ['members','Members'],['bookings','Rink Bookings'],['fixtures','Fixtures'],['team-sheets','Team Sheets'],
 ['competitions','Competitions'],['news','News'],['gallery','Galleries & Photos'],['documents','Documents'],
] as const;
export type AdminSection=typeof ADMIN_SECTIONS[number][0];
export function validSections(value:unknown):value is AdminSection[]{return Array.isArray(value)&&value.length<=ADMIN_SECTIONS.length&&new Set(value).size===value.length&&value.every(v=>ADMIN_SECTIONS.some(([id])=>id===v));}
export function requestSection(request:Request):AdminSection|null{
 const name=new URL(request.url).pathname.split('/')[3];
 const map:Record<string,AdminSection>={members:'members',bookings:'bookings','rink-usage':'bookings',fixtures:'fixtures','player-requests':'fixtures','team-sheets':'team-sheets',competitions:'competitions',news:'news',gallery:'gallery',uploads:'documents'};
 return map[name]||null;
}
export async function accessReady(db:D1Database){return !!await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='empire_admin_access'").first();}
export async function memberSections(db:D1Database,memberId:number):Promise<AdminSection[]>{
 if(!await accessReady(db))return [];
 const row=await db.prepare("SELECT a.sections FROM empire_admin_access a JOIN empire_member_credentials c ON c.member_id=a.member_id JOIN empire_members m ON m.id=a.member_id WHERE a.member_id=? AND trim(m.email)<>'' AND upper(trim(m.membership_type))<>'RIP'").bind(memberId).first<{sections:string}>();
 try{const value=JSON.parse(row?.sections||'[]');return validSections(value)?value:[]}catch{return []}
}
export async function accessList(db:D1Database){
 const rows=(await db.prepare("SELECT m.id,m.name,CASE WHEN c.member_id IS NOT NULL AND trim(m.email)<>'' AND upper(trim(m.membership_type))<>'RIP' THEN 1 ELSE 0 END AS eligible FROM empire_members m LEFT JOIN empire_member_credentials c ON c.member_id=m.id ORDER BY m.name COLLATE NOCASE").all<{id:number;name:string;eligible:number}>()).results;
 return Promise.all(rows.map(async row=>({...row,sections:await memberSections(db,row.id)})));
}
export async function revokeSections(db:D1Database,id:number){if(await accessReady(db))await db.prepare('DELETE FROM empire_admin_access WHERE member_id=?').bind(id).run();}
export async function setSections(db:D1Database,bucket:R2Bucket,id:number,sections:AdminSection[]){
 if(!Number.isSafeInteger(id)||id<1||!validSections(sections))throw new Error('Choose a member and valid sections.');
 const eligible=await db.prepare("SELECT m.id,m.email FROM empire_members m JOIN empire_member_credentials c ON c.member_id=m.id WHERE m.id=? AND trim(m.email)<>'' AND upper(trim(m.membership_type))<>'RIP'").bind(id).first<{id:number;email:string}>();
 if(sections.length&&(!eligible||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(eligible.email)))throw new Error('This member needs an active login and valid email before receiving admin access.');
 if(!await accessReady(db)){
  if(!sections.length)return;
  const tables=(await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{name:string;sql:string}>()).results;
  if(tables.some(t=>!/^\w+$/.test(t.name)))throw new Error('The private backup could not be prepared.');
  const data=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM "${t.name}"`)));
  await bucket.put(`backups/admin-access/${crypto.randomUUID()}.json`,JSON.stringify({createdAt:new Date().toISOString(),tables:tables.map((t,i)=>({...t,rows:data[i].results}))}),{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  await db.prepare('CREATE TABLE IF NOT EXISTS empire_admin_access(member_id INTEGER PRIMARY KEY,sections TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 }
 if(sections.length)await db.prepare("INSERT INTO empire_admin_access(member_id,sections,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM empire_member_credentials WHERE member_id=?) ON CONFLICT(member_id) DO UPDATE SET sections=excluded.sections,updated_at=excluded.updated_at").bind(id,JSON.stringify(sections),new Date().toISOString(),id).run();
 else await revokeSections(db,id);
}
