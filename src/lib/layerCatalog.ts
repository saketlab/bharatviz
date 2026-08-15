import { fetchGeoJSON } from './geoJsonCache';
import { getDistrictMapConfig, getDistrictMapTypesList } from './districtMapConfig';
import {
  SUB_ADMIN_LAYERS, ELECTORAL_LAYERS, ENVIRONMENT_LAYERS, URBAN_LAYERS,
  getSubAdminLayer, getElectoralLayer, getEnvironmentLayer, getUrbanLayer,
  type GeoDataLayer,
} from './geodataLayerConfig';
import { CITY_DATASETS, type CityDataset } from './cityMapConfig';
import {
  loadVillageMapping, getVillageSources, getVillagePolygonStates, getVillagePolygonUrl,
  type VillageSource,
} from './villagePolygonMapping';
import type { GeoJSONFeatureLike } from './geojsonToPolygonFeature';

const R2 = 'https://geo.bharatviz.org';

export type LayerGroup = 'districts' | 'sub-admin' | 'electoral' | 'environment' | 'urban' | 'cities' | 'villages';

export interface LayerCatalogEntry {
  id: string;
  group: LayerGroup;
  displayName: string;
  description?: string;
  scope: 'national' | 'per-city' | 'per-state';
  scopeKey?: string; // city id for 'per-city'; village source id for 'per-state'
}

export const LAYER_GROUPS: { group: LayerGroup; label: string }[] = [
  { group: 'districts', label: 'Districts' },
  { group: 'sub-admin', label: 'Sub-Admin' },
  { group: 'electoral', label: 'Electoral' },
  { group: 'environment', label: 'Environment' },
  { group: 'urban', label: 'Urban' },
  { group: 'cities', label: 'Cities' },
  { group: 'villages', label: 'Villages' },
];

// A missing sentinel makes buildDiffFeatures group layers without state properties together.
const NO_STATE_PROP = '__no_state__';

// Compare uses simplified 70–240MB sources; other tabs still require the catalog's full-resolution URLs.
const COMPARE_URL_OVERRIDES: Record<string, string> = {
  lgd_subdistricts: `${R2}/geojsons/admin/India-geodata-lgd-subdistricts_simplified.geojson`,
  soi_subdistricts: `${R2}/geojsons/admin/India-geodata-soi-subdistricts_simplified.geojson`,
  lgd_parliament: `${R2}/geojsons/electoral/India-geodata-lgd-parliament_simplified.geojson`,
  lgd_assembly: `${R2}/geojsons/electoral/India-geodata-lgd-assembly_simplified.geojson`,
};

function geoDataLayersFor(group: LayerGroup): GeoDataLayer[] {
  switch (group) {
    case 'sub-admin': return SUB_ADMIN_LAYERS;
    case 'electoral': return ELECTORAL_LAYERS;
    case 'environment': return ENVIRONMENT_LAYERS;
    case 'urban': return URBAN_LAYERS;
    default: return [];
  }
}

function getGeoDataLayer(group: LayerGroup, id: string): GeoDataLayer | undefined {
  switch (group) {
    case 'sub-admin': return getSubAdminLayer(id);
    case 'electoral': return getElectoralLayer(id);
    case 'environment': return getEnvironmentLayer(id);
    case 'urban': return getUrbanLayer(id);
    default: return undefined;
  }
}

export function getLayerCatalogEntries(group: LayerGroup): LayerCatalogEntry[] {
  if (group === 'districts') {
    return getDistrictMapTypesList().map(d => ({
      id: d.id, group, displayName: d.displayName, description: d.description, scope: 'national',
    }));
  }
  if (group === 'cities') {
    return CITY_DATASETS.map(c => ({
      id: c.id, group, displayName: `${c.displayName} · ${c.label}`,
      description: `${c.state} · ${c.source} · ${c.featureCount} features`,
      scope: 'per-city', scopeKey: cityScopeKey(c),
    }));
  }
  // Village entries depend on the runtime mapping and are populated asynchronously.
  if (group === 'villages') return [];
  return geoDataLayersFor(group).map(l => ({
    id: l.id, group, displayName: l.displayName, description: l.description,
    // State scope caps sub-admin/electoral reprojection; environment/urban stay below ~1.6M vertices nationally.
    scope: (group === 'sub-admin' || group === 'electoral') ? 'per-state' : 'national',
  }));
}

// Use each layer's states file so picker names exactly match its state_name values.
export async function getGeoDataLayerStates(group: LayerGroup): Promise<string[]> {
  const layers = geoDataLayersFor(group);
  if (layers.length === 0) return [];
  return getStatesFromStatesFile(layers[0].statesUrl);
}

export async function getDistrictStates(): Promise<string[]> {
  return getStatesFromStatesFile(getDistrictMapConfig('LGD').states);
}

async function getStatesFromStatesFile(statesUrl: string): Promise<string[]> {
  const geo = await fetchGeoJSON(statesUrl);
  const names = new Set<string>();
  for (const f of geo.features as GeoJSONFeatureLike[]) {
    const name = f.properties.state_name;
    if (typeof name === 'string') names.add(name);
  }
  return Array.from(names).sort();
}

function cityScopeKey(c: CityDataset): string {
  return `${c.displayName}::${c.state}`;
}

