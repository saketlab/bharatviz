import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { ColorScale } from '../types/index.js';
import type { FeatureCollection, Polygon, MultiPolygon } from 'geojson';
import { getD3ColorInterpolator } from '../utils/discreteColorUtils.js';
import { isColorDark, roundToSignificantDigits, escapeHtml } from '../utils/colorUtils.js';

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

interface Bounds {
  minX: number; maxX: number; minY: number; maxY: number;
}

const PINCODE_GIST_MAP: Record<string, string> = {
  "Andaman & Nicobar": "https://gist.githubusercontent.com/saketkc/7da1df4ce5f09b9570316004f96992f3/raw/c4cb12e0af8d9151e2442161770d2ac6ad396209/bharatviz_pincodes_Andaman_and_Nicobar.geojson",
  "Andhra Pradesh": "https://gist.githubusercontent.com/saketkc/e221d9bac893f668fb5a7c8e4f3c53f8/raw/03d5b8f3383fd6de29030f65657af7f54f9322c1/bharatviz_pincodes_Andhra_Pradesh.geojson",
  "Arunachal Pradesh": "https://gist.githubusercontent.com/saketkc/0853fbf441ad97e28f4fc9351c501e07/raw/83372760017671e8cb8ccc445f13e8fae4553e57/bharatviz_pincodes_Arunachal_Pradesh.geojson",
  "Assam": "https://gist.githubusercontent.com/saketkc/b08b4f39e9910bd6e67bf21c61600d1b/raw/e58d9fb8508de56f6c8cbc08c8d2bcc0b536bd93/bharatviz_pincodes_Assam.geojson",
  "Bihar": "https://gist.githubusercontent.com/saketkc/a888ce32f1b59e424bb118d51cdfb3ef/raw/698f34c079418561a7bb2d35e6d10818fc695d50/bharatviz_pincodes_Bihar.geojson",
  "Chandigarh": "https://gist.githubusercontent.com/saketkc/619a34118563a21f6b35a48c125c68de/raw/acdba68fd58fa9e190723cd52426672f44cd567c/bharatviz_pincodes_Chandigarh.geojson",
  "Chhattisgarh": "https://gist.githubusercontent.com/saketkc/62a6792244d6fb4a6a41313d65ea6429/raw/fdbf07583102277ffcaa123cc3c44870eaf1aca0/bharatviz_pincodes_Chhattisgarh.geojson",
  "Dadar Nagar& Haveli": "https://gist.githubusercontent.com/saketkc/5587f315cee626e57ae30739b611ff6c/raw/6474227b0df4b97f91bef147978fce9d50e5e353/bharatviz_pincodes_Dadar_Nagarand_Haveli.geojson",
  "Daman & Diu": "https://gist.githubusercontent.com/saketkc/89006577b948cbca72ccf1b6b42535d8/raw/1253ae16acf665c2a42e0efd9f92d78a5a6d62ed/bharatviz_pincodes_Daman_and_Diu.geojson",
  "Delhi": "https://gist.githubusercontent.com/saketkc/be660f995cfb1c9fd80fa206bb242327/raw/9602cbd0d48e420ae6befd37c1cc5bcb86a6a8bb/bharatviz_pincodes_Delhi.geojson",
  "Goa": "https://gist.githubusercontent.com/saketkc/fd3313e572c3be4cd3f44905140df603/raw/c86c43417b66c6c39cd9fe264ad85795ab168884/bharatviz_pincodes_Goa.geojson",
  "Gujarat": "https://gist.githubusercontent.com/saketkc/44b9c7331ae44ecaa0c7c03945a8c8c0/raw/aa56979cdcfca8a55d042724af6e5299043f7ffb/bharatviz_pincodes_Gujarat.geojson",
  "Haryana": "https://gist.githubusercontent.com/saketkc/b5eb43d9da802b4235c9abd3e0bc9711/raw/39c36553a08849b7cb6bb3a2bf32ac3f1e9a24bc/bharatviz_pincodes_Haryana.geojson",
  "Himachal Pradesh": "https://gist.githubusercontent.com/saketkc/793269d88f287b35b8a9d1c5eefba8e0/raw/26ee613fffb41b45c1c16ab2671d953d436ab852/bharatviz_pincodes_Himachal_Pradesh.geojson",
  "Jharkhand": "https://gist.githubusercontent.com/saketkc/92c29824aa7eb93f09b10cc5ee50b619/raw/5df5f80574e8f8972341d9f67612205fd2db5059/bharatviz_pincodes_Jharkhand.geojson",
  "Karnataka": "https://gist.githubusercontent.com/saketkc/11992739692a6564ec67650c62f3cee0/raw/15b71ac0b96d31a7b9829fbc67becfbe231b21cb/bharatviz_pincodes_Karnataka.geojson",
  "Kerala": "https://gist.githubusercontent.com/saketkc/45426550aa181bc94af671b1dbc22e8a/raw/75534ce977b0c6f93fe907c451b5e9fe7927e396/bharatviz_pincodes_Kerala.geojson",
  "Lakshadweep": "https://gist.githubusercontent.com/saketkc/a790f966090773c8dff3431dd39ff445/raw/c5325825ec7b25c3c6137a5b58d04c598920d6c6/bharatviz_pincodes_Lakshadweep.geojson",
  "Madhya Pradesh": "https://gist.githubusercontent.com/saketkc/4a4a97267366a5b39d04d85bae8e9542/raw/ee0bfbc2427eace99fb21af5c8d0b88ea78aa541/bharatviz_pincodes_Madhya_Pradesh.geojson",
  "Maharashtra": "https://gist.githubusercontent.com/saketkc/2e3977f75f4b3797cd5b101c7f455e1b/raw/2072bc39fd58e3dd1047b73c8eacbbb380d9a80c/bharatviz_pincodes_Maharashtra.geojson",
  "Manipur": "https://gist.githubusercontent.com/saketkc/d08f0562efaaee409583808bb0fd0f85/raw/c657983716ec9c0654700d81e5e7d0f096e1a6cc/bharatviz_pincodes_Manipur.geojson",
  "Meghalaya": "https://gist.githubusercontent.com/saketkc/230fece3e94b4da92e209bb0e3533f29/raw/a447d70f0a83f72315488a65218ae5f6284461ec/bharatviz_pincodes_Meghalaya.geojson",
  "Mizoram": "https://gist.githubusercontent.com/saketkc/ec61d1a0d8e9d7f6a28bcd5a0ed3432a/raw/c81cdad07b84736528284a8b2d5c75877fecca1c/bharatviz_pincodes_Mizoram.geojson",
  "Nagaland": "https://gist.githubusercontent.com/saketkc/4b0bf4a5b99f1b33d444c94ef056c376/raw/8d009fc1ed2ca6c6a0c8a409c4bcef024765d757/bharatviz_pincodes_Nagaland.geojson",
  "Orissa": "https://gist.githubusercontent.com/saketkc/fddb0281f4cb8e65bb39adb23666044d/raw/b7ce02682dff27de6e1e5973732688640ad2be82/bharatviz_pincodes_Orissa.geojson",
  "Puducherry": "https://gist.githubusercontent.com/saketkc/063bd20ca82b7c526938b5718236b08a/raw/4ad84e9b9d5d83950ca50d5abe57da07e6aab0d0/bharatviz_pincodes_Puducherry.geojson",
  "Punjab": "https://gist.githubusercontent.com/saketkc/57ac1103dff884a3a56adcbde83c6888/raw/f2d99df03cb5b092b1418e93f374d84ea8a1c0e4/bharatviz_pincodes_Punjab.geojson",
  "Rajasthan": "https://gist.githubusercontent.com/saketkc/3cc75bbcee2b622e77ad9dac27df96fa/raw/4d10fe4f8d3f2ef093f6eb5a434a61db4256f3d1/bharatviz_pincodes_Rajasthan.geojson",
  "Sikkim": "https://gist.githubusercontent.com/saketkc/cbe5cc5ee4da9e4649f84a1242b640b8/raw/ec4ffdea0e3d22a4c58f9070483b4744750b1f31/bharatviz_pincodes_Sikkim.geojson",
  "Tamil Nadu": "https://gist.githubusercontent.com/saketkc/827c6d0c4245d63f4eafb319791082c5/raw/6e27aee71cc298947c6a40d821d01721fe056c0b/bharatviz_pincodes_Tamil_Nadu.geojson",
  "Telangana": "https://gist.githubusercontent.com/saketkc/87322e7a4a3ab9753d2b856cbae020af/raw/7051533d7f3fea38cf77da66502a291f409b440c/bharatviz_pincodes_Telangana.geojson",
  "Tripura": "https://gist.githubusercontent.com/saketkc/f2a4d38ae883d17ae8b38a9036ecd76f/raw/68ccd34918795efaa21918d9459743b74597b81d/bharatviz_pincodes_Tripura.geojson",
  "Union Territory of Jammu and Kashmir": "https://gist.githubusercontent.com/saketkc/3edd42585c7e2b353ddafd39ed485449/raw/706418fe70756b99bb612c9fe269c26384f01bb0/bharatviz_pincodes_Union_Territory_of_Jammu_and_Kashmir.geojson",
  "Union Territory of Ladakh": "https://gist.githubusercontent.com/saketkc/e586a3e36059e88b193c0d5390124438/raw/9afb490135b05b15942b2e6500f0858043746a1e/bharatviz_pincodes_Union_Territory_of_Ladakh.geojson",
  "Uttar Pradesh": "https://gist.githubusercontent.com/saketkc/ef4bfecdbac2df041e0174d871682fcd/raw/5d2e1591c54bcc042ad34ff5a092f1953cbb396c/bharatviz_pincodes_Uttar_Pradesh.geojson",
  "Uttarakhand": "https://gist.githubusercontent.com/saketkc/5d3d40802e4a80ff55b0e83ef07413e7/raw/cf044809e1c6c4bc128129caf64b5072dbedbb74/bharatviz_pincodes_Uttarakhand.geojson",
  "West Bengal": "https://gist.githubusercontent.com/saketkc/2bcfff1265cfba1d49e017b68724a566/raw/682f7de271e79d7a61334b0552ecdc19d66f3caa/bharatviz_pincodes_West_Bengal.geojson",
};

