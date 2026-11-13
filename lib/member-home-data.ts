export async function loadMemberHome(date:string,headers:HeadersInit,request:typeof fetch=fetch){
  const responses=await Promise.all([
    request(`/api/empire/bookings?date=${encodeURIComponent(date)}`,{headers}),
    request('/api/empire/members',{headers}),
    request('/api/empire/uploads',{headers}),
    request('/api/empire/team-sheets',{headers}),
    request('/api/empire/member-home',{headers,cache:'no-store'}),
  ]);
  if(responses.some(response=>!response.ok))throw new Error('Member data request failed');
  const [booking,members,files,teams,home]=await Promise.all(responses.map(response=>response.json())) as Array<Record<string,any>>;
  return {bookings:booking.bookings??[],members:members.members??[],files:files.files??[],sheets:teams.sheets??[],member:home.member,alerts:home.alerts??[]};
}
