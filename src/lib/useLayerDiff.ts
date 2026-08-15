import { useEffect, useRef, useState } from 'react';
import { buildDiffFeatures } from './districtDiff';
import { getLayerFeatures, type LayerCatalogEntry } from './layerCatalog';
import type { DiffResult } from './compareTypes';
import type { DiffRequest } from './compareEngine.worker';

export type DiffProgress = 'idle' | 'fetching' | 'computing' | 'done';

export function useLayerDiff(
  entryA: LayerCatalogEntry | null,
  entryB: LayerCatalogEntry | null,
  scopeState?: string
) {
  const [result, setResult] = useState<DiffResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<DiffProgress>('idle');
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!entryA || !entryB || entryA.id === entryB.id) {
      setResult(null);
      setProgress('idle');
      return;
    }
    const needsState = entryA.scope === 'per-state' || entryB.scope === 'per-state';
    if (needsState && !scopeState) {
      setResult(null);
      setProgress('idle');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setProgress('fetching');

    Promise.all([
      getLayerFeatures(entryA, { villageState: scopeState, geoDataState: scopeState, districtState: scopeState }),
      getLayerFeatures(entryB, { villageState: scopeState, geoDataState: scopeState, districtState: scopeState }),
    ])
      .then(([a, b]) => {
        if (cancelled) return;
        setProgress('computing');
        const featuresA = buildDiffFeatures({ features: a.features }, entryA.id, a.nameProp, a.stateProp);
        const featuresB = buildDiffFeatures({ features: b.features }, entryB.id, b.nameProp, b.stateProp);

        const worker = new Worker(new URL('./compareEngine.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current = worker;
        worker.onmessage = (e: MessageEvent<DiffResult>) => {
          if (!cancelled) {
            setResult(e.data);
            setProgress('done');
            setLoading(false);
          }
          worker.terminate();
        };
        worker.onerror = (e) => {
          if (!cancelled) {
            setError(e.message || 'Diff computation failed');
            setLoading(false);
            setProgress('idle');
          }
          worker.terminate();
        };
        const request: DiffRequest = { featuresA, featuresB, sourceAId: entryA.id, sourceBId: entryB.id };
        worker.postMessage(request);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load boundaries');
          setLoading(false);
          setProgress('idle');
        }
      });

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [entryA, entryB, scopeState]);

  return { result, loading, error, progress };
}
