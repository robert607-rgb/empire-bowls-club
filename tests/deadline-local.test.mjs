import {test} from 'node:test';import assert from 'node:assert/strict';import {localDeadlineOptions} from '../lib/deadline-local.ts';
process.env.TZ='Europe/London';
test('finds skipped, repeated and ordinary local clock times',()=>{assert.deepEqual(localDeadlineOptions('2026-03-29T01:30'),[]);assert.deepEqual(localDeadlineOptions('2026-10-25T01:30'),['2026-10-25T00:30:00.000Z','2026-10-25T01:30:00.000Z']);assert.equal(localDeadlineOptions('2026-11-01T12:00').length,1)});
