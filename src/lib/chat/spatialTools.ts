/**
 * Spatial & Statistical Analysis Tools for WebLLM Chat
 *
 * Provides 6 tools the LLM can call:
 * - summarize_data: summary stats for all data or a filtered subset
 * - rank_entities: top/bottom N entities by value
 * - compare_regions: compare means across geographic regions
 * - spatial_autocorrelation: Global Moran's I
 * - local_spatial_clusters: LISA (Local Indicators of Spatial Association)
 * - hotspot_analysis: Getis-Ord Gi*
 */

import { mean as ssMean, median as ssMedian, standardDeviation, quantile, min as ssMin, max as ssMax } from 'simple-statistics';
import type { DynamicChatContext, Region } from './types';
import { classifyRegion } from './contextBuilder';

interface EntityData {
  name: string;
  value: number;
  state?: string;
}

interface ToolResult {
  success: boolean;
  data: unknown;
  error?: string;
}

export const toolDefinitions = [
  {
    type: "function" as const,
    function: {
      name: "summarize_data",
      description: "Get summary statistics (mean, median, standard deviation, min, max, quartiles, count) for the current dataset. Can filter by region (North/South/East/West/Northeast/Central) or by state name.",
      parameters: {
        type: "object",
        properties: {
          region: {
            type: "string",
            enum: ["North", "South", "East", "West", "Northeast", "Central"],
            description: "Filter to a specific geographic region"
          },
          state: {
            type: "string",
            description: "Filter to a specific state name"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "rank_entities",
      description: "Get the top or bottom N entities ranked by their data value.",
      parameters: {
        type: "object",
        properties: {
          n: {
            type: "number",
            description: "Number of entities to return (default 10)"
          },
          order: {
            type: "string",
            enum: ["top", "bottom"],
            description: "Whether to return highest ('top') or lowest ('bottom') values (default 'top')"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "compare_regions",
      description: "Compare the mean, min, max, and count of data values across India's geographic regions (North, South, East, West, Northeast, Central).",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "spatial_autocorrelation",
      description: "Compute Global Moran's I to test whether data values are spatially clustered, dispersed, or random. Returns I statistic, z-score, p-value, and interpretation.",
      parameters: {
        type: "object",
        properties: {
          k: {
            type: "number",
            description: "Number of nearest neighbors for spatial weights (default 5)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "local_spatial_clusters",
      description: "Run LISA (Local Indicators of Spatial Association) analysis to identify spatial clusters: High-High (hotspot clusters), Low-Low (coldspot clusters), High-Low and Low-High (spatial outliers).",
      parameters: {
        type: "object",
        properties: {
          k: {
            type: "number",
            description: "Number of nearest neighbors for spatial weights (default 5)"
          }
        },
        required: []
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "hotspot_analysis",
      description: "Run Getis-Ord Gi* hotspot analysis to identify statistically significant hotspots (high value clusters) and coldspots (low value clusters) with confidence levels.",
      parameters: {
        type: "object",
        properties: {
          k: {
            type: "number",
            description: "Number of nearest neighbors for spatial weights (default 5)"
          }
        },
        required: []
      }
    }
  }
];

function extractEntities(context: DynamicChatContext): EntityData[] {
  const { userData, geoMetadata } = context;
  if (!userData.allData) return [];

  return userData.allData.map(d => {
    // For district data, name may be "District, State"
    const parts = d.name.split(', ');
    const name = parts[0];
    const state = parts.length > 1 ? parts[1] : undefined;

    return { name, value: d.value, state };
  });
}

function filterByRegion(entities: EntityData[], region: string, hierarchy: Record<string, { region: Region }>): EntityData[] {
  const statesInRegion = new Set(
    Object.entries(hierarchy)
      .filter(([, info]) => info.region === region)
      .map(([state]) => state)
  );

  return entities.filter(e => {
    if (e.state && statesInRegion.has(e.state)) return true;
    // For state-level data, name is the state
    if (!e.state && statesInRegion.has(e.name)) return true;
    return false;
  });
}

function filterByState(entities: EntityData[], state: string): EntityData[] {
  const stateLower = state.toLowerCase();
  return entities.filter(e => {
    if (e.state?.toLowerCase() === stateLower) return true;
    if (!e.state && e.name.toLowerCase() === stateLower) return true;
    return false;
  });
}

function computeStats(values: number[]) {
  if (values.length === 0) return null;

  const q25 = quantile(values, 0.25);
  const q75 = quantile(values, 0.75);

  return {
    count: values.length,
    mean: round(ssMean(values)),
    median: round(ssMedian(values)),
    stdDev: round(values.length > 1 ? standardDeviation(values) : 0),
    min: round(ssMin(values)),
    max: round(ssMax(values)),
    q25: round(q25),
    q75: round(q75),
    iqr: round(q75 - q25)
  };
}

function round(v: number, dp = 4): number {
  return Math.round(v * 10 ** dp) / 10 ** dp;
}

interface Centroid {
  lat: number;
  lng: number;
  name: string;
  index: number;
}

function computeCentroid(feature: GeoJSON.Feature): { lat: number; lng: number } | null {
  const geom = feature.geometry;
  if (!geom) return null;

  const coords: number[][] = [];

  function collectCoords(c: unknown) {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      coords.push(c as number[]);
    } else {
      for (const sub of c) collectCoords(sub);
    }
  }

  collectCoords((geom as GeoJSON.Polygon | GeoJSON.MultiPolygon).coordinates);

  if (coords.length === 0) return null;

  let sumLat = 0, sumLng = 0;
  for (const [lng, lat] of coords) {
    sumLat += lat;
    sumLng += lng;
  }
  return { lat: sumLat / coords.length, lng: sumLng / coords.length };
}

function haversineDistance(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat +
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) *
    sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Build KNN row-standardized weight matrix.
 * Returns W[i][j] = 1/k if j is one of i's k nearest neighbors, else 0.
 */
function buildKNNWeights(centroids: Centroid[], k: number): number[][] {
  const n = centroids.length;
  const W: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    const distances: Array<{ j: number; dist: number }> = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      distances.push({ j, dist: haversineDistance(centroids[i], centroids[j]) });
    }
    distances.sort((a, b) => a.dist - b.dist);
    const neighbors = distances.slice(0, k);
    for (const nb of neighbors) {
      W[i][nb.j] = 1 / k;
    }
  }

  return W;
}

async function loadCentroidsForEntities(
  entities: EntityData[],
  geoJsonPath: string,
  context: DynamicChatContext
): Promise<{ centroids: Centroid[]; matchedEntities: EntityData[] }> {
  const response = await fetch(geoJsonPath);
  const geoJson: GeoJSON.FeatureCollection = await response.json();

  const isDistrictLevel = context.userData.dataType === 'district';

  // Build a map from entity name to centroid
  const centroidMap = new Map<string, { lat: number; lng: number }>();

  for (const feature of geoJson.features) {
    const props = feature.properties || {};
    const stateName = props.st_nm || props.state_name || props.ST_NM || props.STATE_NAME || '';
    const districtName = props.district || props.DISTRICT || props.district_name || props.dtname || props.DTNAME || props.nss_region || '';

    const centroid = computeCentroid(feature);
    if (!centroid) continue;

    if (isDistrictLevel && districtName) {
      // Key: "districtName" - match against entity.name
      centroidMap.set(districtName.toLowerCase(), centroid);
    } else if (stateName) {
      centroidMap.set(stateName.toLowerCase(), centroid);
    }
  }

  const centroids: Centroid[] = [];
  const matchedEntities: EntityData[] = [];

  for (let i = 0; i < entities.length; i++) {
    const e = entities[i];
    const key = e.name.toLowerCase();
    const c = centroidMap.get(key);
    if (c) {
      centroids.push({ ...c, name: e.name, index: centroids.length });
      matchedEntities.push(e);
    }
  }

  return { centroids, matchedEntities };
}

function globalMoransI(values: number[], W: number[][]): {
  I: number;
  expectedI: number;
  variance: number;
  zScore: number;
  pValue: number;
  interpretation: string;
} {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const z = values.map(v => v - mean);
  const s2 = z.reduce((a, v) => a + v * v, 0) / n;

  let sumW = 0;
  let numerator = 0;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumW += W[i][j];
      numerator += W[i][j] * z[i] * z[j];
    }
  }

  const I = (n / sumW) * (numerator / (s2 * n));
  const expectedI = -1 / (n - 1);

  // Variance under normality assumption
  const S1 = computeS1(W, n);
  const S2 = computeS2(W, n);
  const k = kurtosis(values);

  const A = n * ((n * n - 3 * n + 3) * S1 - n * S2 + 3 * sumW * sumW);
  const B = k * ((n * n - n) * S1 - 2 * n * S2 + 6 * sumW * sumW);
  const C = (n - 1) * (n - 2) * (n - 3) * sumW * sumW;

  const variance = (A - B) / C - expectedI * expectedI;
  const zScore = (I - expectedI) / Math.sqrt(Math.max(variance, 1e-10));

  // Two-tailed p-value from z-score (normal approximation)
  const pValue = 2 * (1 - normalCDF(Math.abs(zScore)));

  let interpretation: string;
  if (pValue > 0.05) {
    interpretation = "No statistically significant spatial autocorrelation detected (p > 0.05). Values appear spatially random.";
  } else if (I > expectedI) {
    interpretation = `Significant positive spatial autocorrelation (I=${round(I, 4)}, z=${round(zScore, 2)}, p=${round(pValue, 4)}). Similar values tend to cluster together spatially.`;
  } else {
    interpretation = `Significant negative spatial autocorrelation (I=${round(I, 4)}, z=${round(zScore, 2)}, p=${round(pValue, 4)}). Dissimilar values tend to be adjacent (spatial dispersion).`;
  }

  return { I: round(I, 4), expectedI: round(expectedI, 4), variance: round(variance, 6), zScore: round(zScore, 4), pValue: round(pValue, 4), interpretation };
}

function localMoransI(values: number[], W: number[][]): Array<{
  name: string;
  localI: number;
  zScore: number;
  pValue: number;
  cluster: string;
}> {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const z = values.map(v => v - mean);
  const s2 = z.reduce((a, v) => a + v * v, 0) / n;

  const b2 = kurtosis(values);

  const results: Array<{
    name: string;
    localI: number;
    zScore: number;
    pValue: number;
    cluster: string;
    index: number;
  }> = [];

  for (let i = 0; i < n; i++) {
    let lag = 0;
    for (let j = 0; j < n; j++) {
      lag += W[i][j] * z[j];
    }

    const Ii = (z[i] / s2) * lag;

    // Variance of local Moran's I (simplified)
    let wSumSq = 0;
    for (let j = 0; j < n; j++) {
      wSumSq += W[i][j] * W[i][j];
    }
    const expectedIi = -wSumSq / (n - 1);

    // Approximate z-score
    const wSum = W[i].reduce((a, b) => a + b, 0);
    const varianceIi = wSumSq * (n - b2) / (n - 1) + (wSum * wSum - wSumSq) * (2 * b2 - n) / ((n - 1) * (n - 2)) - expectedIi * expectedIi;
    const zScoreI = (Ii - expectedIi) / Math.sqrt(Math.max(varianceIi, 1e-10));
    const pValueI = 2 * (1 - normalCDF(Math.abs(zScoreI)));

    let cluster = 'Not Significant';
    if (pValueI <= 0.05) {
      if (z[i] > 0 && lag > 0) cluster = 'High-High';
      else if (z[i] < 0 && lag < 0) cluster = 'Low-Low';
      else if (z[i] > 0 && lag < 0) cluster = 'High-Low';
      else if (z[i] < 0 && lag > 0) cluster = 'Low-High';
    }

    results.push({
      name: '',  // filled in by caller
      localI: round(Ii, 4),
      zScore: round(zScoreI, 4),
      pValue: round(pValueI, 4),
      cluster,
      index: i
    });
  }

  return results;
}

function getisOrdGiStar(values: number[], W: number[][]): Array<{
  name: string;
  giStar: number;
  pValue: number;
  significance: string;
  type: string;
}> {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const s = Math.sqrt(values.reduce((a, v) => a + (v - mean) ** 2, 0) / n);

  const results: Array<{
    name: string;
    giStar: number;
    pValue: number;
    significance: string;
    type: string;
    index: number;
  }> = [];

  for (let i = 0; i < n; i++) {
    let sumWX = 0;
    let sumW = 0;
    let sumW2 = 0;

    for (let j = 0; j < n; j++) {
      const w = W[i][j] + (i === j ? 1 : 0); // Gi* includes self
      sumWX += w * values[j];
      sumW += w;
      sumW2 += w * w;
    }

    const numerator = sumWX - mean * sumW;
    const denominator = s * Math.sqrt((n * sumW2 - sumW * sumW) / (n - 1));

    const gi = denominator > 0 ? numerator / denominator : 0;
    const pValue = 2 * (1 - normalCDF(Math.abs(gi)));

    let significance = 'Not Significant';
    let type = 'neutral';

    if (Math.abs(gi) >= 2.576) {
      significance = '99% confidence';
      type = gi > 0 ? 'hotspot' : 'coldspot';
    } else if (Math.abs(gi) >= 1.96) {
      significance = '95% confidence';
      type = gi > 0 ? 'hotspot' : 'coldspot';
    } else if (Math.abs(gi) >= 1.645) {
      significance = '90% confidence';
      type = gi > 0 ? 'hotspot' : 'coldspot';
    }

    results.push({
      name: '',
      giStar: round(gi, 4),
      pValue: round(pValue, 4),
      significance,
      type,
      index: i
    });
  }

  return results;
}

function computeS1(W: number[][], n: number): number {
  let s1 = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      s1 += (W[i][j] + W[j][i]) ** 2;
    }
  }
  return s1 / 2;
}

function computeS2(W: number[][], n: number): number {
  let s2 = 0;
  for (let i = 0; i < n; i++) {
    let rowSum = 0, colSum = 0;
    for (let j = 0; j < n; j++) {
      rowSum += W[i][j];
      colSum += W[j][i];
    }
    s2 += (rowSum + colSum) ** 2;
  }
  return s2;
}

function kurtosis(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const m2 = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const m4 = values.reduce((a, v) => a + (v - mean) ** 4, 0) / n;
  return m4 / (m2 * m2);
}

function normalCDF(z: number): number {
  // Abramowitz & Stegun approximation
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  z = Math.abs(z) / Math.SQRT2;

  const t = 1.0 / (1.0 + p * z);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * y);
}

// Spatial Data Cache (reused across tool calls within a single query)

interface SpatialCache {
  geoJsonPath: string;
  centroids: Centroid[];
  matchedEntities: EntityData[];
  weights: Map<number, number[][]>; // k -> weight matrix
}

let spatialCache: SpatialCache | null = null;

async function getSpatialData(
  entities: EntityData[],
  k: number,
  context: DynamicChatContext
): Promise<{ centroids: Centroid[]; matchedEntities: EntityData[]; W: number[][] } | { error: ToolResult }> {
  const geoJsonPath = context.geoJsonPath;

  if (!geoJsonPath) {
    return { error: { success: false, data: null, error: "No GeoJSON path available for spatial analysis" } };
  }

  // Reuse cached centroids if same GeoJSON path
  if (!spatialCache || spatialCache.geoJsonPath !== geoJsonPath) {
    const { centroids, matchedEntities } = await loadCentroidsForEntities(entities, geoJsonPath, context);
    spatialCache = { geoJsonPath, centroids, matchedEntities, weights: new Map() };
  }

  const { centroids, matchedEntities } = spatialCache;

  if (centroids.length < k + 1) {
    return { error: { success: false, data: null, error: `Need at least ${k + 1} entities with spatial data, found ${centroids.length}` } };
  }

  // Reuse cached weight matrix if same k
  if (!spatialCache.weights.has(k)) {
    spatialCache.weights.set(k, buildKNNWeights(centroids, k));
  }

  return { centroids, matchedEntities, W: spatialCache.weights.get(k)! };
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  context: DynamicChatContext
): Promise<ToolResult> {
  try {
    const entities = extractEntities(context);
    if (entities.length === 0) {
      return { success: false, data: null, error: "No data available for analysis" };
    }

    switch (toolName) {
      case 'summarize_data':
        return summarizeData(entities, args, context);

      case 'rank_entities':
        return rankEntities(entities, args);

      case 'compare_regions':
        return compareRegions(entities, context);

      case 'spatial_autocorrelation':
        return await spatialAutocorrelation(entities, args, context);

      case 'local_spatial_clusters':
        return await localSpatialClusters(entities, args, context);

      case 'hotspot_analysis':
        return await hotspotAnalysis(entities, args, context);

      default:
        return { success: false, data: null, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return {
      success: false,
      data: null,
      error: `Tool execution error: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

export function clearSpatialCache(): void {
  spatialCache = null;
}

function summarizeData(
  entities: EntityData[],
  args: Record<string, unknown>,
  context: DynamicChatContext
): ToolResult {
  let filtered = entities;
  const metricName = context.userData.metricName || 'value';

  if (args.region && typeof args.region === 'string') {
    filtered = filterByRegion(entities, args.region, context.geoMetadata.hierarchy);
    if (filtered.length === 0) {
      return { success: false, data: null, error: `No data found for region: ${args.region}` };
    }
  }

  if (args.state && typeof args.state === 'string') {
    filtered = filterByState(entities, args.state);
    if (filtered.length === 0) {
      return { success: false, data: null, error: `No data found for state: ${args.state}` };
    }
  }

  const values = filtered.map(e => e.value);
  const stats = computeStats(values);

  return {
    success: true,
    data: {
      metric: metricName,
      filter: args.region || args.state || 'all data',
      ...stats
    }
  };
}

function rankEntities(
  entities: EntityData[],
  args: Record<string, unknown>
): ToolResult {
  const n = typeof args.n === 'number' ? Math.min(args.n, 20) : 10;
  const order = args.order === 'bottom' ? 'bottom' : 'top';

  const sorted = [...entities].sort((a, b) =>
    order === 'top' ? b.value - a.value : a.value - b.value
  );

  const ranked = sorted.slice(0, n).map((e, i) => ({
    rank: i + 1,
    name: e.state ? `${e.name}, ${e.state}` : e.name,
    value: round(e.value, 2)
  }));

  return {
    success: true,
    data: {
      order,
      count: ranked.length,
      entities: ranked
    }
  };
}

function compareRegions(
  entities: EntityData[],
  context: DynamicChatContext
): ToolResult {
  const hierarchy = context.geoMetadata.hierarchy;

  // Pre-compute state->region map once instead of scanning hierarchy per region
  const stateToRegion = new Map<string, Region>();
  for (const [state, info] of Object.entries(hierarchy)) {
    stateToRegion.set(state, info.region);
  }

  // Group entity values by region in a single pass
  const regionValues = new Map<Region, number[]>();
  for (const e of entities) {
    const stateName = e.state || e.name;
    const region = stateToRegion.get(stateName);
    if (!region) continue;
    if (!regionValues.has(region)) regionValues.set(region, []);
    regionValues.get(region)!.push(e.value);
  }

  const regionStats: Array<{
    region: string;
    count: number;
    mean: number;
    min: number;
    max: number;
    stdDev: number;
  }> = [];

  for (const [region, values] of regionValues) {
    const stats = computeStats(values);
    if (!stats) continue;

    regionStats.push({
      region,
      count: stats.count,
      mean: stats.mean,
      min: stats.min,
      max: stats.max,
      stdDev: stats.stdDev
    });
  }

  regionStats.sort((a, b) => b.mean - a.mean);

  return {
    success: true,
    data: {
      metric: context.userData.metricName || 'value',
      regions: regionStats,
      highestRegion: regionStats[0]?.region,
      lowestRegion: regionStats[regionStats.length - 1]?.region
    }
  };
}

async function spatialAutocorrelation(
  entities: EntityData[],
  args: Record<string, unknown>,
  context: DynamicChatContext
): Promise<ToolResult> {
  const k = typeof args.k === 'number' ? args.k : 5;
  const spatial = await getSpatialData(entities, k, context);
  if ('error' in spatial) return spatial.error;

  const { centroids, matchedEntities, W } = spatial;
  const values = matchedEntities.map(e => e.value);
  const result = globalMoransI(values, W);

  return {
    success: true,
    data: {
      metric: context.userData.metricName || 'value',
      n: centroids.length,
      k,
      ...result
    }
  };
}

async function localSpatialClusters(
  entities: EntityData[],
  args: Record<string, unknown>,
  context: DynamicChatContext
): Promise<ToolResult> {
  const k = typeof args.k === 'number' ? args.k : 5;
  const spatial = await getSpatialData(entities, k, context);
  if ('error' in spatial) return spatial.error;

  const { centroids, matchedEntities, W } = spatial;
  const values = matchedEntities.map(e => e.value);
  const lisaResults = localMoransI(values, W);

  // Fill in names
  for (const r of lisaResults) {
    const e = matchedEntities[r.index];
    r.name = e.state ? `${e.name}, ${e.state}` : e.name;
  }

  // Summarize clusters
  const clusterCounts: Record<string, number> = {};
  for (const r of lisaResults) {
    clusterCounts[r.cluster] = (clusterCounts[r.cluster] || 0) + 1;
  }

  // Only return significant clusters (cap at 15)
  const significantClusters = lisaResults
    .filter(r => r.cluster !== 'Not Significant')
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 15)
    .map(({ index, ...rest }) => rest);

  return {
    success: true,
    data: {
      metric: context.userData.metricName || 'value',
      n: centroids.length,
      k,
      summary: clusterCounts,
      clusters: significantClusters
    }
  };
}

async function hotspotAnalysis(
  entities: EntityData[],
  args: Record<string, unknown>,
  context: DynamicChatContext
): Promise<ToolResult> {
  const k = typeof args.k === 'number' ? args.k : 5;
  const spatial = await getSpatialData(entities, k, context);
  if ('error' in spatial) return spatial.error;

  const { centroids, matchedEntities, W } = spatial;
  const values = matchedEntities.map(e => e.value);
  const giResults = getisOrdGiStar(values, W);

  // Fill in names
  for (const r of giResults) {
    const e = matchedEntities[r.index];
    r.name = e.state ? `${e.name}, ${e.state}` : e.name;
  }

  // Summarize
  const hotspots = giResults
    .filter(r => r.type === 'hotspot')
    .sort((a, b) => b.giStar - a.giStar)
    .slice(0, 15)
    .map(({ index, ...rest }) => rest);

  const coldspots = giResults
    .filter(r => r.type === 'coldspot')
    .sort((a, b) => a.giStar - b.giStar)
    .slice(0, 15)
    .map(({ index, ...rest }) => rest);

  return {
    success: true,
    data: {
      metric: context.userData.metricName || 'value',
      n: centroids.length,
      k,
      hotspotCount: hotspots.length,
      coldspotCount: coldspots.length,
      neutralCount: giResults.filter(r => r.type === 'neutral').length,
      hotspots,
      coldspots
    }
  };
}

/**
 * Human-readable description of what a tool is doing (for UI status)
 */
export function getToolStatusMessage(toolName: string): string {
  switch (toolName) {
    case 'summarize_data': return 'Computing summary statistics...';
    case 'rank_entities': return 'Ranking entities...';
    case 'compare_regions': return 'Comparing regions...';
    case 'spatial_autocorrelation': return 'Computing spatial autocorrelation (Moran\'s I)...';
    case 'local_spatial_clusters': return 'Running LISA cluster analysis...';
    case 'hotspot_analysis': return 'Running hotspot analysis (Gi*)...';
    default: return 'Analyzing data...';
  }
}
