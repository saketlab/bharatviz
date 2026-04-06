import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as d3 from 'd3';
import { Feature } from 'geojson';

interface EvoNode {
  id: string;
  year: number;
  name: string;
  type: string;
  chainId: number;
  color: string;
  geojsonMatch: string | null;
  geojsonScore: number;
}

interface EvolutionData {
  years: number[];
  nodes: EvoNode[];
  links: { sourceId: string; targetId: string }[];
  chains: { chainId: number; canonicalName: string; color: string }[];
}

interface EvolutionMapProps {
  darkMode?: boolean;
}

interface PanelState {
  hovered: string | null;
  clickedChainId: number | null;
  chainSets: Map<number, Set<string>>;
  colorLookup: Map<string, EvoNode>;
  darkMode: boolean;
}

const YEARS = [1872, 1881, 1891, 1901, 1911, 1921, 1931, 1941];
const HOVER_COLOR   = '#f59e0b';
const CLICKED_COLOR = '#ef4444';

const geojsonCache = new Map<number, any>();
let evoCache: EvolutionData | null = null;
let referenceFC: any = null;

function filterBombay(gj: any): any {
  const features = gj.features
    .filter((f: Feature) => (f.properties?.state_name || '').includes('ombay'))
    .map((f: Feature) => ({
      ...f,
      properties: {
        ...f.properties,
        _dname: (f.properties?.district_name || '').toLowerCase(),
      },
    }));
  return { type: 'FeatureCollection', features };
}

function fetchGeoJSON(year: number): Promise<any> {
  if (geojsonCache.has(year)) return Promise.resolve(geojsonCache.get(year)!);
  return fetch(`/India-${year}-districts.geojson`)
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(gj => {
      const fc = filterBombay(gj);
      geojsonCache.set(year, fc);
      if (year === 1872) referenceFC = fc;
      return fc;
    });
}

function fetchEvoData(): Promise<EvolutionData> {
  if (evoCache) return Promise.resolve(evoCache);
  return fetch('/evolution/bombay_evolution.json')
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(d => { evoCache = d; return d; });
}

function buildChainSets(evoData: EvolutionData): Map<number, Set<string>> {
  const result = new Map<number, Set<string>>();
  for (const n of evoData.nodes) {
    if (!n.geojsonMatch) continue;
    if (!result.has(n.chainId)) result.set(n.chainId, new Set());
    result.get(n.chainId)!.add(n.geojsonMatch.toLowerCase());
  }
  return result;
}

