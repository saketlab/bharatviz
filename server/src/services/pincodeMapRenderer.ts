import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { ColorScale } from '../types/index.js';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { getD3ColorInterpolator } from '../utils/discreteColorUtils.js';
import { isColorDark, roundToSignificantDigits, escapeHtml } from '../utils/colorUtils.js';
import { calculateBounds, projectCoordinate, convertCoordinatesToPath, calculateVisualCenter } from '../utils/geoProjection.js';
import { ALL_INDIA_STATE } from '../utils/constants.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ALL_INDIA_GEOJSON = 'https://geo.bharatviz.org/geojsons/pincodes/India_pincodes_simplified.geojson';

export interface PincodeMapRequest {
  data: Array<{ pincode: string; value: number }>;
  state?: string;
  colorScale?: ColorScale;
  invertColors?: boolean;
  hidePincodeLabels?: boolean;
  hideValues?: boolean;
  mainTitle?: string;
  legendTitle?: string;
  darkMode?: boolean;
  formats?: Array<'png' | 'svg' | 'pdf'>;
}

const PINCODE_GIST_MAP: Record<string, string> = {
  "Andaman & Nicobar": "https://geo.bharatviz.org/geojsons/pincodes/andaman_nicobar.geojson",
  "Andhra Pradesh": "https://geo.bharatviz.org/geojsons/pincodes/andhra_pradesh.geojson",
  "Arunachal Pradesh": "https://geo.bharatviz.org/geojsons/pincodes/arunachal_pradesh.geojson",
  "Assam": "https://geo.bharatviz.org/geojsons/pincodes/assam.geojson",
  "Bihar": "https://geo.bharatviz.org/geojsons/pincodes/bihar.geojson",
  "Chandigarh": "https://geo.bharatviz.org/geojsons/pincodes/chandigarh.geojson",
  "Chhattisgarh": "https://geo.bharatviz.org/geojsons/pincodes/chhattisgarh.geojson",
  "Dadar Nagar& Haveli": "https://geo.bharatviz.org/geojsons/pincodes/dadar_nagar_haveli.geojson",
  "Daman & Diu": "https://geo.bharatviz.org/geojsons/pincodes/daman_diu.geojson",
  "Delhi": "https://geo.bharatviz.org/geojsons/pincodes/delhi.geojson",
  "Goa": "https://geo.bharatviz.org/geojsons/pincodes/goa.geojson",
  "Gujarat": "https://geo.bharatviz.org/geojsons/pincodes/gujarat.geojson",
  "Haryana": "https://geo.bharatviz.org/geojsons/pincodes/haryana.geojson",
  "Himachal Pradesh": "https://geo.bharatviz.org/geojsons/pincodes/himachal_pradesh.geojson",
  "Jharkhand": "https://geo.bharatviz.org/geojsons/pincodes/jharkhand.geojson",
  "Karnataka": "https://geo.bharatviz.org/geojsons/pincodes/karnataka.geojson",
  "Kerala": "https://geo.bharatviz.org/geojsons/pincodes/kerala.geojson",
  "Lakshadweep": "https://geo.bharatviz.org/geojsons/pincodes/lakshadweep.geojson",
  "Madhya Pradesh": "https://geo.bharatviz.org/geojsons/pincodes/madhya_pradesh.geojson",
  "Maharashtra": "https://geo.bharatviz.org/geojsons/pincodes/maharashtra.geojson",
  "Manipur": "https://geo.bharatviz.org/geojsons/pincodes/manipur.geojson",
  "Meghalaya": "https://geo.bharatviz.org/geojsons/pincodes/meghalaya.geojson",
  "Mizoram": "https://geo.bharatviz.org/geojsons/pincodes/mizoram.geojson",
  "Nagaland": "https://geo.bharatviz.org/geojsons/pincodes/nagaland.geojson",
  "Orissa": "https://geo.bharatviz.org/geojsons/pincodes/orissa.geojson",
  "Puducherry": "https://geo.bharatviz.org/geojsons/pincodes/puducherry.geojson",
  "Punjab": "https://geo.bharatviz.org/geojsons/pincodes/punjab.geojson",
  "Rajasthan": "https://geo.bharatviz.org/geojsons/pincodes/rajasthan.geojson",
  "Sikkim": "https://geo.bharatviz.org/geojsons/pincodes/sikkim.geojson",
  "Tamil Nadu": "https://geo.bharatviz.org/geojsons/pincodes/tamil_nadu.geojson",
  "Telangana": "https://geo.bharatviz.org/geojsons/pincodes/telangana.geojson",
  "Tripura": "https://geo.bharatviz.org/geojsons/pincodes/tripura.geojson",
  "Union Territory of Jammu and Kashmir": "https://geo.bharatviz.org/geojsons/pincodes/union_territory_of_jammu_and_kashmir.geojson",
  "Union Territory of Ladakh": "https://geo.bharatviz.org/geojsons/pincodes/union_territory_of_ladakh.geojson",
  "Uttar Pradesh": "https://geo.bharatviz.org/geojsons/pincodes/uttar_pradesh.geojson",
  "Uttarakhand": "https://geo.bharatviz.org/geojsons/pincodes/uttarakhand.geojson",
  "West Bengal": "https://geo.bharatviz.org/geojsons/pincodes/west_bengal.geojson",
};

