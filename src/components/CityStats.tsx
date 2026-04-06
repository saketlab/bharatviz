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

interface CityStatsProps {
  darkMode?: boolean;
}

// Module-level cache so switching datasets doesn't re-parse the 9.2 MB CSV
let allWardsCache: WardMetric[] | null = null;
let datasetStatsCache: Map<string, DatasetStats> | null = null;
// In-flight fetch guard — prevents DatasetView + WardMetricsView from double-fetching simultaneously
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
  n == null ? '—' : n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d });

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

function tableClasses(darkMode: boolean) {
  const thBase = `px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium uppercase tracking-wider cursor-pointer transition-colors ${darkMode ? 'text-gray-300' : 'text-gray-700'}`;
  const tdBase = 'px-3 py-2.5 sm:px-4 sm:py-3 text-sm';
  const tdMuted = `${tdBase} ${darkMode ? 'text-gray-400' : 'text-gray-700'}`;
  const tdPrimary = `${tdBase} font-medium ${darkMode ? 'text-gray-300' : 'text-gray-900'}`;
  return { thBase, tdBase, tdMuted, tdPrimary };
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
  currentPage, totalPages, setCurrentPage, darkMode,
}: { currentPage: number; totalPages: number; setCurrentPage: (fn: (p: number) => number) => void; darkMode: boolean }) {
  if (totalPages <= 1) return null;
  const btnBase = 'px-3 py-1 rounded border text-sm transition-colors';
  const active = darkMode
    ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50';
  const disabled = darkMode
    ? 'border-gray-700 bg-gray-800 text-gray-600 cursor-not-allowed'
    : 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed';
  return (
    <div className={`px-3 py-2.5 sm:px-4 sm:py-3 border-t flex items-center justify-between gap-2 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-200 bg-gray-50'}`}>
      <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>{currentPage}/{totalPages}</span>
      <div className="flex gap-2">
        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? disabled : active}`}>Prev</button>
        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? disabled : active}`}>Next</button>
      </div>
    </div>
  );
}

