type Rink = { format: string; memberIds: number[] };
export function parseRoster(value: string): { rinks: Rink[]; reserveIds: number[] } {
  try {
    const data = JSON.parse(value || '[]');
    if (Array.isArray(data)) return { rinks: data, reserveIds: [] };
    return { rinks: Array.isArray(data.rinks) ? data.rinks : [], reserveIds: Array.isArray(data.reserveIds) ? data.reserveIds : [] };
  } catch { return { rinks: [], reserveIds: [] }; }
}
export function validateRoster(rinks: Rink[], reserveIds: number[]) {
  const ids = [...rinks.flatMap(rink => rink.memberIds), ...reserveIds];
  return reserveIds.length <= 40 && ids.every(id => Number.isInteger(id) && id > 0) && new Set(ids).size === ids.length;
}
