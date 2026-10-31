import { useEffect, useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import { IndiaDistrictsMap, type IndiaDistrictsMapRef, type DistrictMapData, type NAInfo } from '@/components/IndiaDistrictsMap';
import { FileUpload } from '@/components/FileUpload';
import { ExportOptions } from '@/components/ExportOptions';
import { MapProcessingOverlay } from '@/components/MapProcessingOverlay';
import { ColorMapChooser, type ColorScale, type ColorBarSettings } from '@/components/ColorMapChooser';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUrlState } from '@/hooks/useUrlState';
import { type CategoryColorMapping, detectDataType, getUniqueCategories, generateDefaultCategoryColors } from '@/lib/categoricalUtils';
import { type BoundaryColor } from '@/lib/colorUtils';
import { fetchWithCorsFallback } from '@/lib/corsProxy';
import { evictGeoJSON } from '@/lib/geoJsonCache';
import { geometryToPolygons } from '@/lib/geojsonToPolygonFeature';

type Props = Record<string, unknown>;
interface Feature {
  type: 'Feature';
  properties: Props;
  geometry: { type: string; coordinates: unknown };
}

const NO_STATE = '__none__';
const NO_STATE_LABEL = 'All';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

type Geom = { type: string; coordinates?: unknown; geometries?: Geom[] };

const isGeometry = (g: unknown): g is Geom => !!g && typeof g === 'object' && typeof (g as Geom).type === 'string';

// GeometryCollections flatten to MultiPolygon
function toPolygonal(g: Geom): Feature['geometry'] | null {
  if (g.type === 'Polygon' || g.type === 'MultiPolygon') return g as Feature['geometry'];
  if (g.type !== 'GeometryCollection') return null;
  const parts = (g.geometries ?? []).flatMap(c => {
    const p = isGeometry(c) && toPolygonal(c);
    return p ? geometryToPolygons(p as Parameters<typeof geometryToPolygons>[0]) : [];
  });
  return parts.length ? { type: 'MultiPolygon', coordinates: parts } : null;
}

// properties built only for kept rows
function toFeatures<T>(rows: T[], geometryOf: (r: T) => unknown, propertiesOf: (r: T) => Props, what: string): Feature[] {
  const features: Feature[] = [];
  const skipped = new Map<string, number>();
  for (const r of rows) {
    const geometry = geometryOf(r);
    if (!isGeometry(geometry)) continue;
    const g = toPolygonal(geometry);
    if (g) features.push({ type: 'Feature', properties: propertiesOf(r), geometry: g });
    else skipped.set(geometry.type, (skipped.get(geometry.type) ?? 0) + 1);
  }
  if (!features.length) {
    const found = [...skipped].map(([t, n]) => `${n.toLocaleString('en-US')} ${t}`).join(', ');
    throw new Error(`No Polygon or MultiPolygon features in this ${what} (found ${found || 'none'}). Your Map colours areas; point and line layers aren't supported yet.`);
  }
  return features;
}

// parquet BigInt/Date break JSON.stringify
const toScalar = (v: unknown) =>
  typeof v === 'bigint' ? Number(v) : v instanceof Date ? v.toISOString() : v;

async function readParquet(src: File | string): Promise<{ features: Feature[]; columns: string[] }> {
  const [{ parquetReadObjects }, { compressors }] = await Promise.all([
    import('hyparquet'),
    import('hyparquet-compressors'),
  ]);
  // whole-file GET; range reads need a CORS preflight bharatlas.com rejects
  const file = typeof src === 'string' ? await fetchWithCorsFallback(src).then(r => r.arrayBuffer()) : await src.arrayBuffer();
  const rows = await parquetReadObjects({ file, compressors }) as Props[];
  const columns = rows.length ? Object.keys(rows[0]) : [];
  // hyparquet decodes GeoParquet WKB into GeoJSON geometry
  const geomCol = columns.find(c => rows.some(r => isGeometry(r[c])));
  if (!geomCol) {
    throw new Error(`No geometry column found. This file is a plain table (${rows.length.toLocaleString('en-US')} rows; columns: ${columns.join(', ')}). Export boundaries with geopandas \`gdf.to_parquet()\` or as GeoJSON.`);
  }
  const propertiesOf = (r: Props) => {
    const properties: Props = {};
    for (const c of columns) if (c !== geomCol) properties[c] = toScalar(r[c]);
    return properties;
  };
  const features = toFeatures(rows, r => r[geomCol], propertiesOf, 'parquet file');
  return { features, columns: columns.filter(c => c !== geomCol) };
}

