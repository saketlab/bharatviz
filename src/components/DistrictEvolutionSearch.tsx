import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Search, X, ChevronDown } from 'lucide-react';

interface DistrictName {
  district: string;
  state: string;
}

interface YearEntry {
  state: string;
  district: string;
  geojson?: any | null;
}

interface EvolutionMatch {
  modern_state: string;
  evolution: Record<string, YearEntry[]>;
}

interface EvolutionResponse {
  query: { district: string; state?: string };
  matches: EvolutionMatch[];
}

interface DistrictEvolutionSearchProps {
  darkMode?: boolean;
  defaultDistrict?: string;
  onDistrictChange?: (district: string | null) => void;
}

const CENSUS_YEARS = [1951, 1961, 1971, 1981, 1991, 2001, 2011];

const API_BASE = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  ? ''
  : 'https://bharatviz.org';

const DISTRICT_COLOR = '#e07b39';

function norm(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function filterNames(names: DistrictName[], query: string): DistrictName[] {
  const q = norm(query);
  if (!q) return [];
  const prefix: DistrictName[] = [];
  const substr: DistrictName[] = [];
  for (const n of names) {
    const nd = norm(n.district);
    if (nd.startsWith(q)) prefix.push(n);
    else if (nd.includes(q)) substr.push(n);
  }
  return [...prefix, ...substr].slice(0, 40);
}

const EARTH_RADIUS_KM = 6371;

function computeMetrics(geojson: any): { area: number; compactness: number } | null {
  if (!geojson?.features?.length) return null;
  const collection = { type: 'GeometryCollection' as const, geometries: geojson.features.map((f: any) => f.geometry) };
  const areaSr = d3.geoArea(collection as any);
  const perimRad = d3.geoLength(collection as any);
  if (!areaSr || !perimRad) return null;
  const area = areaSr * EARTH_RADIUS_KM * EARTH_RADIUS_KM;
  const perim = perimRad * EARTH_RADIUS_KM;
  const compactness = (4 * Math.PI * area) / (perim * perim);
  return { area, compactness };
}

function YearMap({
  year, geojson, color, darkMode,
}: {
  year: number;
  geojson: any | null;
  color: string;
  darkMode: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const draw = useCallback(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !geojson?.features?.length) return;

    const W = wrap.clientWidth || 160;
    if (W === 0) return;
    const H = Math.round(W * 1.2);
    const d3svg = d3.select(svg);
    d3svg.selectAll('*').remove();
    d3svg.attr('width', W).attr('height', H);

    const strokeColor = darkMode ? 'hsl(25, 8%, 20%)' : 'hsl(38, 30%, 80%)';

    const pad = 8;
    const projection = d3.geoMercator()
      .fitExtent([[pad, pad], [W - pad, H - pad - 16]], geojson);

    const path = d3.geoPath().projection(projection);
    const g = d3svg.append('g');

    g.selectAll('path')
      .data(geojson.features)
      .join('path')
      .attr('d', (f: any) => path(f) || '')
      .attr('fill', color)
      .attr('fill-opacity', 0.8)
      .attr('stroke', strokeColor)
      .attr('stroke-width', 0.8);

    const n = geojson.features.length;
    const fontSize = Math.max(5, Math.min(9, W / (n * 5)));
    g.selectAll('text')
      .data(geojson.features)
      .join('text')
      .attr('x', (f: any) => path.centroid(f)[0])
      .attr('y', (f: any) => path.centroid(f)[1] + 3)
      .attr('text-anchor', 'middle')
      .attr('font-size', fontSize)
      .attr('font-weight', '600')
      .attr('fill', darkMode ? '#fff' : '#111')
      .attr('pointer-events', 'none')
      .text((f: any) => f.properties?.district_name || '');

    d3svg.append('text')
      .attr('x', W / 2).attr('y', H - 5)
      .attr('text-anchor', 'middle').attr('font-size', 10).attr('font-weight', '700')
      .attr('fill', darkMode ? '#f59e0b' : '#b45309')
      .text(String(year));
  }, [geojson, year, color, darkMode]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    const ro = new ResizeObserver(() => draw());
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const metrics = useMemo(() => computeMetrics(geojson), [geojson]);

  return (
    <div ref={wrapRef} className={`rounded border overflow-hidden ${
      darkMode ? 'bg-[hsl(25,8%,6%)] border-[hsl(25,8%,14%)]' : 'bg-[hsl(38,30%,97%)] border-[hsl(35,18%,84%)]'
    }`}>
      <svg ref={svgRef} className="block w-full" />
      {metrics && (
        <div className={`px-1 pb-1 text-center leading-tight ${darkMode ? 'text-[hsl(30,8%,40%)]' : 'text-[hsl(28,8%,56%)]'}`}>
          <div className="text-[8px]">{Math.round(metrics.area).toLocaleString()} km²</div>
          <div className="text-[8px]">compact. {metrics.compactness.toFixed(2)}</div>
        </div>
      )}
    </div>
  );
}


export function DistrictEvolutionSearch({ darkMode = false, defaultDistrict, onDistrictChange }: DistrictEvolutionSearchProps) {
  const [allNames, setAllNames] = useState<DistrictName[]>([]);
  const [inputValue, setInputValue] = useState(defaultDistrict ?? '');
  const [suggestions, setSuggestions] = useState<DistrictName[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<EvolutionResponse | null>(null);
  const [selectedMatchIdx, setSelectedMatchIdx] = useState(0);
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const onDistrictChangeRef = useRef(onDistrictChange);
  useEffect(() => { onDistrictChangeRef.current = onDistrictChange; }, [onDistrictChange]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/district-evolution/names`)
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then((data: unknown) => { if (Array.isArray(data)) setAllNames(data); else throw new Error('bad data'); })
      .catch(() =>
        fetch(`${API_BASE}/api/v1/district-evolution/data.csv`)
          .then(r => r.text())
          .then(csv => {
            const seen = new Set<string>();
            const result: DistrictName[] = [];
            for (const line of csv.split('\n').slice(1)) {
              const parts = line.trim().split(',');
              if (parts.length < 5) continue;
              const [src, dst, , , state] = parts;
              for (const district of [src.trim(), dst.trim()]) {
                const key = `${district}|${state.trim()}`;
                if (district && !seen.has(key)) {
                  seen.add(key);
                  result.push({ district, state: state.trim() });
                }
              }
            }
            result.sort((a, b) => a.district.localeCompare(b.district));
            setAllNames(result);
          })
          .catch(() => {})
      );
  }, []);

  useEffect(() => {
    if (defaultDistrict) search(defaultDistrict);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const results = filterNames(allNames, inputValue);
    setSuggestions(results);
    setActiveSuggestion(-1);
    setShowSuggestions(results.length > 0 && inputValue.trim().length > 0);
  }, [inputValue, allNames]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestRef.current && !suggestRef.current.contains(e.target as Node) &&
          inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const search = useCallback(async (district: string, state?: string) => {
    const trimmed = district.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    setResponse(null);
    setSelectedMatchIdx(0);
    setStateDropdownOpen(false);
    setShowSuggestions(false);

    try {
      const params = new URLSearchParams({ district: trimmed, geojson: 'true' });
      if (state) params.set('state', state);
      const res = await fetch(`${API_BASE}/api/v1/district-evolution?${params}`);
      if (!res.ok) throw new Error(`${res.status}`);
      const data: EvolutionResponse = await res.json();
      if (data.matches.length === 0) {
        setError(`No district found matching "${trimmed}".`);
        onDistrictChangeRef.current?.(null);
      } else {
        setResponse(data);
        onDistrictChangeRef.current?.(trimmed);
      }
    } catch {
      setError('Failed to fetch district data. Make sure the API server is running.');
    } finally {
      setLoading(false);
    }
  }, []);

  const selectSuggestion = (s: DistrictName) => {
    setInputValue(s.district);
    setShowSuggestions(false);
    search(s.district, s.state);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0 && suggestions[activeSuggestion]) {
        selectSuggestion(suggestions[activeSuggestion]);
      } else if (inputValue.trim()) {
        setShowSuggestions(false);
        search(inputValue);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const clear = () => {
    setInputValue('');
    setResponse(null);
    setError(null);
    setSelectedMatchIdx(0);
    setShowSuggestions(false);
    onDistrictChangeRef.current?.(null);
    inputRef.current?.focus();
  };

  const match = response?.matches[selectedMatchIdx] ?? null;

  const bg = darkMode ? 'bg-[hsl(25,8%,9%)]' : 'bg-white';
  const border = darkMode ? 'border-[hsl(25,8%,14%)]' : 'border-[hsl(35,18%,84%)]';
  const muted = darkMode ? 'text-[hsl(30,8%,50%)]' : 'text-[hsl(28,8%,48%)]';
  const inputBg = darkMode
    ? 'bg-[hsl(25,8%,12%)] border-[hsl(25,8%,18%)] text-[hsl(35,12%,90%)] placeholder-[hsl(30,8%,36%)]'
    : 'bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)] placeholder-[hsl(28,8%,62%)]';
  const suggBg = darkMode ? 'bg-[hsl(25,8%,10%)] border-[hsl(25,8%,16%)]' : 'bg-white border-[hsl(35,18%,84%)]';
  const suggHover = darkMode ? 'hover:bg-[hsl(25,8%,14%)]' : 'hover:bg-[hsl(35,20%,96%)]';
  const suggActive = darkMode ? 'bg-[hsl(25,8%,16%)] text-amber-400' : 'bg-amber-50 text-amber-800';

  return (
    <div className="relative">
      <div className={`px-4 py-3 border-b ${border} ${bg}`}>
        <div className="relative">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${muted}`} />
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                placeholder="Type a district name, e.g. 24 Para, Coimbatore, Bombay…"
                className={`w-full pl-9 pr-8 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 ${inputBg}`}
                autoComplete="off"
                spellCheck={false}
              />
              {inputValue && (
                <button
                  type="button"
                  onClick={clear}
                  className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${muted} hover:text-current`}
                  aria-label="Clear"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {showSuggestions && (
            <div
              ref={suggestRef}
              className={`absolute left-0 right-0 top-full mt-1 z-30 rounded-lg border shadow-lg overflow-hidden ${suggBg}`}
              style={{ maxHeight: 280, overflowY: 'auto' }}
            >
              {suggestions.map((s, i) => (
                <button
                  key={`${s.district}|${s.state}`}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); selectSuggestion(s); }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  className={`w-full text-left px-3 py-2 text-sm flex items-baseline justify-between gap-2 transition-colors ${
                    i === activeSuggestion ? suggActive : `${darkMode ? 'text-[hsl(35,10%,82%)]' : 'text-[hsl(28,20%,14%)]'} ${suggHover}`
                  }`}
                >
                  <span className="font-medium">{s.district}</span>
                  <span className={`text-xs shrink-0 ${i === activeSuggestion ? 'opacity-70' : muted}`}>{s.state}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {response && response.matches.length > 1 && (
          <div className="mt-2 flex items-center gap-2" ref={dropdownRef}>
            <span className={`text-xs ${muted}`}>
              Found in {response.matches.length} states:
            </span>
            <div className="relative">
              <button
                type="button"
                onClick={() => setStateDropdownOpen(o => !o)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                  darkMode
                    ? 'bg-[hsl(25,8%,14%)] border-[hsl(25,8%,20%)] text-[hsl(35,10%,82%)] hover:bg-[hsl(25,8%,18%)]'
                    : 'bg-amber-50 border-amber-200 text-amber-800 hover:bg-amber-100'
                }`}
              >
                {match?.modern_state ?? 'Select state'}
                <ChevronDown className={`h-3 w-3 transition-transform ${stateDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {stateDropdownOpen && (
                <div className={`absolute left-0 top-full mt-1 z-20 rounded-lg border shadow-lg overflow-hidden min-w-[180px] ${suggBg}`}>
                  {response.matches.map((m, i) => (
                    <button
                      key={m.modern_state}
                      type="button"
                      onClick={() => { setSelectedMatchIdx(i); setStateDropdownOpen(false); }}
                      className={`w-full text-left text-xs px-3 py-2 transition-colors ${
                        i === selectedMatchIdx ? suggActive : `${darkMode ? 'text-[hsl(35,10%,78%)]' : 'text-[hsl(28,20%,14%)]'} ${suggHover}`
                      }`}
                    >
                      {m.modern_state}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className={bg}>
        {!response && !loading && !error && (
          <div className={`py-16 text-center ${muted} text-sm`}>
            <Search className="h-10 w-10 mx-auto mb-3 opacity-25" />
            <p>Search for any district to see its boundaries across census years.</p>
            <p className="mt-1 text-xs opacity-70">Splits, merges, and renames are all traced.</p>
          </div>
        )}

        {loading && (
          <div className={`py-16 text-center ${muted} text-sm`}>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-3" />
            <p>Fetching boundaries…</p>
          </div>
        )}

        {error && !loading && (
          <div className="px-4 py-6">
            <p className={`text-sm ${darkMode ? 'text-red-400' : 'text-red-600'}`}>{error}</p>
          </div>
        )}

        {match && !loading && (
          <div className="p-3">
            <div className={`mb-3 px-3 py-2 rounded-lg border text-xs flex items-start gap-3 ${
              darkMode ? 'bg-[hsl(25,8%,12%)] border-[hsl(25,8%,16%)]' : 'bg-amber-50 border-amber-100'
            }`}>
              <span className="mt-0.5 h-3 w-3 rounded-full shrink-0" style={{ background: DISTRICT_COLOR }} />
              <div className="min-w-0">
                <span className={`font-semibold ${darkMode ? 'text-amber-400' : 'text-amber-800'}`}>
                  {response?.query.district}
                </span>
                <span className={` · ${muted}`}>{match.modern_state}</span>
                <div className={`mt-0.5 leading-relaxed ${muted}`}>
                  {CENSUS_YEARS.map((y, i) => {
                    const entries = match.evolution[String(y)];
                    const label = entries?.length ? entries.map(e => e.district).join(' / ') : null;
                    return (
                      <span key={y}>
                        {i > 0 && <span className="opacity-30"> → </span>}
                        <span className={label ? '' : 'opacity-30 italic'}>
                          {label ?? String(y)}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              {CENSUS_YEARS.map(y => {
                const entries = match.evolution[String(y)] ?? [];
                const allFeatures = entries.flatMap(e => e.geojson?.features ?? []);
                const mergedGeo = allFeatures.length ? { type: 'FeatureCollection', features: allFeatures } : null;
                const label = entries.length ? entries.map(e => e.district).join(' / ') : null;
                const labelDiffers = label && label !== response?.query.district;
                return (
                  <div key={y}>
                    {entries.length > 0 ? (
                      <>
                        {mergedGeo ? (
                          <YearMap year={y} geojson={mergedGeo} color={DISTRICT_COLOR} darkMode={darkMode} />
                        ) : (
                          <div className={`rounded border ${darkMode ? 'bg-[hsl(25,8%,6%)] border-[hsl(25,8%,14%)]' : 'bg-[hsl(35,18%,96%)] border-[hsl(35,18%,88%)]'}`}>
                            <div className={`aspect-[5/6] flex flex-col items-center justify-center gap-1 text-[9px] italic ${muted} opacity-60`}>
                              <span>{entries[0].district}</span>
                              <span className="opacity-60">no boundary</span>
                            </div>
                            <p className={`text-center text-[9px] font-bold pb-1 ${darkMode ? 'text-amber-500' : 'text-amber-700'}`}>{y}</p>
                          </div>
                        )}
                        {labelDiffers && mergedGeo && (
                          <p className={`mt-0.5 text-center text-[9px] leading-tight px-0.5 ${muted}`} title={label}>
                            {label}
                          </p>
                        )}
                      </>
                    ) : (
                      <div className={`rounded border ${darkMode ? 'bg-[hsl(25,8%,6%)] border-[hsl(25,8%,14%)]' : 'bg-[hsl(35,18%,96%)] border-[hsl(35,18%,88%)]'}`}>
                        <div className={`aspect-[5/6] flex items-center justify-center text-[9px] italic ${muted} opacity-50`}>
                          not extant
                        </div>
                        <p className={`text-center text-[9px] font-bold pb-1 ${darkMode ? 'text-amber-500' : 'text-amber-700'}`}>{y}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
