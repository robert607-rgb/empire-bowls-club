import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRoster, validateRoster } from '../lib/team-roster.ts';
test('reads existing rink-only sheets and round-trips reserves',()=>{
 const rinks=[{format:'Pairs',memberIds:[1,2]}];
 assert.deepEqual(parseRoster(JSON.stringify(rinks)),{rinks,reserveIds:[]});
 assert.deepEqual(parseRoster(JSON.stringify({rinks,reserveIds:[3,4]})),{rinks,reserveIds:[3,4]});
});
test('rejects duplicate and invalid reserves across all positions',()=>{
 const rinks=[{format:'Pairs',memberIds:[1,2]}];
 assert.equal(validateRoster(rinks,[2]),false);
 assert.equal(validateRoster(rinks,[3,3]),false);
 assert.equal(validateRoster(rinks,[0]),false);
 assert.equal(validateRoster(rinks,[3,4]),true);
});
