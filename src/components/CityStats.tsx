import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import Papa from 'papaparse';
import { CITY_DATASETS } from '@/lib/cityMapConfig';

type SortDirection = 'asc' | 'desc' | null;

interface WardMetric {
  dataset_id: string;
  city: string;
  state: string;
  source: string;
  type: string;
  label: string;
  ward_name: string;
  ward_number: string;
  area_sq_km: number;
  perimeter_km: number;
  compactness: number;
  centroid_lon: number;
  centroid_lat: number;
  num_vertices: number;
}

interface DatasetStats {
  totalArea: number;
  avgCompactness: number;
}

type DatasetSortField = 'displayName' | 'state' | 'source' | 'type' | 'label' | 'featureCount' | 'totalArea' | 'avgCompactness';
type WardSortField = 'ward_name' | 'area_sq_km' | 'perimeter_km' | 'compactness';

let allWardsCache: WardMetric[] | null = null;
let datasetStatsCache: Map<string, DatasetStats> | null = null;
let wardsFetchPromise: Promise<WardMetric[]> | null = null;

function loadWardMetrics(): Promise<WardMetric[]> {
  if (allWardsCache) return Promise.resolve(allWardsCache);
  if (wardsFetchPromise) return wardsFetchPromise;
  wardsFetchPromise = fetch('/city-stats/city_ward_metrics.csv')
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.text(); })
    .then(text => new Promise<WardMetric[]>((resolve, reject) => {
      Papa.parse<WardMetric>(text, {
        header: true, dynamicTyping: true, skipEmptyLines: true,
        complete: results => { allWardsCache = results.data; wardsFetchPromise = null; resolve(results.data); },
        error: err => { wardsFetchPromise = null; reject(new Error(err.message)); },
      });
    }));
  return wardsFetchPromise;
}

const fmt = (n: number | null, d = 2) =>
  n == null ? '-' : n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

function buildDatasetStats(wards: WardMetric[]): Map<string, DatasetStats> {
  const map = new Map<string, { area: number; compactness: number[]; }>();
  for (const w of wards) {
    if (!map.has(w.dataset_id)) map.set(w.dataset_id, { area: 0, compactness: [] });
    const s = map.get(w.dataset_id)!;
    if (w.area_sq_km > 0) s.area += w.area_sq_km;
    if (w.compactness > 0) s.compactness.push(w.compactness);
  }
  const result = new Map<string, DatasetStats>();
  for (const [id, s] of map) {
    result.set(id, {
      totalArea: s.area,
      avgCompactness: s.compactness.length ? s.compactness.reduce((a, b) => a + b, 0) / s.compactness.length : 0,
    });
  }
  return result;
}

function sortRows<T>(data: T[], field: keyof T | null, dir: SortDirection): T[] {
  if (!field || !dir) return data;
  return [...data].sort((a, b) => {
    const av = a[field], bv = b[field];
    if (typeof av === 'string' && typeof bv === 'string')
      return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    if ((typeof av === 'number' || av == null) && (typeof bv === 'number' || bv == null)) {
      const an = av ?? -Infinity, bn = bv ?? -Infinity;
      return dir === 'asc' ? (an as number) - (bn as number) : (bn as number) - (an as number);
    }
    return 0;
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDirection }) {
  if (!active) return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40 shrink-0" />;
  if (dir === 'asc') return <ArrowUp className="w-3.5 h-3.5 ml-1 shrink-0" />;
  if (dir === 'desc') return <ArrowDown className="w-3.5 h-3.5 ml-1 shrink-0" />;
  return <ArrowUpDown className="w-3.5 h-3.5 ml-1 opacity-40 shrink-0" />;
}

function useSort<F extends string>(defaultField: F | null = null, defaultDir: SortDirection = null) {
  const [sortField, setSortField] = useState<F | null>(defaultField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultDir);
  const handleSort = (field: F) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortDirection(null); setSortField(null); }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  return { sortField, sortDirection, handleSort };
}

function usePagination(itemsPerPage = 50) {
  const [currentPage, setCurrentPage] = useState(1);
  const reset = () => setCurrentPage(1);
  const paginate = <T,>(data: T[]) => ({
    totalPages: Math.ceil(data.length / itemsPerPage),
    page: data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
  });
  return { currentPage, setCurrentPage, reset, paginate };
}

