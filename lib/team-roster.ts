export const rinkLocations = ["Home", "Away"] as const;
export const matchLocations = ["Home", "Away", "Home & Away"] as const;
export type RinkLocation = typeof rinkLocations[number];
export type MatchLocation = typeof matchLocations[number];
type Rink = { format: string; memberIds: number[]; venue?: RinkLocation };

export function parseRoster(value: string) {
  try {
    const data = JSON.parse(value || "[]");
    if (Array.isArray(data)) return { rinks: data as Rink[], reserveIds: [] as number[] };
    return {
      rinks: Array.isArray(data.rinks) ? data.rinks as Rink[] : [],
      reserveIds: Array.isArray(data.reserveIds) ? data.reserveIds as number[] : [],
      ...(typeof data.startTime === "string" ? { startTime: data.startTime as string } : {}),
      ...(matchLocations.includes(data.venue) ? { venue: data.venue as MatchLocation } : {}),
      ...(Number.isSafeInteger(data.fixtureId) ? { fixtureId: data.fixtureId as number } : {}),
      ...(data.draft === true ? { draft: true } : {}),
    };
  } catch {
    return { rinks: [] as Rink[], reserveIds: [] as number[] };
  }
}

export const publishedRoster = "CASE WHEN json_valid(s.rinks_json) THEN COALESCE(json_extract(s.rinks_json, '$.draft'), 0) ELSE 0 END = 0";

export function validateRoster(rinks: Rink[], reserveIds: number[]) {
  const ids = [...rinks.flatMap(rink => rink.memberIds), ...reserveIds];
  return reserveIds.length <= 40 && ids.every(id => Number.isInteger(id) && id > 0) && new Set(ids).size === ids.length;
}
