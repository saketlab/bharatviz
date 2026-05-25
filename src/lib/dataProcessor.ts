/**
 * Data Processing - optimized single-pass validation and matching
 */

import { search as fastFuzzySearch } from 'fast-fuzzy';
import { fetchGeoJSON } from './geoJsonCache';

interface StateData {
  state: string;
  value: number | string;
}

interface DistrictData {
  state: string;
  district: string;
  value: number | string;
}

interface NAInfo {
  states?: string[];
  districts?: Array<{ state: string; district: string }>;
  count: number;
}

interface ProcessedData<T> {
  matched: T[];
  naInfo: NAInfo;
}

function normalizeString(str: string): string {
  return str.trim().toLowerCase().replace(/\s*&\s*/g, ' and ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

const STATE_ALIASES: Record<string, string[]> = {
  'delhi': ['nct of delhi', 'national capital territory of delhi'],
  'dadra and nagar haveli': ['dadra and nagar haveli and daman and diu'],
  'daman and diu': ['dadra and nagar haveli and daman and diu'],
  'jammu and kashmir': ['ladakh', 'jammu and kashmir', 'j and k'],
  'odisha': ['orissa'],
};

function resolveStateAlias(normalized: string, referenceList: string[]): string | null {
  for (const [canonical, aliases] of Object.entries(STATE_ALIASES)) {
    if (aliases.includes(normalized)) {
      const match = referenceList.find(r => normalizeString(r) === canonical);
      if (match) return match;
    }
  }
  return null;
}

function fuzzyMatch(input: string, referenceList: string[], threshold: number): string | null {
  const normalized = normalizeString(input);
  const normalizedRefs = referenceList.map(ref => ({
    original: ref,
    normalized: normalizeString(ref)
  }));

  const exactMatch = normalizedRefs.find(ref => ref.normalized === normalized);
  if (exactMatch) return exactMatch.original;

  const aliasMatch = resolveStateAlias(normalized, referenceList);
  if (aliasMatch) return aliasMatch;

  if (normalized.length === 0 || referenceList.length === 0) return null;

  const results = fastFuzzySearch(normalized, normalizedRefs.map(r => r.normalized), {
    threshold,
    ignoreCase: true,
    returnMatchData: true
  });

  if (results.length > 0) {
    const bestMatch = results[0];
    const matchedRef = normalizedRefs.find(ref => ref.normalized === bestMatch.item);
    if (!matchedRef) return null;

    const inputFirstChar = normalized.charAt(0);
    const matchFirstChar = bestMatch.item.charAt(0);

    if (inputFirstChar === matchFirstChar || threshold < 0.3) {
      return matchedRef.original;
    }
  }

  return null;
}

export async function processStateData(
  data: StateData[],
  geojsonPath: string,
  fuzzyThreshold: number
): Promise<ProcessedData<StateData>> {
  if (!geojsonPath) {
    const validData = data.filter(d => {
      const isNA = typeof d.value === 'string' && d.value === '' ||
                   typeof d.value === 'number' && (isNaN(d.value) || !isFinite(d.value));
      return !isNA;
    });
    return { matched: validData, naInfo: { states: [], count: 0 } };
  }

  const geojson = await fetchGeoJSON(geojsonPath);

  const validStates: string[] = [];
  geojson.features.forEach((feature) => {
    const stateName = (
      feature.properties?.state_name ||
      feature.properties?.NAME_1 ||
      feature.properties?.name ||
      feature.properties?.ST_NM
    )?.trim();
    if (stateName && !validStates.includes(stateName)) {
      validStates.push(stateName);
    }
  });

  const matched: StateData[] = [];
  const dataMap = new Map<string, boolean>();

  data.forEach(row => {
    const matchedState = fuzzyMatch(row.state, validStates, fuzzyThreshold);
    if (matchedState) {
      matched.push({ state: matchedState, value: row.value });
      dataMap.set(matchedState, true);
    }
  });

  const validData = matched.filter(d => {
    const isNA = typeof d.value === 'string' && d.value === '' ||
                 typeof d.value === 'number' && (isNaN(d.value) || !isFinite(d.value));
    return !isNA;
  });

  const naEntries = matched.filter(d => {
    const isNA = typeof d.value === 'string' && d.value === '' ||
                 typeof d.value === 'number' && (isNaN(d.value) || !isFinite(d.value));
    return isNA;
  });

  const missingStates = validStates.filter(state => !dataMap.has(state));
  const allNAEntries = [...naEntries, ...missingStates.map(state => ({ state, value: NaN }))];

  return {
    matched: validData,
    naInfo: {
      states: allNAEntries.map(e => e.state),
      count: allNAEntries.length
    }
  };
}

export async function processDistrictData(
  data: DistrictData[],
  geojsonPath: string,
  fuzzyThreshold: number,
  selectedState?: string
): Promise<ProcessedData<DistrictData>> {
  const geojson = await fetchGeoJSON(geojsonPath);

  const validStates = new Set<string>();
  const validDistrictsByState = new Map<string, string[]>();

  geojson.features.forEach((feature) => {
    const stateName = feature.properties?.state_name?.trim();
    const districtName = feature.properties?.district_name?.trim();

    if (stateName) {
      validStates.add(stateName);
      if (districtName) {
        if (!validDistrictsByState.has(stateName)) {
          validDistrictsByState.set(stateName, []);
        }
        validDistrictsByState.get(stateName)!.push(districtName);
      }
    }
  });

  const matched: DistrictData[] = [];
  const dataMap = new Map<string, boolean>();

  data.forEach(row => {
    const matchedState = fuzzyMatch(row.state, Array.from(validStates), fuzzyThreshold);
    if (matchedState) {
      const districtsInState = validDistrictsByState.get(matchedState) || [];
      const matchedDistrict = fuzzyMatch(row.district, districtsInState, fuzzyThreshold);

      if (matchedDistrict) {
        matched.push({
          state: matchedState,
          district: matchedDistrict,
          value: row.value
        });
        dataMap.set(`${matchedState}|${matchedDistrict}`, true);
      }
    }
  });

  const validData = matched.filter(d => {
    const isNA = typeof d.value === 'string' && d.value === '' ||
                 typeof d.value === 'number' && (isNaN(d.value) || !isFinite(d.value));
    return !isNA;
  });

  const naEntries = matched.filter(d => {
    const isNA = typeof d.value === 'string' && d.value === '' ||
                 typeof d.value === 'number' && (isNaN(d.value) || !isFinite(d.value));
    return isNA;
  });

  const missingEntries: Array<{ state: string; district: string }> = [];
  validDistrictsByState.forEach((districts, state) => {
    if (selectedState && state !== selectedState) return;

    districts.forEach(district => {
      const key = `${state}|${district}`;
      if (!dataMap.has(key)) {
        missingEntries.push({ state, district });
      }
    });
  });

  const allNAEntries = [...naEntries, ...missingEntries.map(e => ({ ...e, value: NaN }))];

  return {
    matched: validData,
    naInfo: {
      districts: allNAEntries.map(e => ({ state: e.state, district: e.district })),
      count: allNAEntries.length
    }
  };
}
