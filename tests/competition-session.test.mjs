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
globalThis.__empireTestEnv={DB:testDb,EMPIRE_MEMBER_CODE_KEY:'a'.repeat(64)};
const bundle=await build({entryPoints:['app/api/empire/_server.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'test-workers',setup(build){build.onResolve({filter:/^cloudflare:workers$/},()=>({path:'worker-env',namespace:'test'}));build.onLoad({filter:/.*/,namespace:'test'},()=>({contents:'export const env = globalThis.__empireTestEnv',loader:'js'}))}}]});
const server=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

test('individual login binds the correct member, old sessions are anonymous, and logout revokes identity',async()=>{
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
 assert.equal((await server.getEmpireSession(new Request('https://club.test/',{headers:{cookie:`empire_session=${oldToken}`}}))).member_id,null);
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
 const reset=await server.issueMemberLoginCode(3);
 const resetLogin=await server.authenticateEmpireMember(new Request('https://club.test/api/empire/auth'), 'Jordan',reset);
 assert.equal(resetLogin.ok,true);
});
