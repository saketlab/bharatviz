import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { StatesMapRenderer } from './services/mapRenderer.js';
import { DistrictsMapRenderer } from './services/districtsMapRenderer.js';
import { PincodeMapRenderer } from './services/pincodeMapRenderer.js';
import { CityMapRenderer } from './services/cityMapRenderer.js';
import type { ColorScale } from './types/index.js';
import { ExportService } from './services/exportService.js';
import { queryEvolution, getDistrictGeoJSON, getDistrictNames, ensureLoaded as ensureEvolutionLoaded } from './services/districtEvolutionService.js';
import type { FeatureCollection } from 'geojson';
import { LRUCache } from './utils/lruCache.js';

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
  /** GeoJSON property name for the sub-unit label (defaults to "district_name") */
  featureNameProp?: string;
}

const R2 = 'https://geo.bharatviz.org';
const CENSUS = `${R2}/geojsons/census`;
const DIST = `${R2}/geojsons/districts`;

export const MAP_REGISTRY: Record<string, MapEntry> = {
  // Census boundaries
  'census-1872-states': { id: 'census-1872-states', file: `${CENSUS}/India-1872-states.geojson`, level: 'states', source: 'Census 1872', year: 1872, description: 'State boundaries from the 1872 Census of India' },
  'census-1872-districts': { id: 'census-1872-districts', file: `${CENSUS}/India-1872-districts.geojson`, level: 'districts', source: 'Census 1872', year: 1872, description: 'District boundaries from the 1872 Census of India', statesFile: `${CENSUS}/India-1872-states.geojson` },
  'census-1881-states': { id: 'census-1881-states', file: `${CENSUS}/India-1881-states.geojson`, level: 'states', source: 'Census 1881', year: 1881, description: 'State boundaries from the 1881 Census of India' },
  'census-1881-districts': { id: 'census-1881-districts', file: `${CENSUS}/India-1881-districts.geojson`, level: 'districts', source: 'Census 1881', year: 1881, description: 'District boundaries from the 1881 Census of India', statesFile: `${CENSUS}/India-1881-states.geojson` },
  'census-1891-states': { id: 'census-1891-states', file: `${CENSUS}/India-1891-states.geojson`, level: 'states', source: 'Census 1891', year: 1891, description: 'State boundaries from the 1891 Census of India' },
  'census-1891-districts': { id: 'census-1891-districts', file: `${CENSUS}/India-1891-districts.geojson`, level: 'districts', source: 'Census 1891', year: 1891, description: 'District boundaries from the 1891 Census of India', statesFile: `${CENSUS}/India-1891-states.geojson` },
  'census-1901-states': { id: 'census-1901-states', file: `${CENSUS}/India-1901-states.geojson`, level: 'states', source: 'Census 1901', year: 1901, description: 'State boundaries from the 1901 Census of India' },
  'census-1901-districts': { id: 'census-1901-districts', file: `${CENSUS}/India-1901-districts.geojson`, level: 'districts', source: 'Census 1901', year: 1901, description: 'District boundaries from the 1901 Census of India', statesFile: `${CENSUS}/India-1901-states.geojson` },
  'census-1911-states': { id: 'census-1911-states', file: `${CENSUS}/India-1911-states.geojson`, level: 'states', source: 'Census 1911', year: 1911, description: 'State boundaries from the 1911 Census of India' },
  'census-1911-districts': { id: 'census-1911-districts', file: `${CENSUS}/India-1911-districts.geojson`, level: 'districts', source: 'Census 1911', year: 1911, description: 'District boundaries from the 1911 Census of India', statesFile: `${CENSUS}/India-1911-states.geojson` },
  'census-1921-states': { id: 'census-1921-states', file: `${CENSUS}/India-1921-states.geojson`, level: 'states', source: 'Census 1921', year: 1921, description: 'State boundaries from the 1921 Census of India' },
  'census-1921-districts': { id: 'census-1921-districts', file: `${CENSUS}/India-1921-districts.geojson`, level: 'districts', source: 'Census 1921', year: 1921, description: 'District boundaries from the 1921 Census of India', statesFile: `${CENSUS}/India-1921-states.geojson` },
  'census-1931-states': { id: 'census-1931-states', file: `${CENSUS}/India-1931-states.geojson`, level: 'states', source: 'Census 1931', year: 1931, description: 'State boundaries from the 1931 Census of India' },
  'census-1931-districts': { id: 'census-1931-districts', file: `${CENSUS}/India-1931-districts.geojson`, level: 'districts', source: 'Census 1931', year: 1931, description: 'District boundaries from the 1931 Census of India', statesFile: `${CENSUS}/India-1931-states.geojson` },
  'census-1941-states': { id: 'census-1941-states', file: `${CENSUS}/India-1941-states.geojson`, level: 'states', source: 'Census 1941', year: 1941, description: 'State boundaries from the 1941 Census of India' },
  'census-1941-districts': { id: 'census-1941-districts', file: `${CENSUS}/India-1941-districts.geojson`, level: 'districts', source: 'Census 1941', year: 1941, description: 'District boundaries from the 1941 Census of India', statesFile: `${CENSUS}/India-1941-states.geojson` },
  'census-1951-states': { id: 'census-1951-states', file: `${CENSUS}/India-1951-states.geojson`, level: 'states', source: 'Census 1951', year: 1951, description: 'State boundaries from the 1951 Census of India' },
  'census-1951-districts': { id: 'census-1951-districts', file: `${CENSUS}/India-1951-districts.geojson`, level: 'districts', source: 'Census 1951', year: 1951, description: 'District boundaries from the 1951 Census of India', statesFile: `${CENSUS}/India-1951-states.geojson` },
  'census-1961-states': { id: 'census-1961-states', file: `${CENSUS}/India-1961-states.geojson`, level: 'states', source: 'Census 1961', year: 1961, description: 'State boundaries from the 1961 Census of India' },
  'census-1961-districts': { id: 'census-1961-districts', file: `${CENSUS}/India-1961-districts.geojson`, level: 'districts', source: 'Census 1961', year: 1961, description: 'District boundaries from the 1961 Census of India', statesFile: `${CENSUS}/India-1961-states.geojson` },
  'census-1971-states': { id: 'census-1971-states', file: `${CENSUS}/India-1971-states.geojson`, level: 'states', source: 'Census 1971', year: 1971, description: 'State boundaries from the 1971 Census of India' },
  'census-1971-districts': { id: 'census-1971-districts', file: `${CENSUS}/India-1971-districts.geojson`, level: 'districts', source: 'Census 1971', year: 1971, description: 'District boundaries from the 1971 Census of India', statesFile: `${CENSUS}/India-1971-states.geojson` },
  'census-1981-states': { id: 'census-1981-states', file: `${CENSUS}/India-1981-states.geojson`, level: 'states', source: 'Census 1981', year: 1981, description: 'State boundaries from the 1981 Census of India' },
  'census-1981-districts': { id: 'census-1981-districts', file: `${CENSUS}/India-1981-districts.geojson`, level: 'districts', source: 'Census 1981', year: 1981, description: 'District boundaries from the 1981 Census of India', statesFile: `${CENSUS}/India-1981-states.geojson` },
  'census-1991-states': { id: 'census-1991-states', file: `${CENSUS}/India-1991-states.geojson`, level: 'states', source: 'Census 1991', year: 1991, description: 'State boundaries from the 1991 Census of India' },
  'census-1991-districts': { id: 'census-1991-districts', file: `${CENSUS}/India-1991-districts.geojson`, level: 'districts', source: 'Census 1991', year: 1991, description: 'District boundaries from the 1991 Census of India', statesFile: `${CENSUS}/India-1991-states.geojson` },
  'census-2001-states': { id: 'census-2001-states', file: `${CENSUS}/India-2001-states.geojson`, level: 'states', source: 'Census 2001', year: 2001, description: 'State boundaries from the 2001 Census of India' },
  'census-2001-districts': { id: 'census-2001-districts', file: `${CENSUS}/India-2001-districts.geojson`, level: 'districts', source: 'Census 2001', year: 2001, description: 'District boundaries from the 2001 Census of India', statesFile: `${CENSUS}/India-2001-states.geojson` },
  'census-2011-states': { id: 'census-2011-states', file: `${CENSUS}/India-2011-states.geojson`, level: 'states', source: 'Census 2011', year: 2011, description: 'State boundaries from the 2011 Census of India' },
  'census-2011-districts': { id: 'census-2011-districts', file: `${CENSUS}/India-2011-districts.geojson`, level: 'districts', source: 'Census 2011', year: 2011, description: 'District boundaries from the 2011 Census of India', statesFile: `${CENSUS}/India-2011-states.geojson` },

  // Official boundaries (LGD - Local Government Directory)
  'lgd-states': { id: 'lgd-states', file: `${DIST}/India_LGD_states.geojson`, level: 'states', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official state boundaries from the Local Government Directory' },
  'lgd-districts': { id: 'lgd-districts', file: `${DIST}/India_LGD_districts.geojson`, level: 'districts', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official district boundaries from the Local Government Directory', statesFile: `${DIST}/India_LGD_states.geojson` },

  // Survey boundaries (NFHS)
  'nfhs4-states': { id: 'nfhs4-states', file: `${DIST}/India_NFHS4_states_simplified.geojson`, level: 'states', source: 'NFHS-4 (2015-16)', year: 2016, description: 'State boundaries from NFHS-4 survey (2015-16)' },
  'nfhs4-districts': { id: 'nfhs4-districts', file: `${DIST}/India_NFHS4_districts_simplified.geojson`, level: 'districts', source: 'NFHS-4 (2015-16)', year: 2016, description: 'District boundaries from NFHS-4 survey (2015-16)', statesFile: `${DIST}/India_NFHS4_states_simplified.geojson` },
  'nfhs5-states': { id: 'nfhs5-states', file: `${DIST}/India_NFHS5_states_simplified.geojson`, level: 'states', source: 'NFHS-5 (2019-21)', year: 2021, description: 'State boundaries from NFHS-5 survey (2019-21)' },
  'nfhs5-districts': { id: 'nfhs5-districts', file: `${DIST}/India_NFHS5_districts_simplified.geojson`, level: 'districts', source: 'NFHS-5 (2019-21)', year: 2021, description: 'District boundaries from NFHS-5 survey (2019-21)', statesFile: `${DIST}/India_NFHS5_states_simplified.geojson` },

  // Survey of India
  'soi-states': { id: 'soi-states', file: `${DIST}/India-soi-states.geojson`, level: 'states', source: 'Survey of India', year: 2020, description: 'State boundaries from the Survey of India' },
  'soi-districts': { id: 'soi-districts', file: `${DIST}/India-soi-districts.geojson`, level: 'districts', source: 'Survey of India', year: 2020, description: 'District boundaries from the Survey of India', statesFile: `${DIST}/India-soi-states.geojson` },

  // ISRO Bhuvan
  'bhuvan-states': { id: 'bhuvan-states', file: `${DIST}/India-bhuvan-states.geojson`, level: 'states', source: 'ISRO Bhuvan', year: 2020, description: 'State boundaries from ISRO Bhuvan satellite data' },
  'bhuvan-districts': { id: 'bhuvan-districts', file: `${DIST}/India-bhuvan-districts.geojson`, level: 'districts', source: 'ISRO Bhuvan', year: 2020, description: 'District boundaries from ISRO Bhuvan satellite data', statesFile: `${DIST}/India-bhuvan-states.geojson` },

  // NSSO Regions
  'nsso-regions': { id: 'nsso-regions', file: `${DIST}/India_NFHS5_NSSO_regions_boundaries.geojson`, level: 'regions', source: 'NSSO', year: 2021, description: 'NSSO regional boundaries based on NFHS-5', featureNameProp: 'nss_region' },

  // Sub-administrative boundaries
  'lgd-subdistricts': { id: 'lgd-subdistricts', file: `${R2}/geojsons/admin/India-geodata-lgd-subdistricts.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'LGD subdistrict (tehsil/taluka) boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'subdistrict_name' },
  'soi-subdistricts': { id: 'soi-subdistricts', file: `${R2}/geojsons/admin/India-geodata-soi-subdistricts.geojson`, level: 'districts', source: 'Survey of India', year: 2020, description: 'Survey of India subdistrict boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-soi-states.geojson`, featureNameProp: 'subdistrict_name' },
  'lgd-blocks': { id: 'lgd-blocks', file: `${R2}/geojsons/admin/India-geodata-lgd-blocks.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'LGD block-level boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'block_name' },
  'bhuvan-blocks': { id: 'bhuvan-blocks', file: `${R2}/geojsons/admin/India-geodata-bhuvan-blocks.geojson`, level: 'districts', source: 'ISRO Bhuvan', year: 2020, description: 'NRSC Bhuvan block-level boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-bhuvan-states.geojson`, featureNameProp: 'block_name' },
  'pmgsy-blocks': { id: 'pmgsy-blocks', file: `${R2}/geojsons/admin/India-geodata-pmgsy-blocks.geojson`, level: 'districts', source: 'PMGSY', year: 2024, description: 'PMGSY (Pradhan Mantri Gram Sadak Yojana) block boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'block_name' },
  'shrug-subdistricts': { id: 'shrug-subdistricts', file: `${R2}/geojsons/admin/India-shrug-subdistrict-pc11_simplified.geojson`, level: 'districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 subdistrict polygons from the SHRUG platform (Asher, Lunt, Matsuura & Novosad). License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'subdistrict_name' },

  // Electoral boundaries
  'lgd-parliament': { id: 'lgd-parliament', file: `${R2}/geojsons/electoral/India-geodata-lgd-parliament.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'Lok Sabha parliamentary constituency boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'lgd-assembly': { id: 'lgd-assembly', file: `${R2}/geojsons/electoral/India-geodata-lgd-assembly.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'Vidhan Sabha assembly constituency boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'susewind-parliament-2014': { id: 'susewind-parliament-2014', file: `${R2}/geojsons/electoral/India-susewind-parliament-2014_simplified.geojson`, level: 'districts', source: 'Susewind (2014)', year: 2014, description: 'Lok Sabha constituency boundaries as used in the 2014 general election, digitised by Raphael Susewind. License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'susewind-assembly-2014': { id: 'susewind-assembly-2014', file: `${R2}/geojsons/electoral/India-susewind-assembly-2014_simplified.geojson`, level: 'districts', source: 'Susewind (2014)', year: 2014, description: 'Vidhan Sabha constituency boundaries as used in elections around 2014, digitised by Raphael Susewind. License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },

  // SHRUG districts
  'shrug-districts': { id: 'shrug-districts', file: `${R2}/geojsons/districts/India-shrug-district-pc11_simplified.geojson`, level: 'districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 district polygons from the SHRUG platform (Asher, Lunt, Matsuura & Novosad). License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson` },

  // Environment boundaries
  'gs-wildlife': { id: 'gs-wildlife', file: `${R2}/geojsons/environment/India-geodata-wildlife.geojson`, level: 'regions', source: 'GatiShakti', year: 2024, description: 'Protected wildlife sanctuaries and national parks', featureNameProp: 'area_name' },
  'bm-eco-zones': { id: 'bm-eco-zones', file: `${R2}/geojsons/environment/India-geodata-eco-zones.geojson`, level: 'regions', source: 'GatiShakti', year: 2024, description: 'Biological / eco-sensitive zone boundaries', featureNameProp: 'area_name' },
  'fsi-circles': { id: 'fsi-circles', file: `${R2}/geojsons/environment/India-fsi-circles_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative circles — top-level forest administrative unit', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'circle_name' },
  'fsi-divisions': { id: 'fsi-divisions', file: `${R2}/geojsons/environment/India-fsi-divisions_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative divisions, within circles', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'division_name' },
  'fsi-ranges': { id: 'fsi-ranges', file: `${R2}/geojsons/environment/India-fsi-ranges_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative ranges, within divisions', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'range_name' },

  // Urban boundaries
  'sbm-ulbs': { id: 'sbm-ulbs', file: `${R2}/geojsons/urban/India-sbm-ulbs_simplified.geojson`, level: 'districts', source: 'SBM', year: 2024, description: 'Urban Local Body boundaries from the Swachh Bharat Mission — national coverage (most states)', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'ulb_name' },
};

/** GeoJSON cache to avoid reloading large files */
const geojsonCache = new LRUCache<string, FeatureCollection>(50);

async function loadGeoJSON(url: string): Promise<FeatureCollection> {
  if (geojsonCache.has(url)) return geojsonCache.get(url)!;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch GeoJSON from ${url}: ${response.status}`);
  const data = await response.json() as FeatureCollection;
  geojsonCache.set(url, data);
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
  private pincodeRenderer = new PincodeMapRenderer();
  private cityRenderer = new CityMapRenderer();

  private async formatOutput(
    svgString: string,
    outputFormat: 'png' | 'svg' | 'both' = 'png',
  ): Promise<{ svg?: string; png?: string }> {
    const result: { svg?: string; png?: string } = {};
    if (outputFormat === 'svg' || outputFormat === 'both') result.svg = svgString;
    if (outputFormat === 'png' || outputFormat === 'both') result.png = await this.exportService.svgToPNG(svgString);
    return result;
  }

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

    const nameProp = entry.featureNameProp || 'district_name';
    const data = await loadGeoJSON(entry.file);
    const results: Array<{ state: string; district: string }> = [];
    for (const feature of data.features) {
      const stateName = String(feature.properties?.state_name || '').trim();
      const districtName = String(feature.properties?.[nameProp] || '').trim();
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
      const nameProp = entry.featureNameProp || 'district_name';
      const districts = await this.listDistricts(mapId);
      const hasState = districts.some(d => d.state);
      const lines = [hasState ? `state,${nameProp},value` : `${nameProp},value`];
      for (const d of districts) {
        lines.push(hasState ? `${d.state},${d.district},` : `${d.district},`);
      }
      return lines.join('\n');
    }
  }

  /** Render a state-level map */
  async renderStatesMap(options: {
    data: Array<{ state: string; value: number }>;
    mapId?: string;
    colorScale?: string;
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
    await renderer.loadGeoJSONFromPath(entry.file);

    // Fuzzy-match user-provided state names to GeoJSON names
    const geojsonStates = await this.listStates(mapId);
    const resolvedData = options.data.map(d => {
      const matched = fuzzyMatchName(d.state, geojsonStates);
      return { state: matched || d.state, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideStateNames: options.hideStateNames ?? false,
      hideValues: options.hideValues ?? false,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  /** Render a district-level map */
  async renderDistrictsMap(options: {
    data: Array<{ state: string; district: string; value: number }>;
    mapId?: string;
    state?: string;
    colorScale?: string;
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
    await renderer.loadGeoJSONFromPaths(entry.file, entry.statesFile);

    // Fuzzy-match user-provided names to GeoJSON names
    const allDistricts = await this.listDistricts(mapId);
    const geojsonStates = [...new Set(allDistricts.map(d => d.state).filter(Boolean))];
    const isStateless = geojsonStates.length === 0; // layers like eco-zones have no state_name
    const allFeatureNames = isStateless ? allDistricts.map(d => d.district) : [];
    const districtsByState = new Map<string, string[]>();
    if (!isStateless) {
      for (const d of allDistricts) {
        const key = d.state.toLowerCase().trim();
        if (!districtsByState.has(key)) districtsByState.set(key, []);
        districtsByState.get(key)!.push(d.district);
      }
    }

    const resolvedData = options.data.map(d => {
      if (isStateless) {
        const matchedDistrict = fuzzyMatchName(d.district, allFeatureNames) || d.district;
        return { state: '', district: matchedDistrict, value: d.value };
      }
      const matchedState = fuzzyMatchName(d.state, geojsonStates) || d.state;
      const stateDistricts = districtsByState.get(matchedState.toLowerCase().trim()) || [];
      const matchedDistrict = fuzzyMatchName(d.district, stateDistricts) || d.district;
      return { state: matchedState, district: matchedDistrict, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData.map(d => ({ state: d.state, district: d.district, value: d.value })),
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideDistrictNames: options.hideDistrictNames ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      showStateBoundaries: options.showStateBoundaries ?? true,
      state: options.state ? (fuzzyMatchName(options.state, geojsonStates) || options.state) : undefined,
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
      featureNameProp: entry.featureNameProp || 'district_name',
    });

    return this.formatOutput(svgString, options.outputFormat);
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

  // ── Pincode Tools ──────────────────────────────────────────────────────

  listPincodeStates(): string[] {
    return this.pincodeRenderer.getAvailableStates();
  }

  async listPincodes(state?: string): Promise<Array<{ pincode: string; office_name: string; district: string }>> {
    return this.pincodeRenderer.listPincodes(state);
  }

  async renderPincodesMap(options: {
    data: Array<{ pincode: string; value: number }>;
    state?: string;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hidePincodeLabels?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const svgString = await this.pincodeRenderer.renderMap({
      data: options.data,
      state: options.state,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hidePincodeLabels: options.hidePincodeLabels ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  // ── City/Ward Tools ────────────────────────────────────────────────────

  private citiesManifestCache: Array<{ id: string; displayName: string; state: string; type: string; featureCount: number }> | null = null;

  async listCities(): Promise<Array<{ id: string; displayName: string; state: string; type: string; featureCount: number }>> {
    if (!this.citiesManifestCache) {
      const manifestPath = join(__dirname, '../public/city-datasets-manifest.json');
      const raw = await readFile(manifestPath, 'utf-8');
      this.citiesManifestCache = JSON.parse(raw);
    }
    return this.citiesManifestCache!;
  }

  async listWards(cityId: string): Promise<string[]> {
    return this.cityRenderer.listWards(cityId);
  }

  async renderCityMap(options: {
    cityId: string;
    data: Array<{ ward: string; value: number }>;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideWardNames?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const svgString = await this.cityRenderer.renderMap({
      cityId: options.cityId,
      data: options.data,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideWardNames: options.hideWardNames ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  // ── District Evolution Tools ───────────────────────────────────────────

  async listHistoricalDistrictNames(): Promise<Array<{ district: string; state: string }>> {
    await ensureEvolutionLoaded();
    return getDistrictNames();
  }

  async traceDistrictEvolution(params: {
    district: string;
    state?: string;
    year?: number;
    includeGeojson?: boolean;
  }) {
    const result = await queryEvolution({
      district: params.district,
      state: params.state,
      year: params.year,
    });

    if (!params.includeGeojson) return result;

    const enriched = {
      ...result,
      matches: await Promise.all(result.matches.map(async (match) => {
        const evolution: Record<string, Array<{ state: string; district: string; geojson?: object | null }>> = {};
        for (const [yearStr, entries] of Object.entries(match.evolution)) {
          const year = parseInt(yearStr, 10);
          evolution[yearStr] = await Promise.all(
            entries.map(async (entry) => ({
              ...entry,
              geojson: await getDistrictGeoJSON({ district: entry.district, state: entry.state, year }),
            }))
          );
        }
        return { ...match, evolution };
      })),
    };

    return enriched;
  }
}
