import { apiError, getEmpireDatabase, hasEmpireAccess, unauthorized } from "../../_server";
import { parseRoster } from "../../../../../lib/team-roster";

const headers = { "cache-control": "private, no-store", vary: "Cookie", "x-robots-tag": "noindex" };
export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  const id = Number(new URL(request.url).searchParams.get("sheetId"));
  if (!Number.isSafeInteger(id) || id < 1) return Response.json({error:"Choose a team sheet."},{status:400,headers});
  try {
    const db = await getEmpireDatabase();
    const row = await db.prepare("SELECT rinks_json FROM empire_team_sheets WHERE id = ?").bind(id).first<{rinks_json:string}>();
    if (!row) return Response.json({error:"Team sheet not found."},{status:404,headers});
    const roster = parseRoster(row.rinks_json);
    const ids = [...new Set([...roster.rinks.flatMap(rink=>rink.memberIds),...roster.reserveIds])].filter(id=>Number.isSafeInteger(id)&&id>0);
    if (!ids.length) return Response.json({addresses:[],missing:0},{headers});
    const records = (await db.prepare(`SELECT id,email FROM empire_members WHERE id IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all<{id:number;email:string}>()).results ?? [];
    const byId = new Map(records.map(record=>[record.id,record.email || '']));
    const addresses:string[] = []; const seen=new Set<string>(); let missing=0;
    for(const memberId of ids){const email=(byId.get(memberId)||'').trim();if(!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)){missing++;continue;}const key=email.toLowerCase();if(!seen.has(key)){seen.add(key);addresses.push(email);}}
    return Response.json({addresses,missing},{headers});
  } catch(error){return apiError(error);}
}
