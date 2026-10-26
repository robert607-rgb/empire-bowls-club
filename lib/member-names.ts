export function sortMembers<T extends {id:number;name:string}>(members:T[]):T[] {
  const compare=new Intl.Collator('en-GB',{sensitivity:'base',numeric:true});
  return [...members].sort((a,b)=>compare.compare(a.name.trim().split(/\s+/)[0],b.name.trim().split(/\s+/)[0])||compare.compare(a.name,b.name)||a.id-b.id);
}
