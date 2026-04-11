import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const CSV_PATH = join(PROJECT_ROOT, 'harmonized_districts', 'district_proliferation_1951_2024.csv');
const GEOJSON_DIR = join(PROJECT_ROOT, 'public', 'harmonized-districts');

export const CENSUS_YEARS = [1951, 1961, 1971, 1981, 1991, 2001, 2011] as const;

interface Transition {
  sourceDistrict: string;
  destDistrict: string;
  sourceYear: number;
  destYear: number;
  state: string;
}

interface StateIndex {
  forward: Map<number, Map<string, Set<string>>>;
  backward: Map<number, Map<string, Set<string>>>;
  transitions: Transition[];
}

export interface YearEntry {
  state: string;
  district: string;
}

interface EvolutionResult {
  query: { district: string; state?: string };
  matches: Array<{
    modern_state: string;
    evolution: Record<string, YearEntry[]>;
  }>;
}

type GeoJSON = { type: string; features: Array<{ properties: Record<string, string>; geometry: object }> };

let transitions: Transition[] = [];
let csvCache: string | null = null;
const stateIndexes = new Map<string, StateIndex>();
const geojsonCache = new Map<number, GeoJSON>();
let loadPromise: Promise<void> | null = null;

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(raw: string): Transition[] {
  const lines = raw.split('\n');
  const seen = new Set<string>();
  const result: Transition[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const [sourceDistrict, destDistrict, srcYearStr, destYearStr, state] = line.split(',');
    if (!sourceDistrict || !destDistrict || !srcYearStr || !destYearStr || !state) continue;
    const sourceYear = Number(srcYearStr);
    const destYear = Number(destYearStr);
    if (!sourceYear || !destYear) continue;

    const key = `${sourceDistrict}|${destDistrict}|${sourceYear}|${destYear}|${state}`;
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({ sourceDistrict: sourceDistrict.trim(), destDistrict: destDistrict.trim(), sourceYear, destYear, state: state.trim() });
  }
  return result;
}

function buildStateIndex(normState: string): StateIndex {
  const stateTransitions = transitions.filter(t => normalize(t.state) === normState);
  const forward = new Map<number, Map<string, Set<string>>>();
  const backward = new Map<number, Map<string, Set<string>>>();

  for (const t of stateTransitions) {
    if (!forward.has(t.sourceYear)) forward.set(t.sourceYear, new Map());
    const fwdMap = forward.get(t.sourceYear)!;
    const normSrc = normalize(t.sourceDistrict);
    if (!fwdMap.has(normSrc)) fwdMap.set(normSrc, new Set());
    fwdMap.get(normSrc)!.add(t.destDistrict);

    if (!backward.has(t.destYear)) backward.set(t.destYear, new Map());
    const bwdMap = backward.get(t.destYear)!;
    const normDest = normalize(t.destDistrict);
    if (!bwdMap.has(normDest)) bwdMap.set(normDest, new Set());
    bwdMap.get(normDest)!.add(t.sourceDistrict);
  }

  return { forward, backward, transitions: stateTransitions };
}

async function loadTransitions(): Promise<void> {
  if (loadPromise) return loadPromise;
  loadPromise = Promise.resolve().then(() => {
    transitions = parseCsv(readFileSync(CSV_PATH, 'utf-8'));
  });
  return loadPromise;
}

function getStateIndex(normState: string): StateIndex {
  if (!stateIndexes.has(normState)) {
    stateIndexes.set(normState, buildStateIndex(normState));
  }
  return stateIndexes.get(normState)!;
}

function traceDistrict(
  startDistrict: string,
  modernState: string,
  startYear: number
): Record<string, YearEntry[]> {
  const result: Record<string, YearEntry[]> = {};
  const { forward, backward, transitions: stateTransitions } = getStateIndex(normalize(modernState));

  const normStart = normalize(startDistrict);
  const atStart = stateTransitions.find(
    t => t.sourceYear === startYear && normalize(t.sourceDistrict) === normStart
  );
  if (!atStart) return result;

  const canonicalName = atStart.sourceDistrict;
  result[String(startYear)] = [{ state: modernState, district: canonicalName }];

  let currentDistricts = new Set<string>([canonicalName]);
  const yearsAsc = CENSUS_YEARS.filter(y => y >= startYear).sort((a, b) => a - b);
  for (let i = 0; i < yearsAsc.length - 1; i++) {
    const fwdMap = forward.get(yearsAsc[i]);
    const nextDistricts = new Set<string>();
    for (const dist of currentDistricts) {
      fwdMap?.get(normalize(dist))?.forEach(d => nextDistricts.add(d));
    }
    const nextYr = yearsAsc[i + 1];
    result[String(nextYr)] = [...nextDistricts].map(d => ({ state: modernState, district: d }));
    currentDistricts = nextDistricts;
  }

  let prevDistricts = new Set<string>([canonicalName]);
  const yearsDesc = CENSUS_YEARS.filter(y => y <= startYear).sort((a, b) => b - a);
  for (let i = 0; i < yearsDesc.length - 1; i++) {
    const bwdMap = backward.get(yearsDesc[i]);
    const prevSet = new Set<string>();
    for (const dist of prevDistricts) {
      bwdMap?.get(normalize(dist))?.forEach(s => prevSet.add(s));
    }
    const prevYr = yearsDesc[i + 1];
    result[String(prevYr)] = [...prevSet].map(d => ({ state: modernState, district: d }));
    prevDistricts = prevSet;
  }

  return result;
}