function tableClasses() {
  const thBase = 'px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium uppercase tracking-wider transition-colors text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,75%)]';
  const thBtnBase = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] focus-visible:ring-offset-1 rounded';
  const tdBase = 'px-3 py-2.5 sm:px-4 sm:py-3 text-sm';
  const tdMuted = `${tdBase} text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,52%)]`;
  const tdPrimary = `${tdBase} font-medium text-[hsl(28,20%,14%)] dark:text-[hsl(35,10%,82%)]`;
  return { thBase, thBtnBase, tdBase, tdMuted, tdPrimary };
}

function downloadCSV(rows: object[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

function PaginationBar({
  currentPage, totalPages, setCurrentPage,
}: { currentPage: number; totalPages: number; setCurrentPage: (fn: (p: number) => number) => void }) {
  if (totalPages <= 1) return null;
  const btnBase = 'px-3 py-1 rounded border text-sm transition-colors';
  const active = 'border-[hsl(35,18%,78%)] bg-white text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,16%)]';
  const disabled = 'border-[hsl(35,18%,88%)] bg-[hsl(35,20%,95%)] text-[hsl(28,8%,58%)] cursor-not-allowed dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,11%)] dark:text-[hsl(30,8%,38%)]';
  return (
    <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t flex items-center justify-between gap-2 border-[hsl(35,18%,84%)] bg-[hsl(35,20%,97%)] dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,9%)]">
      <span className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">{currentPage}/{totalPages}</span>
      <div className="flex gap-2">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? disabled : active}`}>Prev</button>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? disabled : active}`}>Next</button>
      </div>
    </div>
  );
}

