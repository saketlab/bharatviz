import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ColorScale } from '../types/index.js';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { getD3ColorInterpolator } from '../utils/discreteColorUtils.js';
import { isColorDark, roundToSignificantDigits, escapeHtml } from '../utils/colorUtils.js';
import polylabel from 'polylabel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface CityMapRequest {
  cityId: string;
  data: Array<{ ward: string; value: number }>;
  colorScale?: ColorScale;
  invertColors?: boolean;
  hideWardNames?: boolean;
  hideValues?: boolean;
  mainTitle?: string;
  legendTitle?: string;
  darkMode?: boolean;
  colorBarSettings?: {
    mode: 'continuous' | 'discrete';
    binCount?: number;
    customBoundaries?: number[];
  };
  formats?: Array<'png' | 'svg' | 'pdf'>;
}

interface Bounds {
  minX: number; maxX: number; minY: number; maxY: number;
}

function calculateBounds(geojson: FeatureCollection): Bounds {
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
      const geom = feature.geometry as { coordinates: unknown };
      processCoords(geom.coordinates);
    }
  }
  return { minX, maxX, minY, maxY };
}

function projectCoordinate(lon: number, lat: number, bounds: Bounds, width: number, height: number, padding = 40): [number, number] {
  const mapWidth = width - padding * 2;
  const mapHeight = height - padding * 2 - 60; // 60px reserved for title (top) and legend (bottom)
  const scale = Math.min(mapWidth / (bounds.maxX - bounds.minX), mapHeight / (bounds.maxY - bounds.minY));
  const offsetX = padding + (mapWidth - (bounds.maxX - bounds.minX) * scale) / 2;
  const offsetY = padding + 40 + (mapHeight - (bounds.maxY - bounds.minY) * scale) / 2; // 40px title
  return [
    offsetX + (lon - bounds.minX) * scale,
    offsetY + (bounds.maxY - lat) * scale,
  ];
}

