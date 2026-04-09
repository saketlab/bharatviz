import React, { useState, useEffect, useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download } from 'lucide-react';
import Papa from 'papaparse';
import { DISTRICT_MAP_TYPES } from '@/lib/districtMapConfig';

interface DistrictMetric {
  state_name: string;
  district_name: string;
  area_sq_km: number;
  perimeter_km: number;
  compactness: number;
  bbox_xmin: number;
  bbox_ymin: number;
  bbox_xmax: number;
  bbox_ymax: number;
  centroid_lon: number;
  centroid_lat: number;
  num_vertices: number;
}

type SortField = 'state_name' | 'district_name' | 'area_sq_km' | 'perimeter_km' | 'compactness';
type SortDirection = 'asc' | 'desc' | null;

const SHAPEFILE_OPTIONS = Object.values(DISTRICT_MAP_TYPES).map((cfg) => ({
  id: cfg.geojsonPath.replace(/^\//, '').replace(/\.geojson$/, ''),
  name: cfg.displayName,
}));

export const DistrictStats: React.FC<{ darkMode?: boolean }> = () => {
  const [selectedShapefile, setSelectedShapefile] = useState('India_LGD_districts');
  const [data, setData] = useState<DistrictMetric[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        const csvPath = `/district-stats/${selectedShapefile}_metrics.csv`;
        const response = await fetch(csvPath);

        if (!response.ok) {
          throw new Error(`Failed to load data: ${response.statusText}`);
        }

        const csvText = await response.text();

        Papa.parse<DistrictMetric>(csvText, {
          header: true,
          dynamicTyping: true,
          skipEmptyLines: true,
          complete: (results) => {
            setData(results.data as DistrictMetric[]);
            setLoading(false);
            setCurrentPage(1);
          },
          error: (err) => {
            setError(`Error parsing CSV: ${err.message}`);
            setLoading(false);
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    loadData();
  }, [selectedShapefile]);

  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (row) =>
          row.state_name?.toLowerCase().includes(query) ||
          row.district_name?.toLowerCase().includes(query)
      );
    }

    if (sortField && sortDirection) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];

        if (typeof aVal === 'string' && typeof bVal === 'string') {
          return sortDirection === 'asc'
            ? aVal.localeCompare(bVal)
            : bVal.localeCompare(aVal);
        }

        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }

        return 0;
      });
    }

    return result;
  }, [data, searchQuery, sortField, sortDirection]);

  const totalPages = Math.ceil(filteredAndSortedData.length / itemsPerPage);
  const paginatedData = filteredAndSortedData.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1" />;
    }
    if (sortDirection === 'desc') {
      return <ArrowDown className="w-4 h-4 ml-1" />;
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 opacity-40" />;
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(filteredAndSortedData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedShapefile}_filtered_metrics.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 100);
  };

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num === null || num === undefined) return 'N/A';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  };

  const thBase = 'px-3 py-2 sm:px-4 sm:py-3 text-xs font-medium uppercase tracking-wider transition-colors text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,75%)]';
  const thBtnBase = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] focus-visible:ring-offset-1 rounded';
  const tdBase = 'px-3 py-2.5 sm:px-4 sm:py-3 text-sm';
  const tdMuted = `${tdBase} text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,52%)]`;
  const tdPrimary = `${tdBase} font-medium text-[hsl(28,20%,14%)] dark:text-[hsl(35,10%,82%)]`;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="p-4 sm:p-6 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <h2 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-4 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
          District Statistics
        </h2>
        <p className="text-sm mb-4 sm:mb-6 text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
          Explore geometric metrics for Indian districts across different shapefiles.
          Metrics include area, perimeter, compactness score, and geographic coordinates.
        </p>

        <div className="mb-4">
          <Label htmlFor="shapefile-select" className="text-sm font-medium mb-2 block">
            Select Shapefile
          </Label>
          <Select value={selectedShapefile} onValueChange={setSelectedShapefile}>
            <SelectTrigger id="shapefile-select" className="w-full sm:max-w-lg">
              <SelectValue placeholder="Select a shapefile" />
            </SelectTrigger>
            <SelectContent>
              {SHAPEFILE_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-4">
          <Label htmlFor="search" className="text-sm font-medium mb-2 block">
            Search
          </Label>
          <div className="relative w-full sm:max-w-lg">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(28,8%,56%)] dark:text-[hsl(30,8%,45%)]" />
            <Input
              id="search"
              type="text"
              placeholder="Search by state or district name..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              className="pl-10"
            />
          </div>
        </div>

        {!loading && data.length > 0 && (
          <div className="flex flex-wrap gap-3 items-center justify-between">
            <div className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
              {filteredAndSortedData.length} districts
              {searchQuery && ` of ${data.length}`}
            </div>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border text-sm transition-colors border-[hsl(35,18%,78%)] bg-white text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,16%)]"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="p-8 sm:p-12 text-center border rounded-lg bg-white border-[hsl(35,18%,84%)] text-[hsl(28,8%,40%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,55%)]">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-[hsl(28,62%,48%)] mx-auto mb-4"></div>
          Loading district metrics...
        </div>
      )}

      {error && (
        <div className="p-6 border rounded-lg bg-red-50 border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
          <p className="font-semibold mb-2">Error loading data</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && data.length > 0 && (
        <div className="border rounded-lg overflow-hidden bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem]">
              <thead className="bg-[hsl(35,20%,97%)] dark:bg-[hsl(25,8%,12%)]">
                <tr>
                  <th className={`${thBase} text-left`}>
                    <button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('state_name')} aria-label={`Sort by state${sortField === 'state_name' ? `, currently ${sortDirection}ending` : ''}`}>State{getSortIcon('state_name')}</button>
                  </th>
                  <th className={`${thBase} text-left`}>
                    <button className={`flex items-center w-full ${thBtnBase}`} onClick={() => handleSort('district_name')} aria-label={`Sort by district${sortField === 'district_name' ? `, currently ${sortDirection}ending` : ''}`}>District{getSortIcon('district_name')}</button>
                  </th>
                  <th className={`${thBase} text-right`}>
                    <button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('area_sq_km')} aria-label={`Sort by area${sortField === 'area_sq_km' ? `, currently ${sortDirection}ending` : ''}`}>Area (km²){getSortIcon('area_sq_km')}</button>
                  </th>
                  <th className={`${thBase} text-right hidden sm:table-cell`}>
                    <button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('perimeter_km')} aria-label={`Sort by perimeter${sortField === 'perimeter_km' ? `, currently ${sortDirection}ending` : ''}`}>Perimeter (km){getSortIcon('perimeter_km')}</button>
                  </th>
                  <th className={`${thBase} text-right`}>
                    <button className={`flex items-center justify-end w-full ${thBtnBase}`} onClick={() => handleSort('compactness')} aria-label={`Sort by compactness${sortField === 'compactness' ? `, currently ${sortDirection}ending` : ''}`}>Compact.{getSortIcon('compactness')}</button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(35,18%,88%)] dark:divide-[hsl(25,8%,14%)]">
                {paginatedData.map((row, idx) => (
                  <tr
                    key={`${row.state_name}-${row.district_name}-${idx}`}
                    className="transition-colors hover:bg-[hsl(35,20%,97%)] dark:hover:bg-[hsl(25,8%,12%)]"
                  >
                    <td className={tdPrimary}>{row.state_name || 'N/A'}</td>
                    <td className={tdMuted}>{row.district_name || 'N/A'}</td>
                    <td className={`${tdMuted} text-right font-mono`}>{formatNumber(row.area_sq_km, 2)}</td>
                    <td className={`${tdMuted} text-right font-mono hidden sm:table-cell`}>{formatNumber(row.perimeter_km, 2)}</td>
                    <td className={`${tdMuted} text-right font-mono`}>{formatNumber(row.compactness, 4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="px-3 py-2.5 sm:px-4 sm:py-3 border-t flex items-center justify-between gap-2 border-[hsl(35,18%,84%)] bg-[hsl(35,20%,97%)] dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,9%)]">
              <div className="text-sm text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,55%)]">
                {currentPage}/{totalPages}
              </div>
              <div className="flex gap-2">
                {(() => {
                  const btnBase = 'px-3 py-1 rounded border text-sm transition-colors';
                  const active = 'border-[hsl(35,18%,78%)] bg-white text-[hsl(28,20%,22%)] hover:bg-[hsl(35,20%,96%)] dark:border-[hsl(25,8%,20%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,75%)] dark:hover:bg-[hsl(25,8%,16%)]';
                  const disabled = 'border-[hsl(35,18%,88%)] bg-[hsl(35,20%,95%)] text-[hsl(28,8%,58%)] cursor-not-allowed dark:border-[hsl(25,8%,14%)] dark:bg-[hsl(25,8%,11%)] dark:text-[hsl(30,8%,38%)]';
                  return (<>
                    <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className={`${btnBase} ${currentPage === 1 ? disabled : active}`}>Prev</button>
                    <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className={`${btnBase} ${currentPage === totalPages ? disabled : active}`}>Next</button>
                  </>);
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
