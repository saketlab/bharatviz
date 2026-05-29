import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { IndiaDistrictsMapRef } from '@/components/IndiaDistrictsMap';
import { ExportOptions } from '@/components/ExportOptions';
import type { BoundaryColor } from '@/lib/colorUtils';
import type { PointFeature } from '@/components/IndiaDistrictsMap';

const IndiaDistrictsMap = React.lazy(() =>
  import('@/components/IndiaDistrictsMap').then(m => ({ default: m.IndiaDistrictsMap }))
);

const R2 = 'https://geo.bharatviz.org';

// Color palette for categorical coloring — distinct enough at small radius
const CAT_COLORS = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
];

interface HealthDataset {
  id: string;
  displayName: string;
  parquetUrl: string;
  latField: string;
  lonField: string;
  labelField: string;
  colorField?: string;
  rows: string;
  defaultRadius: number;
  // columns to show in tooltip, in order. If omitted, all non-empty non-internal cols shown.
  tooltipFields?: string[];
  // Max rows to load in the slow path (no pre-computed in_india column). Prevents hang on large datasets.
  slowPathCap?: number;
}

const DATASETS: HealthDataset[] = [
  {
    id: 'nhp-hospital-directory',
    displayName: 'NHP Hospital Directory 2025',
    parquetUrl: `${R2}/geoparquet/health/nhp_hospital_directory_2025.parquet`,
    latField: 'Latitude', lonField: 'Longitude',
    labelField: 'Hospital_Name', colorField: 'Hospital_Category',
    rows: '10,843', defaultRadius: 2.5,
    tooltipFields: ['Hospital_Category', 'Hospital_Care_Type', 'Specialties', 'Facilities',
      'Accreditation', 'Total_Num_Beds', 'Number_Doctor', 'Emergency_Services',
      'Address_Original_First_Line', 'Town', 'District', 'State', 'Pincode',
      'Telephone', 'Mobile_Number', 'Website'],
  },
  {
    id: 'nhp-blood-banks',
    displayName: 'NHP Blood Banks 2015',
    parquetUrl: `${R2}/geoparquet/health/nhp_blood_banks_2015.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'h_name', colorField: 'category',
    rows: '897', defaultRadius: 3,
    tooltipFields: ['category', 'state', 'district', 'city', 'blood_component',
      'blood_group', 'service_time', 'contact'],
  },
  {
    id: 'nhp-health-facilities',
    displayName: 'NHP Health Facilities 2025',
    parquetUrl: `${R2}/geoparquet/health/nhp_health_facilities_2025.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'health_facility_name', colorField: 'facility_type',
    rows: '166,462', defaultRadius: 1.5,
    tooltipFields: ['facility_type', 'address', 'block_name', 'taluka_name',
      'district_name', 'state_name', 'pincode'],
  },
  {
    id: 'ncog-soi-hospitals',
    displayName: 'SOI NCOG Hospitals',
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_hospitals.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'name', colorField: undefined,
    rows: '—', defaultRadius: 2.5,
  },
  {
    id: 'ncog-soi-dispensaries',
    displayName: 'SOI NCOG Dispensaries',
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_dispensaries.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'name', colorField: undefined,
    rows: '—', defaultRadius: 2,
  },
  {
    id: 'bharatmaps-health-centers',
    displayName: 'BharatMaps Health Centers',
    parquetUrl: `${R2}/geoparquet/health/bharatmaps_health_centers.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'name', colorField: undefined,
    rows: '—', defaultRadius: 2,
  },
  {
    id: 'livingatlas-health-facilities',
    displayName: 'Living Atlas Health Facilities',
    parquetUrl: `${R2}/geoparquet/health/livingatlas_health_facilities.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'name', colorField: 'type',
    rows: '—', defaultRadius: 2,
  },
  {
    id: 'hotosm-health-facilities',
    displayName: 'HOTOSM Health Facilities (OSM)',
    parquetUrl: `${R2}/geoparquet/facilities/hotosm_ind_health_facilities.parquet`,
    latField: 'latitude', lonField: 'longitude',
    labelField: 'name', colorField: 'amenity',
    rows: '142,629', defaultRadius: 1.5,
    slowPathCap: 30000,
    tooltipFields: ['amenity', 'healthcare', 'healthcare_speciality', 'operator_type',
      'capacity_persons', 'addr_city', 'adm1_name', 'adm2_name'],
  },
];

// Extract lat/lon from a parquet row — handles both dedicated columns and WKB/WKT geometry
function extractCoords(row: Record<string, unknown>, ds: HealthDataset): { lon: number; lat: number } | null {
  // Try dedicated lat/lon columns first
  const lat = Number(row[ds.latField]);
  const lon = Number(row[ds.lonField]);
  if (isFinite(lat) && isFinite(lon) && lat !== 0 && lon !== 0) return { lat, lon };

  // Try geometry object (hyparquet parses WKB into a geometry object with coordinates)
  const geom = row.geometry as { type?: string; coordinates?: number[] } | null;
  if (geom?.type === 'Point' && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
    const [gLon, gLat] = geom.coordinates;
    if (isFinite(gLat) && isFinite(gLon) && gLat !== 0 && gLon !== 0) return { lat: gLat, lon: gLon };
  }

  return null;
}

