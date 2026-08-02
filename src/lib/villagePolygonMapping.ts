// Village polygons bypass MAP_REGISTRY; the source/state/url mapping is fetched from a
// gist at runtime so sources and states can change without a redeploy.
export type VillageSource = 'lgd' | 'bhuvan' | 'soi' | 'bhuvan_jk';

type VillageMapping = Record<string, { label: string; states: Record<string, string> }>;

const GIST_URL =
  'https://gist.githubusercontent.com/saketkc/081d56fd97703f70c578ff87de677ebc/raw/village-polygon-mapping.json';

let inflight: Promise<VillageMapping> | null = null;

export function loadVillageMapping(): Promise<VillageMapping> {
  return (inflight ??= fetch(GIST_URL)
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
