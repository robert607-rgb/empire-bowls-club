import {getEmpireDatabase,getEmpireSession,unauthorized,apiError} from '../_server';
import {rinkUsage} from '../../../../lib/rink-usage';
export async function GET(request:Request){
 try{const session=await getEmpireSession(request);if(!session)return unauthorized();if(session.access!=='admin')return Response.json({error:'Administrator access required.'},{status:403});
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),week=new Date(day+'T00:00:00Z');week.setUTCDate(week.getUTCDate()-6);const start=[day.slice(0,4)+'-01-01',week.toISOString().slice(0,10)].sort()[0],db=await getEmpireDatabase();
 const found=await db.prepare('SELECT booking_date,rink_number,time_slot FROM empire_bookings WHERE booking_date BETWEEN ? AND ?').bind(start,day).all<{booking_date:string;rink_number:number;time_slot:string}>();
 const bookings=(found.results||[]).map(row=>{const [a,b]=row.time_slot.split('–');const minute=(v:string)=>Number(v.slice(0,2))*60+Number(v.slice(3,5));return {booking_date:row.booking_date,rink:row.rink_number,booking_time:a,duration_minutes:minute(b)-minute(a)}});
 const closures=[];for(let date=new Date(start+'T00:00:00Z');date.toISOString().slice(0,10)<=day;date.setUTCDate(date.getUTCDate()+1))if(date.getUTCDay()===5)for(let rink=1;rink<=6;rink++)closures.push({booking_date:date.toISOString().slice(0,10),rink,booking_time:'10:00',duration_minutes:120});
 return Response.json(rinkUsage(day,['10:00–12:00','12:00–14:00','14:00–16:00','16:00–18:00','18:00–21:00'],6,bookings,closures,[]),{headers:{'cache-control':'private, no-store'}});
 }catch(error){return apiError(error)}
}
