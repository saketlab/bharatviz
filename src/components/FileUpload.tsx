import React, { useRef, useState, useEffect } from 'react';
import { Upload, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Papa from 'papaparse';
import pako from 'pako';
import { processStateData, processDistrictData } from '@/lib/dataProcessor';
import { fetchWithCorsFallback, fetchAndDecompressGz } from '@/lib/corsProxy';
import { getNextDemo } from '@/lib/showcaseDemos';

interface NAInfo {
  states?: string[];
  districts?: Array<{ state: string; district: string }>;
  count: number;
}

type StateValueRow = { state: string; value: number | string };
type DistrictValueRow = { state: string; district: string; value: number | string };

type MultiSeriesPayload =
  | {
      kind: 'states';
      series: Array<{ key: string; title: string; data: StateValueRow[]; naInfo?: NAInfo }>;
    }
  | {
      kind: 'districts';
      series: Array<{ key: string; title: string; data: DistrictValueRow[]; naInfo?: NAInfo }>;
    };

interface FileUploadProps {
  onDataLoad: (
    data: Array<{ state: string; value: number | string }> | Array<{ state: string; district: string; value: number | string }>,
    title?: string,
    naInfo?: NAInfo
  ) => void;
  onMultiDataLoad?: (payload: MultiSeriesPayload) => void;
  mode?: 'states' | 'districts';
  templateCsvPath?: string;
  demoDataPath?: string;
  googleSheetLink?: string;
  geojsonPath?: string;
  selectedState?: string;
  onMapTitleChange?: (title: string) => void;
  onDemoUrlChange?: (dataUrl: string, title: string) => void;
  darkMode?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoad, onMultiDataLoad, mode = 'states', templateCsvPath, demoDataPath, googleSheetLink, geojsonPath, selectedState, onMapTitleChange, onDemoUrlChange, darkMode: _darkMode }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [fuzzyThreshold, setFuzzyThreshold] = useState<number>(0.4);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoInfo, setDemoInfo] = useState<{ index: number; total: number } | null>(null);
  const [showDemoPulse, setShowDemoPulse] = useState(() => {
    try { return !localStorage.getItem('bharatviz-demo-seen'); } catch { return false; }
  });

  useEffect(() => { setDemoInfo(null); }, [mode]);

  const clearDemoPulse = () => {
    if (showDemoPulse) {
      setShowDemoPulse(false);
      try { localStorage.setItem('bharatviz-demo-seen', '1'); } catch { /* ignore */ }
    }
  };

  const decompressGzip = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const compressed = new Uint8Array(e.target?.result as ArrayBuffer);
          const decompressed = pako.inflate(compressed, { to: 'string' });
          resolve(decompressed);
        } catch (error) {
          reject(new Error('Failed to decompress gzipped file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };


  const processUploadedData = async (result: Papa.ParseResult<Record<string, string>>) => {
    try {
      const data = result.data as Array<Record<string, string>>;
      const headers = result.meta.fields || [];

      const requiredColumns = mode === 'districts' ? 3 : 2;
      if (headers.length < requiredColumns) {
        alert(`CSV must have at least ${requiredColumns} columns${mode === 'districts' ? ' (state, district, value)' : ' (state, value)'}`);
        return;
      }

      const stateColumn = headers[0];
      const locationColumn = mode === 'districts' ? headers[1] : headers[0];

      const parseValue = (val: string): number | string => {
        const trimmed = val ? val.trim() : '';
        if (trimmed === '' || trimmed.toLowerCase() === 'na' || trimmed.toLowerCase() === 'n/a') {
          return NaN;
        }
        const num = Number(trimmed);
        return isNaN(num) ? trimmed : num;
      };

      /**
       * SPECIAL CASE: state, value, year format
       *
       * Users often provide data as:
       *   state, <value column>, year
       * with multiple rows per state/year. We want:
       *   - One map per unique year (colored by value)
       *   - The year shown as the map title/label
       *
       * We detect this pattern when:
       *   - mode === 'states'
       *   - We have at least 3 columns
       *   - The last column header contains "year"
       */
      if (mode === 'states' && headers.length >= 3 && onMultiDataLoad) {
        const valueColumnForYearFormat = headers[1]; // middle column in state, value, year
        const yearColumn = headers[headers.length - 1];
        const hasYearColumn = yearColumn.toLowerCase().includes('year');

        if (hasYearColumn) {
          type RowWithYear = { state: string; value: number | string; year: string };

          const rows: RowWithYear[] = data
            .filter(row => row[stateColumn] && row[valueColumnForYearFormat] && row[yearColumn])
            .map(row => ({
              state: row[stateColumn].trim(),
              value: parseValue(row[valueColumnForYearFormat]),
              year: String(row[yearColumn]).trim(),
            }));

          if (rows.length === 0) {
            alert('No valid data found. Please ensure your file has state, value, and year columns.');
            return;
          }

          const byYear = new Map<string, StateValueRow[]>();
          for (const row of rows) {
            if (!row.year) continue;
            if (!byYear.has(row.year)) {
              byYear.set(row.year, []);
            }
            byYear.get(row.year)!.push({ state: row.state, value: row.value });
          }

          const years = Array.from(byYear.keys())
            .filter(y => y !== '')
            .sort((a, b) => {
              const na = Number(a);
              const nb = Number(b);
              if (!isNaN(na) && !isNaN(nb)) return na - nb;
              return a.localeCompare(b);
            });

          if (years.length === 0) {
            alert('No valid year values found in the last column.');
            return;
          }

          const allSeries: Array<{ key: string; title: string; data: StateValueRow[]; naInfo?: NAInfo }> = [];

          for (const year of years) {
            const yearRows = byYear.get(year) || [];
            const processed = await processStateData(
              yearRows,
              geojsonPath || '',
              fuzzyThreshold
            );

            allSeries.push({
              key: year,
              title: year,
              data: processed.matched,
              naInfo: processed.naInfo
            });
          }

          onMultiDataLoad?.({ kind: 'states', series: allSeries });
          return;
        }
      }

      const valueColumns = mode === 'districts' ? headers.slice(2) : headers.slice(1);
      const valueColumn = valueColumns[valueColumns.length - 1];

      const processedData = data
        .filter(row => {
          return mode === 'districts'
            ? row[stateColumn] && row[locationColumn]
            : row[locationColumn];
        })
        .map(row => {
          return mode === 'districts'
            ? { state: row[stateColumn].trim(), district: row[locationColumn].trim(), value: parseValue(row[valueColumn]) }
            : { state: row[locationColumn].trim(), value: parseValue(row[valueColumn]) };
        });

      if (processedData.length === 0) {
        alert(`No valid data found. Please ensure your file has data in the correct columns.`);
        return;
      }

      const canEmitMulti = Boolean(onMultiDataLoad) && valueColumns.length > 1;
      if (canEmitMulti) {
        const seriesLimit = 4;
        const isYearLike = (col: string) => /^\s*\d{4}\s*$/.test(col);
        const normalizedCols = valueColumns.map(c => c.trim()).filter(Boolean);
        const yearCols = normalizedCols.filter(isYearLike);
        const nonYearCols = normalizedCols.filter(c => !isYearLike(c));
        const orderedCols =
          yearCols.length > 0
            ? [...yearCols].sort((a, b) => Number(a) - Number(b))
            : normalizedCols;

        const colsToUse = orderedCols.slice(-seriesLimit);

        if (mode === 'districts') {
          const allSeries: Array<{ key: string; title: string; data: DistrictValueRow[]; naInfo?: NAInfo }> = [];
          for (const col of colsToUse) {
            const seriesRaw = data
              .filter(row => row[stateColumn] && row[locationColumn])
              .map(row => ({
                state: row[stateColumn].trim(),
                district: row[locationColumn].trim(),
                value: parseValue(row[col])
              }));

            const processed = await processDistrictData(
              seriesRaw,
              geojsonPath || '',
              fuzzyThreshold,
              selectedState
            );

            allSeries.push({
              key: col,
              title: col,
              data: processed.matched,
              naInfo: processed.naInfo
            });
          }

          onMultiDataLoad?.({ kind: 'districts', series: allSeries });
          return;
        } else {
          const allSeries: Array<{ key: string; title: string; data: StateValueRow[]; naInfo?: NAInfo }> = [];
          for (const col of colsToUse) {
            const seriesRaw = data
              .filter(row => row[locationColumn])
              .map(row => ({
                state: row[locationColumn].trim(),
                value: parseValue(row[col])
              }));

            const processed = await processStateData(
              seriesRaw,
              geojsonPath || '',
              fuzzyThreshold
            );

            allSeries.push({
              key: col,
              title: col,
              data: processed.matched,
              naInfo: processed.naInfo
            });
          }

          onMultiDataLoad?.({ kind: 'states', series: allSeries });
          return;
        }
      }

      if (mode === 'districts') {
        const result = await processDistrictData(
          processedData as Array<{ state: string; district: string; value: number | string }>,
          geojsonPath || '',
          fuzzyThreshold,
          selectedState
        );

        if (result.matched.length === 0) {
          alert(`No data matched the current map. Please check your state and district names.`);
          return;
        }

        onDataLoad(result.matched, valueColumn, result.naInfo);
      } else {
        const result = await processStateData(
          processedData as Array<{ state: string; value: number | string }>,
          geojsonPath || '',
          fuzzyThreshold
        );

        if (result.matched.length === 0) {
          alert(`No data matched the current map. Please check your state names.`);
          return;
        }

        onDataLoad(result.matched, valueColumn, result.naInfo);
      }
    } catch (error) {
      alert(`Error processing file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    onMapTitleChange?.('');

    const isGzipped = file.name.endsWith('.gz');

    if (isGzipped) {
      try {
        const decompressedText = await decompressGzip(file);
        Papa.parse<Record<string, string>>(decompressedText, {
          header: true,
          complete: async (result) => {
            await processUploadedData(result);
          },
          error: () => {
            alert('Error parsing decompressed file');
          }
        });
      } catch (error) {
        alert('Error decompressing gzipped file. Please ensure the file is a valid .gz file.');
      }
      return;
    }

    Papa.parse<Record<string, string>>(file, {
      header: true,
      complete: async (result) => {
        await processUploadedData(result);
      },
      error: () => {
        alert('Error parsing file');
      }
    });
  };

  const handleLoadDemo = async () => {
    if (demoLoading) return;
    setDemoLoading(true);
    try {
      let csvText: string;

      const showcase = !demoDataPath ? getNextDemo(mode) : null;

      if (showcase) {
        const response = await fetch(showcase.demo.url);
        if (!response.ok) throw new Error('Failed to load demo data');
        csvText = await response.text();
        onMapTitleChange?.(showcase.demo.title);
        onDemoUrlChange?.(showcase.demo.url, showcase.demo.title);
        setDemoInfo({ index: showcase.index, total: showcase.total });
      } else {
        const response = await fetch(demoDataPath!);
        if (!response.ok) throw new Error('Failed to load demo data');
        csvText = await response.text();
      }

      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        complete: async (result) => {
          await processUploadedData(result);
          setDemoLoading(false);
        },
        error: () => { alert('Error parsing demo file'); setDemoLoading(false); }
      });
    } catch (error) {
      alert('Error loading demo data');
      setDemoLoading(false);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const downloadCSVTemplate = async () => {
    try {
      const templateFile = templateCsvPath || (mode === 'districts' ? '/bharatviz-district-template.csv' : '/bharatviz-state-template.csv');
      const response = await fetch(templateFile);
      if (!response.ok) {
        throw new Error('Failed to download template');
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const defaultName = mode === 'districts' ? 'bharatviz-district-template.csv' : 'bharatviz-state-template.csv';
      a.download = templateCsvPath ? templateFile.split('/').pop() || defaultName : defaultName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Error downloading template file');
    }
  };

  function detectUrlType(url: string): 'google-sheets' | 'csv' | 'tsv' | 'csv-gz' | 'tsv-gz' | 'unknown' {
    if (url.includes('docs.google.com/spreadsheets')) return 'google-sheets';
    if (url.endsWith('.csv.gz')) return 'csv-gz';
    if (url.endsWith('.tsv.gz')) return 'tsv-gz';
    if (url.endsWith('.csv')) return 'csv';
    if (url.endsWith('.tsv')) return 'tsv';
    return 'unknown';
  }

  function extractSheetInfo(url: string) {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/.*?gid=(\d+))?/);
    if (!match) return null;
    return { sheetId: match[1], gid: match[2] || '0' };
  }

  const handleLoadGoogleSheet = async () => {
    setSheetError(null);
    setLoadingSheet(true);
    onMapTitleChange?.('');

    const urlType = detectUrlType(googleSheetUrl);
    let csvText: string;

    try {
      if (urlType === 'google-sheets') {
        const info = extractSheetInfo(googleSheetUrl);
        if (!info) {
          setSheetError('Invalid Google Sheet link.');
          setLoadingSheet(false);
          return;
        }
        const csvUrl = `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:csv&gid=${info.gid}`;
        const response = await fetchWithCorsFallback(csvUrl);
        csvText = await response.text();
      } else if (urlType === 'csv-gz' || urlType === 'tsv-gz') {
        csvText = await fetchAndDecompressGz(googleSheetUrl);
      } else if (urlType === 'csv' || urlType === 'tsv') {
        const response = await fetchWithCorsFallback(googleSheetUrl);
        csvText = await response.text();
      } else {
        setSheetError('Invalid URL. Please provide a Google Sheets link or a direct link to a CSV, TSV, or gzipped file.');
        setLoadingSheet(false);
        return;
      }

      Papa.parse<Record<string, string>>(csvText, {
        header: true,
        complete: async (result) => {
          await processUploadedData(result);
          setLoadingSheet(false);
        },
        error: () => {
          setSheetError('Error parsing CSV/TSV data from URL.');
          setLoadingSheet(false);
        }
      });
    } catch (err) {
      setSheetError(err instanceof Error ? err.message : 'Failed to fetch or parse data from URL.');
      setLoadingSheet(false);
    }
  };

  return (
    <Card className="p-3 sm:p-6 transition-colors border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
      <div className="text-center">
        <Upload className="mx-auto h-8 w-8 sm:h-12 sm:w-12 mb-2 sm:mb-4 text-[hsl(28,42%,48%)] dark:text-[hsl(28,20%,48%)]" />
        <h3 className="text-base sm:text-lg font-medium mb-1 sm:mb-2 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">Upload Your Data</h3>
        <p className="text-xs sm:text-sm mb-3 sm:mb-4 text-muted-foreground dark:text-[hsl(30,8%,58%)]">
          {mode === 'districts'
            ? 'Upload a CSV, TSV, or gzipped (.gz) file with state, district, and value columns. The last column name becomes the color map title. Your data is never stored.'
            : 'Upload a CSV, TSV, or gzipped (.gz) file with state and value columns. The last column name becomes the color map title. Your data is never stored.'
          }
        </p>
        <div className="flex flex-col items-center gap-2 sm:gap-2.5">
          <div className="relative">
            {showDemoPulse && (
              <span className="absolute -inset-1 rounded-lg motion-safe:animate-ping opacity-60 bg-[hsl(28,62%,48%)] dark:bg-[hsl(28,55%,52%)]" style={{ animationDuration: '1.5s', animationIterationCount: 3 }} />
            )}
            <Button
              size="sm"
              onClick={() => { clearDemoPulse(); handleLoadDemo(); }}
              disabled={demoLoading}
              className="relative flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base px-5 py-2 sm:px-6 sm:py-2.5 font-semibold bg-[hsl(28,62%,48%)] hover:bg-[hsl(28,55%,42%)] text-white border-transparent dark:bg-[hsl(28,55%,52%)] dark:hover:bg-[hsl(28,50%,46%)] dark:text-[hsl(25,8%,6%)]"
            >
              <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              {demoLoading ? 'Loading…' : 'Load Demo'}
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUploadClick}
            className="text-xs sm:text-sm text-[hsl(28,10%,42%)] hover:border-[hsl(28,42%,52%)] hover:text-[hsl(30,42%,28%)] dark:bg-transparent dark:border-[hsl(25,8%,18%)] dark:text-[hsl(35,8%,65%)] dark:hover:border-[hsl(28,30%,48%)] dark:hover:text-[hsl(35,10%,82%)]"
          >
            or upload your own CSV
          </Button>
        </div>
        {demoInfo && !demoDataPath && (
          <p className="text-xs mt-2 text-[hsl(28,8%,54%)] dark:text-[hsl(28,8%,40%)]">
            {demoInfo.index} of {demoInfo.total} NFHS-5 indicators — click again for more
          </p>
        )}

        <div className="mt-4 p-4 border-t border-[hsl(35,16%,87%)] dark:border-[hsl(25,8%,14%)]">
          <div className="text-center mb-3">
            <h4 className="text-sm font-medium mb-1 text-[hsl(25,8%,16%)] dark:text-[hsl(35,10%,82%)]">Or load from URL</h4>
            <p className="text-xs text-[hsl(28,8%,46%)] dark:text-[hsl(30,8%,50%)]">
              Paste a Google Sheets link (sheet must be publicly viewable — see{' '}
              <a
                href={googleSheetLink || (mode === 'districts'
                  ? "https://docs.google.com/spreadsheets/d/1mxE70Qrf0ij3z--4alVbmKEfAIftH3N1wqMWYPNQk7Q/edit?usp=sharing"
                  : "https://docs.google.com/spreadsheets/d/1BtZOnh15b4ZG_I0pFLdMIK7nNqplikn5_ui59SFbxaI/edit?usp=sharing")}
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-[hsl(28,45%,38%)] hover:text-[hsl(30,42%,28%)] dark:text-[hsl(28,55%,52%)] dark:hover:text-[hsl(28,48%,58%)]"
              >
                template
              </a>
              ) or a direct URL to CSV, TSV, or gzipped files.{' '}
              <button
                onClick={downloadCSVTemplate}
                className="underline text-[hsl(28,38%,42%)] hover:text-[hsl(28,45%,32%)] dark:text-[hsl(28,45%,48%)] dark:hover:text-[hsl(28,55%,58%)]"
              >
                Download template
              </button>
            </p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="relative">
              <input
                type="text"
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(28,62%,48%)] focus:border-transparent border-[hsl(35,18%,84%)] bg-[hsl(38,22%,99%)] text-[hsl(28,20%,14%)] dark:bg-[hsl(25,8%,11%)] dark:border-[hsl(25,8%,16%)] dark:text-[hsl(35,10%,82%)] dark:placeholder-[hsl(28,8%,36%)]"
                placeholder="https://docs.google.com/... or https://example.com/data.csv"
                value={googleSheetUrl}
                onChange={e => setGoogleSheetUrl(e.target.value)}
                disabled={loadingSheet}
              />
              {googleSheetUrl && (
                <button
                  onClick={() => setGoogleSheetUrl('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 text-[hsl(28,8%,58%)] hover:text-[hsl(30,42%,28%)] dark:text-[hsl(28,8%,36%)] dark:hover:text-[hsl(30,8%,58%)]"
                  disabled={loadingSheet}
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center justify-center">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 hover:border-[hsl(28,62%,48%)] hover:text-[hsl(30,42%,28%)] dark:bg-[hsl(25,8%,12%)] dark:border-[hsl(25,8%,18%)] dark:text-[hsl(35,8%,72%)] dark:hover:bg-[hsl(25,8%,16%)] dark:hover:border-[hsl(28,62%,48%)] disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleLoadGoogleSheet}
                disabled={loadingSheet || !googleSheetUrl}
              >
                {loadingSheet ? 'Loading...' : 'Load from URL'}
              </Button>
            </div>
            {sheetError && <div className="text-xs text-center text-[hsl(0,55%,40%)] dark:text-[hsl(0,52%,50%)]">{sheetError}</div>}
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.gz"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </Card>
  );
};
