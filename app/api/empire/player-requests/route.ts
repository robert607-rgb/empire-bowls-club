import { apiError, cleanText, getEmpireDatabase, hasEmpireAccess, readJson, sameOrigin, unauthorized } from "../_server";

type Row = { id: number; match_name: string; match_date: string; players_required: number; names_json: string };
const map = (r: Row) => ({ id:r.id, match:r.match_name, date:r.match_date, playersRequired:r.players_required, names: JSON.parse(r.names_json || "[]") as string[] });

export async function GET(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  try { const db=await getEmpireDatabase(); const result=await db.prepare("SELECT id, match_name, match_date, players_required, names_json FROM empire_player_requests ORDER BY match_date ASC").all<Row>(); return Response.json({ requests:(result.results??[]).map(map) }); } catch(error) { return apiError(error); }
}
export async function POST(request: Request) {
  if (!(await hasEmpireAccess(request, true))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({error:"Invalid request origin."},{status:403});
  try { const input=await readJson(request); const match=cleanText(input.match,160), date=cleanText(input.date,10), playersRequired=Number(input.playersRequired); if(!match||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(playersRequired)||playersRequired<1||playersRequired>20)return Response.json({error:"Please enter a match, date and number of players required."},{status:400}); const db=await getEmpireDatabase(); const result=await db.prepare("INSERT INTO empire_player_requests (match_name,match_date,players_required,names_json,created_at) VALUES (?,?,?,?,?)").bind(match,date,playersRequired,"[]",new Date().toISOString()).run(); return Response.json({request:{id:result.meta.last_row_id,match,date,playersRequired,names:[]}},{status:201}); } catch(error){return apiError(error);}
}
export async function PUT(request: Request) {
  if (!(await hasEmpireAccess(request))) return unauthorized();
  if (!sameOrigin(request)) return Response.json({error:"Invalid request origin."},{status:403});
  try { const input=await readJson(request); const id=Number(input.id), names=Array.isArray(input.names)?input.names.map(v=>cleanText(v,120)).filter(Boolean):[]; if(!Number.isInteger(id))return Response.json({error:"Invalid player request."},{status:400}); const db=await getEmpireDatabase(); const row=await db.prepare("SELECT players_required FROM empire_player_requests WHERE id=?").bind(id).first<{players_required:number}>(); if(!row)return Response.json({error:"Player request not found."},{status:404}); if(names.length>row.players_required)return Response.json({error:"Too many names for this request."},{status:400}); await db.prepare("UPDATE empire_player_requests SET names_json=? WHERE id=?").bind(JSON.stringify([...new Set(names)]),id).run(); return Response.json({saved:true}); } catch(error){return apiError(error);}
}
