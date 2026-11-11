export type DirectoryContact = { email: string; membershipType: string };
export function directoryRecipients(records: DirectoryContact[], group: string) {
  const addresses: string[] = [];
  const seen = new Set<string>();
  let omitted = 0;
  for (const record of records) {
    if (group !== 'all' && record.membershipType !== group) continue;
    const email = (record.email || '').trim();
    if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(email)) { omitted++; continue; }
    if (!seen.has(email.toLowerCase())) { seen.add(email.toLowerCase()); addresses.push(email); }
  }
  return { addresses, omitted };
}
export function bccMailto(addresses: string[]) {
  if (!addresses.length) return null;
  const url = `mailto:?bcc=${encodeURIComponent(addresses.join(','))}`;
  return url.length <= 1800 ? url : null;
}
