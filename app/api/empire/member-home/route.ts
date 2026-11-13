import {apiError,getEmpireDatabase,getEmpireSession,unauthorized} from '../_server';
import {clubToday,selectedRole} from '../../../../lib/club-date';
import {parseRoster} from '../../../../lib/team-roster';
export async function GET(request:Request){
 try{
 const session=await getEmpireSession(request);
 if(!session||session.member_id===null)return unauthorized();
 const db=await getEmpireDatabase();
 const member=await db.prepare('SELECT id,name FROM empire_members WHERE id=?').bind(session.member_id).first<{id:number;name:string}>();
 if(!member)return unauthorized();
 const rows=(await db.prepare('SELECT s.id,s.opponent,s.competition,s.match_date,s.rinks_json FROM empire_team_sheets s LEFT JOIN empire_team_sheet_archives a ON a.sheet_id=s.id WHERE s.match_date>=? AND a.sheet_id IS NULL ORDER BY s.match_date,s.id').bind(clubToday()).all<{id:number;opponent:string;competition:string;match_date:string;rinks_json:string}>()).results??[];
 const alerts=rows.flatMap((row:{id:number;opponent:string;competition:string;match_date:string;rinks_json:string})=>{const role=selectedRole(parseRoster(row.rinks_json),member.id);return role?[{id:row.id,opponent:row.opponent,competition:row.competition,date:row.match_date,role}]:[]});
 return Response.json({member,alerts},{headers:{'cache-control':'private, no-store',vary:'Cookie'}});
 }catch(error){return apiError(error)}
}
