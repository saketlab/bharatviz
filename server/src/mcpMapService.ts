import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StatesMapRenderer } from './services/mapRenderer.js';
import { DistrictsMapRenderer } from './services/districtsMapRenderer.js';
import { ExportService } from './services/exportService.js';
import type { ColorScale } from './types/index.js';
import type { FeatureCollection } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MapEntry {
  id: string;
  file: string;
  level: 'states' | 'districts' | 'regions';
  source: string;
  year: number;
  description: string;
  /** For district maps, the corresponding states GeoJSON for boundary overlays */
  statesFile?: string;
}

export const MAP_REGISTRY: Record<string, MapEntry> = {
  // Census boundaries
  'census-1941-states': { id: 'census-1941-states', file: 'India-1941-states.geojson', level: 'states', source: 'Census 1941', year: 1941, description: 'State boundaries from the 1941 Census of India' },
  'census-1941-districts': { id: 'census-1941-districts', file: 'India-1941-districts.geojson', level: 'districts', source: 'Census 1941', year: 1941, description: 'District boundaries from the 1941 Census of India', statesFile: 'India-1941-states.geojson' },
  'census-1951-states': { id: 'census-1951-states', file: 'India-1951-states.geojson', level: 'states', source: 'Census 1951', year: 1951, description: 'State boundaries from the 1951 Census of India' },
  'census-1951-districts': { id: 'census-1951-districts', file: 'India-1951-districts.geojson', level: 'districts', source: 'Census 1951', year: 1951, description: 'District boundaries from the 1951 Census of India', statesFile: 'India-1951-states.geojson' },
  'census-1961-states': { id: 'census-1961-states', file: 'India-1961-states.geojson', level: 'states', source: 'Census 1961', year: 1961, description: 'State boundaries from the 1961 Census of India' },
  'census-1961-districts': { id: 'census-1961-districts', file: 'India-1961-districts.geojson', level: 'districts', source: 'Census 1961', year: 1961, description: 'District boundaries from the 1961 Census of India', statesFile: 'India-1961-states.geojson' },
  'census-1971-states': { id: 'census-1971-states', file: 'India-1971-states.geojson', level: 'states', source: 'Census 1971', year: 1971, description: 'State boundaries from the 1971 Census of India' },
  'census-1971-districts': { id: 'census-1971-districts', file: 'India-1971-districts.geojson', level: 'districts', source: 'Census 1971', year: 1971, description: 'District boundaries from the 1971 Census of India', statesFile: 'India-1971-states.geojson' },
  'census-1981-states': { id: 'census-1981-states', file: 'India-1981-states.geojson', level: 'states', source: 'Census 1981', year: 1981, description: 'State boundaries from the 1981 Census of India' },
  'census-1981-districts': { id: 'census-1981-districts', file: 'India-1981-districts.geojson', level: 'districts', source: 'Census 1981', year: 1981, description: 'District boundaries from the 1981 Census of India', statesFile: 'India-1981-states.geojson' },
  'census-1991-states': { id: 'census-1991-states', file: 'India-1991-states.geojson', level: 'states', source: 'Census 1991', year: 1991, description: 'State boundaries from the 1991 Census of India' },
  'census-1991-districts': { id: 'census-1991-districts', file: 'India-1991-districts.geojson', level: 'districts', source: 'Census 1991', year: 1991, description: 'District boundaries from the 1991 Census of India', statesFile: 'India-1991-states.geojson' },
  'census-2001-states': { id: 'census-2001-states', file: 'India-2001-states.geojson', level: 'states', source: 'Census 2001', year: 2001, description: 'State boundaries from the 2001 Census of India' },
  'census-2001-districts': { id: 'census-2001-districts', file: 'India-2001-districts.geojson', level: 'districts', source: 'Census 2001', year: 2001, description: 'District boundaries from the 2001 Census of India', statesFile: 'India-2001-states.geojson' },
  'census-2011-states': { id: 'census-2011-states', file: 'India-2011-states.geojson', level: 'states', source: 'Census 2011', year: 2011, description: 'State boundaries from the 2011 Census of India' },
  'census-2011-districts': { id: 'census-2011-districts', file: 'India-2011-districts.geojson', level: 'districts', source: 'Census 2011', year: 2011, description: 'District boundaries from the 2011 Census of India', statesFile: 'India-2011-states.geojson' },

  // Official boundaries (LGD - Local Government Directory)
  'lgd-states': { id: 'lgd-states', file: 'India_LGD_states.geojson', level: 'states', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official state boundaries from the Local Government Directory' },
  'lgd-districts': { id: 'lgd-districts', file: 'India_LGD_districts.geojson', level: 'districts', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official district boundaries from the Local Government Directory', statesFile: 'India_LGD_states.geojson' },

  // Survey boundaries (NFHS)
  'nfhs4-states': { id: 'nfhs4-states', file: 'India_NFHS4_states_simplified.geojson', level: 'states', source: 'NFHS-4 (2015-16)', year: 2016, description: 'State boundaries from NFHS-4 survey (2015-16)' },
  'nfhs4-districts': { id: 'nfhs4-districts', file: 'India_NFHS4_districts_simplified.geojson', level: 'districts', source: 'NFHS-4 (2015-16)', year: 2016, description: 'District boundaries from NFHS-4 survey (2015-16)', statesFile: 'India_NFHS4_states_simplified.geojson' },
  'nfhs5-states': { id: 'nfhs5-states', file: 'India_NFHS5_states_simplified.geojson', level: 'states', source: 'NFHS-5 (2019-21)', year: 2021, description: 'State boundaries from NFHS-5 survey (2019-21)' },
  'nfhs5-districts': { id: 'nfhs5-districts', file: 'India_NFHS5_districts_simplified.geojson', level: 'districts', source: 'NFHS-5 (2019-21)', year: 2021, description: 'District boundaries from NFHS-5 survey (2019-21)', statesFile: 'India_NFHS5_states_simplified.geojson' },

  // Survey of India
  'soi-states': { id: 'soi-states', file: 'India-soi-states.geojson', level: 'states', source: 'Survey of India', year: 2020, description: 'State boundaries from the Survey of India' },
  'soi-districts': { id: 'soi-districts', file: 'India-soi-districts.geojson', level: 'districts', source: 'Survey of India', year: 2020, description: 'District boundaries from the Survey of India', statesFile: 'India-soi-states.geojson' },

  // ISRO Bhuvan
  'bhuvan-states': { id: 'bhuvan-states', file: 'India-bhuvan-states.geojson', level: 'states', source: 'ISRO Bhuvan', year: 2020, description: 'State boundaries from ISRO Bhuvan satellite data' },
  'bhuvan-districts': { id: 'bhuvan-districts', file: 'India-bhuvan-districts.geojson', level: 'districts', source: 'ISRO Bhuvan', year: 2020, description: 'District boundaries from ISRO Bhuvan satellite data', statesFile: 'India-bhuvan-states.geojson' },

  // NSSO Regions
  'nsso-regions': { id: 'nsso-regions', file: 'India_NFHS5_NSSO_regions_boundaries.geojson', level: 'regions', source: 'NSSO', year: 2021, description: 'NSSO regional boundaries based on NFHS-5' },
};

/** Resolve the public/ directory containing GeoJSON files */
function getPublicDir(): string {
  return join(__dirname, '../public');
}

/** GeoJSON cache to avoid reloading large files */
const geojsonCache = new Map<string, FeatureCollection>();

async function loadGeoJSON(filename: string): Promise<FeatureCollection> {
  if (geojsonCache.has(filename)) {
    return geojsonCache.get(filename)!;
  }
  const filePath = join(getPublicDir(), filename);
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content) as FeatureCollection;
  geojsonCache.set(filename, data);
  return data;
}

/** Levenshtein distance between two strings (two-row optimization) */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Find the best fuzzy match for `input` among `candidates`. Returns null if no good match. */
function fuzzyMatchName(input: string, candidates: string[]): string | null {
  const norm = input.toLowerCase().trim();
  const normalized = candidates.map(c => c.toLowerCase().trim());

  const exactIdx = normalized.indexOf(norm);
  if (exactIdx !== -1) return candidates[exactIdx];

  const maxDist = Math.max(1, Math.floor(norm.length * 0.3));
  let bestMatch: string | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < normalized.length; i++) {
    const dist = levenshtein(norm, normalized[i]);
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestMatch = candidates[i];
    }
  }
  return bestMatch;
}