function convertCoordinatesToPath(coordinates: unknown, bounds: Bounds, width: number, height: number): string {
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

function calculateVisualCenter(coordinates: unknown, type: string): [number, number] | null {
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

const geojsonCache = new Map<string, FeatureCollection>();

async function loadCityGeoJSON(cityId: string): Promise<FeatureCollection> {
  if (geojsonCache.has(cityId)) return geojsonCache.get(cityId)!;
  const filePath = join(__dirname, '../../public/cities', `${cityId}.geojson`);
  try {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as FeatureCollection;
    geojsonCache.set(cityId, data);
    return data;
  } catch {
    const response = await fetch(`https://bharatviz.org/cities/${cityId}.geojson`);
    if (!response.ok) throw new Error(`City not found: "${cityId}". Use GET /api/v1/cities to list available city IDs.`);
    const data = await response.json() as FeatureCollection;
    geojsonCache.set(cityId, data);
    return data;
  }
}

export class CityMapRenderer {
  async listWards(cityId: string): Promise<string[]> {
    const geojson = await loadCityGeoJSON(cityId);
    return geojson.features
      .map(f => String(f.properties?.ward_name || '').trim())
      .filter(Boolean)
      .sort();
  }

  async renderMap(request: CityMapRequest): Promise<string> {
    const {
      cityId,
      data,
      colorScale = 'spectral',
      invertColors = false,
      hideWardNames = true,
      hideValues = true,
      mainTitle = 'BharatViz',
      legendTitle = 'Values',
      darkMode = false,
    } = request;

    const geojson = await loadCityGeoJSON(cityId);

    // Some cities have non-unique or blank ward_name; fall back to "Ward <number>" when
    // fewer than half the features have distinct names.
    const names = geojson.features.map(f => (String(f.properties?.ward_name || '')).toLowerCase().trim());
    const uniqueNames = new Set(names.filter(Boolean));
    if (uniqueNames.size < geojson.features.length * 0.5) {
      for (const feature of geojson.features) {
        const wn = (String(feature.properties?.ward_name || '')).trim().toLowerCase();
        if (!wn || wn === 'na' || wn === 'n/a' || wn === 'm_ward') {
          const props = feature.properties as Record<string, unknown>;
          const num = props?.ward_number ?? props?.wardcode;
          if (num != null) props.ward_name = `Ward ${num}`;
        }
      }
    }

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    const valueMap = new Map<string, number>();
    for (const d of data) {
      valueMap.set(d.ward.toLowerCase().trim(), d.value);
    }

    const bounds = calculateBounds(geojson);
    const width = 800;
    const height = 900;

    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    const svg = d3.select(document.body)
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('font-family', 'Arial, Helvetica, sans-serif')
      .style('background-color', darkMode ? '#000000' : '#ffffff');

    svg.append('rect').attr('x', 0).attr('y', 0).attr('width', width).attr('height', height).attr('fill', darkMode ? '#000000' : 'white');

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '18px')
      .attr('font-weight', 'bold')
      .attr('fill', darkMode ? '#ffffff' : '#0f172a')
      .text(escapeHtml(mainTitle));

    const mapGroup = svg.append('g').attr('class', 'map-content');
    const interpolator = getD3ColorInterpolator(colorScale);

    for (const feature of geojson.features) {
      const wardName = String(feature.properties?.ward_name || '').toLowerCase().trim();
      const value = valueMap.get(wardName);

      const fillColor = value !== undefined
        ? interpolator(invertColors ? 1 - (value - minValue) / (maxValue - minValue) : (value - minValue) / (maxValue - minValue))
        : (darkMode ? '#1a1a1a' : '#e5e7eb');

      const strokeColor = (!isColorDark(fillColor))
        ? (darkMode ? '#ffffff' : '#374151')
        : '#ffffff';

      let pathData = '';
      if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
        const geom = feature.geometry as Polygon | MultiPolygon;
        pathData = convertCoordinatesToPath(geom.coordinates, bounds, width, height);
      }

      const pathEl = mapGroup.append('path')
        .attr('d', pathData)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 0.5);

      const displayName = String(feature.properties?.ward_name || '');
      if (displayName) {
        pathEl.append('title').text(value !== undefined ? `${displayName}: ${roundToSignificantDigits(value)}` : displayName);
      }
    }

    if (!hideWardNames || !hideValues) {
      for (const feature of geojson.features) {
        const wardName = String(feature.properties?.ward_name || '').toLowerCase().trim();
        const value = valueMap.get(wardName);
        if (value === undefined) continue;

        const geom = feature.geometry as Polygon | MultiPolygon;
        const center = calculateVisualCenter(geom.coordinates, feature.geometry.type);
        if (!center) continue;

        const [x, y] = projectCoordinate(center[0], center[1], bounds, width, height);
        const fillColor = interpolator(invertColors ? 1 - (value - minValue) / (maxValue - minValue) : (value - minValue) / (maxValue - minValue));
        const textColor = isColorDark(fillColor) ? '#ffffff' : '#0f172a';

        let tspans = '';
        let dy = 0;
        if (!hideWardNames) { tspans += `<tspan x="${x}" dy="${dy}">${escapeHtml(String(feature.properties?.ward_name || ''))}</tspan>`; dy = 12; }
        if (!hideValues) { tspans += `<tspan x="${x}" dy="${dy}">${roundToSignificantDigits(value)}</tspan>`; }

        if (tspans) {
          const textEl = mapGroup.append('text')
            .attr('x', x).attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '8px')
            .attr('font-weight', '600')
            .attr('fill', textColor)
            .style('pointer-events', 'none');
          const node = textEl.node();
          if (node) node.innerHTML = tspans;
        }
      }
    }

    const legendY = height - 80;
    const legendX = 40;
    const legendWidth = 200;
    const legendHeight = 12;

    const defs = svg.append('defs');
    const gradientId = 'legendGradient';
    const gradient = defs.append('linearGradient').attr('id', gradientId).attr('x1', '0%').attr('x2', '100%');
    const stops = invertColors ? [0, 0.25, 0.5, 0.75, 1].map(t => ({ offset: t, color: interpolator(1 - t) }))
                               : [0, 0.25, 0.5, 0.75, 1].map(t => ({ offset: t, color: interpolator(t) }));
    for (const s of stops) {
      gradient.append('stop').attr('offset', `${s.offset * 100}%`).attr('stop-color', s.color);
    }

    svg.append('rect').attr('x', legendX).attr('y', legendY).attr('width', legendWidth).attr('height', legendHeight)
      .attr('fill', `url(#${gradientId})`).attr('rx', 2);

    const textFill = darkMode ? '#ffffff' : '#374151';
    svg.append('text').attr('x', legendX).attr('y', legendY - 8).attr('font-size', '11px').attr('fill', textFill).text(escapeHtml(legendTitle));
    svg.append('text').attr('x', legendX).attr('y', legendY + legendHeight + 14).attr('font-size', '10px').attr('fill', textFill).text(roundToSignificantDigits(minValue).toString());
    svg.append('text').attr('x', legendX + legendWidth).attr('y', legendY + legendHeight + 14).attr('font-size', '10px').attr('text-anchor', 'end').attr('fill', textFill).text(roundToSignificantDigits(maxValue).toString());

    return document.body.innerHTML;
  }
}
