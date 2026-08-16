import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getLayerFeatures, type LayerCatalogEntry } from '@/lib/layerCatalog';
import { geoJsonFeatureToPolygonFeature, computeBoundsFromFeatureSets, type Bounds, type GeoJSONFeatureLike } from '@/lib/geojsonToPolygonFeature';
import { MultiSourcePolygonsLayer, type SourceLayerSpec, type RGBA } from '@/components/MultiSourcePolygonsLayer';
import { MapProcessingOverlay } from '@/components/MapProcessingOverlay';
import type { PolygonFeature } from '@/components/DeckPolygonsLayer';
import type { DiffResult, DiffClassification } from '@/lib/compareTypes';

const VIEW_W = 800;
const VIEW_H = 890;

const OVERLAY_PALETTE_LIGHT: { fill: RGBA; line: RGBA }[] = [
  { fill: [217, 119, 6, 60], line: [180, 83, 9, 220] },
  { fill: [13, 148, 136, 60], line: [15, 118, 110, 220] },
  { fill: [147, 51, 234, 60], line: [126, 34, 206, 220] },
];
const OVERLAY_PALETTE_DARK: { fill: RGBA; line: RGBA }[] = [
  { fill: [251, 191, 36, 130], line: [253, 224, 71, 240] },
  { fill: [45, 212, 191, 130], line: [153, 246, 228, 240] },
  { fill: [192, 132, 252, 130], line: [233, 213, 255, 240] },
];

const DIFF_COLORS_LIGHT: Record<DiffClassification, RGBA> = {
  unchanged: [34, 197, 94, 90],
  modified: [249, 115, 22, 140],
  removed: [239, 68, 68, 150],
  added: [59, 130, 246, 150],
  split: [168, 85, 247, 150],
  merged: [168, 85, 247, 150],
};
const DIFF_COLORS_DARK: Record<DiffClassification, RGBA> = {
  unchanged: [74, 222, 128, 190],
  modified: [251, 146, 60, 220],
  removed: [248, 113, 113, 230],
  added: [96, 165, 250, 230],
  split: [216, 180, 254, 230],
  merged: [216, 180, 254, 230],
};

interface LoadedLayer {
  entry: LayerCatalogEntry;
  features: GeoJSONFeatureLike[];
  nameProp: string;
  stateProp: string;
}

interface CompareMapProps {
  sources: LayerCatalogEntry[];
  scopeState?: string;
  diffResult: DiffResult | null;
  diffColorMode: boolean;
  focusChanged?: boolean;
  darkMode?: boolean;
  highlightedId?: string | null;
  onFeatureClick?: (sourceId: string, feature: PolygonFeature) => void;
}

