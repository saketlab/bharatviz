import React, { useState, useEffect, useMemo, useRef, lazy, Suspense, forwardRef, useImperativeHandle } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ColorMapChooser, type ColorScale } from '@/components/ColorMapChooser';
import type { IndiaDistrictsMapRef } from '@/components/IndiaDistrictsMap';

const IndiaDistrictsMap = lazy(() =>
  import('@/components/IndiaDistrictsMap').then(m => ({ default: m.IndiaDistrictsMap }))
);

const GEOJSON_URL = 'https://geo.bharatviz.org/geojsons/census2011/india_census2011_districts.geojson';

// Metric groups for the selector
const METRIC_GROUPS: { label: string; metrics: { key: string; label: string }[] }[] = [
  {
    label: 'Population',
    metrics: [
      { key: 'population',    label: 'Total Population' },
      { key: 'sc_pct',        label: 'Scheduled Caste (%)' },
      { key: 'st_pct',        label: 'Scheduled Tribe (%)' },
      { key: 'sc_population', label: 'SC Population (abs)' },
      { key: 'st_population', label: 'ST Population (abs)' },
    ],
  },
  {
    label: 'Education',
    metrics: [
      { key: 'literacy_pct', label: 'Literacy Rate (%)' },
      { key: 'literate',     label: 'Literate Population (abs)' },
    ],
  },
  {
    label: 'Language',
    metrics: [
      { key: 'shannon_diversity',   label: 'Language Diversity (Shannon H)' },
      { key: 'effective_languages', label: 'Effective Languages (exp H)' },
      { key: 'num_languages',       label: 'No. of Languages (L1)' },
    ],
  },
];

// Top languages by national speaker share — shown as individual metric options
const TOP_LANGUAGES = [
  'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu',
  'Kannada', 'Odia', 'Malayalam', 'Punjabi', 'Assamese', 'Maithili',
  'Santali', 'Kashmiri', 'Nepali', 'Sindhi', 'Konkani', 'Dogri', 'Manipuri',
  'Bodo', 'Sanskrit',
];

function colKey(lang: string): string {
  return `lang_${lang.replace(/ /g, '_')}`;
}

interface Feature {
  properties: Record<string, string | number | null>;
}

