import type {
  DynamicChatContext,
  UserData,
  CurrentView,
  RegionalStats,
  HierarchicalStateStats,
  DistrictData,
  StateHierarchy
} from './types';

export interface BuildPromptOptions {
  useTools?: boolean;
}

export function buildSystemPrompt(context: DynamicChatContext, options: BuildPromptOptions = {}): string {
  if (!context) {
    throw new Error('context is not defined');
  }

  const { useTools = false } = options;
  const { currentView, geoMetadata, userData } = context;
  const metricLabel = userData.metricName || 'values';

  let prompt = `You are a data analyst for Indian geographic data on BharatViz.

View: ${getViewDescription(currentView.tab, currentView.selectedState, currentView.mapType)} (${currentView.mapType} boundaries)
`;

  if (currentView.selectedState && geoMetadata.selectedStateInfo) {
    prompt += `State: ${currentView.selectedState} (${geoMetadata.selectedStateInfo.districtCount} districts)\n`;
  }

  if (userData.hasData) {
    prompt += useTools
      ? buildToolDataSection(userData)
      : buildDataSection(userData, currentView, context);
  } else {
    prompt += `\nNo data uploaded yet. Answer general questions about Indian states, districts, and geography.\n`;
  }

  if (geoMetadata.featureProperties && geoMetadata.featureProperties.length > 0) {
    prompt += buildGeoSection(geoMetadata.featureProperties, currentView.tab);
  }

  // For district/state/region maps, include state->district listing from hierarchy
  if (currentView.tab !== 'cities') {
    prompt += buildHierarchySection(geoMetadata.hierarchy, currentView.tab, context.mentionedStates);
  }

  if (context.previousContext) {
    prompt += `\nPrevious map: ${context.previousContext.mapType}`;
    if (context.previousContext.stats) {
      const s = context.previousContext.stats;
      prompt += ` (mean=${s.mean.toFixed(2)}, range=${s.min.toFixed(2)}-${s.max.toFixed(2)})`;
    }
    prompt += '\n';
  }

  prompt += `
Rules:
- Call the metric "${metricLabel}", never "data" or "values"
- Lead with the key finding, then supporting numbers
- 2-3 paragraphs max
- Cite specific numbers from the data
- Note missing data when it affects analysis
- No causal claims, only patterns
- ONLY use the data provided above. Do not fabricate numbers or make up statistics.${currentView.tab === 'states' ? '\n- STATE-LEVEL only. Never mention districts.' : ''}${currentView.tab === 'regions' ? '\n- REGION-LEVEL only. These are NSSO survey sampling regions.' : ''}${currentView.tab === 'cities' ? '\n- WARD-LEVEL only. This is city ward data, not state or district data.' : ''}
`;

  return prompt;
}

function getViewDescription(tab: string, selectedState?: string, mapType?: string): string {
  switch (tab) {
    case 'states': return 'State-level map of India';
    case 'districts': return 'All-India districts map';
    case 'state-districts': return `Districts of ${selectedState}`;
    case 'regions': return 'NSSO Regions map of India';
    case 'cities': return `City ward map (${mapType || 'ward-level'})`;
    default: return 'Map view';
  }
}

function buildDataPreamble(userData: UserData): string {
  const metricLabel = userData.metricName || 'values';
  let s = `\nMetric: ${metricLabel}
Coverage: ${userData.count}/${userData.totalExpected} (${(100 - userData.missingPercentage).toFixed(0)}%)
`;
  if (userData.missingEntities.length > 0 && userData.missingEntities.length <= 10) {
    s += `Missing: ${userData.missingEntities.join(', ')}\n`;
  } else if (userData.missingEntities.length > 10) {
    s += `Missing: ${userData.missingEntities.length} entities\n`;
  }
  return s;
}

function buildToolDataSection(userData: UserData): string {
  let s = buildDataPreamble(userData);

  if (userData.stats) {
    const st = userData.stats;
    s += `Quick summary: min=${st.min.toFixed(2)}, max=${st.max.toFixed(2)}, mean=${st.mean.toFixed(2)}, median=${st.median.toFixed(2)}\n`;
  }

  s += `
You MUST use your tools to answer data questions. Each tool already has the complete dataset AND geographic boundaries loaded internally. You do not need to provide any data - just call the tool and it returns computed results.

Tools:
- summarize_data: summary stats (mean, median, SD, min, max, quartiles). Optional: filter by region or state.
- rank_entities: top or bottom N entities by value.
- compare_regions: compare means across geographic regions.
- spatial_autocorrelation: computes Global Moran's I with spatial weights from the loaded GeoJSON boundaries.
- local_spatial_clusters: runs LISA analysis using the loaded GeoJSON boundaries. Returns cluster classifications.
- hotspot_analysis: computes Getis-Ord Gi* using the loaded GeoJSON boundaries. Returns hotspot/coldspot z-scores.

CRITICAL RULES:
1. NEVER say "I don't have the data" or "I need spatial data" - the tools have everything.
2. ALWAYS call the tool first, then explain the results.
3. For spatial questions (clustering, Moran's I, LISA, hotspots), the tool loads GeoJSON boundaries automatically.
4. Call tools with no arguments to use defaults, or pass optional filters.
`;

  return s;
}