import { LRUCache } from '../utils/lruCache.js';

const geojsonCache = new LRUCache<string, FeatureCollection>(15);

function getPublicDir(): string {
  return join(__dirname, '../../public');
}

async function loadGeoJSON(key: string): Promise<FeatureCollection> {
  if (geojsonCache.has(key)) return geojsonCache.get(key)!;
  let data: FeatureCollection;
  if (key.startsWith('http')) {
    const response = await fetch(key);
    if (!response.ok) throw new Error(`Failed to fetch GeoJSON from ${key}: ${response.status}`);
    data = await response.json() as FeatureCollection;
  } else {
    const raw = await readFile(join(getPublicDir(), key), 'utf-8');
    data = JSON.parse(raw) as FeatureCollection;
  }
  geojsonCache.set(key, data);
  return data;
}

export class PincodeMapRenderer {

  getAvailableStates(): string[] {
    return [ALL_INDIA_STATE, ...Object.keys(PINCODE_GIST_MAP).sort()];
  }

  private async loadForState(state?: string): Promise<FeatureCollection> {
    if (!state || state.toLowerCase().trim() === ALL_INDIA_STATE.toLowerCase()) {
      return loadGeoJSON(ALL_INDIA_GEOJSON);
    }
    const url = this.resolveGistUrl(state);
    if (!url) throw new Error(`Unknown state: "${state}". Use list_pincode_states to see available states.`);
    return loadGeoJSON(url);
  }

  async listPincodes(state?: string): Promise<Array<{ pincode: string; office_name: string; district: string }>> {
    const geojson = await this.loadForState(state);
    const results: Array<{ pincode: string; office_name: string; district: string }> = [];
    for (const feature of geojson.features) {
      const props = feature.properties || {};
      const pincode = String(props.pincode || '').trim();
      if (!pincode) continue;
      results.push({
        pincode,
        office_name: String(props.office_name || '').trim(),
        district: String(props.district_name || '').trim(),
      });
    }
    return results.sort((a, b) => a.pincode.localeCompare(b.pincode));
  }