const geojsonCache = new Map<string, FeatureCollection>();

async function fetchGeoJSON(url: string): Promise<FeatureCollection> {
  if (geojsonCache.has(url)) return geojsonCache.get(url)!;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch GeoJSON from ${url}: ${response.status}`);
  const data = await response.json() as FeatureCollection;
  geojsonCache.set(url, data);
  return data;
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
      processCoords((feature.geometry as { coordinates: unknown }).coordinates);
    }
  }
  return { minX, maxX, minY, maxY };
}

function projectCoordinate(lon: number, lat: number, bounds: Bounds, width: number, height: number, padding = 40): [number, number] {
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

export class PincodeMapRenderer {

  getAvailableStates(): string[] {
    return Object.keys(PINCODE_GIST_MAP).sort();
  }

  async listPincodes(state: string): Promise<Array<{ pincode: string; office_name: string; district: string }>> {
    const url = this.resolveGistUrl(state);
    if (!url) throw new Error(`Unknown state: "${state}". Use list_pincode_states to see available states.`);
    const geojson = await fetchGeoJSON(url);
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

    if (!state) throw new Error('state is required for pincode maps. Use list_pincode_states to see available states.');
    const url = this.resolveGistUrl(state);
    if (!url) throw new Error(`Unknown state: "${state}". Use list_pincode_states to see available states.`);

    const geojson = await fetchGeoJSON(url);

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

        // Simple centroid
        const coords: number[][] = [];
        const collect = (c: unknown) => {
          if (!Array.isArray(c)) return;
          if (typeof c[0] === 'number') { coords.push(c as number[]); return; }
          for (const sub of c) collect(sub);
        };
        collect(geom.coordinates);
        if (coords.length === 0) continue;

        let sumX = 0, sumY = 0;
        for (const [x, y] of coords) { sumX += x; sumY += y; }
        const [cx, cy] = projectCoordinate(sumX / coords.length, sumY / coords.length, bounds, width, height);

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
