import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Feature } from 'geojson';
import { Search, X } from 'lucide-react';

interface EvoNode {
  id: string;
  year: number;
  name: string;
  stateName: string;
  chainId: number;
  color: string;
  geojsonMatch: string | null;
  geojsonState: string | null;
  geojsonScore: number;
}

interface EvolutionData {
  years: number[];
  nodes: EvoNode[];
  links: { sourceId: string; targetId: string }[];
  chains: { chainId: number; canonicalName: string; originState: string; color: string }[];
}

interface IndiaEvolutionMapProps {
  darkMode?: boolean;
  evolutionFile?: string;
  geojsonYearMap?: Record<number, number>;
  originYear?: number;
}

interface PanelState {
  hovered: string | null;
  clickedChainId: number | null;
  chainSets: Map<number, Set<string>>;
  colorLookup: Map<string, EvoNode>;
  darkMode: boolean;
}

const YEARS_DEFAULT = [1951, 1961, 1971, 1981, 1991, 2001, 2011, 2024];
const GEOJSON_YEAR_DEFAULT: Record<number, number> = {
  1951: 1951, 1961: 1961, 1971: 1971, 1981: 1981,
  1991: 1991, 2001: 2001, 2011: 2011, 2024: 2011,
};
const HOVER_COLOR   = '#f59e0b';
const CLICKED_COLOR = '#ef4444';

const geojsonCache = new Map<string, any>();
const evoCaches = new Map<string, EvolutionData>();

function isSriLanka(f: Feature): boolean {
  if (!f.geometry) return false;
  const geom = f.geometry as any;
  const rings: number[][][] = geom.type === 'Polygon'
    ? geom.coordinates
    : geom.type === 'MultiPolygon'
    ? geom.coordinates.flat(1)
    : [];
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const ring of rings) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  return maxX < 82.1 && minX > 79.4 && maxY < 10.0;
}

function prepareGeoJSON(gj: any): any {
  return {
    type: 'FeatureCollection',
    features: gj.features
      .filter((f: Feature) => !isSriLanka(f))
      .map((f: Feature) => {
        const d = (f.properties?.district_name || '').toLowerCase();
        const s = (f.properties?.state_name || '').toLowerCase();
        return {
          ...f,
          properties: { ...f.properties, _dname: d, _sname: s, _key: `${s}:${d}` },
        };
      }),
  };
}

function makeGeoJSONFetcher(gjYearMap: Record<number, number>, firstYear: number) {
  return function fetchGeoJSON(year: number): Promise<any> {
    const gjYear = gjYearMap[year] ?? year;
    const cacheKey = String(gjYear);
    const yearKey = String(year);
    if (geojsonCache.has(yearKey)) return Promise.resolve(geojsonCache.get(yearKey)!);
    const alreadyParsed = gjYear !== year && geojsonCache.has(cacheKey);
    const base = alreadyParsed
      ? Promise.resolve(geojsonCache.get(cacheKey)!)
      : fetch(`/India-${gjYear}-districts.geojson`)
          .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
          .then(gj => { const fc = prepareGeoJSON(gj); geojsonCache.set(cacheKey, fc); return fc; });
    return base.then(fc => {
      geojsonCache.set(yearKey, fc);
      return fc;
    });
  };
}

function makeEvoFetcher(evolutionFile: string) {
  return function fetchEvoData(): Promise<EvolutionData> {
    if (evoCaches.has(evolutionFile)) return Promise.resolve(evoCaches.get(evolutionFile)!);
    return fetch(evolutionFile)
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => { evoCaches.set(evolutionFile, d); return d; });
  };
}

function nodeKey(n: EvoNode): string {
  return `${(n.geojsonState || n.stateName).toLowerCase()}:${(n.geojsonMatch || '').toLowerCase()}`;
}