function DatasetView({ darkMode, onDrillDown }: { darkMode: boolean; onDrillDown: (id: string) => void }) {
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
      .catch(() => {}); // stats columns show '—' on failure
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

  const { thBase, tdBase, tdMuted, tdPrimary } = tableClasses(darkMode);

  return (
    <>
      <div className="mb-4">
        <div className="relative w-full sm:max-w-lg">
          <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
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
        <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {filtered.length} datasets{searchQuery && ` of ${CITY_DATASETS.length}`}
        </span>
        <button
          onClick={() => downloadCSV(filtered.map(({ id, displayName, state, source, type, label, featureCount, totalArea, avgCompactness }) => ({ id, displayName, state, source, type, label, featureCount, totalArea, avgCompactness })), 'bharatviz-city-datasets.csv')}
          className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border text-sm transition-colors ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
        >
          <Download className="w-4 h-4" />Export CSV
        </button>
      </div>

      <div className={`border rounded-lg overflow-hidden ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem]">
            <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
              <tr>
                <th className={`${thBase} text-left`} onClick={() => handleSort('displayName')}><div className="flex items-center">City<SortIcon active={sortField === 'displayName'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-left`} onClick={() => handleSort('state')}><div className="flex items-center">State<SortIcon active={sortField === 'state'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-left hidden sm:table-cell`} onClick={() => handleSort('source')}><div className="flex items-center">Source<SortIcon active={sortField === 'source'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-left hidden sm:table-cell`} onClick={() => handleSort('label')}><div className="flex items-center">Label<SortIcon active={sortField === 'label'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-right`} onClick={() => handleSort('featureCount')}><div className="flex items-center justify-end">Wards<SortIcon active={sortField === 'featureCount'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-right`} onClick={() => handleSort('totalArea')}><div className="flex items-center justify-end">Area (km²)<SortIcon active={sortField === 'totalArea'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-right hidden sm:table-cell`} onClick={() => handleSort('avgCompactness')}><div className="flex items-center justify-end">Compact.<SortIcon active={sortField === 'avgCompactness'} dir={sortDirection} /></div></th>
                <th className={`${thBase} text-right`}></th>
              </tr>
            </thead>
            <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
              {page.map(row => (
                <tr key={row.id} className={`transition-colors ${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
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
                      className={`text-xs px-2 py-0.5 rounded border transition-colors ${darkMode ? 'border-blue-700 text-blue-400 hover:bg-blue-900/30' : 'border-blue-300 text-blue-600 hover:bg-blue-50'}`}
                    >
                      Ward metrics
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationBar currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} darkMode={darkMode} />
      </div>
    </>
  );
}

function WardMetricsView({ darkMode, initialDatasetId, onBack }: { darkMode: boolean; initialDatasetId: string; onBack: () => void }) {
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

  const { thBase, tdBase, tdMuted, tdPrimary } = tableClasses(darkMode);

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={onBack}
          className={`text-sm px-3 py-1.5 rounded border transition-colors ${darkMode ? 'border-gray-600 text-gray-300 hover:bg-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          ← Back
        </button>
        <h3 className={`font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Ward Metrics — {dataset?.displayName ?? selectedId}
          {dataset && <span className={`ml-2 text-sm font-normal ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>{dataset.state} · {dataset.label}</span>}
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
                {d.displayName} — {d.label} ({d.state})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && (
        <div className={`p-8 text-center border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333] text-gray-400' : 'bg-white border-gray-200 text-gray-600'}`}>
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500 mx-auto mb-4" />
          Loading ward metrics...
        </div>
      )}

      {error && (
        <div className={`p-4 border rounded-lg ${darkMode ? 'bg-red-900/20 border-red-800 text-red-400' : 'bg-red-50 border-red-200 text-red-700'}`}>
          <p className="font-semibold mb-1">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && wards.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 items-center justify-between mb-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`} />
              <Input
                type="text"
                placeholder="Search ward..."
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); reset(); }}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                {filtered.length} wards{searchQuery && ` of ${wards.length}`}
              </span>
              <button
                onClick={() => downloadCSV(filtered, `${selectedId}_ward_metrics.csv`)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm transition-colors ${darkMode ? 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <Download className="w-4 h-4" />Export
              </button>
            </div>
          </div>

          <div className={`border rounded-lg overflow-hidden ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem]">
                <thead className={darkMode ? 'bg-gray-800' : 'bg-gray-50'}>
                  <tr>
                    <th className={`${thBase} text-left`} onClick={() => handleSort('ward_name')}><div className="flex items-center">Ward<SortIcon active={sortField === 'ward_name'} dir={sortDirection} /></div></th>
                    <th className={`${thBase} text-right`} onClick={() => handleSort('area_sq_km')}><div className="flex items-center justify-end">Area (km²)<SortIcon active={sortField === 'area_sq_km'} dir={sortDirection} /></div></th>
                    <th className={`${thBase} text-right hidden sm:table-cell`} onClick={() => handleSort('perimeter_km')}><div className="flex items-center justify-end">Perimeter (km)<SortIcon active={sortField === 'perimeter_km'} dir={sortDirection} /></div></th>
                    <th className={`${thBase} text-right`} onClick={() => handleSort('compactness')}><div className="flex items-center justify-end">Compact.<SortIcon active={sortField === 'compactness'} dir={sortDirection} /></div></th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-800' : 'divide-gray-200'}`}>
                  {page.map((w, i) => (
                    <tr key={`${w.ward_name}-${i}`} className={`transition-colors ${darkMode ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}>
                      <td className={tdPrimary}>{w.ward_name || `Ward ${w.ward_number}` || 'N/A'}</td>
                      <td className={`${tdMuted} text-right font-mono`}>{fmt(w.area_sq_km)}</td>
                      <td className={`${tdMuted} text-right font-mono hidden sm:table-cell`}>{fmt(w.perimeter_km)}</td>
                      <td className={`${tdMuted} text-right font-mono`}>{fmt(w.compactness, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationBar currentPage={currentPage} totalPages={totalPages} setCurrentPage={setCurrentPage} darkMode={darkMode} />
          </div>
        </>
      )}

      {!loading && !error && wards.length === 0 && (
        <div className={`p-6 text-center border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333] text-gray-400' : 'bg-white border-gray-200 text-gray-500'}`}>
          No ward metrics found for this dataset.
        </div>
      )}
    </>
  );
}

export const CityStats: React.FC<CityStatsProps> = ({ darkMode = false }) => {
  const [drillDownId, setDrillDownId] = useState<string | null>(null);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`p-4 sm:p-6 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          City Statistics
        </h2>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          {drillDownId
            ? 'Per-ward geometric metrics computed from GeoJSON boundaries. Click "Back" to return to the dataset list.'
            : `Browse all ${CITY_DATASETS.length} city ward boundary datasets. Click "Ward metrics" on any row to see area, perimeter, and compactness per ward.`}
        </p>
      </div>

      {drillDownId ? (
        <WardMetricsView
          darkMode={darkMode}
          initialDatasetId={drillDownId}
          onBack={() => setDrillDownId(null)}
        />
      ) : (
        <DatasetView darkMode={darkMode} onDrillDown={setDrillDownId} />
      )}
    </div>
  );
};
