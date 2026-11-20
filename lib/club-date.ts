export function clubToday(now=new Date()) {
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 const get=(name:string)=>parts.find(part=>part.type===name)!.value;
 return `${get('year')}-${get('month')}-${get('day')}`;
}
export function millisecondsUntilNextClubDay(now=new Date()) {
 const start=now.getTime(),day=clubToday(now);let low=start,high=start+27*60*60*1000;
 while(high-low>1){const middle=Math.floor((low+high)/2);if(clubToday(new Date(middle))===day)low=middle;else high=middle;}
 return high-start;
}
export function selectedRole(roster:{rinks:{memberIds:number[]}[];reserveIds:number[]},memberId:number):'player'|'reserve'|null {
 return roster.rinks.some(rink=>Array.isArray(rink.memberIds)&&rink.memberIds.includes(memberId))?'player':roster.reserveIds.includes(memberId)?'reserve':null;
}

export function isClubDate(value: unknown): value is string {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const parsed = new Date(value + 'T12:00:00Z');
 return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
