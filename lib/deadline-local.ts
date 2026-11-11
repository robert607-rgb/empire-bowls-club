export function localDeadlineOptions(value:string):string[] {
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return [];
 const time=new Date(value).getTime();if(!Number.isFinite(time))return [];
 const local=(date:Date)=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}T${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
 return [-120,-90,-60,-30,0,30,60,90,120].map(min=>new Date(time+min*60000)).filter(date=>local(date)===value).map(date=>date.toISOString()).sort();
}
export function londonDeadline(iso:string){return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',dateStyle:'medium',timeStyle:'short'}).format(new Date(iso))+' (UK time)'}
