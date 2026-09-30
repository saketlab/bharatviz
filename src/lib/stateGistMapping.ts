/**
 * State District Mapping Module
 * Maps state names to GitHub Gist raw URLs for per-state GeoJSON files
 */

import gistMapping from './historical-mapping.json';

export interface StateGistMapping {
  [mapType: string]: {
    [stateName: string]: string;
  };
}

const mapping = gistMapping as StateGistMapping;

/**
 * Load state gist mapping (returns the static mapping immediately)
 */
export async function loadStateGistMapping(): Promise<StateGistMapping | null> {
  return mapping;
}

/**
 * Get available states for a given map type
 */
export function getAvailableStates(mapping: StateGistMapping | null, mapType: string): string[] {
  if (!mapping || !mapping[mapType]) {
    return [];
  }
  return Object.keys(mapping[mapType]).sort();
}

/**
 * Get the GeoJSON URL for a specific state and map type
 */
export function getStateGeoJSONUrl(
  mapping: StateGistMapping | null,
  mapType: string,
  stateName: string
): string | null {
  if (!mapping || !mapping[mapType] || !mapping[mapType][stateName]) {
    return null;
  }
  return mapping[mapType][stateName];
}
