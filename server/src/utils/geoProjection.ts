import type { FeatureCollection } from 'geojson';
import polylabel from 'polylabel';

export interface Bounds {
  minX: number; maxX: number; minY: number; maxY: number;
}

export function calculateBounds(geojson: FeatureCollection): Bounds {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const processCoord = (coord: number[]) => {
    minX = Math.min(minX, coord[0]);
    maxX = Math.max(maxX, coord[0]);
    minY = Math.min(minY, coord[1]);
    maxY = Math.max(maxY, coord[1]);
  };
  const processCoords = (coords: unknown): void => {
    if (Array.isArray(coords[0])) {
      (coords as unknown[][]).forEach(c => processCoords(c));
    } else {
      processCoord(coords as number[]);
    }
  };
  for (const feature of geojson.features) {
    if (feature.geometry) {
      processCoords((feature.geometry as { coordinates: unknown }).coordinates);
    }
  }
  return { minX, maxX, minY, maxY };
}

export function projectCoordinate(lon: number, lat: number, bounds: Bounds, width: number, height: number, padding = 40): [number, number] {
  const mapWidth = width - padding * 2;
  const mapHeight = height - padding * 2 - 60;
  const scale = Math.min(mapWidth / (bounds.maxX - bounds.minX), mapHeight / (bounds.maxY - bounds.minY));
  const offsetX = padding + (mapWidth - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = padding + 40 + (mapHeight - (bounds.maxY - bounds.minY) * scale) / 2;
  return [
    offsetX + (lon - bounds.minX) * scale,
    offsetY + (bounds.maxY - lat) * scale,
  ];
}

export function convertCoordinatesToPath(coordinates: unknown, bounds: Bounds, width: number, height: number): string {
  const convertRing = (ring: number[][]): string =>
    ring.map((coord, i) => {
      const [x, y] = projectCoordinate(coord[0], coord[1], bounds, width, height);
      return `${i === 0 ? '' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');

  if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]) && Array.isArray(coordinates[0][0][0])) {
    return (coordinates as number[][][][]).map(polygon =>
      polygon.map(ring => `M ${convertRing(ring)} Z`).join(' ')
    ).join(' ');
  } else if (Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0])) {
    return (coordinates as number[][][]).map(ring => `M ${convertRing(ring)} Z`).join(' ');
  }
  return '';
}

export function calculateVisualCenter(coordinates: unknown, type: string): [number, number] | null {
  try {
    if (type === 'Polygon') {
      const center = polylabel(coordinates as number[][][], 1.0);
      return [center[0], center[1]];
    } else if (type === 'MultiPolygon') {
      const multiCoords = coordinates as number[][][][];
      let largestPolygon: number[][][] | null = null;
      let largestArea = 0;
      for (const polygon of multiCoords) {
        const ring = polygon[0];
        let area = 0;
        for (let i = 0; i < ring.length - 1; i++) {
          area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
        }
        area = Math.abs(area) / 2;
        if (area > largestArea) { largestArea = area; largestPolygon = polygon; }
      }
      if (largestPolygon) {
        const center = polylabel(largestPolygon, 1.0);
        return [center[0], center[1]];
      }
    }
  } catch { /* degenerate geometry */ }
  return null;
}
