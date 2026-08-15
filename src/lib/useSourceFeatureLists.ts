import { useEffect, useState } from 'react';
import { getLayerFeatures, type LayerCatalogEntry } from './layerCatalog';

export interface SourceFeatureList {
  entry: LayerCatalogEntry;
  names: string[];
  loading: boolean;
  error: string | null;
}

// getLayerFeatures shares fetchGeoJSON's cache with CompareMap, avoiding duplicate requests.
export function useSourceFeatureLists(
  sources: LayerCatalogEntry[],
  scopeState?: string
): Record<string, SourceFeatureList> {
  const [lists, setLists] = useState<Record<string, SourceFeatureList>>({});

  useEffect(() => {
    let cancelled = false;
    setLists(prev => {
      const next: Record<string, SourceFeatureList> = {};
      for (const entry of sources) {
        next[entry.id] = prev[entry.id]?.entry.id === entry.id
          ? { ...prev[entry.id], loading: true }
          : { entry, names: [], loading: true, error: null };
      }
      return next;
    });

    sources.forEach(entry => {
      getLayerFeatures(entry, { villageState: scopeState, geoDataState: scopeState, districtState: scopeState })
        .then(res => {
          if (cancelled) return;
          const names = res.features
            .map(f => f.properties[res.nameProp])
            .filter((n): n is string | number => n != null)
            .map(String)
            .sort((a, b) => a.localeCompare(b));
          setLists(prev => ({ ...prev, [entry.id]: { entry, names, loading: false, error: null } }));
        })
        .catch(err => {
          if (cancelled) return;
          setLists(prev => ({
            ...prev,
            [entry.id]: { entry, names: [], loading: false, error: err instanceof Error ? err.message : 'Failed to load' },
          }));
        });
    });

    return () => { cancelled = true; };
  }, [sources, scopeState]);

  return lists;
}