export const CompareMap: React.FC<CompareMapProps> = ({
  sources,
  scopeState,
  diffResult,
  diffColorMode,
  focusChanged = false,
  darkMode = false,
  highlightedId,
  onFeatureClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mapRect, setMapRect] = useState<DOMRect | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadedById, setLoadedById] = useState<Record<string, LoadedLayer>>({});
  const [hover, setHover] = useState<{ x: number; y: number; sourceId: string; feature: PolygonFeature } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(entries => {
      if (entries[0]) setMapRect(entries[0].target.getBoundingClientRect());
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      sources.map(entry =>
        getLayerFeatures(entry, { villageState: scopeState, geoDataState: scopeState, districtState: scopeState }).then(res => [entry, res] as const)
      )
    ).then(entries => {
      if (cancelled) return;
      const map: Record<string, LoadedLayer> = {};
      for (const [entry, res] of entries) {
        map[entry.id] = { entry, features: res.features, nameProp: res.nameProp, stateProp: res.stateProp };
      }
      setLoadedById(map);
      setLoading(false);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [sources, scopeState]);

  const bounds = useMemo<Bounds | null>(() => {
    const sets = sources.map(s => loadedById[s.id]).filter(Boolean) as LoadedLayer[];
    if (sets.length === 0) return null;
    return computeBoundsFromFeatureSets(sets);
  }, [sources, loadedById]);

  const project = useCallback((lng: number, lat: number): { x: number; y: number } => {
    if (!bounds) return { x: 0, y: 0 };
    const geoWidth = bounds.maxLng - bounds.minLng || 1;
    const geoHeight = bounds.maxLat - bounds.minLat || 1;
    const geoAspect = geoWidth / geoHeight;
    const canvasAspect = VIEW_W / VIEW_H;
    let pw = VIEW_W, ph = VIEW_H, ox = 0, oy = 0;
    if (geoAspect > canvasAspect) {
      ph = VIEW_W / geoAspect;
      oy = (VIEW_H - ph) / 2;
    } else {
      pw = VIEW_H * geoAspect;
      ox = (VIEW_W - pw) / 2;
    }
    return {
      x: ((lng - bounds.minLng) / geoWidth) * pw + ox,
      y: ((bounds.maxLat - lat) / geoHeight) * ph + oy,
    };
  }, [bounds]);

  const DIFF_COLORS = darkMode ? DIFF_COLORS_DARK : DIFF_COLORS_LIGHT;
  const OVERLAY_PALETTE = darkMode ? OVERLAY_PALETTE_DARK : OVERLAY_PALETTE_LIGHT;
  const diffLineColor: RGBA = darkMode ? [15, 12, 8, 210] : [255, 255, 255, 160];

  const layers = useMemo<SourceLayerSpec[]>(() => {
    if (diffColorMode && diffResult && sources.length === 2) {
      const loadedA = loadedById[sources[0].id];
      const loadedB = loadedById[sources[1].id];
      if (!loadedA || !loadedB) return [];

      // Build order must match buildDiffFeatures' iteration so index i lines up with the worker's DiffFeature.
      const idToClass = new Map<string, DiffClassification>();
      for (const m of diffResult.matches) {
        if (m.bId) idToClass.set(m.bId, m.classification);
      }
      const bDiffFeatures = Array.from(diffResult.featuresB.values());
      const bColored: PolygonFeature[] = loadedB.features
        .map(f => geoJsonFeatureToPolygonFeature(f, loadedB.nameProp, loadedB.stateProp))
        .map((f, i) => {
          const diffFeature = bDiffFeatures[i];
          const cls = diffFeature ? idToClass.get(diffFeature.id) ?? 'unchanged' : 'unchanged';
          return { ...f, properties: { ...f.properties, __diffId: diffFeature?.id ?? null, __cls: cls } };
        });

      const removedAIds = new Set(diffResult.matches.filter(m => m.classification === 'removed' && m.aId).map(m => m.aId));
      const aDiffFeatures = Array.from(diffResult.featuresA.values());
      const removedOnly: PolygonFeature[] = loadedA.features
        .map(f => geoJsonFeatureToPolygonFeature(f, loadedA.nameProp, loadedA.stateProp))
        .flatMap((f, i) => {
          const diffFeature = aDiffFeatures[i];
          if (!diffFeature || !removedAIds.has(diffFeature.id)) return [];
          return [{ ...f, properties: { ...f.properties, __diffId: diffFeature.id, __cls: 'removed' as const } }];
        });

      return [
        {
          id: 'removed',
          features: removedOnly,
          fillColor: DIFF_COLORS.removed,
          lineColor: [239, 68, 68, 255],
        },
        {
          id: 'diff',
          features: bColored,
          fillColor: DIFF_COLORS.unchanged,
          lineColor: diffLineColor,
          getFillColor: (f) => {
            const cls = (f.properties.__cls as DiffClassification) ?? 'unchanged';
            if (focusChanged && cls === 'unchanged') return [0, 0, 0, 0];
            return DIFF_COLORS[cls];
          },
          getLineColor: (f) => {
            const cls = (f.properties.__cls as DiffClassification) ?? 'unchanged';
            if (focusChanged && cls === 'unchanged') return [0, 0, 0, 0];
            return diffLineColor;
          },
        },
      ];
    }

    return sources.map((entry, i) => {
      const loaded = loadedById[entry.id];
      const palette = OVERLAY_PALETTE[i % OVERLAY_PALETTE.length];
      return {
        id: entry.id,
        features: loaded ? loaded.features.map(f => geoJsonFeatureToPolygonFeature(f, loaded.nameProp, loaded.stateProp)) : [],
        fillColor: palette.fill,
        lineColor: palette.line,
      };
    });
  }, [sources, loadedById, diffColorMode, diffResult, focusChanged, DIFF_COLORS, OVERLAY_PALETTE, diffLineColor]);

  // Index by both aId and bId: a split/merged feature spans several matches.
  const matchesByDiffId = useMemo(() => {
    const map = new Map<string, DiffResult['matches']>();
    if (!diffResult) return map;
    for (const m of diffResult.matches) {
      if (m.aId) map.set(m.aId, [...(map.get(m.aId) ?? []), m]);
      if (m.bId) map.set(m.bId, [...(map.get(m.bId) ?? []), m]);
    }
    return map;
  }, [diffResult]);

  return (
    <div ref={containerRef} className="relative w-full aspect-[800/890] bg-[hsl(38,30%,98%)] dark:bg-[hsl(25,8%,9%)] rounded-lg border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)] overflow-hidden">
      <MultiSourcePolygonsLayer
        layers={layers}
        mapRect={mapRect}
        project={bounds ? project : null}
        viewBoxWidth={VIEW_W}
        viewBoxHeight={VIEW_H}
        highlightedId={highlightedId}
        onPolygonHover={setHover}
        onPolygonClick={(info) => onFeatureClick?.(info.sourceId, info.feature)}
      />
      {hover && (() => {
        const diffId = typeof hover.feature.properties.__diffId === 'string' ? hover.feature.properties.__diffId : null;
        const cls = typeof hover.feature.properties.__cls === 'string' ? hover.feature.properties.__cls : null;
        const matches = diffId && diffResult ? matchesByDiffId.get(diffId) ?? [] : [];

        const otherNames = new Set<string>();
        for (const m of matches) {
          const otherId = m.aId === diffId ? m.bId : m.aId;
          if (!otherId || !diffResult) continue;
          const other = diffResult.featuresA.get(otherId) ?? diffResult.featuresB.get(otherId);
          if (other?.name) otherNames.add(other.name);
        }

        return (
          <div
            className="absolute z-30 pointer-events-none px-2.5 py-1.5 rounded-md text-xs bg-[hsl(25,8%,9%)] text-white shadow-lg max-w-[220px]"
            style={{ left: hover.x + 12, top: hover.y + 12 }}
          >
            <div className="font-medium">{hover.feature.name ?? 'Unnamed'}</div>
            {cls && <div className="text-[hsl(35,12%,70%)] capitalize">{cls}</div>}
            {cls === 'unchanged' && otherNames.size > 0 && (
              <div className="text-[hsl(35,12%,70%)] mt-0.5">Same as: {Array.from(otherNames).join(', ')}</div>
            )}
            {cls === 'modified' && otherNames.size > 0 && (
              <div className="text-[hsl(35,12%,70%)] mt-0.5">Was: {Array.from(otherNames).join(', ')}</div>
            )}
            {cls === 'split' && otherNames.size > 0 && (
              <div className="text-[hsl(35,12%,70%)] mt-0.5">Split into: {Array.from(otherNames).join(', ')}</div>
            )}
            {cls === 'merged' && otherNames.size > 0 && (
              <div className="text-[hsl(35,12%,70%)] mt-0.5">Merged from: {Array.from(otherNames).join(', ')}</div>
            )}
            {cls === 'removed' && <div className="text-[hsl(35,12%,70%)] mt-0.5">Not present in {sources[1]?.displayName ?? 'the second source'}</div>}
            {cls === 'added' && <div className="text-[hsl(35,12%,70%)] mt-0.5">Not present in {sources[0]?.displayName ?? 'the first source'}</div>}
          </div>
        );
      })()}
      <MapProcessingOverlay active={loading} message="Loading boundaries…" />
    </div>
  );
};
