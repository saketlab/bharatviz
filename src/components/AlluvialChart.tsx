import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { useDarkMode } from '@/hooks/useDarkMode';

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

interface EvoLink {
  sourceId: string;
  targetId: string;
}

interface Chain {
  chainId: number;
  canonicalName: string;
  color: string;
}

interface EvolutionData {
  years: number[];
  nodes: EvoNode[];
  links: EvoLink[];
  chains: Chain[];
}

interface AlluvialChartProps {
  darkMode?: boolean;
  onNodeClick?: (node: EvoNode) => void;
}

const BAND_H   = 14;   // px height of each district band
const BAND_GAP = 3;    // px gap between bands
const LANE_GAP = 28;   // px gap between British and Princely lanes
const COL_W    = 110;  // px width of each year column
const LABEL_W  = 130;  // px for left/right labels
const YEAR_H   = 32;   // px header height for year labels

function buildLayout(data: EvolutionData) {
  const YEARS = data.years;

  const origins1872 = data.nodes.filter(n => n.year === 1872);
  const britishChainIds = new Set(
    origins1872.filter(n => n.type === 'British districts').map(n => n.chainId)
  );
  const princlyChainIds = new Set(
    origins1872.filter(n => n.type !== 'British districts').map(n => n.chainId)
  );

  const fwd = new Map<string, string[]>();
  const bwd = new Map<string, string[]>();
  for (const lk of data.links) {
    if (!fwd.has(lk.sourceId)) fwd.set(lk.sourceId, []);
    if (!bwd.has(lk.targetId)) bwd.set(lk.targetId, []);
    fwd.get(lk.sourceId)!.push(lk.targetId);
    bwd.get(lk.targetId)!.push(lk.sourceId);
  }

  function getLane(node: EvoNode): 'british' | 'princely' {
    if (britishChainIds.has(node.chainId)) return 'british';
    if (princlyChainIds.has(node.chainId)) return 'princely';
    return node.type === 'British districts' ? 'british' : 'princely';
  }

  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));

  const sortOrder = new Map<string, number>(); // nodeId → sort index

  const brit72 = origins1872.filter(n => n.type === 'British districts')
    .sort((a, b) => a.name.localeCompare(b.name));
  const princ72 = origins1872.filter(n => n.type !== 'British districts')
    .sort((a, b) => a.name.localeCompare(b.name));

  brit72.forEach((n, i) => sortOrder.set(n.id, i));
  princ72.forEach((n, i) => sortOrder.set(n.id, i));

  for (let yi = 1; yi < YEARS.length; yi++) {
    const year = YEARS[yi];
    const nodesThisYear = data.nodes.filter(n => n.year === year);

    for (const lane of ['british', 'princely'] as const) {
      const laneNodes = nodesThisYear.filter(n => getLane(n) === lane);
      for (const n of laneNodes) {
        const sources = bwd.get(n.id) || [];
        const srcOrders = sources
          .map(sid => sortOrder.get(sid) ?? Infinity)
          .filter(o => isFinite(o));
        sortOrder.set(n.id, srcOrders.length ? Math.min(...srcOrders) : 9999);
      }
    }
  }

  const nodePos = new Map<string, { x: number; y: number; lane: 'british' | 'princely' }>();

  let maxBrit = 0, maxPrinc = 0;
  for (const y of YEARS) {
    const yn = data.nodes.filter(n => n.year === y);
    maxBrit  = Math.max(maxBrit,  yn.filter(n => getLane(n) === 'british').length);
    maxPrinc = Math.max(maxPrinc, yn.filter(n => getLane(n) === 'princely').length);
  }

  const britLaneH  = maxBrit  * (BAND_H + BAND_GAP);
  const princLaneH = maxPrinc * (BAND_H + BAND_GAP);

  const xForYear = (y: number) => LABEL_W + YEARS.indexOf(y) * COL_W;
  const yLanePrinc = YEAR_H + britLaneH + LANE_GAP;

  for (const y of YEARS) {
    const xi = xForYear(y);
    const nodesY = data.nodes.filter(n => n.year === y);

    for (const lane of ['british', 'princely'] as const) {
      const laneNodes = nodesY
        .filter(n => getLane(n) === lane)
        .sort((a, b) => (sortOrder.get(a.id) ?? 9999) - (sortOrder.get(b.id) ?? 9999));

      const laneYBase = lane === 'british' ? YEAR_H : yLanePrinc;
      laneNodes.forEach((n, i) => {
        nodePos.set(n.id, {
          x: xi,
          y: laneYBase + i * (BAND_H + BAND_GAP),
          lane,
        });
      });
    }
  }

  const svgH = YEAR_H + britLaneH + LANE_GAP + princLaneH + 20;
  const svgW = LABEL_W + YEARS.length * COL_W + LABEL_W;

  return { nodePos, nodeMap, fwd, bwd, britLaneH, princLaneH, xForYear, svgH, svgW, getLane };
}

