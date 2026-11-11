import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const sql=new DatabaseSync(':memory:');
sql.exec(`CREATE TABLE empire_members(id INTEGER PRIMARY KEY,name TEXT);INSERT INTO empire_members VALUES(1,'Alice'),(2,'Bob'),(3,'Carol');CREATE TABLE empire_member_credentials(member_id INTEGER PRIMARY KEY);INSERT INTO empire_member_credentials VALUES(1),(2),(3);CREATE TABLE empire_team_sheets(id INTEGER PRIMARY KEY,opponent TEXT,competition TEXT,match_date TEXT,rink_count INTEGER,rinks_json TEXT,created_at TEXT);`);
const db={prepare(query){let args=[];return {bind(...v){args=v;return this},async all(){return {results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args) ?? null},async run(){const r=sql.prepare(query).run(...args);return {meta:{last_row_id:Number(r.lastInsertRowid),changes:Number(r.changes)}}}}}};
globalThis.__teamDeps={getEmpireDatabase:async()=>db,hasEmpireAccess:async(req,admin)=>req.headers.get('role')==='admin'||(!admin&&req.headers.get('role')==='member'),cleanText:(x,n)=>typeof x==='string'?x.trim().slice(0,n):'',sameOrigin:()=>true,readJson:async req=>req.json(),unauthorized:()=>Response.json({}, {status:401}),apiError:error=>Response.json({error:String(error)},{status:500})};
const bundle=await build({entryPoints:['app/api/empire/team-sheets/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'server',setup(b){b.onResolve({filter:/^\.\.\/_server$/},()=>({path:'server',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const {getEmpireDatabase,hasEmpireAccess,cleanText,sameOrigin,readJson,unauthorized,apiError}=globalThis.__teamDeps',loader:'js'}))}}]});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const request=(role,method,body)=>new Request('https://club.test/api',{method,headers:{role,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
const base={opponent:'Opponents',competition:'League',matchDate:'2026-12-01',rinkCount:1,rinks:[{format:'Pairs',memberIds:[1,2]}]};
test('reserve selection persists, displays to members and rejects invalid or unauthorised writes',async()=>{
 assert.equal((await api.POST(request('member','POST',{...base,reserveIds:[3]}))).status,401);
 assert.equal((await api.POST(request('admin','POST',{...base,reserveIds:[2]}))).status,400);
 assert.equal((await api.POST(request('admin','POST',{...base,reserveIds:[99]}))).status,400);
 const created=await api.POST(request('admin','POST',{...base,reserveIds:[3]}));assert.equal(created.status,201);
 const listing=await (await api.GET(request('member','GET'))).json();assert.deepEqual(listing.sheets[0].reserves,[{memberId:3,name:'Carol'}]);assert.equal(listing.sheets[0].rinks[0].players[0].name,'Alice');
 sql.exec('DELETE FROM empire_member_credentials WHERE member_id=3');assert.equal((await api.POST(request('admin','POST',{...base,reserveIds:[3]}))).status,400);sql.exec('INSERT INTO empire_member_credentials VALUES(3)');
});
test('player email lookup is private and only includes the selected team and reserves',async()=>{
 sql.exec("ALTER TABLE empire_members ADD COLUMN email TEXT; UPDATE empire_members SET email=CASE id WHEN 1 THEN 'one@example.com' WHEN 2 THEN '' WHEN 3 THEN 'three@example.com' END;");
 const res=await api.GET(request('admin','GET')); const id=(await res.json()).sheets[0].id;
 const rec=await import('data:text/javascript;base64,'+Buffer.from((await build({entryPoints:['app/api/empire/team-sheets/recipients/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'server',setup(b){b.onResolve({filter:/^\.\.\/\.\.\/_server$/},()=>({path:'server',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const {getEmpireDatabase,hasEmpireAccess,unauthorized,apiError}=globalThis.__teamDeps',loader:'js'}))}}]})).outputFiles[0].text).toString('base64'));
 const make=role=>new Request(`https://club.test/api/recipients?sheetId=${id}`,{headers:{role}});
 assert.equal((await rec.GET(make('member'))).status,401); const output=await rec.GET(make('admin'));assert.equal(output.status,200);const result=await output.json();assert.deepEqual(result.addresses,['one@example.com','three@example.com']);assert.equal(result.missing,1);
});
