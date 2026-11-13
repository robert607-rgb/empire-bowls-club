/** Persisted permission keys stay stable; labels are shared by grants and tabs. */
export const ADMIN_SECTIONS = [
 ['members','Members'],['competitions','Competitions'],['bookings','Bookings'],['committee','Committee'],
 ['team-sheets','Team sheets'],['fixtures','Fixtures'],['player-signups','Player sign-ups'],['news','News'],
 ['gallery','Gallery'],['sponsors','Sponsors'],['documents','Documents'],['champions','Club champions'],
] as const;
export type AdminSection=typeof ADMIN_SECTIONS[number][0];
export const ADMIN_SECTION_LABELS = Object.fromEntries(ADMIN_SECTIONS) as Record<AdminSection,string>;