function initPanel(
  svgEl: SVGSVGElement,
  wrapEl: HTMLDivElement,
  fc: any,
  year: number,
  state: PanelState,
  showLabel: boolean,
  refFC: any,
  onEnter: (dname: string, node: EvoNode | null, event: MouseEvent) => void,
  onLeave: () => void,
  onClick: (chainId: number | null) => void,
): (newState: PanelState) => void {
  const { darkMode } = state;
  const W = wrapEl.clientWidth || 200;
  const H = Math.round(W * (showLabel ? 1.35 : 1.1));
  const bgColor    = darkMode ? 'hsl(25, 8%, 6%)' : 'hsl(38, 30%, 97%)';
  const strokeColor = bgColor;

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  svg.attr('width', W).attr('height', H);
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', bgColor);

  const fitTarget = refFC ?? fc;
  const pad = showLabel ? 16 : 8;
  const projection = d3.geoMercator()
    .fitExtent([[pad, pad], [W - pad, H - pad - (showLabel ? 18 : 0)]], fitTarget);
  const path = d3.geoPath().projection(projection);

  const g = svg.append('g');
  const paths = g.selectAll<SVGPathElement, any>('path')
    .data(fc.features)
    .join('path')
    .attr('d', (f: any) => path(f) || '')
    .attr('stroke', strokeColor)
    .attr('stroke-width', 0.3)
    .attr('cursor', 'pointer')
    .attr('tabindex', 0)
    .attr('role', 'button');

  const labelG = svg.append('g').attr('pointer-events', 'none');

  if (showLabel) {
    svg.append('text')
      .attr('x', W / 2).attr('y', H - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-weight', '700')
      .attr('fill', darkMode ? '#f59e0b' : '#b45309')
      .text(year === 2024 ? '2024 (est.)' : String(year));
  }

  function applyStyle(s: PanelState) {
    const { hovered, clickedChainId, chainSets, colorLookup: cl, darkMode: dm } = s;
    const noDataColor  = dm ? 'hsl(25, 8%, 14%)' : 'hsl(35, 18%, 88%)';
    const clickedKeys = clickedChainId != null ? (chainSets.get(clickedChainId) ?? new Set()) : null;

    paths
      .attr('fill', (f: any) => {
        const key = f.properties._key;
        if (key === hovered) return HOVER_COLOR;
        if (clickedKeys && clickedKeys.has(key)) return CLICKED_COLOR;
        const node = cl.get(key);
        return node ? node.color : noDataColor;
      })
      .attr('fill-opacity', (f: any) => {
        const key = f.properties._key;
        if (!hovered && !clickedKeys) return 0.85;
        return (key === hovered || (clickedKeys && clickedKeys.has(key))) ? 1 : 0.25;
      })
      .attr('stroke-width', (f: any) => f.properties._key === hovered ? 1.2 : 0.3);

    labelG.selectAll('*').remove();
    const labelFeatures = hovered
      ? fc.features.filter((f: any) => f.properties._key === hovered)
      : clickedKeys
      ? fc.features.filter((f: any) => clickedKeys.has(f.properties._key))
      : [];
    if (labelFeatures.length) {
      labelG.selectAll('text')
        .data(labelFeatures)
        .join('text')
        .attr('x', (f: any) => path.centroid(f)[0])
        .attr('y', (f: any) => path.centroid(f)[1] + 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', showLabel ? 7 : 10).attr('font-weight', '600')
        .attr('fill', dm ? '#fff' : '#111')
        .text((f: any) => f.properties?.district_name || '');
    }
  }

  paths
    .on('mouseenter', function(event: MouseEvent, f: any) {
      onEnter(f.properties._key, state.colorLookup.get(f.properties._key) ?? null, event);
    })
    .on('mouseleave', function() { onLeave(); })
    .on('click', function(_event: MouseEvent, f: any) {
      const node = state.colorLookup.get(f.properties._key);
      onClick(node?.chainId ?? null);
    });

  applyStyle(state);

  return (newState: PanelState) => {
    Object.assign(state, newState);
    applyStyle(state);
  };
}

function SegBtn({ label, active, darkMode, onClick }: { label: string; active: boolean; darkMode: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
        active
          ? darkMode ? 'bg-[hsl(25,8%,18%)] text-amber-400' : 'bg-white text-amber-700 shadow-sm'
          : darkMode ? 'text-[hsl(30,8%,52%)] hover:text-[hsl(35,10%,78%)]' : 'text-[hsl(28,8%,44%)] hover:text-[hsl(28,20%,22%)]'
      }`}
    >
      {label}
    </button>
  );
}

function Panel({
  year, fc, refFC, colorLookup, chainSets, darkMode, showLabel,
  hovered, clickedChainId, onHover, onLeave, onClick,
}: {
  year: number;
  fc: any;
  refFC: any;
  colorLookup: Map<string, EvoNode>;
  chainSets: Map<number, Set<string>>;
  darkMode: boolean;
  showLabel: boolean;
  hovered: string | null;
  clickedChainId: number | null;
  onHover: (dname: string, node: EvoNode | null, event: MouseEvent) => void;
  onLeave: () => void;
  onClick: (chainId: number | null) => void;
}) {
  const svgRef     = useRef<SVGSVGElement>(null);
  const wrapRef    = useRef<HTMLDivElement>(null);
  const updaterRef = useRef<((s: PanelState) => void) | null>(null);
  const stateRef   = useRef<PanelState>({ hovered, clickedChainId, chainSets, colorLookup, darkMode });

  useEffect(() => {
    if (!svgRef.current || !wrapRef.current || !fc) return;
    stateRef.current = { hovered, clickedChainId, chainSets, colorLookup, darkMode };
    updaterRef.current = initPanel(
      svgRef.current, wrapRef.current, fc, year,
      stateRef.current, showLabel, refFC, onHover, onLeave, onClick,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc, year, colorLookup, chainSets, darkMode, showLabel, refFC]);

  useEffect(() => {
    updaterRef.current?.({ hovered, clickedChainId, chainSets, colorLookup, darkMode });
  }, [hovered, clickedChainId, chainSets, colorLookup, darkMode]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (!svgRef.current || !wrapRef.current || !fc) return;
      stateRef.current = { ...stateRef.current, colorLookup, darkMode };
      updaterRef.current = initPanel(
        svgRef.current, wrapRef.current, fc, year,
        stateRef.current, showLabel, refFC, onHover, onLeave, onClick,
      );
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc, year, colorLookup, chainSets, darkMode, showLabel, refFC]);

  const selectedNames = useMemo(() => {
    if (clickedChainId == null) return null;
    const keys = chainSets.get(clickedChainId);
    if (!keys) return null;
    const names: string[] = [];
    for (const [key, node] of colorLookup) {
      if (keys.has(key)) names.push(node.name);
    }
    return names.length ? names : null;
  }, [clickedChainId, chainSets, colorLookup]);

  return (
    <div
      ref={wrapRef}
      className={`rounded border overflow-hidden ${darkMode ? 'bg-[hsl(25,8%,6%)] border-[hsl(25,8%,14%)]' : 'bg-[hsl(38,30%,97%)] border-[hsl(35,18%,84%)]'}`}
    >
      {showLabel && selectedNames && (
        <div className={`px-1.5 py-0.5 text-center text-[9px] font-semibold truncate leading-tight ${
          darkMode ? 'bg-[hsl(22,60%,14%)] text-[hsl(22,70%,60%)]' : 'bg-[hsl(28,80%,96%)] text-[hsl(22,62%,38%)]'
        }`}>
          {selectedNames.join(' · ')}
        </div>
      )}
      <svg ref={svgRef} className="block w-full" role="img" aria-label={`India district map ${year}`} />
    </div>
  );
}

export function IndiaEvolutionMap({
  darkMode: darkModeProp,
  evolutionFile = '/evolution-data/india_evolution.json',
  geojsonYearMap = GEOJSON_YEAR_DEFAULT,
  originYear = 1951,
}: IndiaEvolutionMapProps) {
  const darkMode = darkModeProp ?? false;
  const YEARS = useMemo(() => {
    const allYears = new Set([...Object.keys(geojsonYearMap).map(Number)]);
    return [...allYears].sort((a, b) => a - b);
  }, [geojsonYearMap]);

  const fetchGeoJSON = useMemo(
    () => makeGeoJSONFetcher(geojsonYearMap, YEARS[0]),
    [geojsonYearMap, YEARS],
  );
  const fetchEvoData = useMemo(
    () => makeEvoFetcher(evolutionFile),
    [evolutionFile],
  );

  const [mode, setMode]               = useState<'single' | 'grid'>('grid');
  const [yearIdx, setYearIdx]         = useState(0);
  const [allFCs, setAllFCs]           = useState<Map<number, any>>(new Map());
  const [evoData, setEvoData]         = useState<EvolutionData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [hovered, setHovered]         = useState<string | null>(null);
  const [clickedChainId, setClickedChainId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef                     = useRef<HTMLInputElement>(null);
  const [tooltip, setTooltip]         = useState<{
    x: number; y: number; name: string; stateName: string;
    chainName?: string; originState?: string;
    prevName?: string; nextName?: string; color: string;
  } | null>(null);

  const year = YEARS[yearIdx];

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    const toLoad = mode === 'grid' ? YEARS : [YEARS[0], year];
    const needed: number[] = [], cached: [number, any][] = [];
    for (const y of toLoad) {
      const fc = geojsonCache.get(String(y));
      if (fc) cached.push([y, fc]); else needed.push(y);
    }
    Promise.all(needed.map(y => fetchGeoJSON(y).then(fc => [y, fc] as [number, any])))
      .then(fetched => {
        if (ac.signal.aborted) return;
        setAllFCs(new Map([...cached, ...fetched]));
        setLoading(false);
      })
      .catch(() => { if (!ac.signal.aborted) setLoading(false); });
    return () => ac.abort();
  }, [mode, year, YEARS, fetchGeoJSON]);

  const refFC = allFCs.get(YEARS[0]) ?? null;

  useEffect(() => {
    const ac = new AbortController();
    fetchEvoData().then(d => { if (!ac.signal.aborted) setEvoData(d); }).catch(() => {});
    return () => ac.abort();
  }, [fetchEvoData]);

  const derived = useMemo(() => {
    const emptyColorLookups = new Map<number, Map<string, EvoNode>>();
    const emptyChainSets    = new Map<number, Set<string>>();
    const emptyPrevNext     = new Map<string, { prev?: string; next?: string }>();
    const emptyChainMeta    = new Map<number, { name: string; state: string }>();
    if (!evoData) return { colorLookups: emptyColorLookups, chainSets: emptyChainSets, prevNextLookup: emptyPrevNext, chainMeta: emptyChainMeta };

    const colorLookups = new Map<number, Map<string, EvoNode>>();
    const chainSets    = new Map<number, Set<string>>();
    for (const y of YEARS) colorLookups.set(y, new Map());

    for (const n of evoData.nodes) {
      if (!n.geojsonMatch) continue;
      const k = nodeKey(n);
      colorLookups.get(n.year)?.set(k, n);
      if (!chainSets.has(n.chainId)) chainSets.set(n.chainId, new Set());
      chainSets.get(n.chainId)!.add(k);
    }

    const nodeById = new Map(evoData.nodes.map(n => [n.id, n]));
    const fwd = new Map<string, string[]>();
    const bwd = new Map<string, string[]>();
    for (const lk of evoData.links) {
      if (!fwd.has(lk.sourceId)) fwd.set(lk.sourceId, []);
      if (!bwd.has(lk.targetId)) bwd.set(lk.targetId, []);
      fwd.get(lk.sourceId)!.push(lk.targetId);
      bwd.get(lk.targetId)!.push(lk.sourceId);
    }
    const prevNextLookup = new Map<string, { prev?: string; next?: string }>();
    for (const n of evoData.nodes) {
      if (!n.geojsonMatch) continue;
      const prevNames = (bwd.get(n.id) || []).map(id => nodeById.get(id)?.name).filter(Boolean) as string[];
      const nextNames = (fwd.get(n.id) || []).map(id => nodeById.get(id)?.name).filter(Boolean) as string[];
      const prev = prevNames.length && prevNames[0] !== n.name ? prevNames.join(', ') : undefined;
      const next = nextNames.length && !(nextNames.length === 1 && nextNames[0] === n.name) ? nextNames.join(', ') : undefined;
      prevNextLookup.set(`${n.year}:${nodeKey(n)}`, { prev, next });
    }

    const chainMeta = new Map(evoData.chains.map(c => [c.chainId, { name: c.canonicalName, state: c.originState }]));

    return { colorLookups, chainSets, prevNextLookup, chainMeta };
  }, [evoData, YEARS]);

  const { colorLookups, chainSets, prevNextLookup, chainMeta } = derived;

  const handleHover = useCallback((key: string, node: EvoNode | null, event: MouseEvent) => {
    setHovered(key);
    if (!node) { setTooltip(null); return; }
    const pn = prevNextLookup.get(`${node.year}:${key}`);
    const meta = chainMeta.get(node.chainId);
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      name: node.name,
      stateName: node.stateName,
      chainName: meta?.name !== node.name ? meta?.name : undefined,
      originState: meta?.state !== node.stateName ? meta?.state : undefined,
      prevName: pn?.prev,
      nextName: pn?.next,
      color: node.color,
    });
  }, [prevNextLookup, chainMeta]);

  const handleLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback((chainId: number | null) => {
    setClickedChainId(prev => prev === chainId ? null : chainId);
    setSearchQuery('');
  }, []);

  const searchSuggestions = useMemo(() => {
    if (!evoData || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().replace(/[^a-z0-9]/g, '');
    const seen = new Set<number>();
    const prefix: { chainId: number; name: string; state: string }[] = [];
    const substr: { chainId: number; name: string; state: string }[] = [];
    for (const chain of evoData.chains) {
      if (seen.has(chain.chainId)) continue;
      const norm = chain.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm.startsWith(q)) { seen.add(chain.chainId); prefix.push({ chainId: chain.chainId, name: chain.canonicalName, state: chain.originState }); }
      else if (norm.includes(q)) { seen.add(chain.chainId); substr.push({ chainId: chain.chainId, name: chain.canonicalName, state: chain.originState }); }
    }
    return [...prefix, ...substr].slice(0, 20);
  }, [evoData, searchQuery]);

  const handleSearchSelect = useCallback((chainId: number, name: string) => {
    setClickedChainId(chainId);
    setSearchQuery(name);
    setSearchOpen(false);
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSearchOpen(false);
    setClickedChainId(null);
  }, []);

  const resetMode = (m: 'single' | 'grid') => {
    setMode(m);
    setClickedChainId(null);
    setHovered(null);
    setTooltip(null);
    setSearchQuery('');
  };

  const selectedMeta = clickedChainId != null ? chainMeta.get(clickedChainId) : null;
  const panelProps = { chainSets, darkMode, hovered, clickedChainId, onHover: handleHover, onLeave: handleLeave, onClick: handleClick };

  const tooltipEl = tooltip && (
    <div
      className={`fixed z-50 pointer-events-none rounded-lg shadow-lg border text-xs p-3 ${
        darkMode ? 'bg-[hsl(25,8%,9%)] border-[hsl(25,8%,14%)] text-[hsl(35,12%,90%)]' : 'bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)]'
      }`}
      style={{ left: Math.min(tooltip.x + 14, window.innerWidth - 248), top: tooltip.y - 10, maxWidth: 240 }}
    >
      <div className="font-bold text-sm mb-0.5" style={{ color: tooltip.color }}>{tooltip.name}</div>
      <div className={`mb-1 text-[10px] ${darkMode ? 'text-[hsl(30,8%,52%)]' : 'text-[hsl(28,8%,44%)]'}`}>{tooltip.stateName}</div>
      {tooltip.chainName && (
        <div className={`mb-1 ${darkMode ? 'text-[hsl(30,8%,52%)]' : 'text-[hsl(28,8%,44%)]'}`}>
          Origin: <span className="font-medium">{tooltip.chainName}</span>
          {tooltip.originState && ` (${tooltip.originState})`}
        </div>
      )}
      {tooltip.prevName && <div><span className={darkMode ? 'text-[hsl(30,8%,42%)]' : 'text-[hsl(28,8%,54%)]'}>Carved from: </span>{tooltip.prevName}</div>}
      {tooltip.nextName && <div><span className={darkMode ? 'text-[hsl(30,8%,42%)]' : 'text-[hsl(28,8%,54%)]'}>Split into: </span>{tooltip.nextName}</div>}
    </div>
  );

  return (
    <div className="relative">
      <div className={`flex items-center justify-between px-3 py-2 border-b ${darkMode ? 'border-[hsl(25,8%,14%)]' : 'border-[hsl(35,16%,88%)]'}`}>
        <div className={`flex items-center gap-1 p-1 rounded-lg ${darkMode ? 'bg-[hsl(25,8%,13%)]' : 'bg-[hsl(35,20%,93%)]'}`}>
          <SegBtn label="All years" active={mode === 'grid'} darkMode={darkMode} onClick={() => resetMode('grid')} />
          <SegBtn label="Single year" active={mode === 'single'} darkMode={darkMode} onClick={() => resetMode('single')} />
        </div>

        <div className="flex items-center gap-2">
          {/* Search box */}
          <div className="relative">
            <div className={`flex items-center gap-1.5 rounded-md px-2 py-1 border text-xs ${
              darkMode
                ? 'bg-[hsl(25,8%,11%)] border-[hsl(25,8%,18%)] text-[hsl(35,12%,82%)]'
                : 'bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)]'
            }`}>
              <Search className="w-3 h-3 shrink-0 opacity-50" />
              <input
                ref={searchRef}
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                placeholder="Search district…"
                className="bg-transparent outline-none w-28 placeholder:opacity-40"
              />
              {searchQuery && (
                <button onClick={clearSearch} aria-label="Clear search" className="opacity-50 hover:opacity-100">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {searchOpen && searchSuggestions.length > 0 && (
              <div className={`absolute right-0 top-full mt-1 z-50 rounded-md shadow-lg border overflow-hidden text-xs ${
                darkMode
                  ? 'bg-[hsl(25,8%,9%)] border-[hsl(25,8%,18%)] text-[hsl(35,12%,82%)]'
                  : 'bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)]'
              }`} style={{ minWidth: '180px', maxHeight: '200px', overflowY: 'auto' }}>
                {searchSuggestions.map(s => (
                  <button
                    key={s.chainId}
                    onMouseDown={() => handleSearchSelect(s.chainId, s.name)}
                    className={`w-full text-left px-3 py-1.5 flex flex-col gap-0.5 ${
                      darkMode ? 'hover:bg-[hsl(25,8%,14%)]' : 'hover:bg-amber-50'
                    }`}
                  >
                    <span className="font-medium">{s.name}</span>
                    {s.state && <span className={`text-[10px] ${darkMode ? 'text-[hsl(30,8%,46%)]' : 'text-[hsl(28,8%,52%)]'}`}>{s.state}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedMeta ? (
            <span className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${darkMode ? 'bg-[hsl(25,8%,14%)] text-[hsl(35,10%,82%)]' : 'bg-amber-50 text-amber-800 border border-amber-200'}`}>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 shrink-0" />
              {selectedMeta.name}
              {selectedMeta.state && <span className={darkMode ? 'text-[hsl(30,8%,44%)]' : 'text-amber-600'}> · {selectedMeta.state}</span>}
              <button onClick={() => { setClickedChainId(null); setSearchQuery(''); }} aria-label="Clear selection" className={`ml-1 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[hsl(28,62%,48%)] rounded ${darkMode ? 'text-[hsl(30,8%,44%)] hover:text-[hsl(35,10%,72%)]' : 'text-amber-400 hover:text-amber-700'}`}>✕</button>
            </span>
          ) : (
            <span className={`text-xs italic hidden sm:inline ${darkMode ? 'text-[hsl(30,8%,36%)]' : 'text-[hsl(28,8%,58%)]'}`}>
              Click a district to trace its lineage
            </span>
          )}
          {loading && <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-amber-500 shrink-0" />}
        </div>
      </div>

      {mode === 'single' && (
        <div className={`flex items-center gap-3 px-4 py-2 border-b ${darkMode ? 'border-[hsl(25,8%,14%)]' : 'border-[hsl(35,16%,92%)]'}`}>
          <span className={`text-sm font-semibold w-10 shrink-0 ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>{year}</span>
          <div className="flex-1 overflow-x-auto">
            <div className="flex items-center gap-1">
            {YEARS.map((y, i) => (
              <button key={y} onClick={() => setYearIdx(i)} aria-label={String(y)} aria-pressed={i === yearIdx} className="flex-1 min-w-[28px] flex flex-col items-center gap-1 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] rounded-sm">
                <div className={`h-2 w-full rounded-full transition-all ${
                  i === yearIdx ? 'bg-amber-500' : darkMode ? 'bg-[hsl(25,8%,18%)] group-hover:bg-[hsl(25,8%,22%)]' : 'bg-[hsl(35,14%,88%)] group-hover:bg-[hsl(35,14%,82%)]'
                }`} />
                <span className={`text-[9px] font-mono leading-none ${
                  i === yearIdx
                    ? darkMode ? 'text-amber-400' : 'text-amber-700'
                    : darkMode ? 'text-[hsl(30,8%,40%)]' : 'text-[hsl(28,8%,58%)]'
                }`}>{String(y)}</span>
              </button>
            ))}
            </div>
          </div>
        </div>
      )}

      {mode === 'single' && allFCs.get(year) && (
        <Panel
          year={year}
          fc={allFCs.get(year)}
          refFC={refFC}
          colorLookup={colorLookups.get(year) ?? new Map()}
          showLabel={false}
          {...panelProps}
        />
      )}

      {mode === 'grid' && (
        <div className="p-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {YEARS.map(y => allFCs.get(y) && (
            <Panel
              key={y}
              year={y}
              fc={allFCs.get(y)}
              refFC={refFC}
              colorLookup={colorLookups.get(y) ?? new Map()}
              showLabel
              {...panelProps}
            />
          ))}
        </div>
      )}

      <div className={`px-4 py-2 flex items-center gap-4 text-[10px] border-t ${darkMode ? 'border-[hsl(25,8%,14%)] text-[hsl(30,8%,36%)]' : 'border-[hsl(35,16%,92%)] text-[hsl(28,8%,58%)]'}`}>
        {clickedChainId != null && (
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-red-500" />
            Selected lineage
          </span>
        )}
        <span className="flex items-center gap-1">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: darkMode ? 'hsl(25,8%,22%)' : 'hsl(35,14%,82%)' }} />
          No {originYear} origin
        </span>
        {evoData && (
          <span className="ml-auto">{evoData.chains.length} origin districts</span>
        )}
      </div>

      {tooltipEl}
    </div>
  );
}