function readGeoJSON(text: string): { features: Feature[]; columns: string[] } {
  const json = JSON.parse(text);
  const all = json.type === 'FeatureCollection' ? json.features : json.type === 'Feature' ? [json] : Array.isArray(json) ? json : [];
  const features = toFeatures<{ geometry?: unknown; properties?: Props | null }>(all, f => f?.geometry, f => f.properties ?? {}, 'GeoJSON');
  return { features, columns: Object.keys(features[0].properties) };
}

async function loadGeometry(src: File | string) {
  const name = typeof src === 'string' ? new URL(src).pathname : src.name;
  if (/\.(geo)?parquet$/i.test(name)) return readParquet(src);
  const text = typeof src === 'string'
    ? await fetchWithCorsFallback(src).then(r => r.text())
    : await src.text();
  return readGeoJSON(text);
}

const STATE_HEADER = /state|st_?nm|^st_?name$/i;
const UNIT_HEADER = /name|dist|^dt|s(ub_?)?dt|block|tehsil|taluk|mandal|village|ward|panchayat|constituency|^(ac|pc)_?n/i;
const MAX_STATES = 40; // all states/UTs plus spelling variants
const SAMPLE = 2000; // distinct counts only rank columns

function detectColumns(features: Feature[], columns: string[]): { name: string; state: string } {
  const step = Math.ceil(features.length / SAMPLE);
  const sample = step > 1 ? features.filter((_, i) => i % step === 0) : features;
  const stats = new Map(columns.map(c => {
    const vals = sample.map(f => f.properties[c]).filter(v => v != null && v !== '');
    const distinct = new Set(vals.map(String)).size;
    const textual = vals.filter(v => typeof v === 'string' && isNaN(Number(v))).length > vals.length / 2;
    return [c, { distinct, textual }];
  }));
  const s = (c: string) => stats.get(c)!;

  const state = columns
    .filter(c => STATE_HEADER.test(c) && s(c).distinct > 0 && s(c).distinct <= MAX_STATES)
    .sort((a, b) => Number(s(b).textual) - Number(s(a).textual) || Number(/name/i.test(b)) - Number(/name/i.test(a)))[0];

  // finest admin unit wins (most distinct values)
  const name = columns
    .filter(c => c !== state && !STATE_HEADER.test(c) && s(c).textual)
    .sort((a, b) => Number(UNIT_HEADER.test(b)) - Number(UNIT_HEADER.test(a)) || s(b).distinct - s(a).distinct)[0];

  return { name: name ?? columns.find(c => c !== state) ?? columns[0] ?? '', state: state ?? NO_STATE };
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (r: { access_token?: string; error?: string }) => void;
            error_callback?: (e: { message?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
    };
  }
}

async function getGoogleToken(): Promise<string> {
  if (!window.google) {
    await new Promise<void>((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load Google sign-in'));
      document.head.appendChild(s);
    });
  }
  return new Promise((resolve, reject) => {
    window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID!,
      scope: 'https://www.googleapis.com/auth/drive.file', // only files this app creates
      callback: r => (r.access_token ? resolve(r.access_token) : reject(new Error(r.error || 'Sign-in cancelled'))),
      error_callback: e => reject(new Error(e.message || 'Sign-in cancelled')),
    }).requestAccessToken();
  });
}

