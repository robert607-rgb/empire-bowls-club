const minutes=(time:string)=>Number(time.slice(0,2))*60+Number(time.slice(3,5));
type Interval=[number,number];
type RecordRow={booking_date:string;rink:number;booking_time?:string;duration_minutes?:number;start_minute?:number;end_minute?:number};
type Rink={rink:number;bookedMinutes:number;availableMinutes:number;percentage:number|null};
const merge=(items:Interval[]):Interval[]=>items.filter(x=>x[1]>x[0]).sort((a,b)=>a[0]-b[0]).reduce((out:Interval[],item)=>{const last=out.at(-1);if(last&&item[0]<=last[1])last[1]=Math.max(last[1],item[1]);else out.push([...item]);return out},[]);
const intersect=(a:Interval[],b:Interval[])=>merge(a.flatMap(x=>b.map(y=>[Math.max(x[0],y[0]),Math.min(x[1],y[1])] as Interval)));
function subtract(a:Interval[],b:Interval[]):Interval[]{let result=a;for(const [start,end] of b)result=result.flatMap(([x,y])=>end<=x||start>=y?[[x,y] as Interval]:[[x,Math.min(start,y)] as Interval,[Math.max(end,x),y] as Interval].filter(i=>i[1]>i[0]));return result}
const total=(intervals:Interval[])=>intervals.reduce((sum,[a,b])=>sum+b-a,0);
const dateString=(d:Date)=>d.toISOString().slice(0,10);
const shift=(day:string,n:number)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return dateString(d)};
const summary=(rows:Rink[][],rinks:number):Rink[]=>Array.from({length:rinks},(_,i)=>{const bookedMinutes=rows.reduce((n,row)=>n+row[i].bookedMinutes,0),availableMinutes=rows.reduce((n,row)=>n+row[i].availableMinutes,0);return {rink:i+1,bookedMinutes,availableMinutes,percentage:availableMinutes?Math.round(bookedMinutes/availableMinutes*1000)/10:null}});
const overall=(rinks:Rink[])=>{const bookedMinutes=rinks.reduce((n,r)=>n+r.bookedMinutes,0),availableMinutes=rinks.reduce((n,r)=>n+r.availableMinutes,0);return {bookedMinutes,availableMinutes,percentage:availableMinutes?Math.round(bookedMinutes/availableMinutes*1000)/10:null}};
export function rinkUsage(today:string,times:string[],rinks:number,bookings:RecordRow[],closures:RecordRow[],fixtures:RecordRow[]){
 const yearStart=today.slice(0,4)+'-01-01',weekStart=shift(today,-6),start=weekStart<yearStart?weekStart:yearStart;
 const slots=merge(times.map(slot=>{const [start,end]=slot.split('–');return [minutes(start),minutes(end)] as Interval}));
 const group=(rows:RecordRow[],fixture=false)=>{const result=new Map<string,Interval[]>();for(const r of rows){const key=r.booking_date+':'+r.rink;const a=fixture?Number(r.start_minute):minutes(String(r.booking_time));const b=fixture?Number(r.end_minute):a+Number(r.duration_minutes||60);result.set(key,[...(result.get(key)||[]),[a,b]])}return result};
 const booked=group(bookings),closed=group(closures),reserved=group(fixtures,true),all:{date:string;rinks:Rink[]}[]=[];
 for(let day=start;day<=today;day=shift(day,1)){
  const values:Rink[]=Array.from({length:rinks},(_,i)=>{const key=day+':'+(i+1),available=subtract(slots,merge(closed.get(key)||[])),occupied=merge([...(booked.get(key)||[]),...(reserved.get(key)||[])]),availableMinutes=total(available),bookedMinutes=total(intersect(available,occupied));return {rink:i+1,availableMinutes,bookedMinutes,percentage:availableMinutes?Math.round(bookedMinutes/availableMinutes*1000)/10:null}});all.push({date:day,rinks:values});
 }
 const year=all.filter(row=>row.date>=yearStart),months=Array.from(new Set(year.map(row=>row.date.slice(0,7)))).map(month=>({month,rinks:summary(year.filter(row=>row.date.startsWith(month)).map(row=>row.rinks),rinks)}));
 const yearly=summary(year.map(row=>row.rinks),rinks);return {daily:all.filter(row=>row.date>=weekStart).map(row=>({...row,total:overall(row.rinks)})),months:months.map(row=>({...row,total:overall(row.rinks)})),year:{year:today.slice(0,4),rinks:yearly,total:overall(yearly)},through:today};
}
