import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';
class TestDatabase {
  constructor() { this.sql = new DatabaseSync(':memory:'); this.sql.exec(`CREATE TABLE empire_members (id INTEGER PRIMARY KEY, name TEXT NOT NULL); INSERT INTO empire_members VALUES (1,'Alice Example'),(2,'Bob Example'); CREATE TABLE empire_bookings (id INTEGER PRIMARY KEY AUTOINCREMENT,booking_date TEXT NOT NULL,rink_number INTEGER NOT NULL,time_slot TEXT NOT NULL,booking_name TEXT NOT NULL,created_at TEXT NOT NULL,fixture_key TEXT,UNIQUE(booking_date,rink_number,time_slot)); CREATE TABLE empire_player_requests (id INTEGER PRIMARY KEY,match_name TEXT,match_date TEXT,players_required INTEGER,names_json TEXT,created_at TEXT); INSERT INTO empire_player_requests VALUES (1,'Match','2026-10-29',3,'["Earlier Name"]','2026-01-01');`); }
  prepare(sql) {const db=this.sql;let args=[];return {bind(...v){args=v;return this},async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)??null},async run(){const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes),last_row_id:Number(result.lastInsertRowid)}}}}}
  async batch(statements){this.sql.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());this.sql.exec('COMMIT');return results}catch(error){this.sql.exec('ROLLBACK');throw error}}
}
const db=new TestDatabase();
globalThis.__ownershipDeps={
 apiError:e=>Response.json({error:String(e)},{status:500}), cleanText:(v,max)=>typeof v==='string'?v.trim().slice(0,max):'',
 getEmpireDatabase:async()=>db, getEmpireSession:async request=>{const role=request.headers.get('x-test-role');return role==='admin'?{access:'admin',member_id:null}:role==='alice'?{access:'member',member_id:1}:role==='bob'?{access:'member',member_id:2}:role==='charlie'?{access:'member',member_id:3}:role==='legacy'?{access:'member',member_id:null}:null;},
 hasEmpireAccess:async(request,adminOnly=false)=>{const role=request.headers.get('x-test-role');return role==='admin'||(!adminOnly&&['alice','bob','legacy'].includes(role));},
 readJson:async request=>request.json(), sameOrigin:request=>request.headers.get('origin')===new URL(request.url).origin, unauthorized:()=>Response.json({error:'Unauthorized'},{status:401})
};
async function load(path){const bundle=await build({entryPoints:[path],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'mock-server',setup(build){build.onResolve({filter:/^\.\.\/_server$/},()=>({path:'server',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const {apiError,cleanText,getEmpireDatabase,getEmpireSession,hasEmpireAccess,readJson,sameOrigin,unauthorized}=globalThis.__ownershipDeps;',loader:'js'}))}}]});return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))}
const bookings=await load('app/api/empire/bookings/route.ts');
const signups=await load('app/api/empire/player-requests/route.ts');
function req(role,method='GET',body,params=''){return new Request('https://club.test/api'+params,{method,headers:{'x-test-role':role,'origin':'https://club.test','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})})}

test('booking ownership is server-derived; only owner or admin can remove it',async()=>{
 let response=await bookings.POST(req('alice','POST',{bookingDate:'2026-10-29',rinkNumber:1,timeSlot:'10:00–12:00',bookingType:'Roll Up',bookingName:'Bob'}));assert.equal(response.status,201);
 let view=await (await bookings.GET(req('alice','GET',undefined,'?date=2026-10-29'))).json();const own=view.bookings[0];assert.equal(own.bookingName,'Bob · Roll Up');assert.equal(own.canCancel,true);
 view=await (await bookings.GET(req('bob','GET',undefined,'?date=2026-10-29'))).json();assert.equal(view.bookings[0].canCancel,false);
 assert.equal((await bookings.DELETE(req('bob','DELETE',{id:own.id}))).status,403);assert.equal((await bookings.DELETE(req('alice','DELETE',{id:own.id}))).status,200);
 await db.prepare("INSERT INTO empire_bookings (booking_date,rink_number,time_slot,booking_name,created_at) VALUES ('2026-10-29',2,'10:00–12:00','Legacy','2026-01-01')").run();
 view=await (await bookings.GET(req('bob','GET',undefined,'?date=2026-10-29'))).json();const old=view.bookings[0];assert.equal(old.canCancel,false);assert.equal((await bookings.DELETE(req('bob','DELETE',{id:old.id}))).status,403);assert.equal((await bookings.DELETE(req('admin','DELETE',{id:old.id}))).status,200);
 await db.prepare("INSERT INTO empire_bookings (booking_date,rink_number,time_slot,booking_name,created_at,fixture_key) VALUES ('2026-10-29',3,'10:00–12:00','Fixture','2026-01-01','fixture')").run();
 view=await (await bookings.GET(req('admin','GET',undefined,'?date=2026-10-29'))).json();assert.equal((await bookings.DELETE(req('admin','DELETE',{id:view.bookings[0].id}))).status,409);
 assert.equal((await bookings.POST(req('admin','POST',{bookingDate:'2026-10-29',rinkNumber:4,timeSlot:'10:00–12:00',bookingName:'Guest booking'}))).status,201);
 assert.equal((await bookings.POST(req('legacy','POST',{bookingDate:'2026-10-29',rinkNumber:5,timeSlot:'10:00–12:00',bookingName:'Example',bookingType:'Roll Up'}))).status,403);
});

test('members can change only their own signup; legacy names and capacity are preserved',async()=>{
 assert.equal((await signups.PUT(req('alice','PUT',{id:1,names:[]}))).status,403);
 assert.equal((await signups.PUT(req('alice','PUT',{id:1,action:'join',memberId:2}))).status,200);
 let body=await (await signups.GET(req('alice'))).json();assert.deepEqual(body.requests[0].names,['Earlier Name','Alice Example']);assert.equal(body.requests[0].joined,true);
 assert.equal((await signups.PUT(req('alice','PUT',{id:1,action:'join'}))).status,409);
 assert.equal((await signups.PUT(req('bob','PUT',{id:1,action:'join'}))).status,200);
 await db.prepare("INSERT INTO empire_members VALUES (3,'Charlie Example')").run();
 assert.equal((await signups.PUT(req('charlie','PUT',{id:1,action:'join'}))).status,409);
 assert.equal((await signups.PUT(new Request('https://club.test/api',{method:'PUT',headers:{'x-test-role':'bob','origin':'https://other.test','content-type':'application/json'},body:JSON.stringify({id:1,action:'leave'})}))).status,403);
 assert.equal((await signups.PUT(req('alice','PUT',{id:1,action:'leave',memberId:2}))).status,200);
 body=await (await signups.GET(req('bob'))).json();assert.deepEqual(body.requests[0].names,['Earlier Name','Bob Example']);assert.equal(body.requests[0].joined,true);
 assert.equal((await signups.PUT(req('legacy','PUT',{id:1,action:'join'}))).status,403);
 body=await (await signups.GET(req('admin'))).json();assert.deepEqual(body.requests[0].legacyNames,['Earlier Name']);assert.equal(body.requests[0].registered[0].memberId,2);
 assert.equal((await signups.PUT(req('admin','PUT',{id:1,action:'removeLegacy',index:0,name:'Wrong'}))).status,409);
 assert.equal((await signups.PUT(req('admin','PUT',{id:1,action:'removeLegacy',index:0,name:'Earlier Name'}))).status,200);
 assert.equal((await signups.PUT(req('admin','PUT',{id:1,action:'removeSignup',memberId:2}))).status,200);
 body=await (await signups.GET(req('alice'))).json();assert.deepEqual(body.requests[0].names,[]);
});

test('duplicate cleanup does not discard a sheet with linked signups',async()=>{
 await db.prepare("INSERT INTO empire_player_requests VALUES (10,'Duplicate','2026-10-31',4,'[]','2026-01-01'),(11,'Duplicate','2026-10-31',4,'[]','2026-01-01')").run();
 assert.equal((await signups.PUT(req('alice','PUT',{id:11,action:'join'}))).status,200);
 const result=await (await signups.GET(req('admin'))).json();
 assert.ok(result.requests.some(request=>request.id===11 && request.names.includes('Alice Example')));
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM empire_player_signups WHERE request_id = ?').bind(11).first()).count,1);
});