export async function queryEvolution(params: {
  district: string;
  state?: string;
  year?: number;
}): Promise<EvolutionResult> {
  await loadTransitions();
  const { district, state, year } = params;
  const normDistrict = normalize(district);
  const normState = state ? normalize(state) : undefined;

  const srcCandidates = new Map<string, number>();
  const destFallback = new Map<string, number>();
  for (const t of transitions) {
    if (normState && normalize(t.state) !== normState) continue;
    if (year && t.sourceYear !== year) continue;

    if (normalize(t.sourceDistrict) === normDistrict) {
      const cur = srcCandidates.get(t.state);
      if (cur === undefined || t.sourceYear < cur) srcCandidates.set(t.state, t.sourceYear);
    } else if (!year && normalize(t.destDistrict) === normDistrict) {
      const cur = destFallback.get(t.state);
      if (cur === undefined || t.destYear < cur) destFallback.set(t.state, t.destYear);
    }
  }
  const candidates = new Map<string, number>(srcCandidates);
  for (const [s, yr] of destFallback) {
    if (!candidates.has(s)) candidates.set(s, yr);
  }

  const matches = [];
  for (const [modernState, firstYear] of candidates) {
    const evolution = traceDistrict(district, modernState, firstYear);
    if (year) {
      matches.push({ modern_state: modernState, evolution: { [String(year)]: evolution[String(year)] ?? [] } });
    } else {
      matches.push({ modern_state: modernState, evolution });
    }
  }

  return {
    query: { district, ...(state ? { state } : {}) },
    matches,
  };
}

export async function getDistrictGeoJSON(params: {
  district: string;
  state: string;
  year: number;
}): Promise<object | null> {
  const { district, state, year } = params;

  if (!geojsonCache.has(year)) {
    try {
      const data = JSON.parse(readFileSync(join(GEOJSON_DIR, `${year}.geojson`), 'utf-8')) as GeoJSON;
      geojsonCache.set(year, data);
    } catch {
      return null;
    }
  }

  const geojson = geojsonCache.get(year)!;
  const normDistrict = normalize(district);
  const normState = normalize(state);

  const matched = geojson.features.filter(
    f => normalize(f.properties.district_name ?? '') === normDistrict
  );

  if (matched.length === 0) return null;
  if (matched.length === 1) return { type: 'FeatureCollection', features: matched };

  const stateFiltered = matched.filter(
    f => normalize(f.properties.state_name ?? '') === normState
  );
  return { type: 'FeatureCollection', features: stateFiltered.length > 0 ? stateFiltered : matched };
}

export interface DistrictName {
  district: string;
  state: string;
}

let namesCache: DistrictName[] | null = null;

export function getDistrictNames(): DistrictName[] {
  if (!namesCache) {
    const seen = new Set<string>();
    const result: DistrictName[] = [];
    for (const t of transitions) {
      for (const district of [t.sourceDistrict, t.destDistrict]) {
        const key = `${district}|${t.state}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push({ district, state: t.state });
        }
      }
    }
    result.sort((a, b) => a.district.localeCompare(b.district));
    namesCache = result;
  }
  return namesCache;
}

export function getTransitionsCsv(): string {
  if (!csvCache) {
    const header = 'source_district,dest_district,source_year,dest_year,filter_state\n';
    const rows = transitions.map(t =>
      `${t.sourceDistrict},${t.destDistrict},${t.sourceYear},${t.destYear},${t.state}`
    ).join('\n');
    csvCache = header + rows;
  }
  return csvCache;
}

export async function ensureLoaded(): Promise<void> {
  return loadTransitions();
}
