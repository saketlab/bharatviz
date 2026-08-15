// Village polygons bypass MAP_REGISTRY; the source/state/url mapping is fetched at
// runtime so sources and states can change without a redeploy.
export type VillageSource = 'soi_direct' | 'lgd' | 'bhuvan' | 'soi' | 'bhuvan_jk';

type VillageMapping = Record<string, { label: string; states: Record<string, string> }>;

const MAPPING_URL =
  'https://geo.bharatviz.org/geojsons/villages/village-polygon-mapping.json';

let inflight: Promise<VillageMapping> | null = null;

export function loadVillageMapping(): Promise<VillageMapping> {
  return (inflight ??= fetch(MAPPING_URL)
    .then(r => (r.ok ? r.json() : {}))
    .catch(() => ({})));
}

export function getVillageSources(m: VillageMapping): { id: VillageSource; label: string }[] {
  return (Object.keys(m) as VillageSource[])
    .filter(id => Object.keys(m[id]?.states ?? {}).length > 0)
    .map(id => ({ id, label: m[id].label }));
}

export function getVillagePolygonStates(m: VillageMapping, source: VillageSource): string[] {
  return Object.keys(m[source]?.states ?? {}).sort();
}

export function getVillagePolygonUrl(m: VillageMapping, source: VillageSource, state: string): string | null {
  return m[source]?.states[state] || null;
}