export class McpMapService {
  private exportService = new ExportService();

  /** List all available maps with metadata */
  async listMaps(): Promise<Array<MapEntry & { featureCount: number }>> {
    const results = [];
    for (const entry of Object.values(MAP_REGISTRY)) {
      try {
        const data = await loadGeoJSON(entry.file);
        results.push({ ...entry, featureCount: data.features.length });
      } catch {
        results.push({ ...entry, featureCount: 0 });
      }
    }
    return results;
  }

  /** List state names for a given map */
  async listStates(mapId: string): Promise<string[]> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);

    const data = await loadGeoJSON(entry.file);
    const states = new Set<string>();
    for (const feature of data.features) {
      const name = String(feature.properties?.state_name || '').trim();
      if (name) states.add(name);
    }
    return Array.from(states).sort();
  }

  /** List districts for a given map, optionally filtered by state */
  async listDistricts(mapId: string, state?: string): Promise<Array<{ state: string; district: string }>> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);
    if (entry.level === 'states') throw new Error(`Map ${mapId} is a state-level map. Use a district-level map ID instead.`);

    const data = await loadGeoJSON(entry.file);
    const results: Array<{ state: string; district: string }> = [];
    for (const feature of data.features) {
      const stateName = String(feature.properties?.state_name || '').trim();
      const districtName = String(feature.properties?.district_name || '').trim();
      if (!districtName) continue;
      if (state && stateName.toLowerCase() !== state.toLowerCase()) continue;
      results.push({ state: stateName, district: districtName });
    }
    return results.sort((a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district));
  }

  /** Generate CSV template for a given map */
  async getCsvTemplate(mapId: string): Promise<string> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);

    if (entry.level === 'states') {
      const states = await this.listStates(mapId);
      const lines = ['state,value'];
      for (const state of states) {
        lines.push(`${state},`);
      }
      return lines.join('\n');
    } else {
      const districts = await this.listDistricts(mapId);
      const lines = ['state,district,value'];
      for (const d of districts) {
        lines.push(`${d.state},${d.district},`);
      }
      return lines.join('\n');
    }
  }

  /** Render a state-level map */
  async renderStatesMap(options: {
    data: Array<{ state: string; value: number }>;
    mapId?: string;
    colorScale?: ColorScale;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideStateNames?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const mapId = options.mapId || 'lgd-states';
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}`);
    if (entry.level !== 'states') throw new Error(`Map ${mapId} is not a state-level map.`);

    const renderer = new StatesMapRenderer();
    const geojsonPath = join(getPublicDir(), entry.file);
    await renderer.loadGeoJSONFromPath(geojsonPath);

    // Fuzzy-match user-provided state names to GeoJSON names
    const geojsonStates = await this.listStates(mapId);
    const resolvedData = options.data.map(d => {
      const matched = fuzzyMatchName(d.state, geojsonStates);
      return { state: matched || d.state, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData,
      colorScale: options.colorScale ?? 'spectral',
      invertColors: options.invertColors ?? false,
      hideStateNames: options.hideStateNames ?? false,
      hideValues: options.hideValues ?? false,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
    });

    const result: { svg?: string; png?: string } = {};
    const format = options.outputFormat || 'png';

    if (format === 'svg' || format === 'both') {
      result.svg = svgString;
    }
    if (format === 'png' || format === 'both') {
      result.png = await this.exportService.svgToPNG(svgString);
    }

    return result;
  }

  /** Render a district-level map */
  async renderDistrictsMap(options: {
    data: Array<{ state: string; district: string; value: number }>;
    mapId?: string;
    state?: string;
    colorScale?: ColorScale;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideDistrictNames?: boolean;
    hideValues?: boolean;
    showStateBoundaries?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const mapId = options.mapId || 'lgd-districts';
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}`);
    if (entry.level === 'states') throw new Error(`Map ${mapId} is a state-level map. Use a district-level map ID.`);

    const renderer = new DistrictsMapRenderer();
    const districtsPath = join(getPublicDir(), entry.file);
    const statesPath = entry.statesFile ? join(getPublicDir(), entry.statesFile) : undefined;
    await renderer.loadGeoJSONFromPaths(districtsPath, statesPath);

    // Fuzzy-match user-provided names to GeoJSON names
    const allDistricts = await this.listDistricts(mapId);
    const geojsonStates = [...new Set(allDistricts.map(d => d.state))];
    const districtsByState = new Map<string, string[]>();
    for (const d of allDistricts) {
      const key = d.state.toLowerCase().trim();
      if (!districtsByState.has(key)) districtsByState.set(key, []);
      districtsByState.get(key)!.push(d.district);
    }

    const resolvedData = options.data.map(d => {
      const matchedState = fuzzyMatchName(d.state, geojsonStates) || d.state;
      const stateDistricts = districtsByState.get(matchedState.toLowerCase().trim()) || [];
      const matchedDistrict = fuzzyMatchName(d.district, stateDistricts) || d.district;
      return { state: matchedState, district: matchedDistrict, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData.map(d => ({ state: d.state, district: d.district, value: d.value })),
      colorScale: options.colorScale || 'spectral',
      invertColors: options.invertColors ?? false,
      hideDistrictNames: options.hideDistrictNames ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      showStateBoundaries: options.showStateBoundaries ?? true,
      state: options.state ? (fuzzyMatchName(options.state, geojsonStates) || options.state) : undefined,
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
    });

    const result: { svg?: string; png?: string } = {};
    const format = options.outputFormat || 'png';

    if (format === 'svg' || format === 'both') {
      result.svg = svgString;
    }
    if (format === 'png' || format === 'both') {
      result.png = await this.exportService.svgToPNG(svgString);
    }

    return result;
  }

  /** Load showcase demo URLs JSON */
  private async loadDemoUrls(): Promise<Record<string, { url: string; title: string }>> {
    const jsonPath = join(__dirname, '../../src/lib/showcase-demo-urls.json');
    const raw = await readFile(jsonPath, 'utf-8');
    return JSON.parse(raw);
  }

  /** List all available showcase demo datasets */
  async listDemos(level?: 'states' | 'districts'): Promise<Array<{ id: string; title: string; level: string; url: string }>> {
    const demos = await this.loadDemoUrls();
    return Object.entries(demos)
      .filter(([key]) => !level || key.startsWith(level + '_'))
      .map(([key, { url, title }]) => ({
        id: key,
        title,
        level: key.startsWith('districts_') ? 'districts' : 'states',
        url,
      }));
  }

  /** Generate a shareable BharatViz URL for a given demo */
  async getDemoUrl(demoId: string, baseUrl?: string): Promise<{ shareableUrl: string; title: string; csvUrl: string }> {
    const demos = await this.loadDemoUrls();
    const demo = demos[demoId];
    if (!demo) {
      const available = Object.keys(demos).join(', ');
      throw new Error(`Unknown demo ID: "${demoId}". Available: ${available}`);
    }
    const base = (baseUrl || 'https://bharatviz.com').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('dataUrl', demo.url);
    params.set('title', demo.title);
    return {
      shareableUrl: `${base}/?${params.toString()}`,
      title: demo.title,
      csvUrl: demo.url,
    };
  }
}