export function AlluvialChart({ darkMode: darkModeProp, onNodeClick }: AlluvialChartProps) {
  const { dark: darkModeHook } = useDarkMode();
  const darkMode = darkModeProp !== undefined ? darkModeProp : darkModeHook;
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<EvolutionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: EvoNode; sources: string[]; targets: string[] } | null>(null);

  useEffect(() => {
    fetch('/evolution-data/bombay_evolution.json')
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  const layout = useMemo(() => data ? buildLayout(data) : null, [data]);

  useEffect(() => {
    if (!data || !layout || !svgRef.current) return;

    const { nodePos, nodeMap, fwd, bwd, xForYear, svgH, svgW, getLane } = layout;
    const YEARS = data.years;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    svg.attr('width', svgW).attr('height', svgH);

    const textColor    = darkMode ? 'hsl(35, 12%, 82%)' : 'hsl(28, 20%, 22%)';
    const mutedColor   = darkMode ? 'hsl(30, 8%, 55%)' : 'hsl(28, 10%, 55%)';
    const bgColor      = darkMode ? 'hsl(25, 8%, 6%)' : 'hsl(38, 30%, 97%)';
    const laneLineCol  = darkMode ? 'hsl(25, 8%, 16%)' : 'hsl(35, 18%, 88%)';
    const labelBg      = darkMode ? 'hsl(25, 8%, 11%)' : 'hsl(38, 25%, 96%)';

    svg.append('rect').attr('width', svgW).attr('height', svgH).attr('fill', bgColor);

    const divY = layout.britLaneH + YEAR_H + LANE_GAP / 2;
    svg.append('line')
      .attr('x1', LABEL_W).attr('x2', svgW - LABEL_W)
      .attr('y1', divY).attr('y2', divY)
      .attr('stroke', laneLineCol).attr('stroke-width', 1).attr('stroke-dasharray', '4,4');

    const laneLabel = (text: string, y: number) => {
      svg.append('rect')
        .attr('x', 4).attr('y', y - 9).attr('width', LABEL_W - 12).attr('height', 16)
        .attr('fill', labelBg).attr('rx', 3);
      svg.append('text')
        .attr('x', 8).attr('y', y + 4)
        .attr('font-size', 10).attr('font-weight', '600')
        .attr('fill', mutedColor).attr('letter-spacing', '0.05em')
        .text(text);
    };
    laneLabel('BRITISH DISTRICTS', YEAR_H + 2);
    laneLabel('PRINCELY STATES', layout.britLaneH + YEAR_H + LANE_GAP + 2);

    for (const y of YEARS) {
      const x = xForYear(y);
      svg.append('text')
        .attr('x', x + COL_W / 2).attr('y', YEAR_H - 8)
        .attr('text-anchor', 'middle').attr('font-size', 13).attr('font-weight', '700')
        .attr('fill', darkMode ? '#f59e0b' : '#b45309')
        .text(y);

      svg.append('line')
        .attr('x1', x).attr('x2', x)
        .attr('y1', YEAR_H).attr('y2', svgH - 8)
        .attr('stroke', laneLineCol).attr('stroke-width', 1);
    }

    const linkGroup = svg.append('g').attr('class', 'links');

    for (const lk of data.links) {
      const src = nodePos.get(lk.sourceId);
      const dst = nodePos.get(lk.targetId);
      if (!src || !dst) continue;

      const srcNode = nodeMap.get(lk.sourceId)!;
      const x1 = src.x + COL_W;
      const y1 = src.y + BAND_H / 2;
      const x2 = dst.x;
      const y2 = dst.y + BAND_H / 2;
      const cx = (x1 + x2) / 2;

      const isHov = hovered === lk.sourceId || hovered === lk.targetId;

      linkGroup.append('path')
        .attr('d', `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`)
        .attr('fill', 'none')
        .attr('stroke', srcNode.color)
        .attr('stroke-width', isHov ? 3 : 1.5)
        .attr('stroke-opacity', isHov ? 0.9 : (hovered ? 0.15 : 0.5));
    }

    const nodeGroup = svg.append('g').attr('class', 'nodes');

    for (const node of data.nodes) {
      const pos = nodePos.get(node.id);
      if (!pos) continue;

      const isHov = hovered === node.id;
      const isFaded = hovered && !isHov;

      const g = nodeGroup.append('g')
        .attr('class', 'node')
        .attr('cursor', 'pointer')
        .on('mouseenter', function(event) {
          setHovered(node.id);
          const rect = svgRef.current!.getBoundingClientRect();
          const sources = (bwd.get(node.id) || []).map(id => nodeMap.get(id)?.name ?? id);
          const targets = (fwd.get(node.id) || []).map(id => nodeMap.get(id)?.name ?? id);
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            node,
            sources,
            targets,
          });
        })
        .on('mousemove', function(event) {
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip(t => t ? { ...t, x: event.clientX - rect.left, y: event.clientY - rect.top } : null);
        })
        .on('mouseleave', () => { setHovered(null); setTooltip(null); })
        .on('click', () => onNodeClick?.(node));

      g.append('rect')
        .attr('x', pos.x).attr('y', pos.y)
        .attr('width', COL_W - 2).attr('height', BAND_H)
        .attr('fill', node.color)
        .attr('fill-opacity', isFaded ? 0.2 : isHov ? 1.0 : 0.85)
        .attr('rx', 2);

      const prevYearIdx = YEARS.indexOf(node.year) - 1;
      const prevYear = prevYearIdx >= 0 ? YEARS[prevYearIdx] : null;
      const srcName = prevYear ? [...(bwd.get(node.id) || [])].map(id => nodeMap.get(id)?.name)[0] : null;
      const nameChanged = srcName && srcName !== node.name;
      const showLabel = node.year === 1872 || node.year === 1941 || nameChanged;

      if (showLabel || isHov) {
        const isFirst = node.year === 1872;
        const isLast  = node.year === 1941;
        const labelX = isFirst ? pos.x - 4 : isLast ? pos.x + COL_W - 2 + 4 : pos.x + 2;
        const anchor  = isFirst ? 'end' : isLast ? 'start' : 'start';

        g.append('text')
          .attr('x', labelX).attr('y', pos.y + BAND_H - 3)
          .attr('text-anchor', anchor)
          .attr('font-size', isFirst || isLast ? 11 : 9)
          .attr('font-weight', isHov ? '600' : '400')
          .attr('fill', isHov ? node.color : isFaded ? mutedColor : textColor)
          .attr('pointer-events', 'none')
          .text(node.name);
      }
    }

  }, [data, layout, hovered, darkMode, onNodeClick]);

  const tooltipEl = tooltip && (
    <div
      className={`absolute z-50 pointer-events-none rounded-lg shadow-lg border text-xs p-3 max-w-[220px] ${
        darkMode ? 'bg-[hsl(25,8%,9%)] border-[hsl(25,8%,14%)] text-[hsl(35,12%,90%)]' : 'bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)]'
      }`}
      style={{ left: tooltip.x + 14, top: tooltip.y - 10 }}
    >
      <div className="font-bold text-sm mb-1" style={{ color: tooltip.node.color }}>
        {tooltip.node.name}
      </div>
      <div className={`mb-1 ${darkMode ? 'text-[hsl(30,8%,52%)]' : 'text-[hsl(28,8%,44%)]'}`}>
        {tooltip.node.year} · {tooltip.node.type}
      </div>
      {tooltip.sources.length > 0 && tooltip.sources[0] !== tooltip.node.name && (
        <div className="mb-0.5">
          <span className={darkMode ? 'text-[hsl(30,8%,42%)]' : 'text-[hsl(28,8%,54%)]'}>From: </span>
          {tooltip.sources.join(', ')}
        </div>
      )}
      {tooltip.targets.length > 0 && (
        <div>
          <span className={darkMode ? 'text-[hsl(30,8%,42%)]' : 'text-[hsl(28,8%,54%)]'}>
            {tooltip.targets.length > 1 ? 'Split into: ' : 'Became: '}
          </span>
          {tooltip.targets.join(', ')}
        </div>
      )}
    </div>
  );

  if (loading) return (
    <div className={`flex items-center justify-center h-64 ${darkMode ? 'text-[hsl(30,8%,52%)]' : 'text-[hsl(28,8%,44%)]'}`}>
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mr-3" />
      Loading evolution data…
    </div>
  );

  if (error) return (
    <div className={`p-4 rounded-lg border ${darkMode ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
      Failed to load evolution data: {error}
    </div>
  );

  return (
    <div className="relative">
      <div className="overflow-x-auto">
        <svg ref={svgRef} className="block" />
      </div>
      {tooltipEl}
    </div>
  );
}
