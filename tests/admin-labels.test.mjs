import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ADMIN_SECTIONS,ADMIN_SECTION_LABELS} from '../lib/empire-admin-sections.ts';

test('each delegated admin function has its own matching label',()=>{
 assert.equal(new Set(ADMIN_SECTIONS.map(([id])=>id)).size,ADMIN_SECTIONS.length);
 assert.equal(new Set(ADMIN_SECTIONS.map(([,label])=>label)).size,ADMIN_SECTIONS.length);
 assert.equal(ADMIN_SECTION_LABELS.bookings,'Bookings');
 assert.equal(ADMIN_SECTION_LABELS['team-sheets'],'Team sheets');
});