function initPanel(
  svgEl: SVGSVGElement,
  wrapEl: HTMLDivElement,
  fc: any,
  year: number,
  state: PanelState,
  showLabel: boolean,
  onEnter: (dname: string, node: EvoNode | null, event: MouseEvent) => void,
  onLeave: () => void,
  onClick: (chainId: number | null) => void,
): (newState: PanelState) => void {
  const { colorLookup, darkMode } = state;
  const is1901 = year === 1901;
  const W = wrapEl.clientWidth || 200;
  const H = Math.round(W * (showLabel ? 1.12 : 0.75));
  const bgColor     = darkMode ? '#0f0f0f' : '#f0f4f8';
  const strokeColor = darkMode ? '#1f2937' : '#ffffff';

  const svg = d3.select(svgEl);
  svg.selectAll('*').remove();
  svg.attr('width', W).attr('height', H);
  svg.append('rect').attr('width', W).attr('height', H).attr('fill', bgColor);

  const fitTarget = referenceFC ?? fc;
  const pad = showLabel ? 20 : 10;
  const projection = d3.geoMercator()
    .fitExtent([[pad, pad], [W - pad, H - pad - (showLabel ? 16 : 0)]], fitTarget);
  const path = d3.geoPath().projection(projection);

  const g = svg.append('g');
  const paths = g.selectAll<SVGPathElement, any>('path')
    .data(fc.features)
    .join('path')
    .attr('d', (f: any) => path(f) || '')
    .attr('stroke', strokeColor)
    .attr('stroke-width', 0.4)
    .attr('cursor', is1901 ? 'default' : 'pointer');

  const labelG = svg.append('g').attr('pointer-events', 'none');

  if (showLabel) {
    svg.append('text')
      .attr('x', W / 2).attr('y', H - 4)
      .attr('text-anchor', 'middle')
      .attr('font-size', 11).attr('font-weight', '700')
      .attr('fill', darkMode ? '#f59e0b' : '#b45309')
      .text(year);
  }

  if (is1901) {
    svg.append('text')
      .attr('x', W / 2).attr('y', H / 2)
      .attr('text-anchor', 'middle')
      .attr('font-size', showLabel ? 9 : 13).attr('font-weight', '600')
      .attr('fill', darkMode ? '#4b5563' : '#9ca3af')
      .text(showLabel ? 'No district names' : 'District names unavailable for 1901');
  }

  function applyStyle(s: PanelState) {
    const { hovered, clickedChainId, chainSets, colorLookup: cl, darkMode: dm } = s;
    const noDataColor  = dm ? '#2d2d2d' : '#d1d5db';
    const unknownColor = dm ? '#3d3d2d' : '#e5e0d0';
    const clickedNames = clickedChainId != null ? (chainSets.get(clickedChainId) ?? new Set()) : null;

    paths
      .attr('fill', (f: any) => {
        if (is1901) return noDataColor;
        const dname = f.properties._dname;
        if (dname === hovered) return HOVER_COLOR;
        if (clickedNames && clickedNames.has(dname)) return CLICKED_COLOR;
        const node = cl.get(dname);
        return node ? node.color : unknownColor;
      })
      .attr('fill-opacity', (f: any) => {
        if (is1901) return 0.5;
        const dname = f.properties._dname;
        if (!hovered && !clickedNames) return 0.88;
        return (dname === hovered || (clickedNames && clickedNames.has(dname))) ? 1 : 0.35;
      })
      .attr('stroke-width', (f: any) => f.properties._dname === hovered ? 1.5 : 0.4);

    labelG.selectAll('*').remove();
    if (!is1901 && hovered) {
      labelG.selectAll('text')
        .data(fc.features.filter((f: any) => f.properties._dname === hovered))
        .join('text')
        .attr('x', (f: any) => path.centroid(f)[0])
        .attr('y', (f: any) => path.centroid(f)[1] + 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', showLabel ? 8 : 11).attr('font-weight', '600')
        .attr('fill', dm ? '#fff' : '#111')
        .text((f: any) => f.properties?.district_name || '');
    }
  }

  if (!is1901) {
    paths
      .on('mouseenter', function(event: MouseEvent, f: any) {
        onEnter(f.properties._dname, state.colorLookup.get(f.properties._dname) ?? null, event);
      })
      .on('mouseleave', function() { onLeave(); })
      .on('click', function(_event: MouseEvent, f: any) {
        const node = state.colorLookup.get(f.properties._dname);
        onClick(node?.chainId ?? null);
      });
  }

  applyStyle(state);

  return (newState: PanelState) => {
    Object.assign(state, newState);
    applyStyle(state);
  };
}

function Panel({
  year, fc, colorLookup, chainSets, darkMode, showLabel,
  hovered, clickedChainId, onHover, onLeave, onClick,
}: {
  year: number;
  fc: any;
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
      stateRef.current, showLabel, onHover, onLeave, onClick,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc, year, colorLookup, chainSets, darkMode, showLabel]);

  useEffect(() => {
    updaterRef.current?.({ hovered, clickedChainId, chainSets, colorLookup, darkMode });
  }, [hovered, clickedChainId, chainSets, colorLookup, darkMode]);

  useEffect(() => {
    const ro = new ResizeObserver(() => {
      if (!svgRef.current || !wrapRef.current || !fc) return;
      stateRef.current = { ...stateRef.current, colorLookup, darkMode };
      updaterRef.current = initPanel(
        svgRef.current, wrapRef.current, fc, year,
        stateRef.current, showLabel, onHover, onLeave, onClick,
      );
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fc, year, colorLookup, chainSets, darkMode, showLabel]);

  return (
    <div
      ref={wrapRef}
      className={`rounded border overflow-hidden ${showLabel ? '' : 'relative w-full'} ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}
    >
      <svg ref={svgRef} className="block w-full" />
    </div>
  );
}

export function EvolutionMap({ darkMode = false }: EvolutionMapProps) {
  const [mode, setMode]               = useState<'single' | 'grid'>('grid');
  const [yearIdx, setYearIdx]         = useState(0);
  const [allFCs, setAllFCs]           = useState<Map<number, any>>(new Map());
  const [evoData, setEvoData]         = useState<EvolutionData | null>(null);
  const [loading, setLoading]         = useState(true);
  const [hovered, setHovered]         = useState<string | null>(null);
  const [clickedChainId, setClickedChainId] = useState<number | null>(null);
  const [tooltip, setTooltip]         = useState<{
    x: number; y: number; name: string; chainName?: string;
    prevName?: string; nextName?: string; color: string; type: string;
  } | null>(null);

  const year = YEARS[yearIdx];

  useEffect(() => {
    setLoading(true);
    const toLoad = mode === 'grid' ? YEARS : [1872, year];
    // Skip years already cached
    const needed = toLoad.filter(y => !geojsonCache.has(y));
    const cached  = toLoad.filter(y => geojsonCache.has(y)).map(y => [y, geojsonCache.get(y)] as [number, any]);
    Promise.all(needed.map(y => fetchGeoJSON(y).then(fc => [y, fc] as [number, any])))
      .then(fetched => {
        setAllFCs(new Map([...cached, ...fetched]));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [mode, year]);

  useEffect(() => { fetchEvoData().then(setEvoData).catch(() => {}); }, []);

  const colorLookups = useMemo(() => {
    if (!evoData) return new Map<number, Map<string, EvoNode>>();
    const result = new Map<number, Map<string, EvoNode>>();
    for (const y of YEARS) {
      const m = new Map<string, EvoNode>();
      for (const n of evoData.nodes) {
        if (n.year === y && n.geojsonMatch) m.set(n.geojsonMatch.toLowerCase(), n);
      }
      result.set(y, m);
    }
    return result;
  }, [evoData]);

  const chainSets = useMemo(() =>
    evoData ? buildChainSets(evoData) : new Map<number, Set<string>>()
  , [evoData]);

  const prevNextLookup = useMemo(() => {
    if (!evoData) return new Map<string, { prev?: string; next?: string }>();
    const nodeById = new Map(evoData.nodes.map(n => [n.id, n]));
    const fwd = new Map<string, string[]>();
    const bwd = new Map<string, string[]>();
    for (const lk of evoData.links) {
      if (!fwd.has(lk.sourceId)) fwd.set(lk.sourceId, []);
      if (!bwd.has(lk.targetId)) bwd.set(lk.targetId, []);
      fwd.get(lk.sourceId)!.push(lk.targetId);
      bwd.get(lk.targetId)!.push(lk.sourceId);
    }
    const result = new Map<string, { prev?: string; next?: string }>();
    for (const n of evoData.nodes) {
      if (!n.geojsonMatch) continue;
      const prevNames = (bwd.get(n.id) || []).map(id => nodeById.get(id)?.name).filter(Boolean) as string[];
      const nextNames = (fwd.get(n.id) || []).map(id => nodeById.get(id)?.name).filter(Boolean) as string[];
      const prev = prevNames.length && prevNames[0] !== n.name ? prevNames.join(', ') : undefined;
      const next = nextNames.length && !(nextNames.length === 1 && nextNames[0] === n.name) ? nextNames.join(', ') : undefined;
      result.set(`${n.year}:${n.geojsonMatch.toLowerCase()}`, { prev, next });
    }
    return result;
  }, [evoData]);

  const chainNames = useMemo(() => {
    if (!evoData) return new Map<number, string>();
    return new Map(evoData.chains.map(c => [c.chainId, c.canonicalName]));
  }, [evoData]);

  const handleHover = useCallback((dname: string, node: EvoNode | null, event: MouseEvent) => {
    setHovered(dname);
    if (!node) { setTooltip(null); return; }
    const pn = prevNextLookup.get(`${node.year}:${dname}`);
    setTooltip({
      x: event.clientX,
      y: event.clientY,
      name: node.name,
      chainName: chainNames.get(node.chainId),
      prevName: pn?.prev,
      nextName: pn?.next,
      color: node.color,
      type: node.type,
    });
  }, [prevNextLookup, chainNames]);

  const handleLeave = useCallback(() => {
    setHovered(null);
    setTooltip(null);
  }, []);

  const handleClick = useCallback((chainId: number | null) => {
    setClickedChainId(prev => prev === chainId ? null : chainId);
  }, []);

  const resetMode = (m: 'single' | 'grid') => {
    setMode(m);
    setClickedChainId(null);
    setHovered(null);
    setTooltip(null);
  };

  const modeToggle = (
    <div className={`flex items-center gap-1 p-1 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
      {(['single', 'grid'] as const).map(m => (
        <button
          key={m}
          onClick={() => resetMode(m)}
          className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
            mode === m
              ? darkMode ? 'bg-gray-700 text-amber-400' : 'bg-white text-amber-700 shadow-sm'
              : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {m === 'single' ? 'Single year' : 'All years'}
        </button>
      ))}
    </div>
  );

  const scrubber = mode === 'single' && (
    <div className="flex items-center gap-3 px-4 py-2">
      <span className={`text-xs font-mono w-10 text-right ${darkMode ? 'text-amber-400' : 'text-amber-700'}`}>
        {year}
      </span>
      <div className="flex-1 flex items-center gap-1">
        {YEARS.map((y, i) => (
          <button key={y} onClick={() => setYearIdx(i)} className="flex-1 flex flex-col items-center gap-0.5">
            <div className={`h-3 w-full rounded-sm transition-all ${
              i === yearIdx ? 'bg-amber-500' : darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'
            }`} />
            <span className={`text-[9px] font-mono ${
              i === yearIdx ? darkMode ? 'text-amber-400' : 'text-amber-700' : darkMode ? 'text-gray-600' : 'text-gray-400'
            }`}>{y}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const legend = (
    <div className={`px-4 pb-3 flex flex-wrap gap-4 text-xs ${darkMode ? 'text-gray-500' : 'text-gray-500'}`}>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#2a8fb0' }} />
        British districts
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: '#b04a2a' }} />
        Princely states
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-amber-400" />
        Hovered
      </span>
      <span className="flex items-center gap-1.5">
        <span className="inline-block w-3 h-3 rounded-sm bg-red-500" />
        Selected chain
      </span>
      {clickedChainId != null && (
        <button
          onClick={() => setClickedChainId(null)}
          className={`ml-auto text-xs underline ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}
        >
          Clear selection
        </button>
      )}
    </div>
  );

  const tooltipEl = tooltip && (
    <div
      className={`fixed z-50 pointer-events-none rounded-lg shadow-lg border text-xs p-3 ${
        darkMode ? 'bg-gray-900 border-gray-700 text-gray-200' : 'bg-white border-gray-200 text-gray-800'
      }`}
      style={{ left: tooltip.x + 14, top: tooltip.y - 10, maxWidth: 220 }}
    >
      <div className="font-bold text-sm mb-0.5" style={{ color: tooltip.color }}>{tooltip.name}</div>
      <div className={`mb-1 text-[10px] ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{tooltip.type}</div>
      {tooltip.chainName && tooltip.chainName !== tooltip.name && (
        <div className={`mb-1 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Chain: <span className="font-medium">{tooltip.chainName}</span>
        </div>
      )}
      {tooltip.prevName && <div><span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>Was: </span>{tooltip.prevName}</div>}
      {tooltip.nextName && <div><span className={darkMode ? 'text-gray-500' : 'text-gray-400'}>Became: </span>{tooltip.nextName}</div>}
      <div className={`mt-1.5 text-[10px] italic ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Click to highlight related districts across all years
      </div>
    </div>
  );

  const panelProps = { chainSets, darkMode, hovered, clickedChainId, onHover: handleHover, onLeave: handleLeave, onClick: handleClick };

  return (
    <div className="relative">
      <div className={`flex items-center justify-between px-4 py-2 border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'}`}>
        {modeToggle}
        {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500" />}
      </div>

      {scrubber}

      {!clickedChainId && (
        <div className={`px-4 py-2 text-xs text-center ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Select a district to highlight related ones across all years
        </div>
      )}

      {mode === 'single' && allFCs.get(year) && (
        <Panel
          year={year}
          fc={allFCs.get(year)}
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
              colorLookup={colorLookups.get(y) ?? new Map()}
              showLabel
              {...panelProps}
            />
          ))}
        </div>
      )}

      {legend}
      {tooltipEl}
    </div>
  );
}