// ── India point-in-polygon filter ────────────────────────────────────────────
// Loads the LGD states GeoJSON once and caches the rings for fast pip testing.

type Ring = number[][];
let indiaRingsCache: Ring[] | null = null;

async function getIndiaRings(): Promise<Ring[]> {
  if (indiaRingsCache) return indiaRingsCache;
  const res = await fetch('https://geo.bharatviz.org/geojsons/admin/India-geodata-lgd-states.geojson');
  const fc = await res.json() as { features: Array<{ geometry: { type: string; coordinates: unknown } }> };
  const rings: Ring[] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    if (g.type === 'Polygon') {
      for (const ring of g.coordinates as Ring[]) rings.push(ring);
    } else if (g.type === 'MultiPolygon') {
      for (const poly of g.coordinates as Ring[][]) for (const ring of poly) rings.push(ring);
    }
  }
  indiaRingsCache = rings;
  return rings;
}

function pointInRingPIP(lon: number, lat: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

function pointInIndia(lon: number, lat: number, rings: Ring[]): boolean {
  // Quick bbox check first
  if (lat < 6.5 || lat > 37.5 || lon < 68 || lon > 97.5) return false;
  for (const ring of rings) {
    if (pointInRingPIP(lon, lat, ring)) return true;
  }
  return false;
}

interface HealthMapProps {
  darkMode?: boolean;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
  selectedDatasetId?: string;
  onDatasetChange?: (id: string) => void;
}

export const HealthMap: React.FC<HealthMapProps> = ({
  darkMode, boundaryColor, boundaryWidth,
  selectedDatasetId: selectedDatasetIdProp,
  onDatasetChange,
}) => {
  const [selectedDatasetId, setSelectedDatasetId] = useState(selectedDatasetIdProp ?? DATASETS[0].id);
  const [points, setPoints] = useState<PointFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedDatasetId, setLoadedDatasetId] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [colorMap, setColorMap] = useState<Record<string, string>>({});
  const [pointRadius, setPointRadius] = useState(2);
  const [pointOpacity, setPointOpacity] = useState(0.7);
  const [totalRows, setTotalRows] = useState(0);
  const mapRef = useRef<IndiaDistrictsMapRef>(null);

  // Sync from parent (URL read fires after mount)
  useEffect(() => {
    if (selectedDatasetIdProp && selectedDatasetIdProp !== selectedDatasetId) {
      setSelectedDatasetId(selectedDatasetIdProp);
      setLoadedDatasetId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDatasetIdProp]);

  const dataset = DATASETS.find(d => d.id === selectedDatasetId)!;

  const loadDataset = useCallback(async (ds: HealthDataset) => {
    if (loadedDatasetId === ds.id) return;
    setLoading(true);
    setError(null);
    setPoints([]);
    setCategories([]);

    try {
      const [{ asyncBufferFromUrl, parquetReadObjects, parquetMetadataAsync }, { compressors }, indiaRings] = await Promise.all([
        import('hyparquet'),
        import('hyparquet-compressors'),
        getIndiaRings(),
      ]);

      const file = await asyncBufferFromUrl({ url: ds.parquetUrl });

      // Check schema first (cheap) to detect pre-computed columns
      const meta = await parquetMetadataAsync(file);
      // hyparquet schema is a flat list; first element is the root group (no type), rest are leaf columns
      const schemaNames = new Set(
        (meta.schema ?? []).map((f: { name?: string }) => f.name).filter(Boolean)
      );
      const hasPrecomputed = schemaNames.has('in_india') && schemaNames.has('lon') && schemaNames.has('lat');

      // For slow-path large datasets, cap the rows loaded to avoid browser hang
      const rowEnd = (!hasPrecomputed && ds.slowPathCap)
        ? Math.min(ds.slowPathCap, Number(meta.num_rows))
        : undefined;

      const rows = await parquetReadObjects({ file, compressors, rowEnd }) as Array<Record<string, unknown>>;

      // Build category color map
      const catMap: Record<string, string> = {};
      if (ds.colorField) {
        const cats = [...new Set(
          rows.map(r => String(r[ds.colorField!] ?? '').trim()).filter(c => c && c !== '0')
        )].slice(0, 20);
        cats.forEach((cat, i) => { catMap[cat] = CAT_COLORS[i % CAT_COLORS.length]; });
      }

      const pts: PointFeature[] = [];
      for (const row of rows) {
        // Resolve coordinates and validate
        let ptLon: number, ptLat: number;
        if (hasPrecomputed) {
          if (!row.in_india) continue;
          ptLon = Number(row.lon); ptLat = Number(row.lat);
          if (!isFinite(ptLon) || !isFinite(ptLat)) continue;
        } else {
          const coords = extractCoords(row, ds);
          if (!coords) continue;
          if (!pointInIndia(coords.lon, coords.lat, indiaRings)) continue;
          ptLon = coords.lon; ptLat = coords.lat;
        }

        const label = ds.labelField ? String(row[ds.labelField] ?? '').trim() : undefined;
        const catVal = ds.colorField ? String(row[ds.colorField] ?? '').trim() : undefined;
        const color = catVal && catVal !== '0' && catMap[catVal] ? catMap[catVal] : CAT_COLORS[0];

        const properties: Record<string, string | number | null> = {};
        const keys = ds.tooltipFields ?? Object.keys(row);
        for (const k of keys) {
          const v = row[k];
          if (v === null || v === undefined) continue;
          if (typeof v === 'object') continue;
          const s = String(v).trim();
          if (s === '' || s === '0' || s === 'NA') continue;
          properties[k] = typeof v === 'number' ? v : s;
        }
        properties['lat'] = Math.round(ptLat * 10000) / 10000;
        properties['lon'] = Math.round(ptLon * 10000) / 10000;

        pts.push({ lat: ptLat, lon: ptLon, label, color, properties });
      }

      setCategories(Object.keys(catMap));
      setColorMap(catMap);
      setTotalRows(pts.length);
      setPoints(pts);
      setLoadedDatasetId(ds.id);
      setPointRadius(ds.defaultRadius);
    } catch (e) {
      setError(`Failed to load dataset: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [loadedDatasetId]);

  // Auto-load when dataset changes
  useEffect(() => {
    loadDataset(dataset);
  }, [dataset, loadDataset]);

  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
      {/* Map */}
      <div className="lg:col-span-2 order-1 lg:order-2">
        <React.Suspense fallback={<div className="h-96 rounded border border-border bg-background animate-pulse" />}>
          <IndiaDistrictsMap
            ref={mapRef}
            data={[]}
            colorScale="spectral"
            invertColors={false}
            dataTitle=""
            showStateBoundaries={true}
            darkMode={darkMode}
            boundaryColor={boundaryColor}
            boundaryWidth={boundaryWidth}
            pointsLayer={points}
            pointRadius={pointRadius}
            pointOpacity={pointOpacity}
            pointColor={CAT_COLORS[0]}
          />
        </React.Suspense>

        {loading && (
          <div className="mt-3 flex items-center gap-2 text-sm text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading {dataset.displayName}…
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {!loading && totalRows > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            {totalRows.toLocaleString()} facilities plotted
          </p>
        )}

        <div className="mt-4">
          <ExportOptions
            onExportPNG={() => mapRef.current?.exportPNG()}
            onExportSVG={() => mapRef.current?.exportSVG()}
            onExportPDF={() => mapRef.current?.exportPDF()}
            onCopyToClipboard={() => mapRef.current?.copyToClipboard()}
            disabled={loading}
            geojsonDownloadUrl={dataset.parquetUrl}
            geojsonDownloadName={`${dataset.id}.parquet`}
            citationInfo={{ source: dataset.displayName, mapLabel: 'Health Facilities' }}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
        <div className="mb-5">
          <h3 className={`text-sm font-semibold mb-1 ${headingClass}`}>Health Facility Map</h3>
          <p className={`text-xs ${textClass}`}>
            Plot government health facility registries as points over India's district boundaries.
          </p>
        </div>

        <div className="mb-5">
          <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
            Dataset
          </Label>
          <Select value={selectedDatasetId} onValueChange={id => { setLoadedDatasetId(null); setSelectedDatasetId(id); onDatasetChange?.(id); }}>
            <SelectTrigger className="w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATASETS.map(ds => (
                <SelectItem key={ds.id} value={ds.id}>
                  <span>{ds.displayName}</span>
                  {ds.rows !== '—' && (
                    <span className="ml-2 text-xs text-muted-foreground">{ds.rows}</span>
                  )}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="mb-5 space-y-3">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-1 block">
              Point size: {pointRadius}px
            </Label>
            <input
              type="range" min={0.5} max={6} step={0.5}
              value={pointRadius}
              onChange={e => setPointRadius(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-1 block">
              Opacity: {Math.round(pointOpacity * 100)}%
            </Label>
            <input
              type="range" min={0.1} max={1} step={0.05}
              value={pointOpacity}
              onChange={e => setPointOpacity(Number(e.target.value))}
              className="w-full"
            />
          </div>
        </div>

        {/* Category legend */}
        {categories.length > 0 && (
          <div className="mb-5">
            <Label className="text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block">
              {dataset.colorField}
            </Label>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {categories.map(cat => (
                <div key={cat} className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: colorMap[cat], opacity: pointOpacity }}
                  />
                  <span className={`text-xs truncate ${textClass}`}>{cat || '(unknown)'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-3 rounded-md bg-[hsl(38,30%,96%)] dark:bg-[hsl(25,8%,10%)] border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)] text-xs text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]">
          Points are loaded client-side from GeoParquet. Large datasets (166k+ rows) may take a few seconds.
          Anganwadis (1.4M) are not listed here — too large for browser rendering; use MCP <span className="font-mono">aggregate_by_boundary</span> to count them per district instead.
        </div>
      </div>
    </div>
  );
};
