/**
 * Village boundary view: per-state polygon slices loaded on demand from R2.
 * Geometry rides as a JSON `rings` string per row because hyparquet has no
 * in-browser WKB decoder; we JSON.parse it into PolygonFeature[]. The source ->
 * state -> url mapping is fetched once from a gist (see villagePolygonMapping).
 */
import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { PolygonFeature } from './DeckPolygonsLayer';
import {
  loadVillageMapping,
  getVillageSources,
  getVillagePolygonStates,
  getVillagePolygonUrl,
  type VillageSource,
} from '@/lib/villagePolygonMapping';
import type { BoundaryColor } from '@/lib/colorUtils';

const IndiaDistrictsMap = lazy(() => import('./IndiaDistrictsMap').then(m => ({ default: m.IndiaDistrictsMap })));

interface VillagePolygonMapProps {
  darkMode?: boolean;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
}

const DEFAULT_STATE = 'Maharashtra';
type Mapping = Awaited<ReturnType<typeof loadVillageMapping>>;

const featureCache = new Map<string, PolygonFeature[]>();

export const VillagePolygonMap: React.FC<VillagePolygonMapProps> = ({ darkMode, boundaryColor, boundaryWidth }) => {
  const [mapping, setMapping] = useState<Mapping | null>(null);
  const [source, setSource] = useState<VillageSource>('lgd');
  const [state, setState] = useState<string>(DEFAULT_STATE);
  const [features, setFeatures] = useState<PolygonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadVillageMapping().then(m => {
      if (cancelled) return;
      setMapping(m);
      setSource(getVillageSources(m)[0]?.id ?? 'lgd');
    });
    return () => { cancelled = true; };
  }, []);

  const sources = useMemo(() => (mapping ? getVillageSources(mapping) : []), [mapping]);
  const states = useMemo(() => (mapping ? getVillagePolygonStates(mapping, source) : []), [mapping, source]);

  useEffect(() => {
    if (states.length && !states.includes(state)) {
      setState(states.includes(DEFAULT_STATE) ? DEFAULT_STATE : states[0]);
    }
  }, [states, state]);

  useEffect(() => {
    if (!mapping) return;
    const url = getVillagePolygonUrl(mapping, source, state);
    if (!url) { setFeatures([]); return; }
    const cached = featureCache.get(url);
    if (cached) { setFeatures(cached); setError(null); setLoading(false); return; }
    let cancelled = false;
    setLoading(true); setError(null);
    (async () => {
      try {
        const [{ asyncBufferFromUrl, parquetReadObjects }, { compressors }] = await Promise.all([
          import('hyparquet'),
          import('hyparquet-compressors'),
        ]);
        const file = await asyncBufferFromUrl({ url });
        const rows = await parquetReadObjects({ file, compressors }) as Array<Record<string, unknown>>;
        if (cancelled) return;
        const feats: PolygonFeature[] = [];
        for (const row of rows) {
          const ringsStr = row.rings;
          if (typeof ringsStr !== 'string') continue;
          let polygons: number[][][][];
          try { polygons = JSON.parse(ringsStr); } catch { continue; }
          if (!Array.isArray(polygons) || polygons.length === 0) continue;
          const props: Record<string, string | number | null> = {};
          for (const k of ['district', 'subdistrict', 'block', 'state_name']) {
            const v = row[k];
            if (v != null && v !== '') props[k] = v as string;
          }
          feats.push({ polygons, name: (row.village_name as string) ?? null, properties: props });
        }
        featureCache.set(url, feats);
        setFeatures(feats);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load villages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mapping, source, state]);

  if (mapping && sources.length === 0) {
    return (
      <div className="p-6 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
        No village boundary sources are available yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
      <div className="lg:col-span-2 order-1 lg:order-2">
        <Suspense fallback={<div className="h-96 rounded border border-border bg-background animate-pulse" />}>
          <IndiaDistrictsMap
            data={[]}
            colorScale="oranges"
            invertColors={false}
            dataTitle=""
            showStateBoundaries={true}
            selectedState={state}
            darkMode={darkMode}
            boundaryColor={boundaryColor}
            boundaryWidth={boundaryWidth}
            polygonsLayer={features}
            polygonLabels={true}
          />
        </Suspense>
        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {state} villages...
          </div>
        )}
        {error && <div className="mt-3 text-sm text-destructive">{error}</div>}
        {!loading && !error && features.length > 0 && (
          <div className="mt-3 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
            {features.length.toLocaleString()} village boundaries - hover for names.
          </div>
        )}
      </div>

      <div className="lg:col-span-1 order-2 lg:order-1 space-y-3">
        {sources.length > 1 && (
          <div>
            <Label className="text-sm mb-1.5 block">Source</Label>
            <Select value={source} onValueChange={(v) => setSource(v as VillageSource)}>
              <SelectTrigger className="w-full text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {sources.map(s => <SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div>
          <Label className="text-sm mb-1.5 block">State</Label>
          <Select value={state} onValueChange={setState} disabled={!mapping}>
            <SelectTrigger className="w-full text-sm"><SelectValue placeholder="Loading..." /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-[hsl(28,8%,52%)] dark:text-[hsl(30,8%,50%)]">
            Village boundaries load one state at a time. Source: LGD / Survey of India /
            Bhuvan (ramSeraph/indian_admin_boundaries), simplified for web display.
          </p>
        </div>
      </div>
    </div>
  );
};
