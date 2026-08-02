/**
 * Village boundary view: 584k polygons nationwide are sliced per state on R2 and
 * loaded on demand. Geometry rides as a JSON `rings` string per row because
 * hyparquet has no in-browser WKB decoder; we JSON.parse it into PolygonFeature[].
 */
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import type { PolygonFeature } from './DeckPolygonsLayer';
import { getVillagePolygonUrl, getVillagePolygonStates } from '@/lib/villagePolygonMapping';
import type { BoundaryColor } from '@/lib/colorUtils';

const IndiaDistrictsMap = lazy(() => import('./IndiaDistrictsMap').then(m => ({ default: m.IndiaDistrictsMap })));

interface VillagePolygonMapProps {
  darkMode?: boolean;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
}

const STATES = getVillagePolygonStates();

export const VillagePolygonMap: React.FC<VillagePolygonMapProps> = ({ darkMode, boundaryColor, boundaryWidth }) => {
  const [state, setState] = useState<string>(STATES[0] ?? '');
  const [features, setFeatures] = useState<PolygonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const url = getVillagePolygonUrl(state);
    if (!url) { setFeatures([]); return; }
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
        setFeatures(feats);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load villages');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [state]);

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
        <div>
          <Label className="text-sm mb-1.5 block">State</Label>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-full text-sm"><SelectValue /></SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-[hsl(28,8%,52%)] dark:text-[hsl(30,8%,50%)]">
            Village boundaries load one state at a time. Source: LGD / Survey of India
            (ramSeraph/indian_admin_boundaries), simplified for web display.
          </p>
        </div>
      </div>
    </div>
  );
};