export function getCityGroups(): { scopeKey: string; displayName: string; state: string; entries: LayerCatalogEntry[] }[] {
  const groups = new Map<string, { scopeKey: string; displayName: string; state: string; entries: LayerCatalogEntry[] }>();
  for (const c of CITY_DATASETS) {
    const key = cityScopeKey(c);
    const entry: LayerCatalogEntry = {
      id: c.id, group: 'cities', displayName: c.label,
      description: `${c.source} · ${c.featureCount} features`, scope: 'per-city', scopeKey: key,
    };
    const existing = groups.get(key);
    if (existing) existing.entries.push(entry);
    else groups.set(key, { scopeKey: key, displayName: c.displayName, state: c.state, entries: [entry] });
  }
  return Array.from(groups.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export async function getVillageStates(): Promise<string[]> {
  const mapping = await loadVillageMapping();
  const states = new Set<string>();
  for (const { id } of getVillageSources(mapping)) {
    for (const s of getVillagePolygonStates(mapping, id)) states.add(s);
  }
  return Array.from(states).sort();
}

export async function getVillageCatalogEntries(state: string): Promise<LayerCatalogEntry[]> {
  const mapping = await loadVillageMapping();
  return getVillageSources(mapping)
    .filter(({ id }) => getVillagePolygonUrl(mapping, id, state))
    .map(({ id, label }) => ({
      id, group: 'villages' as const, displayName: label, scope: 'per-state' as const, scopeKey: state,
    }));
}

export interface LayerFeatureSet {
  features: GeoJSONFeatureLike[];
  nameProp: string;
  stateProp: string;
}

export async function getLayerFeatures(
  entry: LayerCatalogEntry,
  opts?: { villageState?: string; geoDataState?: string; districtState?: string }
): Promise<LayerFeatureSet> {
  if (entry.group === 'districts') {
    const config = getDistrictMapConfig(entry.id);
    const geo = await fetchGeoJSON(config.geojsonPath);
    let features = geo.features as GeoJSONFeatureLike[];
    // District state focus is optional because the nationwide layer has fewer than 800 features.
    if (opts?.districtState) {
      features = features.filter(f => f.properties.state_name === opts.districtState);
    }
    return { features, nameProp: 'district_name', stateProp: 'state_name' };
  }

  if (entry.group === 'cities') {
    const dataset = CITY_DATASETS.find(c => c.id === entry.id);
    if (!dataset) throw new Error(`Unknown city dataset: ${entry.id}`);
    const geo = await fetchGeoJSON(dataset.geojsonPath);
    return { features: geo.features as GeoJSONFeatureLike[], nameProp: 'ward_name', stateProp: NO_STATE_PROP };
  }

  if (entry.group === 'villages') {
    const state = opts?.villageState;
    if (!state) throw new Error('villageState is required to fetch a village layer');
    const mapping = await loadVillageMapping();
    const url = getVillagePolygonUrl(mapping, entry.id as VillageSource, state);
    if (!url) throw new Error(`No village parquet for source "${entry.id}" in state "${state}"`);
    const features = await fetchVillageParquetAsFeatures(url);
    return { features, nameProp: 'village_name', stateProp: NO_STATE_PROP };
  }

  const layer = getGeoDataLayer(entry.group, entry.id);
  if (!layer) throw new Error(`Unknown ${entry.group} layer: ${entry.id}`);
  const geo = await fetchGeoJSON(COMPARE_URL_OVERRIDES[entry.id] ?? layer.url);
  const stateProp = layer.csvColumns.includes('state_name') ? 'state_name' : NO_STATE_PROP;
  // Simplification can collapse sliver rings to null geometry, which downstream Turf calls reject.
  let features = (geo.features as GeoJSONFeatureLike[]).filter(f => f.geometry != null);

  if (entry.scope === 'per-state') {
    if (!opts?.geoDataState) throw new Error(`geoDataState is required to fetch a ${entry.group} layer`);
    // These sources are filtered client-side; fetchGeoJSON caches the nationwide download across states.
    features = features.filter(f => f.properties[stateProp] === opts.geoDataState);
  }

  return { features, nameProp: layer.featureNameProp, stateProp };
}

// Hyparquet exposes village geometry as JSON rings, so adapt it to GeoJSON for buildDiffFeatures.
async function fetchVillageParquetAsFeatures(url: string): Promise<GeoJSONFeatureLike[]> {
  const [{ asyncBufferFromUrl, parquetReadObjects }, { compressors }] = await Promise.all([
    import('hyparquet'),
    import('hyparquet-compressors'),
  ]);
  const file = await asyncBufferFromUrl({ url });
  const rows = await parquetReadObjects({ file, compressors }) as Array<Record<string, unknown>>;

  const features: GeoJSONFeatureLike[] = [];
  for (const row of rows) {
    const ringsStr = row.rings;
    if (typeof ringsStr !== 'string') continue;
    let polygons: number[][][][];
    try {
      polygons = JSON.parse(ringsStr);
    } catch {
      continue;
    }
    if (!Array.isArray(polygons) || polygons.length === 0) continue;

    features.push({
      type: 'Feature',
      properties: { village_name: (row.village_name as string) ?? null },
      geometry: { type: 'MultiPolygon', coordinates: polygons },
    });
  }
  return features;
}