  async renderMap(request: PincodeMapRequest): Promise<string> {
    const {
      data,
      state,
      colorScale = 'spectral',
      invertColors = false,
      hidePincodeLabels = true,
      hideValues = true,
      mainTitle = 'BharatViz',
      legendTitle = 'Values',
      darkMode = false,
    } = request;

    const geojson = await this.loadForState(state);

    let minValue = Infinity;
    let maxValue = -Infinity;
    for (const d of data) {
      if (d.value < minValue) minValue = d.value;
      if (d.value > maxValue) maxValue = d.value;
    }

    const valueMap = new Map<string, number>();
    for (const d of data) {
      valueMap.set(d.pincode.trim(), d.value);
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
    const range = maxValue - minValue || 1;

    for (const feature of geojson.features) {
      const pincode = String(feature.properties?.pincode || '').trim();
      const value = valueMap.get(pincode);

      const t = value !== undefined ? (value - minValue) / range : undefined;
      const fillColor = t !== undefined
        ? interpolator(invertColors ? 1 - t : t)
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
        .attr('stroke-width', 0.3);

      const officeName = String(feature.properties?.office_name || '');
      const tooltip = value !== undefined
        ? `${pincode} (${officeName}): ${roundToSignificantDigits(value)}`
        : `${pincode} (${officeName})`;
      pathEl.append('title').text(tooltip);
    }

    if (!hidePincodeLabels || !hideValues) {
      for (const feature of geojson.features) {
        const pincode = String(feature.properties?.pincode || '').trim();
        const value = valueMap.get(pincode);
        if (value === undefined) continue;

        const geom = feature.geometry as Polygon | MultiPolygon;
        if (!geom?.coordinates) continue;

        const center = calculateVisualCenter(geom.coordinates, feature.geometry.type);
        if (!center) continue;
        const [cx, cy] = projectCoordinate(center[0], center[1], bounds, width, height);

        const t = (value - minValue) / range;
        const fillColor = interpolator(invertColors ? 1 - t : t);
        const textColor = isColorDark(fillColor) ? '#ffffff' : '#0f172a';

        let tspans = '';
        let dy = 0;
        if (!hidePincodeLabels) { tspans += `<tspan x="${cx}" dy="${dy}">${escapeHtml(pincode)}</tspan>`; dy = 10; }
        if (!hideValues) { tspans += `<tspan x="${cx}" dy="${dy}">${roundToSignificantDigits(value)}</tspan>`; }

        if (tspans) {
          const textEl = mapGroup.append('text')
            .attr('x', cx).attr('y', cy)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', '6px')
            .attr('font-weight', '600')
            .attr('fill', textColor)
            .style('pointer-events', 'none');
          const node = textEl.node();
          if (node) node.innerHTML = tspans;
        }
      }
    }

    // Legend
    const legendY = height - 80;
    const legendX = 40;
    const legendWidth = 200;
    const legendHeight = 12;

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient').attr('id', 'legendGradient').attr('x1', '0%').attr('x2', '100%');
    const stops = [0, 0.25, 0.5, 0.75, 1].map(t => ({
      offset: t,
      color: interpolator(invertColors ? 1 - t : t),
    }));
    for (const s of stops) {
      gradient.append('stop').attr('offset', `${s.offset * 100}%`).attr('stop-color', s.color);
    }

    svg.append('rect').attr('x', legendX).attr('y', legendY).attr('width', legendWidth).attr('height', legendHeight)
      .attr('fill', 'url(#legendGradient)').attr('rx', 2);

    const textFill = darkMode ? '#ffffff' : '#374151';
    svg.append('text').attr('x', legendX).attr('y', legendY - 8).attr('font-size', '11px').attr('fill', textFill).text(escapeHtml(legendTitle));
    svg.append('text').attr('x', legendX).attr('y', legendY + legendHeight + 14).attr('font-size', '10px').attr('fill', textFill).text(roundToSignificantDigits(minValue).toString());
    svg.append('text').attr('x', legendX + legendWidth).attr('y', legendY + legendHeight + 14).attr('font-size', '10px').attr('text-anchor', 'end').attr('fill', textFill).text(roundToSignificantDigits(maxValue).toString());

    return document.body.innerHTML;
  }

  private resolveGistUrl(state: string): string | null {
    // Exact match first
    if (PINCODE_GIST_MAP[state]) return PINCODE_GIST_MAP[state];
    // Case-insensitive match
    const lower = state.toLowerCase().trim();
    for (const [key, url] of Object.entries(PINCODE_GIST_MAP)) {
      if (key.toLowerCase().trim() === lower) return url;
    }
    return null;
  }
}