function buildDataSection(userData: UserData, currentView: CurrentView, context: DynamicChatContext): string {
  let s = buildDataPreamble(userData);

  if (userData.stats) {
    const st = userData.stats;
    s += `Range: ${st.min.toFixed(2)}-${st.max.toFixed(2)} | Mean: ${st.mean.toFixed(2)} | Median: ${st.median.toFixed(2)} | StdDev: ${st.stdDev.toFixed(2)} | IQR: ${st.q25.toFixed(2)}-${st.q75.toFixed(2)}\n`;
  }

  if (userData.top10.length > 0) {
    s += `\nHighest: ${userData.top10.slice(0, 5).map((d, i) => `${i + 1}. ${d.name} (${d.value.toFixed(2)})`).join(', ')}\n`;
    s += `Lowest: ${userData.bottom10.slice(0, 5).map((d, i) => `${i + 1}. ${d.name} (${d.value.toFixed(2)})`).join(', ')}\n`;
  }

  if ((currentView.tab === 'states' || currentView.tab === 'regions' || currentView.tab === 'cities') && userData.allData && userData.allData.length > 0) {
    const label = currentView.tab === 'states' ? 'All states' : currentView.tab === 'regions' ? 'All regions' : 'All wards';
    s += `\n${label}:\n${userData.allData.map(d => `${d.name}: ${d.value.toFixed(2)}`).join(' | ')}\n`;
  }

  if (userData.regionalStats && Object.keys(userData.regionalStats).length > 0) {
    s += `\nRegional means: ${Object.entries(userData.regionalStats)
      .map(([region, stats]: [string, RegionalStats]) => `${region}=${stats.mean.toFixed(2)} (n=${stats.dataCount})`)
      .join(', ')}\n`;
  }

  if (userData.hierarchicalStats && currentView.tab === 'state-districts' && currentView.selectedState) {
    const stateStats = userData.hierarchicalStats[currentView.selectedState];
    if (stateStats) {
      s += `\n${currentView.selectedState}: ${stateStats.dataCount}/${stateStats.districtCount} districts, mean=${stateStats.mean?.toFixed(2) || 'N/A'}, range=${stateStats.min?.toFixed(2) || 'N/A'}-${stateStats.max?.toFixed(2) || 'N/A'}\n`;

      if (stateStats.districts?.length > 0) {
        const withData = stateStats.districts.filter(d => !d.missing);
        if (withData.length > 0) {
          s += `Districts: ${withData.map(d => `${d.name}=${d.value?.toFixed(2)}`).join(', ')}\n`;
        }
        const missing = stateStats.districts.filter(d => d.missing);
        if (missing.length > 0 && missing.length <= 10) {
          s += `Missing: ${missing.map(d => d.name).join(', ')}\n`;
        }
      }
    }
  }

  if (userData.hierarchicalStats && currentView.tab === 'districts') {
    const statesWithData = Object.entries(userData.hierarchicalStats)
      .filter(([_, stats]: [string, HierarchicalStateStats]) => stats.dataCount > 0)
      .sort((a, b) => b[1].dataCount - a[1].dataCount);

    const mentionedStates = context.mentionedStates || [];

    if (mentionedStates.length > 0) {
      for (const [state, stats] of statesWithData) {
        if (mentionedStates.includes(state)) {
          const st = stats as HierarchicalStateStats;
          const withData = st.districts.filter((d: DistrictData) => !d.missing);
          s += `\n${state} (${st.dataCount}/${st.districtCount}): ${withData.map((d: DistrictData) => `${d.name}=${d.value?.toFixed(2)}`).join(', ')}\n`;
        }
      }
    } else {
      s += `\nState summaries: ${statesWithData.map(([state, stats]) => {
        const st = stats as HierarchicalStateStats;
        return `${state}: n=${st.dataCount}/${st.districtCount}, mean=${st.mean?.toFixed(2) || 'N/A'}`;
      }).join(' | ')}\n`;
      s += `(Ask about a specific state for district details.)\n`;
    }
  }

  return s;
}

