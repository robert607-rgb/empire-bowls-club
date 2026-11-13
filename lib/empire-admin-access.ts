import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { ADMIN_SECTIONS, type AdminSection } from './empire-admin-sections';
export { ADMIN_SECTIONS } from './empire-admin-sections';
export type { AdminSection } from './empire-admin-sections';
// Adapted from the Holland-on-Sea admin-access source reference; Empire storage only.
export function validSections(value:unknown):value is AdminSection[]{return Array.isArray(value)&&value.length<=ADMIN_SECTIONS.length&&new Set(value).size===value.length&&value.every(v=>ADMIN_SECTIONS.some(([id])=>id===v));}
export function requestSection(request:Request):AdminSection|null{
 const name=new URL(request.url).pathname.split('/')[3];
 const map:Record<string,AdminSection>={members:'members',bookings:'bookings','rink-usage':'bookings',fixtures:'fixtures','player-requests':'player-signups','team-sheets':'team-sheets',competitions:'competitions',news:'news',gallery:'gallery',uploads:'documents',committee:'committee',sponsors:'sponsors',champions:'champions'};
 return map[name]||null;
}
export async function accessReady(db:D1Database){return !!await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='empire_admin_access'").first();}
export async function memberSections(db:D1Database,memberId:number):Promise<AdminSection[]>{
 if(!await accessReady(db))return [];
 const row=await db.prepare("SELECT a.sections FROM empire_admin_access a JOIN empire_member_credentials c ON c.member_id=a.member_id JOIN empire_members m ON m.id=a.member_id WHERE a.member_id=? AND trim(COALESCE(m.name,''))<>'' AND upper(trim(m.membership_type))<>'RIP'").bind(memberId).first<{sections:string}>();
 try{const value=JSON.parse(row?.sections||'[]');if(!validSections(value))return [];const versionTable=await db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name='empire_admin_access_version'").first();const current=versionTable?await db.prepare('SELECT member_id FROM empire_admin_access_version WHERE member_id=?').bind(memberId).first():null;return !current&&value.includes('fixtures')&&!value.includes('player-signups')?[...value,'player-signups']:value}catch{return []}
}
export async function accessList(db:D1Database){
 const rows=(await db.prepare("SELECT m.id,m.name,CASE WHEN c.member_id IS NOT NULL AND trim(COALESCE(m.name,''))<>'' AND upper(trim(m.membership_type))<>'RIP' THEN 1 ELSE 0 END AS eligible FROM empire_members m LEFT JOIN empire_member_credentials c ON c.member_id=m.id ORDER BY m.name COLLATE NOCASE").all<{id:number;name:string;eligible:number}>()).results;
 return Promise.all(rows.map(async row=>({...row,sections:await memberSections(db,row.id)})));
}
export async function revokeSections(db:D1Database,id:number){if(await accessReady(db))await db.prepare('DELETE FROM empire_admin_access WHERE member_id=?').bind(id).run();}
export async function setSections(db:D1Database,bucket:R2Bucket,id:number,sections:AdminSection[]){
 if(!Number.isSafeInteger(id)||id<1||!validSections(sections))throw new Error('Choose a member and valid sections.');
 const eligible=await db.prepare("SELECT m.id FROM empire_members m JOIN empire_member_credentials c ON c.member_id=m.id WHERE m.id=? AND trim(COALESCE(m.name,''))<>'' AND upper(trim(m.membership_type))<>'RIP'").bind(id).first<{id:number}>();
 if(sections.length&&!eligible)throw new Error('This member needs an active login and a name before receiving admin access.');
 if(!await accessReady(db)){
  if(!sections.length)return;
  const tables=(await db.prepare("SELECT name,sql FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name").all<{name:string;sql:string}>()).results;
  if(tables.some(t=>!/^\w+$/.test(t.name)))throw new Error('The private backup could not be prepared.');
  const data=await db.batch(tables.map(t=>db.prepare(`SELECT * FROM "${t.name}"`)));
  await bucket.put(`backups/admin-access/${crypto.randomUUID()}.json`,JSON.stringify({createdAt:new Date().toISOString(),tables:tables.map((t,i)=>({...t,rows:data[i].results}))}),{httpMetadata:{contentType:'application/json',cacheControl:'private, no-store'}});
  await db.prepare('CREATE TABLE IF NOT EXISTS empire_admin_access(member_id INTEGER PRIMARY KEY,sections TEXT NOT NULL,updated_at TEXT NOT NULL)').run();
 }
 await db.prepare('CREATE TABLE IF NOT EXISTS empire_admin_access_version(member_id INTEGER PRIMARY KEY)').run();
 if(sections.length){const results=await db.batch([db.prepare("INSERT INTO empire_admin_access(member_id,sections,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM empire_members m JOIN empire_member_credentials c ON c.member_id=m.id WHERE m.id=? AND trim(COALESCE(m.name,''))<>'' AND upper(trim(m.membership_type))<>'RIP') ON CONFLICT(member_id) DO UPDATE SET sections=excluded.sections,updated_at=excluded.updated_at").bind(id,JSON.stringify(sections),new Date().toISOString(),id),db.prepare('INSERT OR IGNORE INTO empire_admin_access_version(member_id) SELECT ? WHERE EXISTS(SELECT 1 FROM empire_admin_access WHERE member_id=?)').bind(id,id)]);if(!results[0].meta.changes)throw new Error('The member changed. Refresh and check their login before granting access.');}
 else await revokeSections(db,id);
}
