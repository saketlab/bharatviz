// Frontend-only, display-only layer: village polygons are per-state slices, not an
// MCP MAP_REGISTRY layer. One mapping file per upstream source; empty {} until its
// build/upload pipeline (scripts/40_build_village_layers.py) has run.
import lgd from './village-polygon-mapping.lgd.json';
import bhuvan from './village-polygon-mapping.bhuvan.json';
import soi from './village-polygon-mapping.soi.json';
import bhuvanJk from './village-polygon-mapping.bhuvan_jk.json';

export type VillageSource = 'lgd' | 'bhuvan' | 'soi' | 'bhuvan_jk';

const SOURCES: Record<VillageSource, { label: string; map: Record<string, string> }> = {
  lgd: { label: 'LGD', map: lgd as Record<string, string> },
  bhuvan: { label: 'Bhuvan', map: bhuvan as Record<string, string> },
  soi: { label: 'Survey of India', map: soi as Record<string, string> },
  bhuvan_jk: { label: 'Bhuvan (J&K)', map: bhuvanJk as Record<string, string> },
};

export function getVillageSources(): { id: VillageSource; label: string }[] {
  return (Object.keys(SOURCES) as VillageSource[])
    .filter(id => Object.keys(SOURCES[id].map).length > 0)
    .map(id => ({ id, label: SOURCES[id].label }));
}

export function getVillagePolygonUrl(source: VillageSource, state: string): string | null {
  return SOURCES[source]?.map[state] || null;
}

export function getVillagePolygonStates(source: VillageSource): string[] {
  return Object.keys(SOURCES[source]?.map ?? {}).sort();
}
