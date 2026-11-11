import type {D1Database} from '@cloudflare/workers-types';
export type SignupDetails={time:string;venue:string};
export function readSignupDetails(input:Record<string,unknown>,fallback:SignupDetails={time:'',venue:''}):SignupDetails{
 return {time:input.time===undefined?fallback.time:typeof input.time==='string'?input.time.trim():'invalid',venue:input.venue===undefined?fallback.venue:typeof input.venue==='string'?input.venue.trim():'invalid'};
}
export function validSignupDetails(details:SignupDetails){return (details.time===''||/^([01]\d|2[0-3]):[0-5]\d$/.test(details.time))&&['','Home','Away','Split'].includes(details.venue)}
export async function ensureSignupDetails(db:D1Database){await db.prepare("CREATE TABLE IF NOT EXISTS empire_signup_details(request_id INTEGER PRIMARY KEY,start_time TEXT NOT NULL DEFAULT '',venue TEXT NOT NULL DEFAULT '')").run()}
export async function getSignupDetails(db:D1Database,id:number):Promise<SignupDetails>{const row=await db.prepare('SELECT start_time,venue FROM empire_signup_details WHERE request_id=?').bind(id).first<{start_time:string;venue:string}>();return {time:row?.start_time??'',venue:row?.venue??''}}
export async function saveSignupDetails(db:D1Database,id:number,details:SignupDetails){await db.prepare('INSERT INTO empire_signup_details(request_id,start_time,venue) VALUES(?,?,?) ON CONFLICT(request_id) DO UPDATE SET start_time=excluded.start_time,venue=excluded.venue').bind(id,details.time,details.venue).run()}