const SKIP_KEYS = new Set([
  'gid', 'objectid', 'OBJECTID', 'Id', 'id', 'fid',
  'Shape_Area', 'Shape_Leng', 'shape.STLength()', 'st_area(shape)', 'st_perimeter(shape)',
  'AREA', 'PERIMETER', 'area', 'Area', 'AREA_SQ_KM', 'PERIM_KM',
  'areai', 'bearingi', 'coordinate', 'latitudei', 'longitudei', 'lengthi',
  'LAT', 'LON', 'xi', 'yi',
  'typei', 'versioni', 'selectioni', 'selectionm', 'branchesi',
  '@changeset', '@id', '@timestamp', '@uid', '@user', '@version',
  'altitudeMode', 'begin', 'drawOrder', 'end', 'extrude', 'tessellate', 'timestamp', 'visibility',
  'description', 'icon',
  'polyno',
]);

const WARD_NAME_KEYS = ['ward_name', 'WARD_NAME', 'Ward_Name', 'Ward Name', 'wardname', 'KGISWardName', 'Name', 'Name1', 'name', 'NAME'];
const WARD_NUM_KEYS = ['ward_number', 'Ward_No', 'Ward_No', 'WARD_NO', 'Ward_Number', 'Ward Num', 'ward_no', 'wardcode', 'KGISWardNo', 'KGISWardCode', 'wardnum', 'wardno', 'sno', 'WARD'];

const GEO_SECTION_CHAR_BUDGET = 8000;

const WARD_USED_KEYS = new Set<string>([...WARD_NAME_KEYS, ...WARD_NUM_KEYS]);

function buildGeoSection(featureProperties: Array<Record<string, unknown>>, tab: string): string {
  if (tab === 'cities') {
    const totalWards = featureProperties.length;
    const rows: string[] = [];
    let charCount = 0;
    let truncated = false;

    for (const props of featureProperties) {
      const wardName = firstVal(props, WARD_NAME_KEYS) ?? '';
      const wardNum = firstVal(props, WARD_NUM_KEYS) ?? '';
      const extras: string[] = [];
      for (const [k, v] of Object.entries(props)) {
        if (WARD_USED_KEYS.has(k) || SKIP_KEYS.has(k)) continue;
        if (v === null || v === undefined || v === '' || v === 'Na' || v === 'na') continue;
        extras.push(`${k}=${v}`);
      }

      let line = '';
      if (wardNum) line += `#${wardNum}`;
      if (wardName) line += (line ? ' ' : '') + String(wardName);
      if (extras.length > 0) line += (line ? ' | ' : '') + extras.join(', ');

      if (charCount + line.length > GEO_SECTION_CHAR_BUDGET) {
        truncated = true;
        break;
      }
      rows.push(line);
      charCount += line.length + 1;
    }

    let section = `\nWard geography (${totalWards} wards):\n${rows.join('\n')}\n`;
    if (truncated) {
      section += `(${totalWards - rows.length} more wards not shown)\n`;
    }
    return section;
  }

  const names = featureProperties.map(props => {
    const state = props.state_name || props.st_nm || props.ST_NM || '';
    const entity = props.district_name || props.district || props.DISTRICT || props.nss_region || '';
    const extra: string[] = [];
    if (props.nss_region_code) extra.push(`code=${props.nss_region_code}`);
    if (props.n_districts) extra.push(`${props.n_districts} districts`);
    if (entity && state) {
      const suffix = extra.length > 0 ? ` [${extra.join(', ')}]` : '';
      return `${entity} (${state})${suffix}`;
    }
    return String(state || entity || '');
  }).filter(Boolean);

  if (names.length > 0) {
    return `\nGeographic entities (${names.length}): ${names.join(', ')}\n`;
  }
  return '';
}

const HIERARCHY_CHAR_BUDGET = 6000;

