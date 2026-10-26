import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

class TestDatabase {
 constructor(){this.sql=new DatabaseSync(':memory:')}
 prepare(sql){const db=this.sql;let args=[];return {bind(...v){args=v;return this},async all(){return {results:db.prepare(sql).all(...args)}},async first(){return db.prepare(sql).get(...args)??null},async run(){const r=db.prepare(sql).run(...args);return {meta:{changes:Number(r.changes),last_row_id:Number(r.lastInsertRowid)}}}}}
 async batch(statements){this.sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());this.sql.exec('COMMIT');return result}catch(error){this.sql.exec('ROLLBACK');throw error}}
}
const testDb=new TestDatabase();
// Existing deployments have the earlier identity mapping without a credential binding.
testDb.sql.exec('CREATE TABLE empire_session_members (token TEXT PRIMARY KEY, member_id INTEGER NOT NULL)');
globalThis.__empireTestEnv={DB:testDb,EMPIRE_MEMBER_CODE_KEY:'a'.repeat(64)};
const bundle=await build({entryPoints:['app/api/empire/_server.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-workers',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker-env',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = globalThis.__empireTestEnv',loader:'js'}))}}]});
const server=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
const routeBundle=await build({entryPoints:['app/api/empire/members/route.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-workers',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker-env',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = globalThis.__empireTestEnv',loader:'js'}))}}]});
const membersRoute=await import('data:text/javascript;base64,'+Buffer.from(routeBundle.outputFiles[0].text).toString('base64'));

test('individual login binds the correct member, legacy sessions are rejected, and logout revokes identity',async()=>{
 const db=await server.getEmpireDatabase();
 const now=new Date().toISOString();
 for(const [id,name] of [[1,'Alex One'],[2,'Alex Two']]) await db.prepare("INSERT INTO empire_members(id,name,address,phone,email,membership_type,created_at) VALUES (?,?, '', '', '', 'Full member', ?)").bind(id,name,now).run();
 const firstCode=await server.ensureMemberLoginCode(1), secondCode=await server.ensureMemberLoginCode(2);
 assert.notEqual(firstCode,secondCode);
 const login=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'), 'Alex',secondCode);
 assert.equal(login.ok,true);
 const request=new Request('https://club.test/api/empire/competitions',{headers:{cookie:`empire_session=${login.token}`}});
 assert.equal((await server.getEmpireSession(request)).member_id,2);
 const oldToken=crypto.randomUUID();
 await db.prepare("INSERT INTO empire_sessions (token, access, expires_at, created_at) VALUES (?, 'member', ?, ?)").bind(oldToken,new Date(Date.now()+60000).toISOString(),now).run();
 assert.equal(await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${oldToken}`}})),null);
 const legacyToken=crypto.randomUUID();
 await db.batch([
  db.prepare("INSERT INTO empire_sessions (token, access, expires_at, created_at) VALUES (?, 'member', ?, ?)").bind(legacyToken,new Date(Date.now()+60000).toISOString(),now),
  db.prepare('INSERT INTO empire_session_members (token,member_id) VALUES (?,?)').bind(legacyToken,1),
 ]);
 assert.equal(await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${legacyToken}`}})),null);
 await server.endEmpireSession(request);
 assert.equal(await server.getEmpireSession(request),null);
});

