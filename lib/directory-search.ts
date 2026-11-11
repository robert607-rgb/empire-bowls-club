export function directorySearch(person:{name:string;email:string;phone:string},query:string) {
 const term=query.trim().toLowerCase();return [person.name,person.email,person.phone].some(value=>(value||'').toLowerCase().includes(term));
}