export const CensusMap = forwardRef<IndiaDistrictsMapRef, { darkMode?: boolean }>(({ darkMode }, ref) => {
  const mapRef = useRef<IndiaDistrictsMapRef>(null);

  useImperativeHandle(ref, () => ({
    exportPNG:        () => mapRef.current?.exportPNG(),
    exportSVG:        () => mapRef.current?.exportSVG(),
    exportPDF:        () => mapRef.current?.exportPDF(),
    copyToClipboard:  () => mapRef.current?.copyToClipboard(),
    downloadCSVTemplate: () => mapRef.current?.downloadCSVTemplate(),
  }));

  const [features, setFeatures] = useState<Feature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState('literacy_pct');
  const [level, setLevel] = useState<'l1' | 'l2' | 'combined'>('l1');
  const [colorScale, setColorScale] = useState<ColorScale>('spectral');
  const [invertColors, setInvertColors] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(GEOJSON_URL, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
      .then(fc => { setFeatures(fc.features); setLoading(false); })
      .catch(e => { if (e.name !== 'AbortError') { setError(e.message); setLoading(false); } });
    return () => controller.abort();
  }, []);

  // Resolve which column to read for the current metric + level selection
  const resolvedColumn = useMemo(() => {
    const isLang = TOP_LANGUAGES.some(l => metric === colKey(l));
    if (isLang) {
      if (level === 'l1') return `${metric}_l1_pct`;
      if (level === 'l2') return `${metric}_l2_pct`;
      // combined: sum l1+l2
      return null; // handled separately
    }
    return metric;
  }, [metric, level]);

  const isLangMetric = TOP_LANGUAGES.some(l => metric === colKey(l));

  const mapData = useMemo(() => {
    if (!features.length) return [];
    return features
      .map(f => {
        const p = f.properties;
        let value: number | null = null;
        if (isLangMetric && level === 'combined') {
          const l1 = p[`${metric}_l1_pct`] as number | null;
          const l2 = p[`${metric}_l2_pct`] as number | null;
          const combined = (l1 ?? 0) + (l2 ?? 0);
      value = (l1 !== null || l2 !== null) ? combined : null;
        } else if (resolvedColumn) {
          value = p[resolvedColumn] as number | null;
        }
        return {
          state: String(p.state_name ?? ''),
          district: String(p.district_name ?? ''),
          value: value ?? '',
        };
      })
      .filter(d => d.state && d.district);
  }, [features, resolvedColumn, isLangMetric, level, metric]);

  const metricLabel = useMemo(() => {
    for (const g of METRIC_GROUPS) {
      const m = g.metrics.find(m => m.key === metric);
      if (m) return m.label;
    }
    const lang = TOP_LANGUAGES.find(l => colKey(l) === metric);
    if (lang) {
      const suffix = level === 'l1' ? 'L1 speakers (%)' : level === 'l2' ? 'L2 speakers (%)' : 'L1+L2 speakers (%)';
      return `${lang} — ${suffix}`;
    }
    return metric;
  }, [metric, level]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="p-4 sm:p-6 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <h2 className="text-xl sm:text-2xl font-bold mb-1 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
          Census 2011 — District Demographics
        </h2>
        <p className="text-sm mb-4 text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
          Population, SC/ST, literacy and language data for 640 districts. Source: Office of the Registrar General &amp; Census Commissioner, India.
        </p>

        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] max-w-xs">
            <Label className="text-sm font-medium mb-2 block">Metric</Label>
            <Select value={metric} onValueChange={setMetric}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METRIC_GROUPS.map(g => (
                  <React.Fragment key={g.label}>
                    <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(28,8%,50%)]">
                      {g.label}
                    </div>
                    {g.metrics.map(m => (
                      <SelectItem key={m.key} value={m.key}>{m.label}</SelectItem>
                    ))}
                  </React.Fragment>
                ))}
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[hsl(28,8%,50%)]">
                  Languages
                </div>
                {TOP_LANGUAGES.map(lang => (
                  <SelectItem key={colKey(lang)} value={colKey(lang)}>{lang}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLangMetric && (
            <div className="min-w-[140px]">
              <Label className="text-sm font-medium mb-2 block">Speaker level</Label>
              <Select value={level} onValueChange={v => setLevel(v as 'l1' | 'l2' | 'combined')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="l1">L1 (mother tongue)</SelectItem>
                  <SelectItem value="l2">L2 (second language)</SelectItem>
                  <SelectItem value="combined">L1 + L2</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="min-w-[180px]">
            <Label className="text-sm font-medium mb-2 block">Colour scale</Label>
            <ColorMapChooser
              selectedScale={colorScale}
              onScaleChange={setColorScale}
              invertColors={invertColors}
              onInvertColorsChange={setInvertColors}
            />
          </div>
        </div>
      </div>

      {loading && (
        <div className="p-12 text-center border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[hsl(28,62%,48%)] mx-auto mb-4" />
          <p className="text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">Loading Census 2011 data…</p>
        </div>
      )}

      {error && (
        <div className="p-6 border rounded-lg bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <p className="font-semibold mb-1">Failed to load data</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <Suspense fallback={<div className="h-[600px] flex items-center justify-center text-[hsl(28,8%,40%)]">Loading map…</div>}>
          <IndiaDistrictsMap
            ref={mapRef}
            data={mapData}
            colorScale={colorScale}
            invertColors={invertColors}
            dataTitle={metricLabel}
            geojsonPath={GEOJSON_URL}
            statesGeojsonPath="https://geo.bharatviz.org/geojsons/districts/India_LGD_states.geojson"
            featureNameProp="district_name"
            darkMode={darkMode}
          />
        </Suspense>
      )}
    </div>
  );
});
CensusMap.displayName = 'CensusMap';
