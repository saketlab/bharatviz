/**
 * Pure GeoJSON -> PolygonFeature conversion, generalized from the inline
 * Polygon/MultiPolygon handling in IndiaDistrictsMap.tsx (calculateBounds,
 * convertCoordinatesToPath) so it can be reused outside that component.
 */
import type { PolygonFeature } from '@/components/DeckPolygonsLayer';

export interface GeoJSONFeatureLike {
  type: string;
  properties: Record<string, string | number | undefined | null>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

/** Normalizes a Polygon/MultiPolygon geometry's coordinates into the
 * `number[][][][]` shape PolygonFeature.polygons expects (list of polygons,
 * each a list of rings, each an array of [lng,lat] pairs). */
export function geometryToPolygons(geometry: GeoJSONFeatureLike['geometry']): number[][][][] {
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates as number[][][][];
  }
  return [geometry.coordinates as number[][][]];
}

export function geoJsonFeatureToPolygonFeature(
  feature: GeoJSONFeatureLike,
  nameProp: string,
  stateProp: string
): PolygonFeature {
  const name = feature.properties[nameProp];
  return {
    polygons: geometryToPolygons(feature.geometry),
    name: name != null ? String(name) : null,
    properties: {
      ...feature.properties,
      [stateProp]: feature.properties[stateProp] ?? null,
    } as Record<string, string | number | null>,
  };
}

export function geoJsonToPolygonFeatures(
  geojson: { features: GeoJSONFeatureLike[] },
  nameProp = 'district_name',
  stateProp = 'state_name'
): PolygonFeature[] {
  return geojson.features.map(f => geoJsonFeatureToPolygonFeature(f, nameProp, stateProp));
}

function extendBounds(bounds: Bounds, coords: number[] | number[][]): void {
  if (Array.isArray(coords[0])) {
    (coords as number[][]).forEach(c => extendBounds(bounds, c));
  } else {
    const [lng, lat] = coords as number[];
    bounds.minLng = Math.min(bounds.minLng, lng);
    bounds.maxLng = Math.max(bounds.maxLng, lng);
    bounds.minLat = Math.min(bounds.minLat, lat);
    bounds.maxLat = Math.max(bounds.maxLat, lat);
  }
}

/** Union of bounds across N geojsons - needed because Compare mode projects
 * 2-3 sources into one shared coordinate frame, not just one source's extent. */
export function computeBoundsFromFeatureSets(
  featureSets: { features: GeoJSONFeatureLike[] }[]
): Bounds {
  const bounds: Bounds = { minLng: Infinity, maxLng: -Infinity, minLat: Infinity, maxLat: -Infinity };
  for (const set of featureSets) {
    for (const feature of set.features) {
      for (const polygon of geometryToPolygons(feature.geometry)) {
        for (const ring of polygon) {
          extendBounds(bounds, ring);
        }
      }
    }
  }
  return bounds;
}
