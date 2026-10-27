import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { build } from 'esbuild';

const bundled = await build({ entryPoints: ['lib/competition-service.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { competitionMutation, CompetitionError } = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
const schemaBundle = await build({ entryPoints: ['lib/competition-schema.ts'], bundle: true, platform: 'node', format: 'esm', write: false });
const { COMPETITION_SCHEMA, ensureCompetitionSchema } = await import('data:text/javascript;base64,' + Buffer.from(schemaBundle.outputFiles[0].text).toString('base64'));

class DB {
  constructor() { this.sql = new DatabaseSync(':memory:'); this.sql.exec('CREATE TABLE empire_members (id INTEGER PRIMARY KEY, name TEXT NOT NULL)'); for (let id=1; id<=260; id++) this.sql.prepare('INSERT INTO empire_members VALUES (?,?)').run(id,`Member ${id}`); for (const ddl of COMPETITION_SCHEMA) this.sql.exec(ddl); }
  prepare(sql) { const db=this.sql; let args=[]; return { bind(...values) {args=values; return this;}, async all() {return {results:db.prepare(sql).all(...args)};}, async first() {return db.prepare(sql).get(...args) ?? null;}, async run() {const result=db.prepare(sql).run(...args);return {meta:{changes:Number(result.changes)}};} }; }
  async batch(statements) { this.sql.exec('BEGIN'); try {const result=[]; for (const statement of statements) result.push(await statement.run()); this.sql.exec('COMMIT'); return result;} catch(error) {this.sql.exec('ROLLBACK');throw error;} }
}
const admin = {role:'admin',member_id:null,permissions:['competitions']};
const member = id => ({role:'member',member_id:id,permissions:[]});
const mutate = (db, actor, body) => competitionMutation(db,actor,body,'2026-10-26');

for (const format of ['singles','pairs','triples','rinks']) for (const structure of ['knockout','league']) test(`${format} ${structure} stores team rosters and generates matches`, async () => {
  const db = new DB(), size={singles:1,pairs:2,triples:3,rinks:4}[format];
  const input={action:'createCompetition', name:'Club championship',format:structure,playingFormat:format,memberIds:[1,2,3],teams:Array.from({length:3},(_,team)=>({name:`Team ${team+1}`,memberIds:Array.from({length:size},(_,i)=>team*size+i+1)})),legs:2,leagueCount:1,winPoints:2,drawPoints:1,lossPoints:0};
  const created=await mutate(db,admin,input);
  const entries=db.sql.prepare('SELECT * FROM empire_competition_entries WHERE competition_id=?').all(created.id);
  const games=db.sql.prepare('SELECT * FROM empire_competition_matches WHERE competition_id=?').all(created.id);
  assert.equal(entries.length,3); assert.equal(JSON.parse(entries[0].players_json).length,size); assert.ok(games.length>=2);
  const game=games.find(m=>m.state==='ready'); assert.ok(game);
  const players=JSON.parse(entries.find(e=>e.id===game.entry_a).players_json);
  await assert.rejects(()=>mutate(db,member(250),{action:'competitionResult',id:game.id,revision:game.revision,scoreA:21,scoreB:12}),error=>error instanceof CompetitionError&&error.status===403);
  await mutate(db,member(players.at(-1).memberId),{action:'competitionResult',id:game.id,revision:game.revision,scoreA:21,scoreB:12});
  await assert.rejects(()=>mutate(db,admin,{action:'competitionResult',id:game.id,revision:game.revision,scoreA:15,scoreB:12}),error=>error instanceof CompetitionError&&error.status===409);
});

test('rejects duplicate players and nonexistent members', async()=>{
 const db=new DB(), base={action:'createCompetition',name:'Pairs',format:'knockout',playingFormat:'pairs',teams:[{memberIds:[1,2]},{memberIds:[2,3]}]};
 await assert.rejects(()=>mutate(db,admin,base),error=>error instanceof CompetitionError&&error.status===400);
 base.teams=[{memberIds:[1,2]},{memberIds:[3,999]}];
 await assert.rejects(()=>mutate(db,admin,base),error=>error instanceof CompetitionError&&error.status===400);
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM empire_competitions').get().n,0);
});

test('maximum supported singles draws are created in bounded SQL statements', async()=>{
 const db=new DB();
 for (const [format,count] of [['knockout',64],['league',24]]) {
  const result=await mutate(db,admin,{action:'createCompetition',name:`Maximum ${format}`,format,playingFormat:'singles',memberIds:Array.from({length:count},(_,i)=>i+1),legs:4,leagueCount:1});
  assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM empire_competition_entries WHERE competition_id=?').get(result.id).n,count);
 }
});

test('knockout advances winners and blocks corrections to completed downstream matches', async()=>{
 const db=new DB(), result=await mutate(db,admin,{action:'createCompetition',name:'Four player cup',format:'knockout',playingFormat:'singles',memberIds:[1,2,3,4]});
 let semis=db.sql.prepare('SELECT * FROM empire_competition_matches WHERE competition_id=? AND round=1 ORDER BY slot').all(result.id);
 for(const game of semis) await mutate(db,admin,{action:'competitionResult',id:game.id,revision:game.revision,scoreA:21,scoreB:8});
 let final=db.sql.prepare('SELECT * FROM empire_competition_matches WHERE competition_id=? AND round=2').get(result.id);
 assert.equal(final.state,'ready'); assert.ok(final.entry_a && final.entry_b);
 await mutate(db,admin,{action:'competitionResult',id:final.id,revision:final.revision,scoreA:21,scoreB:9});
 semis=db.sql.prepare('SELECT * FROM empire_competition_matches WHERE competition_id=? AND round=1 ORDER BY slot').all(result.id);
 await assert.rejects(()=>mutate(db,admin,{action:'competitionResult',id:semis[0].id,revision:semis[0].revision,scoreA:5,scoreB:21}),error=>error instanceof CompetitionError&&error.status===409);
 final=db.sql.prepare('SELECT * FROM empire_competition_matches WHERE id=?').get(final.id);
 assert.equal(final.state,'played'); assert.equal(final.score_a,21);
});


test('drawn pairs sign up individually and admin assigns teams before the draw',async()=>{
 const db=new DB(),created=await mutate(db,admin,{action:'createCompetition',name:'Drawn pairs',format:'knockout',playingFormat:'drawn_pairs',openEntries:true});
 assert.ok(created.id);for(let id=1;id<=4;id++)await mutate(db,member(id),{action:'competitionEntry',competitionId:created.id});
 await assert.rejects(()=>mutate(db,admin,{action:'competitionDraw',competitionId:created.id,teams:[{memberIds:[1,2]},{memberIds:[3,3]}]}));
 await mutate(db,admin,{action:'competitionDraw',competitionId:created.id,teams:[{memberIds:[1,2]},{memberIds:[3,4]}]});
 assert.equal(db.sql.prepare('SELECT COUNT(*) AS n FROM empire_competition_entries WHERE competition_id=?').get(created.id).n,2);
 await assert.rejects(()=>mutate(db,member(5),{action:'competitionEntry',competitionId:created.id}));
});


test('schema upgrade preserves existing competition records and results',async()=>{
 const db=new DB();db.sql.exec('DROP TABLE empire_competitions');db.sql.exec(COMPETITION_SCHEMA[0].replace("entry_mode TEXT NOT NULL DEFAULT 'fixed', ",''));
 db.sql.prepare("INSERT INTO empire_competitions(id,title,season,format,structure,status) VALUES(1,'Existing','2026','Singles','Knockout','In progress')").run();
 await ensureCompetitionSchema(db);const row=db.sql.prepare('SELECT title,entry_mode FROM empire_competitions WHERE id=1').get();assert.equal(row.title,'Existing');assert.equal(row.entry_mode,'fixed');
});
