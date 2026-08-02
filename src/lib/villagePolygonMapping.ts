// Frontend-only, display-only layer: village polygons are per-state slices, not an
// MCP MAP_REGISTRY layer. Only village *points* are registry-backed (queryable server-side).
import mapping from './village-polygon-mapping.json';

const map = mapping as Record<string, string>;

export function getVillagePolygonUrl(state: string): string | null {
  return map[state] || null;
}

export function getVillagePolygonStates(): string[] {
  return Object.keys(map).sort();
}

export function hasVillagePolygons(): boolean {
  return Object.keys(map).length > 0;
}
