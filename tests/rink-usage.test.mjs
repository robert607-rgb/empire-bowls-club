import test from 'node:test';import assert from 'node:assert/strict';import {rinkUsage} from '../lib/rink-usage.ts';
test('usage weights the longer evening slot and excludes maintenance',()=>{
 const day='2026-01-02',slots=['10:00–12:00','12:00–14:00','14:00–16:00','16:00–18:00','18:00–21:00'];
 const usage=rinkUsage(day,slots,2,[{booking_date:day,rink:1,booking_time:'18:00',duration_minutes:180}],[{booking_date:day,rink:2,booking_time:'10:00',duration_minutes:120}],[]);
 const result=usage.daily.at(-1);assert.equal(result.rinks[0].percentage,27.3);assert.equal(result.total.percentage,15);assert.equal(result.total.availableMinutes,1200);
});
