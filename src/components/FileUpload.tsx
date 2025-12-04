import React, { useRef, useState } from 'react';
import { Upload, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Papa from 'papaparse';
import pako from 'pako';
import stringSimilarity from "string-similarity";
import { getUniqueStatesFromGeoJSON } from "@/lib/stateUtils";
import { DISTRICT_MAP_TYPES } from "@/lib/districtMapConfig";

interface FileUploadProps {
  onDataLoad: (
    data:
      | Array<{ state: string; value: number }>
      | Array<{ state: string; district: string; value: number }>,
    title?: string
  ) => void;
  mode?: 'states' | 'districts';
  templateCsvPath?: string;
  demoDataPath?: string;
  googleSheetLink?: string;
  geojsonPath?: string;
  selectedDistrictMapType?: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onDataLoad,
  mode = 'states',
  templateCsvPath,
  demoDataPath,
  googleSheetLink,
  geojsonPath,
  selectedDistrictMapType
}) => {

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState('');
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // -------------------------------------------------------------
  // FUZZY MATCHING HELPERS
  // -------------------------------------------------------------
  const correctStateName = (inputName: string, validNames: string[]) => {
    if (!inputName || validNames.length === 0) return inputName;

    const cleaned = inputName.trim().toLowerCase();
    const matchList = validNames.map(v => v.toLowerCase());
    const result = stringSimilarity.findBestMatch(cleaned, matchList);
    return result.bestMatch.target;
  };

  const correctDistrictName = (inputName: string, validDistricts: string[]) => {
    if (!inputName || validDistricts.length === 0) return inputName;

    const cleaned = inputName.trim().toLowerCase();
    const matchList = validDistricts.map(v => v.toLowerCase());
    const result = stringSimilarity.findBestMatch(cleaned, matchList);
    return result.bestMatch.target;
  };

  const getDistrictsFromGeoJSON = async (path: string): Promise<string[]> => {
    try {
      const res = await fetch(path);
      if (!res.ok) return [];
      const geo = await res.json() as { features: Array<{ properties?: { district_name?: string } }> };
      return geo.features
        .map((f) => f.properties?.district_name?.toLowerCase().trim())
        .filter(Boolean) as string[];
    } catch {
      return [];
    }
  };

  // -------------------------------------------------------------
  // GEOJSON FILTERING
  // -------------------------------------------------------------
  interface GeoJSONFeature {
    properties?: {
      district_name?: string;
      state_name?: string;
      NAME_1?: string;
      name?: string;
      ST_NM?: string;
    };
  }

  interface GeoJSONData {
    features: GeoJSONFeature[];
  }

  interface DataRow {
    state: string;
    district?: string;
    value: number;
  }

  const filterDataByGeoJSON = async (
    data: DataRow[]
  ): Promise<DataRow[]> => {
    if (!geojsonPath) return data;

    try {
      const response = await fetch(geojsonPath);
      if (!response.ok) return data;

      const geojson = await response.json() as GeoJSONData;

      if (mode === 'districts') {
        return data.filter(row =>
          geojson.features.some((feature) => {
            const geoDistrict = feature.properties?.district_name?.toLowerCase().trim();
            const geoState = feature.properties?.state_name?.toLowerCase().trim();
            return (
              row.district?.toLowerCase().trim() === geoDistrict &&
              row.state.toLowerCase().trim() === geoState
            );
          })
        );
      }

      return data.filter(row =>
        geojson.features.some((feature) => {
          const s =
            (feature.properties?.state_name ||
              feature.properties?.NAME_1 ||
              feature.properties?.name ||
              feature.properties?.ST_NM)?.toLowerCase().trim();

          return row.state.toLowerCase().trim() === s;
        })
      );

    } catch (err) {
      console.error("GeoJSON filtering failed:", err);
      return data;
    }
  };

  // -------------------------------------------------------------
  // GZIP DECOMPRESSOR
  // -------------------------------------------------------------
  const decompressGzip = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const compressed = new Uint8Array(e.target?.result as ArrayBuffer);
          const decompressed = pako.inflate(compressed, { to: "string" });
          resolve(decompressed);
        } catch {
          reject(new Error("Failed to decompress gzipped file"));
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsArrayBuffer(file);
    });
  };

  // -------------------------------------------------------------
  // UNIFIED CSV/TSV PROCESSOR (FUZZY MATCH INCLUDED)
  // -------------------------------------------------------------
  const processUploadedData = async (result: Papa.ParseResult<Record<string, string>>) => {
    try {
      const data = result.data;
      const headers = result.meta.fields || [];

      const requiredColumns = mode === "districts" ? 3 : 2;
      if (headers.length < requiredColumns) {
        alert(
          mode === "districts"
            ? "CSV must have at least 3 columns: state, district, value"
            : "CSV must have at least 2 columns: state, value"
        );
        return;
      }

      const stateColumn = headers[0];
      const districtColumn = mode === "districts" ? headers[1] : null;
      const valueColumn = headers[headers.length - 1];

      let validStateNames: string[] = [];
      let validDistrictNames: string[] = [];

      // Load valid names from GeoJSON for fuzzy matching
      // If geojsonPath is not provided, fuzzy matching will be skipped (empty arrays)
      // Actual filtering will still occur in filterDataByGeoJSON
      if (geojsonPath) {
        validStateNames = await getUniqueStatesFromGeoJSON(geojsonPath);
      }

      if (mode === "districts" && selectedDistrictMapType) {
        const config = DISTRICT_MAP_TYPES[selectedDistrictMapType];
        validDistrictNames = await getDistrictsFromGeoJSON(config.geojsonPath);
      }

      const processed = data
        .filter(row =>
          mode === "districts"
            ? row[stateColumn] && row[districtColumn!]
            : row[stateColumn]
        )
        .map(row => {
          const raw = row[valueColumn];
          const trimmed = raw ? raw.trim() : "";
          const val =
            trimmed === "" || ["na", "n/a"].includes(trimmed.toLowerCase())
              ? NaN
              : Number(trimmed);

          if (mode === "districts") {
            return {
              state: correctStateName(row[stateColumn], validStateNames),
              district: correctDistrictName(row[districtColumn!], validDistrictNames),
              value: val
            };
          }

          return {
            state: correctStateName(row[stateColumn], validStateNames),
            value: val
          };
        })
        .filter(row => !isNaN(row.value));

      if (processed.length === 0) {
        alert("No valid rows found.");
        return;
      }

      const filtered = await filterDataByGeoJSON(processed);

      if (filtered.length === 0) {
        alert("Your data does not match the map boundaries.");
        return;
      }

      onDataLoad(filtered, valueColumn);
    } catch (err) {
      alert("Error processing file.");
    }
  };

  // -------------------------------------------------------------
  // FILE UPLOAD HANDLER
  // -------------------------------------------------------------
  const handleFileUpload = async (evt: React.ChangeEvent<HTMLInputElement>) => {
    const file = evt.target.files?.[0];
    if (!file) return;

    const isGzip = file.name.endsWith(".gz");

    if (isGzip) {
      try {
        const text = await decompressGzip(file);
        Papa.parse(text, {
          header: true,
          complete: async res => await processUploadedData(res as Papa.ParseResult<Record<string, string>>),
          error: () => alert("Error parsing decompressed file")
        });
      } catch {
        alert("Could not decompress .gz file");
      }
      return;
    }

    Papa.parse(file, {
      header: true,
      complete: async res => await processUploadedData(res as Papa.ParseResult<Record<string, string>>),
      error: () => alert("Error parsing file")
    });
  };
  // -------------------------------------------------------------
  // DEMO LOADER
  // -------------------------------------------------------------
  const handleLoadDemo = async () => {
    try {
      const demoFile =
        demoDataPath ||
        (mode === "districts"
          ? "/districts_demo.csv"
          : "/nfhs5_protein_consumption_eggs.csv");

      const response = await fetch(demoFile);
      if (!response.ok) throw new Error();

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: async (res) => {
          try {
            await processUploadedData(res as Papa.ParseResult<Record<string, string>>);
          } catch (err) {
            alert("Error processing demo data: " + (err instanceof Error ? err.message : String(err)));
          }
        }
      });
    } catch {
      alert("Error loading demo file.");
    }
  };

  // -------------------------------------------------------------
  // URL TYPE DETECTOR
  // -------------------------------------------------------------
  const detectUrlType = (url: string) => {
    if (url.includes("docs.google.com/spreadsheets")) return "google-sheet";
    if (url.endsWith(".csv")) return "csv";
    if (url.endsWith(".tsv")) return "tsv";
    if (url.endsWith(".csv.gz")) return "csv-gz";
    if (url.endsWith(".tsv.gz")) return "tsv-gz";
    return "unknown";
  };

  // -------------------------------------------------------------
  // GOOGLE SHEET HELPERS
  // -------------------------------------------------------------
  const extractSheetInfo = (url: string) => {
    const match = url.match(
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/.*?gid=(\d+))?/
    );
    if (!match) return null;
    return { sheetId: match[1], gid: match[2] || "0" };
  };

  // -------------------------------------------------------------
  // CORS FALLBACK FETCH
  // -------------------------------------------------------------
  const createTimeoutSignal = (timeoutMs: number) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
  };

  const tryProxyServices = async (url: string) => {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    for (const p of proxies) {
      try {
        const res = await fetch(p, { signal: createTimeoutSignal(30000) });
        if (res.ok) return res;
      } catch (e) {
        continue;
      }
    }

    throw new Error("All proxy services failed.");
  };

  const fetchWithCorsFallback = async (url: string) => {
    try {
      const res = await fetch(url, { signal: createTimeoutSignal(10000) });
      if (res.ok) return res;
      throw new Error("Direct fetch failed");
    } catch (error) {
      const isCorsOrNetworkError =
        error instanceof TypeError ||
        (error instanceof Error && (
          error.message.includes('Failed to fetch') ||
          error.message.includes('NetworkError') ||
          error.message.includes('timeout') ||
          error.name === 'AbortError'
        ));

      if (isCorsOrNetworkError) {
        return tryProxyServices(url);
      }
      throw error;
    }
  };

  const fetchAndDecompressGzUrl = async (url: string): Promise<string> => {
    const res = await fetchWithCorsFallback(url);
    const buffer = await res.arrayBuffer();
    try {
      return pako.inflate(new Uint8Array(buffer), { to: "string" });
    } catch (err) {
      throw new Error("Failed to decompress gzipped data" + (err instanceof Error && err.message ? `: ${err.message}` : ""));
    }
  };

  // -------------------------------------------------------------
  // LOAD FROM URL (GOOGLE SHEETS / CSV / TSV / GZ)
  // -------------------------------------------------------------
  const handleLoadGoogleSheet = async () => {
    setSheetError(null);
    setLoadingSheet(true);

    const url = googleSheetUrl.trim();
    const type = detectUrlType(url);
    let csvText = "";

    try {
      if (type === "google-sheet") {
        const info = extractSheetInfo(url);
        if (!info) throw new Error("Invalid Google Sheets URL");
        const csvUrl = `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:csv&gid=${info.gid}`;

        const res = await fetchWithCorsFallback(csvUrl);
        csvText = await res.text();
      } else if (type === "csv-gz" || type === "tsv-gz") {
        csvText = await fetchAndDecompressGzUrl(url);
      } else if (type === "csv" || type === "tsv") {
        const res = await fetchWithCorsFallback(url);
        csvText = await res.text();
      } else {
        throw new Error("Unsupported or invalid URL");
      }

      Papa.parse(csvText, {
        header: true,
        complete: async (res) => {
          try {
            await processUploadedData(res as Papa.ParseResult<Record<string, string>>);
          } catch (err) {
            setSheetError(
              err instanceof Error ? err.message : "Failed to load or parse data"
            );
          } finally {
            setLoadingSheet(false);
          }
        }
      });
    } catch (err) {
      setSheetError(
        err instanceof Error ? err.message : "Failed to load or parse data"
      );
      setLoadingSheet(false);
    }
  };

  // -------------------------------------------------------------
  // TEMPLATE DOWNLOAD
  // -------------------------------------------------------------
  const downloadCSVTemplate = async () => {
    try {
      const templateFile =
        templateCsvPath ||
        (mode === "districts"
          ? "/bharatviz-district-template.csv"
          : "/bharatviz-state-template.csv");

      const res = await fetch(templateFile);
      if (!res.ok) throw new Error();

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        mode === "districts"
          ? "bharatviz-district-template.csv"
          : "bharatviz-state-template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error downloading template");
    }
  };

  // -------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------
  return (
    <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-colors">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Upload Your Data</h3>

        <p className="text-sm text-muted-foreground mb-4">
          {mode === "districts"
            ? "Upload CSV / TSV / GZ with state, district, value. Your data is never stored."
            : "Upload CSV / TSV / GZ with state and value. Your data is never stored."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => fileInputRef.current?.click()}>
            Choose File
          </Button>

          <Button variant="outline" onClick={handleLoadDemo}>
            <Play className="h-4 w-4 mr-1" />
            Load Demo
          </Button>
        </div>

        <div className="flex justify-center mt-3">
          <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
            Download CSV Template
          </Button>
        </div>

        {/* URL INPUT */}
        <div className="mt-4 p-4 border-t border-gray-200">
          <h4 className="text-sm font-medium mb-1">Load from URL</h4>

          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="https://docs.google.com/... or https://example.com/file.csv"
            value={googleSheetUrl}
            onChange={(e) => setGoogleSheetUrl(e.target.value)}
          />

          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={loadingSheet || !googleSheetUrl}
            onClick={handleLoadGoogleSheet}
          >
            {loadingSheet ? "Loading..." : "Load from URL"}
          </Button>

          {sheetError && (
            <p className="text-xs text-red-500 mt-2">{sheetError}</p>
          )}
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