function buildHierarchySection(
  hierarchy: Record<string, StateHierarchy>,
  tab: string,
  mentionedStates?: string[]
): string {
  const states = Object.entries(hierarchy).sort((a, b) => a[0].localeCompare(b[0]));
  if (states.length === 0) return '';

  if (tab === 'states') {
    return `\nStates on this map (${states.length}): ${states.map(([s]) => s).join(', ')}\n`;
  }

  const entityLabel = tab === 'regions' ? 'regions' : 'districts';
  const totalEntities = states.reduce((sum, [, s]) => sum + s.districts.length, 0);
  let section = `\nMap contains ${states.length} states/UTs, ${totalEntities} ${entityLabel}:\n`;
  let charCount = section.length;

  if (mentionedStates && mentionedStates.length > 0) {
    const mentionedSet = new Set(mentionedStates);
    for (const [state, info] of states) {
      if (!mentionedSet.has(state)) continue;
      const line = `${state}: ${info.districts.join(', ')}\n`;
      section += line;
      charCount += line.length;
    }
    const rest = states.filter(([s]) => !mentionedSet.has(s));
    if (rest.length > 0) {
      const summaryLine = rest.map(([s, info]) => `${s} (${info.districts.length})`).join(', ');
      if (charCount + summaryLine.length < HIERARCHY_CHAR_BUDGET) {
        section += `Other states: ${summaryLine}\n`;
      }
    }
  } else {
    let addedCount = 0;
    for (const [state, info] of states) {
      const line = `${state} (${info.districts.length}): ${info.districts.join(', ')}\n`;
      if (charCount + line.length > HIERARCHY_CHAR_BUDGET) {
        const remaining = states.length - addedCount;
        if (remaining > 0) {
          section += `+ ${remaining} more states\n`;
        }
        break;
      }
      section += line;
      charCount += line.length;
      addedCount++;
    }
  }

  return section;
}

function firstVal(props: Record<string, unknown>, keys: string[]): string | number | undefined {
  for (const k of keys) {
    const v = props[k];
    if (v !== null && v !== undefined && v !== '' && v !== 'Na' && v !== 'na' && v !== 'N/A') {
      return typeof v === 'number' ? v : String(v);
    }
  }
  return undefined;
}

export function getStarterQuestions(context: DynamicChatContext | null): string[] {
  if (!context) return [];
  const { userData, currentView } = context;
  const metricLabel = userData.metricName || 'this metric';

  const entityLabel = currentView.tab === 'states' ? 'states'
    : currentView.tab === 'cities' ? 'wards'
    : currentView.tab === 'regions' ? 'regions'
    : 'districts';

  if (!userData.hasData) {
    return [
      `What ${entityLabel} are available on this map?`,
      `Tell me about the geographic coverage of this map`,
    ];
  }

  const questions: string[] = [];
  const top = userData.top10[0];
  const bottom = userData.bottom10[0];

  if (top && bottom) {
    questions.push(`Why might ${top.name} have the highest ${metricLabel}?`);
  }

  if (userData.regionalStats && Object.keys(userData.regionalStats).length > 1) {
    const regions = Object.entries(userData.regionalStats).sort((a, b) => b[1].mean - a[1].mean);
    const highest = regions[0][0];
    const lowest = regions[regions.length - 1][0];
    questions.push(`Why is ${metricLabel} higher in ${highest} than ${lowest} India?`);
  }

  if (userData.stats) {
    questions.push(`Are there outliers in the ${metricLabel} data?`);
  }

  if (userData.missingEntities.length > 0) {
    questions.push(`Which ${entityLabel} are missing data?`);
  }

  if (currentView.tab === 'state-districts' && currentView.selectedState) {
    questions.push(`What patterns do you see across ${currentView.selectedState}'s districts?`);
  }

  if (currentView.tab === 'cities') {
    questions.push(`Which wards have the highest and lowest ${metricLabel}?`);
  }

  if (top && bottom && questions.length < 4) {
    questions.push(`What's the spread between ${top.name} and ${bottom.name}?`);
  }

  if (questions.length < 4) {
    questions.push(`Summarize the ${metricLabel} distribution`);
  }

  return questions.slice(0, 4);
}

export function buildCompactContext(context: DynamicChatContext): string {
  const { currentView, userData } = context;

  let compact = `View: ${currentView.tab}`;
  if (currentView.selectedState) {
    compact += ` (${currentView.selectedState})`;
  }
  compact += ` | ${currentView.mapType}`;

  if (userData.hasData && userData.stats) {
    compact += ` | n=${userData.count}/${userData.totalExpected}`;
    compact += ` | ${userData.stats.min.toFixed(1)}-${userData.stats.max.toFixed(1)}`;
    compact += ` | u=${userData.stats.mean.toFixed(1)}`;
    compact += ` | missing=${userData.missingPercentage.toFixed(1)}%`;
  } else {
    compact += ` | No data`;
  }

  return compact;
}
