import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

const sql = new DatabaseSync(':memory:');
sql.exec('CREATE TABLE empire_member_unavailability (member_id INTEGER, match_date TEXT, PRIMARY KEY(member_id,match_date))');
const db = {
  prepare(query) {
    let args = [];
    return {
      bind(...values) { args=values; return this; },
      async all() { return { results: sql.prepare(query).all(...args) }; },
      async run() { return sql.prepare(query).run(...args); },
    };
  },
  async batch(statements) { return Promise.all(statements.map(statement=>statement.run())); },
};
globalThis.availabilityDeps = {
  getEmpireDatabase: async () => db,
  getEmpireSession: async request => {
    const id = request.headers.get('actor');
    if (id === 'captain') return { access:'admin', member_id:2 };
    return id ? { access:'member', member_id:Number(id) } : null;
  },
  readJson: request => request.json(),
  sameOrigin: request => request.headers.get('origin') === new URL(request.url).origin,
  unauthorized: () => new Response(null,{status:401}),
  apiError: error => Response.json({error:String(error)},{status:500}),
};
const bundle = await build({
  entryPoints:['app/api/empire/team-sheets/availability/route.ts'],bundle:true,platform:'node',format:'esm',write:false,
  plugins:[{name:'server',setup(builder){
    builder.onResolve({filter:/^\.\.\/\.\.\/_server$/},()=>({path:'server',namespace:'mock'}));
    builder.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const {getEmpireDatabase,getEmpireSession,readJson,sameOrigin,unauthorized,apiError}=globalThis.availabilityDeps',loader:'js'}));
  }}],
});
const api=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const request=(actor,body,date,origin='https://club.test')=>new Request('https://club.test/availability'+(date?'?date='+date:''),{
  headers:{...(actor?{actor}:{}),origin,'content-type':'application/json'},
  ...(body?{method:'POST',body:JSON.stringify(body)}:{}),
});
test('member availability can only be written by the owner and only captains can check a fixture day',async()=>{
  const date='2095-04-08';
  const body={unavailable:[date],available:[],memberId:2};
  assert.equal((await api.GET(request())).status,401);
  assert.equal((await api.POST(request('captain',body))).status,401);
  assert.equal((await api.POST(request('1',body,null,'https://wrong.test'))).status,403);
  assert.equal((await api.POST(request('1',{...body,unavailable:['2095-02-30']}))).status,400);
  assert.deepEqual(await (await api.POST(request('1',body))).json(),{dates:[date]});
  assert.equal((await api.GET(request('2',null,date))).status,401);
  assert.deepEqual(await (await api.GET(request('2'))).json(),{dates:[]});
  assert.deepEqual(await (await api.GET(request('captain',null,date))).json(),{memberIds:[1]});
  assert.deepEqual(await (await api.POST(request('1',{available:[date],unavailable:[]}))).json(),{dates:[]});
});