test('issuing a code for a new member persists it and permits sign-in',async()=>{
 const db=await server.getEmpireDatabase();
 await db.prepare("INSERT INTO empire_members(id,name,address,phone,email,membership_type,created_at) VALUES (3,'Jordan Example', '', '', '', 'Full member', ?)").bind(new Date().toISOString()).run();
 const code=await server.issueMemberLoginCode(3);
 const stored=await db.prepare('SELECT member_id FROM empire_member_credentials WHERE member_id = ?').bind(3).first();
 assert.equal(stored.member_id,3);
 const login=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'), 'Jordan',code);
 assert.equal(login.ok,true);
 const oldRequest=new Request('https://club.test/',{headers:{cookie:`empire_session=${login.token}`}});
 const priorHash=(await db.prepare('SELECT code_hash FROM empire_member_credentials WHERE member_id = ?').bind(3).first()).code_hash;
 const reset=await server.issueMemberLoginCode(3);
 assert.equal(await server.getEmpireSession(oldRequest),null);
 // A login begun before a reset cannot create a usable session after it.
 const staleToken=crypto.randomUUID();
 await db.batch([
  db.prepare("INSERT INTO empire_sessions(token,access,expires_at,created_at) VALUES (?,'member',?,?)").bind(staleToken,new Date(Date.now()+60000).toISOString(),new Date().toISOString()),
  db.prepare('INSERT INTO empire_session_members(token,member_id,credential_hash) VALUES (?,?,?)').bind(staleToken,3,priorHash),
 ]);
 assert.equal(await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${staleToken}`}})),null);
 const resetLogin=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'), 'Jordan',reset);
 assert.equal(resetLogin.ok,true);
 const resetRequest=new Request('https://club.test/',{headers:{cookie:`empire_session=${resetLogin.token}`}});
 assert.equal((await server.getEmpireSession(resetRequest)).member_id,3);
 await db.prepare('DELETE FROM empire_members WHERE id = ?').bind(3).run();
 assert.equal(await server.getEmpireSession(resetRequest),null);
 // An administrator session is not tied to a member credential.
 const adminToken=crypto.randomUUID();
 await db.prepare("INSERT INTO empire_sessions(token,access,expires_at,created_at) VALUES (?,'admin',?,?)").bind(adminToken,new Date(Date.now()+60000).toISOString(),new Date().toISOString()).run();
 assert.equal((await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${adminToken}`}}))).access,'admin');
});

test('admin reset and deletion revoke the affected member sessions',async()=>{
 const db=await server.getEmpireDatabase(), now=new Date().toISOString(), adminToken=crypto.randomUUID();
 await db.prepare("INSERT INTO empire_members(id,name,address,phone,email,membership_type,created_at) VALUES (4,'Morgan Example', '', '', '', 'Full member', ?)").bind(now).run();
 await db.prepare("INSERT INTO empire_members(id,name,address,phone,email,membership_type,created_at) VALUES (5,'Taylor Example', '', '', '', 'Full member', ?)").bind(now).run();
 await db.prepare("INSERT INTO empire_sessions(token,access,expires_at,created_at) VALUES (?,'admin',?,?)").bind(adminToken,new Date(Date.now()+60000).toISOString(),now).run();
 const code=await server.issueMemberLoginCode(4);
 const otherCode=await server.issueMemberLoginCode(5);
 const otherLogin=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'),'Taylor',otherCode);
 assert.equal(otherLogin.ok,true);
 const otherRequest=new Request('https://club.test/',{headers:{cookie:`empire_session=${otherLogin.token}`}});
 const login=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'),'Morgan',code);
 assert.equal(login.ok,true);
 const memberRequest=new Request('https://club.test/',{headers:{cookie:`empire_session=${login.token}`}});
 const request=(method)=>new Request('https://club.test/api/empire/members',{method,headers:{origin:'https://club.test',cookie:`empire_session=${adminToken}`,'content-type':'application/json'},body:JSON.stringify({id:4})});
 const resetResponse=await membersRoute.PATCH(request('PATCH'));
 assert.equal(resetResponse.status,200);
 assert.equal(await server.getEmpireSession(memberRequest),null);
 const nextCode=(await resetResponse.json()).loginCode;
 const nextLogin=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'),'Morgan',nextCode);
 assert.equal(nextLogin.ok,true);
 const deleteResponse=await membersRoute.DELETE(request('DELETE'));
 assert.equal(deleteResponse.status,200);
 assert.equal(await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${nextLogin.token}`}})),null);
 assert.equal((await server.getEmpireSession(otherRequest)).member_id,5);
 assert.equal((await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${adminToken}`}}))).access,'admin');
});