function DatasetView({ onDrillDown }: { onDrillDown: (id: string) => void }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Map<string, DatasetStats> | null>(null);
  const { sortField, sortDirection, handleSort } = useSort<DatasetSortField>('displayName', 'asc');
  const { currentPage, setCurrentPage, reset, paginate } = usePagination(50);

  useEffect(() => {
    if (datasetStatsCache) { setStats(datasetStatsCache); return; }
    loadWardMetrics()
      .then(wards => {
        datasetStatsCache = buildDatasetStats(wards);
        setStats(datasetStatsCache);
      })
      .catch(() => {}); // stats columns show '-' on failure
  }, []);

  const withStats = useMemo(() => CITY_DATASETS.map(d => ({
    ...d,
    totalArea: stats?.get(d.id)?.totalArea ?? null,
    avgCompactness: stats?.get(d.id)?.avgCompactness ?? null,
  })), [stats]);

  const filtered = useMemo(() => {
    let result = withStats;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(r =>
        r.displayName.toLowerCase().includes(q) ||
        r.state.toLowerCase().includes(q) ||
        r.source.toLowerCase().includes(q) ||
        r.label.toLowerCase().includes(q)
      );
    }
    return sortRows(result, sortField, sortDirection);
  }, [withStats, searchQuery, sortField, sortDirection]);

  const { totalPages, page } = paginate(filtered);

  const { thBase, thBtnBase, tdBase, tdMuted, tdPrimary } = tableClasses();

  return (
    <>
      <div className="mb-4">
        <div className="relative w-full sm:max-w-lg">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(28,8%,56%)] dark:text-[hsl(30,8%,45%)]" />
          <Input
            type="text"
            placeholder="Search by city, state, source..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); reset(); }}
            className="pl-10"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center justify-between mb-4">
        <span className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
          {filtered.length} datasets{searchQuery && ` of ${CITY_DATASETS.length}`}
        </span>
        <button
          onClick={() => downloadCSV(filtered.map(({ id, displayName, state, source, type, label, featureCount, totalArea, avgCompactness }) => ({ id, displayName, state, source, type, label, featureCount, totalArea, avgCompactness })), 'bharatviz-city-datasets.csv')}
          className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border text-sm transition-colors border-[hsl(35,18%,78%)] bg-white text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,16%)]"
        >
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>

      <div className="border rounded-lg overflow-hidden bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead className="bg-[hsl(35,20%,97%)] dark:bg-[hsl(25,8%,12%)]">
              <tr>
                <th className={`${thBase} text-left`}><button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('displayName')} aria-label={`Sort by city${sortField === 'displayName' ? `, currently ${sortDirection}ending` : ''}`}>City<SortIcon active={sortField === 'displayName'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-left`}><button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('state')} aria-label={`Sort by state${sortField === 'state' ? `, currently ${sortDirection}ending` : ''}`}>State<SortIcon active={sortField === 'state'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-left hidden sm:table-cell`}><button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('source')} aria-label={`Sort by source${sortField === 'source' ? `, currently ${sortDirection}ending` : ''}`}>Source<SortIcon active={sortField === 'source'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-left hidden sm:table-cell`}><button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('label')} aria-label={`Sort by label${sortField === 'label' ? `, currently ${sortDirection}ending` : ''}`}>Label<SortIcon active={sortField === 'label'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-right`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('featureCount')} aria-label={`Sort by wards${sortField === 'featureCount' ? `, currently ${sortDirection}ending` : ''}`}>Wards<SortIcon active={sortField === 'featureCount'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-right`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('totalArea')} aria-label={`Sort by area${sortField === 'totalArea' ? `, currently ${sortDirection}ending` : ''}`}>Area (km2)<SortIcon active={sortField === 'totalArea'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-right hidden sm:table-cell`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('avgCompactness')} aria-label={`Sort by compactness${sortField === 'avgCompactness' ? `, currently ${sortDirection}ending` : ''}`}>Compact.<SortIcon active={sortField === 'avgCompactness'} dir={sortDirection} /></button></th>
                <th className={`${thBase} text-right`}></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(35,18%,88%)] dark:divide-[hsl(25,8%,14%)]">
              {page.map(row => (
                <tr key={row.id} className="transition-colors hover:bg-[hsl(35,20%,97%)] dark:hover:bg-[hsl(25,8%,12%)]">
                  <td className={tdPrimary}>{row.displayName}</td>
                  <td className={tdMuted}>{row.state}</td>
                  <td className={`${tdMuted} hidden sm:table-cell`}>{row.source}</td>
                  <td className={`${tdMuted} hidden sm:table-cell`}>{row.label}</td>
                  <td className={`${tdMuted} text-right font-mono`}>{row.featureCount.toLocaleString('en-IN')}</td>
                  <td className={`${tdMuted} text-right font-mono`}>{fmt(row.totalArea)}</td>
                  <td className={`${tdMuted} text-right font-mono hidden sm:table-cell`}>{fmt(row.avgCompactness, 4)}</td>
                  <td className={`${tdBase} text-right`}>
                    <button
                      onClick={() => onDrillDown(row.id)}
                      className="text-xs px-2 py-0.5 rounded border transition-colors border-[hsl(28,45%,70%)] text-[hsl(28,55%,40%)] hover:bg-[hsl(28,40%,95%)] dark:border-[hsl(28,45%,35%)] dark:text-[hsl(28,55%,58%)] dark:hover:bg-[hsl(28,45%,18%)]"
                    >
                      Ward metrics
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />
      </div>
    </>
  );
}

function WardMetricsView({ initialDatasetId, onBack }: { initialDatasetId: string; onBack: () => void }) {
  const [selectedId, setSelectedId] = useState(initialDatasetId);
  const [wards, setWards] = useState<WardMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { sortField, sortDirection, handleSort } = useSort<WardSortField>('ward_name', 'asc');
  const { currentPage, setCurrentPage, reset, paginate } = usePagination(50);

  useEffect(() => {
    setError(null);
    if (allWardsCache) {
      setWards(allWardsCache.filter(w => w.dataset_id === selectedId));
      setLoading(false);
      return;
    }
    setLoading(true);
    setWards([]);
    loadWardMetrics()
      .then(wards => { setWards(wards.filter(w => w.dataset_id === selectedId)); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [selectedId]);

  const filtered = useMemo(() => {
    let result = wards;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w => w.ward_name?.toLowerCase().includes(q));
    }
    return sortRows(result, sortField, sortDirection);
  }, [wards, searchQuery, sortField, sortDirection]);

  const { totalPages, page } = paginate(filtered);

  const dataset = useMemo(() => CITY_DATASETS.find(d => d.id === selectedId), [selectedId]);

  const { thBase, thBtnBase, tdBase, tdMuted, tdPrimary } = tableClasses();

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className="text-sm px-3 py-1.5 rounded border transition-colors border-[hsl(35,18%,78%)] text-[hsl(28,8%,40%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,12%)]"
        >
          {'<-'} Back
        </button>
        <h3 className="font-semibold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
          Ward Metrics - {dataset?.displayName ?? selectedId}
          {dataset && <span className="ml-2 text-sm font-normal text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,55%)]">{dataset.state} - {dataset.label}</span>}
        </h3>
      </div>

      <div className="mb-4">
        <Label htmlFor="dataset-select" className="text-sm font-medium mb-2 block">Dataset</Label>
        <Select value={selectedId} onValueChange={id => { setSelectedId(id); reset(); setSearchQuery(''); }}>
          <SelectTrigger id="dataset-select" className="w-full sm:max-w-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CITY_DATASETS.map(d => (
              <SelectItem key={d.id} value={d.id}>
                {d.displayName} - {d.label} ({d.state})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className="p-8 text-center border rounded-lg bg-white border-[hsl(35,18%,84%)] text-[hsl(28,8%,40%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,55%)]">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[hsl(28,62%,48%)] mx-auto mb-4" />
          Loading ward metrics...
        </div>
      )}

      {error && (
        <div className="p-4 border rounded-lg bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <p className="font-semibold mb-1">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && wards.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(28,8%,56%)] dark:text-[hsl(30,8%,45%)]" />
              <Input
                type="text"
                placeholder="Search ward..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); reset(); }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
                {filtered.length} wards{searchQuery && ` of ${wards.length}`}
              </span>
              <button
                onClick={() => downloadCSV(filtered, `${selectedId}_ward_metrics.csv`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors border-[hsl(35,18%,78%)] bg-white text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,16%)]"
              >
                <Download className="w-4 h-4" />Export
              </button>
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem]">
                <thead className="bg-[hsl(35,20%,97%)] dark:bg-[hsl(25,8%,12%)]">
                  <tr>
                    <th className={`${thBase} text-left`}><button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('ward_name')} aria-label={`Sort by ward${sortField === 'ward_name' ? `, currently ${sortDirection}ending` : ''}`}>Ward<SortIcon active={sortField === 'ward_name'} dir={sortDirection} /></button></th>
                    <th className={`${thBase} text-right`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('area_sq_km')} aria-label={`Sort by area${sortField === 'area_sq_km' ? `, currently ${sortDirection}ending` : ''}`}>Area (km2)<SortIcon active={sortField === 'area_sq_km'} dir={sortDirection} /></button></th>
                    <th className={`${thBase} text-right hidden sm:table-cell`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('perimeter_km')} aria-label={`Sort by perimeter${sortField === 'perimeter_km' ? `, currently ${sortDirection}ending` : ''}`}>Perimeter (km)<SortIcon active={sortField === 'perimeter_km'} dir={sortDirection} /></button></th>
                    <th className={`${thBase} text-right`}><button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('compactness')} aria-label={`Sort by compactness${sortField === 'compactness' ? `, currently ${sortDirection}ending` : ''}`}>Compact.<SortIcon active={sortField === 'compactness'} dir={sortDirection} /></button></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(35,18%,88%)] dark:divide-[hsl(25,8%,14%)]">
                  {page.map((w, i) => (
                    <tr key={`${w.ward_name}-${i}`} className="transition-colors hover:bg-[hsl(35,20%,97%)] dark:hover:bg-[hsl(25,8%,12%)]">
                      <td className={tdPrimary}>{w.ward_name || `Ward ${w.ward_number}` || 'N/A'}</td>
                      <td className={`${tdMuted} text-right font-mono`}>{fmt(w.area_sq_km)}</td>
                      <td className={`${tdMuted} text-right font-mono hidden sm:table-cell`}>{fmt(w.perimeter_km)}</td>
                      <td className={`${tdMuted} text-right font-mono`}>{fmt(w.compactness, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} />
          </div>
        </>
      )}

      {!loading && !error && wards.length === 0 && (
        <div className="p-6 text-center border rounded-lg bg-white border-[hsl(35,18%,84%)] text-[hsl(28,8%,44%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,55%)]">
          No ward metrics found for this dataset.
        </div>
      )}
    </>
  );
}

export const CityStats: React.FC<{ darkMode?: boolean }> = () => {
  const [drillDownId, setDrillDownId] = useState<string | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="p-4 sm:p-6 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <h2 className="text-xl sm:text-2xl font-bold mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
          City Statistics
        </h2>
        <p className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
          {drillDownId
            ? 'Per-ward geometric metrics computed from GeoJSON boundaries. Click "Back" to return to the dataset list.'
            : `Browse all ${CITY_DATASETS.length} city ward boundary datasets. Click "Ward metrics" on any row to see area, perimeter, and compactness per ward.`}
        </p>
      </div>

      {drillDownId ? (
        <WardMetricsView
          initialDatasetId={drillDownId}
          onBack={() => setDrillDownId(null)}
        />
      ) : (
        <DatasetView onDrillDown={setDrillDownId} />
      )}
    </div>
  );
};