// link-viewable so FileUpload can read it back
async function createGoogleSheet(csv: string, title: string): Promise<string> {
  const token = await getGoogleToken();
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify({ name: title, mimeType: 'application/vnd.google-apps.spreadsheet' })], { type: 'application/json' }));
  form.append('file', new Blob([csv], { type: 'text/csv' }));
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Google Drive: ${res.status} ${await res.text()}`);
  const { id, webViewLink } = await res.json() as { id: string; webViewLink: string };
  await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  });
  return webViewLink;
}

const toCsv = (rows: string[][], nameCol: string, value: () => number | string) =>
  Papa.unparse({ fields: ['state_name', nameCol, 'value'], data: rows.map(r => [...r, value()]) });

function useBlobUrl(content: string | undefined, type: string) {
  const url = useMemo(() => (content === undefined ? undefined : URL.createObjectURL(new Blob([content], { type }))), [content, type]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

const mutedText = 'text-[hsl(28,8%,48%)] dark:text-[hsl(30,8%,55%)]';
const errorText = 'text-xs text-[hsl(0,60%,45%)] dark:text-[hsl(0,60%,65%)] break-words';
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)] mb-2 block';
const inputClass = 'w-full border rounded-lg px-3 py-2 text-sm focus:outline-hidden focus:ring-2 focus:ring-[hsl(28,62%,48%)] focus:border-transparent border-[hsl(35,18%,84%)] bg-[hsl(38,22%,99%)] text-[hsl(28,20%,14%)] dark:bg-[hsl(25,8%,11%)] dark:border-[hsl(25,8%,16%)] dark:text-[hsl(35,10%,82%)]';

interface ByomMapProps {
  darkMode?: boolean;
  boundaryColor: BoundaryColor;
  onBoundaryColorChange: (c: BoundaryColor) => void;
  boundaryWidth: number;
  onBoundaryWidthChange: (w: number) => void;
}

export function ByomMap({ darkMode, boundaryColor, onBoundaryColorChange, boundaryWidth, onBoundaryWidthChange }: ByomMapProps) {
  const mapRef = useRef<IndiaDistrictsMapRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [srcUrl, setSrcUrl] = useUrlState('src', '');
  const urlInputRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<{ name: string; features: Feature[]; columns: string[] } | null>(null);
  const [nameCol, setNameCol] = useUrlState('name', '');
  // empty until load() auto-picks
  const [stateCol, setStateCol] = useUrlState('state', '');
  const [colorCol, setColorCol] = useUrlState('col', '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ busy: boolean; link?: string; error?: string }>({ busy: false });
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);

  const [mapData, setMapData] = useState<DistrictMapData[]>([]);
  const [dataTitle, setDataTitle] = useState('');
  const [naInfo, setNAInfo] = useState<NAInfo | undefined>();
  const [categoryColors, setCategoryColors] = useState<CategoryColorMapping>({});
  const [colorScale, setColorScale] = useUrlState<ColorScale>('colorScale', 'spectral');
  const [invertParam, setInvertParam] = useUrlState('invertColors', '');
  const invertColors = invertParam === 'true';
  const [hideNames, setHideNames] = useState(false);
  const [colorBarSettings, setColorBarSettings] = useState<ColorBarSettings>({
    isDiscrete: false, binCount: 5, customBoundaries: [], useCustomBoundaries: false,
  });

  const resetData = () => { setMapData([]); setNAInfo(undefined); setSheet({ busy: false }); };

  const load = async (src: File | string) => {
    setLoading(true);
    setError(null);
    try {
      const { features, columns } = await loadGeometry(src);
      const name = typeof src === 'string' ? src.split('/').pop() || src : src.name;
      setSource({ name, features, columns });
      const detected = detectColumns(features, columns);
      if (!columns.includes(nameCol)) setNameCol(detected.name);
      if (stateCol !== NO_STATE && !columns.includes(stateCol)) setStateCol(detected.state);
      if (!columns.includes(colorCol)) setColorCol('');
      setHideNames(features.length > 500);
      resetData();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (srcUrl) load(srcUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalized = useMemo(() => {
    if (!source || !source.columns.includes(nameCol)) return null;
    const features = source.features.map(f => {
      const p = f.properties;
      const state = stateCol !== NO_STATE ? p[stateCol] : nameCol === 'state_name' ? p.state_name : NO_STATE_LABEL;
      return { ...f, properties: { ...p, [nameCol]: String(p[nameCol] ?? ''), state_name: String(state ?? '') } };
    });
    return { type: 'FeatureCollection', features };
  }, [source, nameCol, stateCol]);

  // map and CSV matcher only take geometry by URL
  const geoJson = useMemo(() => (normalized ? JSON.stringify(normalized) : undefined), [normalized]);
  const geoUrl = useBlobUrl(geoJson, 'application/json');
  useEffect(() => () => { if (geoUrl) evictGeoJSON(geoUrl); }, [geoUrl]);

  const templateRows = useMemo(() => {
    if (!normalized) return [];
    const seen = new Set<string>();
    const rows: string[][] = [];
    for (const f of normalized.features) {
      const row = [f.properties.state_name, f.properties[nameCol] as string];
      const key = row.join('|');
      if (row[1] && !seen.has(key)) { seen.add(key); rows.push(row); }
    }
    return rows.sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  }, [normalized, nameCol]);

  const templateCsv = useMemo(() => toCsv(templateRows, nameCol, () => ''), [templateRows, nameCol]);
  const demoCsv = useMemo(() => toCsv(templateRows, nameCol, () => Math.round(Math.random() * 1000) / 10), [templateRows, nameCol]);
  const templateUrl = useBlobUrl(templateCsv, 'text/csv');
  const demoUrl = useBlobUrl(demoCsv, 'text/csv');

  const columnData = useMemo(() => (colorCol && normalized ? normalized.features.map(f => {
    const v = f.properties[colorCol];
    return { state: f.properties.state_name, district: f.properties[nameCol] as string, value: v === '' || v === 'NA' ? null : v ?? null };
  }) as DistrictMapData[] : null), [normalized, nameCol, colorCol]);
  const shownData = columnData ?? mapData;

  const values = useMemo(() => shownData.map(d => d.value), [shownData]);
  const dataType = useMemo(() => detectDataType(values), [values]);
  const categories = useMemo(() => getUniqueCategories(values), [values]);

  const baseName = (source?.name ?? 'byom').replace(/\.[^.]+$/, '');

  const handleDataLoad = (rawData: Array<{ state: string; district: string; value: number | string }>, title?: string, na?: NAInfo) => {
    const data = rawData.map(r => ({ ...r, value: r.value === '' || r.value === 'NA' ? null : r.value })) as DistrictMapData[];
    setMapData(data);
    setDataTitle(title || '');
    setNAInfo(na);
    const loaded = data.map(d => d.value);
    if (detectDataType(loaded) === 'categorical') setCategoryColors(generateDefaultCategoryColors(getUniqueCategories(loaded)));
  };

  const handleCsvLoad: typeof handleDataLoad = (...args) => { setColorCol(''); handleDataLoad(...args); };

  useEffect(() => {
    if (columnData && dataType === 'categorical') setCategoryColors(generateDefaultCategoryColors(categories));
  }, [columnData, dataType, categories]);

  const handleCreateSheet = async () => {
    setSheet({ busy: true });
    try {
      setSheet({ busy: false, link: await createGoogleSheet(templateCsv, `BharatViz template - ${baseName}`) });
    } catch (e) {
      setSheet({ busy: false, error: e instanceof Error ? e.message : String(e) });
    }
  };

  const handleUrlLoad = () => {
    const url = urlInputRef.current?.value.trim();
    if (!url) return;
    setSrcUrl(url);
    load(url);
  };

  const columns = source?.columns ?? [];

  return (
    <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 lg:gap-6">
      <div className="relative lg:col-span-2 order-1 lg:order-2">
        <MapProcessingOverlay active={loading || processingMessage !== null} message={loading ? 'Reading boundaries…' : processingMessage ?? undefined} />
        {geoUrl ? (
          <>
            <IndiaDistrictsMap
              ref={mapRef}
              data={shownData}
              colorScale={colorScale}
              invertColors={invertColors}
              dataTitle={columnData ? colorCol : dataTitle}
              showStateBoundaries={false}
              colorBarSettings={colorBarSettings}
              geojsonPath={geoUrl}
              statesGeojsonPath={geoUrl}
              hideDistrictNames={hideNames}
              labelScale={0.7}
              dataType={dataType}
              categoryColors={categoryColors}
              naInfo={columnData ? undefined : naInfo}
              darkMode={darkMode}
              boundaryColor={boundaryColor}
              boundaryWidth={boundaryWidth}
              featureNameProp={nameCol}
              csvTemplateHeader={nameCol}
            />
            <div className="mt-4">
              <ExportOptions
                onExportPNG={() => mapRef.current?.exportPNG()}
                onExportSVG={() => mapRef.current?.exportSVG()}
                onExportPDF={() => mapRef.current?.exportPDF()}
                onCopyToClipboard={() => mapRef.current?.copyToClipboard()}
                disabled={shownData.length === 0}
                darkMode={darkMode}
              />
            </div>
          </>
        ) : (
          <div className={`h-96 flex items-center justify-center rounded border border-dashed border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,16%)] text-sm ${mutedText} px-6 text-center`}>
            Load a GeoJSON or GeoParquet file with polygon boundaries to start.
          </div>
        )}
      </div>

      <div className="lg:col-span-1 order-2 lg:order-1 lg:border-r lg:pr-5 border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
        <div className="mb-5">
          <h3 className="text-sm font-semibold mb-1 text-[hsl(28,20%,22%)] dark:text-[hsl(35,12%,90%)]">Bring Your Own Map</h3>
          <p className={`text-xs ${mutedText}`}>
            Use your own boundaries: GeoJSON, or GeoParquet (e.g. from geopandas <code>gdf.to_parquet()</code>). Files stay in your browser.
          </p>
        </div>

        <div className="mb-5 space-y-3">
          <Label className={labelClass}>Boundaries</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json,.parquet,.geoparquet"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) { setSrcUrl(''); load(f); } e.target.value = ''; }}
          />
          <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()} disabled={loading}>
            {loading ? 'Loading…' : 'Choose boundary file'}
          </Button>
          <div className="flex gap-2">
            <input
              type="url"
              className={inputClass}
              placeholder="https://… .geojson or .parquet"
              ref={urlInputRef}
              defaultValue={srcUrl}
              onKeyDown={e => { if (e.key === 'Enter') handleUrlLoad(); }}
            />
            <Button variant="outline" onClick={handleUrlLoad} disabled={loading}>Load</Button>
          </div>
          {error && <p role="alert" className={errorText}>{error}</p>}
          {source && (
            <p className={`text-xs ${mutedText} break-words`}>
              {source.name}: {source.features.length.toLocaleString('en-US')} polygons
            </p>
          )}
        </div>

        {source && (
          <>
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div>
                <Label className={labelClass}>Name column</Label>
                <Select value={nameCol} onValueChange={v => { setNameCol(v); resetData(); }}>
                  <SelectTrigger aria-label="Name column"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className={labelClass}>State column</Label>
                <Select value={stateCol} onValueChange={v => { setStateCol(v); resetData(); }}>
                  <SelectTrigger aria-label="State column"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_STATE}>None</SelectItem>
                    {columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="mb-5 space-y-2">
              <Label className={labelClass}>Colour by column</Label>
              <Select value={colorCol || NO_STATE} onValueChange={v => { if (v === NO_STATE) { setColorCol(''); resetData(); } else setColorCol(v); }}>
                <SelectTrigger aria-label="Colour by column"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_STATE}>None (upload data below)</SelectItem>
                  {columns.filter(c => c !== nameCol && c !== stateCol).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="mb-5 space-y-2">
              <Label className={labelClass}>Data template</Label>
              <p className={`text-xs ${mutedText}`}>
                {templateRows.length.toLocaleString('en-US')} rows, one per unique {stateCol !== NO_STATE ? 'state + ' : ''}{nameCol}. Fill in <code>value</code> and upload below.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => saveAs(templateUrl!, `${baseName}-template.csv`)}>
                  Download CSV
                </Button>
                {GOOGLE_CLIENT_ID && (
                  <Button variant="outline" size="sm" onClick={handleCreateSheet} disabled={sheet.busy}>
                    {sheet.busy ? 'Creating…' : 'Create Google Sheet'}
                  </Button>
                )}
              </div>
              {GOOGLE_CLIENT_ID && !sheet.link && (
                <p className="text-[11px] text-[hsl(28,8%,54%)] dark:text-[hsl(30,8%,45%)]">
                  The sheet is created in your Drive and shared as "anyone with the link can view" so BharatViz can read it back.
                </p>
              )}
              {sheet.link && (
                <p className="text-xs break-all">
                  <a href={sheet.link} target="_blank" rel="noopener noreferrer" className="underline text-[hsl(28,45%,38%)] dark:text-[hsl(28,55%,52%)]">Open your sheet</a>
                  <span className={mutedText}> - fill it, then paste its link under "Or load from URL".</span>
                </p>
              )}
              {sheet.error && <p role="alert" className={errorText}>{sheet.error}</p>}
            </div>

            <FileUpload
              key={geoUrl}
              onDataLoad={handleCsvLoad}
              onProcessingChange={(active, message) => setProcessingMessage(active ? message ?? '' : null)}
              mode="districts"
              templateCsvPath={templateUrl}
              demoDataPath={demoUrl}
              googleSheetLink={sheet.link ?? ''}
              geojsonPath={geoUrl}
              locationProp={nameCol}
            />
            <div className="mt-6">
              <ColorMapChooser
                selectedScale={colorScale}
                onScaleChange={setColorScale}
                invertColors={invertColors}
                onInvertColorsChange={v => setInvertParam(v ? 'true' : '')}
                hideDistrictNames={hideNames}
                onHideDistrictNamesChange={setHideNames}
                districtNamesLabel="Hide names"
                colorBarSettings={colorBarSettings}
                onColorBarSettingsChange={setColorBarSettings}
                dataType={dataType}
                categories={categories}
                categoryColors={categoryColors}
                onCategoryColorChange={(category, color) => setCategoryColors(prev => ({ ...prev, [category]: color }))}
                boundaryColor={boundaryColor}
                onBoundaryColorChange={onBoundaryColorChange}
                boundaryWidth={boundaryWidth}
                onBoundaryWidthChange={onBoundaryWidthChange}
                darkMode={darkMode}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
