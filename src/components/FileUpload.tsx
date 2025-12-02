import React, { useRef, useState } from 'react';
import { Upload, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import Papa from 'papaparse';
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

  /** ⭐ NEW — REQUIRED for correct district fuzzy matching */
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
      const geo = await res.json();
      return geo.features
        .map((f: any) => f.properties?.district_name?.toLowerCase().trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  };

  // -------------------------------------------------------------
  // GEOJSON FILTERING
  // -------------------------------------------------------------
  const filterDataByGeoJSON = async (data: Array<any>) => {
    if (!geojsonPath) return data;

    try {
      const response = await fetch(geojsonPath);
      if (!response.ok) return data;

      const geojson = await response.json();

      if (mode === 'districts') {
        return data.filter(row =>
          geojson.features.some((feature: any) => {

            const geoDistrict = feature.properties.district_name?.toLowerCase().trim();
            const geoState = feature.properties.state_name?.toLowerCase().trim();

            return (
              row.district.toLowerCase().trim() === geoDistrict &&
              row.state.toLowerCase().trim() === geoState
            );
          })
        );
      }

      // STATES mode
      return data.filter(row =>
        geojson.features.some((feature: any) => {
          const featureStateName =
            (feature.properties.state_name ||
              feature.properties.NAME_1 ||
              feature.properties.name ||
              feature.properties.ST_NM)?.toLowerCase().trim();

          return row.state.toLowerCase().trim() === featureStateName;
        })
      );

    } catch (err) {
      console.error("GeoJSON filtering failed:", err);
      return data;
    }
  };

  // -------------------------------------------------------------
  // FILE UPLOAD HANDLER (PATCHED WITH DISTRICT FUZZY)
  // -------------------------------------------------------------
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      complete: async (result) => {
        try {
          const data = result.data as Array<Record<string, string>>;
          const headers = result.meta.fields || [];

          const requiredColumns = mode === 'districts' ? 3 : 2;
          if (headers.length < requiredColumns) {
            alert(`CSV must have at least ${requiredColumns} columns`);
            return;
          }

          const stateColumn = headers[0];
          const locationColumn = mode === 'districts' ? headers[1] : headers[0];
          const valueColumn = headers[headers.length - 1];

          // -------------------------------------------
          // LOAD VALID NAMES
          // -------------------------------------------
          let validStateNames: string[] = [];
          let validDistrictNames: string[] = [];

          if (geojsonPath) {
            validStateNames = await getUniqueStatesFromGeoJSON(geojsonPath);
          }

          // ⭐ Load correct district list based on selected map type (LGD / NFHS5 / NFHS4)
          if (mode === "districts" && selectedDistrictMapType) {
            const config = DISTRICT_MAP_TYPES[selectedDistrictMapType];
            validDistrictNames = await getDistrictsFromGeoJSON(config.geojsonPath);
          }

          // -------------------------------------------
          // PROCESS CSV ROWS
          // -------------------------------------------
          const processedData = data
            .filter(row =>
              mode === 'districts'
                ? row[stateColumn] && row[locationColumn]
                : row[locationColumn]
            )
            .map(row => {
              const v = row[valueColumn];
              const trimmed = v ? v.trim() : '';

              const numericValue =
                trimmed === '' ||
                trimmed.toLowerCase() === 'na' ||
                trimmed.toLowerCase() === 'n/a'
                  ? NaN
                  : Number(trimmed);

              if (mode === "districts") {
                return {
                  state: correctStateName(row[stateColumn], validStateNames),
                  district: correctDistrictName(row[locationColumn], validDistrictNames),
                  value: numericValue
                };
              }

              return {
                state: correctStateName(row[locationColumn], validStateNames),
                value: numericValue
              };
            })
            .filter(row => !isNaN(row.value));

          if (processedData.length === 0) {
            alert("No valid rows found.");
            return;
          }

          // -------------------------------------------
          // FINAL FILTER USING GEOJSON
          // -------------------------------------------
          const filteredData = await filterDataByGeoJSON(processedData);

          if (filteredData.length === 0) {
            alert("Your data does not match the map boundaries.");
            return;
          }

          onDataLoad(filteredData, valueColumn);

        } catch (error) {
          alert("Error processing file data");
        }
      },
      error: () => alert("Error parsing file")
    });
  };

  // -------------------------------------------------------------
  // DEMO LOADER (PATCHED WITH DISTRICT FUZZY)
  // -------------------------------------------------------------
  const handleLoadDemo = async () => {
    try {
      const demoFile =
        demoDataPath ||
        (mode === 'districts' ? '/districts_demo.csv' : '/nfhs5_protein_consumption_eggs.csv');

      const response = await fetch(demoFile);
      if (!response.ok) throw new Error();

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: async (result) => {
          try {
            const data = result.data as Array<Record<string, string>>;
            const headers = result.meta.fields || [];

            const requiredColumns = mode === 'districts' ? 3 : 2;
            if (headers.length < requiredColumns) {
              alert("Invalid demo CSV format.");
              return;
            }

            const stateColumn = headers[0];
            const locationColumn = mode === 'districts' ? headers[1] : headers[0];
            const valueColumn = headers[headers.length - 1];

            let validStateNames: string[] = [];
            let validDistrictNames: string[] = [];

            if (geojsonPath) validStateNames = await getUniqueStatesFromGeoJSON(geojsonPath);

            if (mode === "districts" && selectedDistrictMapType) {
              const config = DISTRICT_MAP_TYPES[selectedDistrictMapType];
              validDistrictNames = await getDistrictsFromGeoJSON(config.geojsonPath);
            }

            const processedData = data
              .filter(row =>
                mode === 'districts'
                  ? row[stateColumn] && row[locationColumn]
                  : row[locationColumn]
              )
              .map(row => ({
                state: correctStateName(row[stateColumn], validStateNames),
                district: mode === 'districts'
                  ? correctDistrictName(row[locationColumn], validDistrictNames)
                  : undefined,
                value: Number(row[valueColumn])
              }))
              .filter(row => !isNaN(row.value));

            const filteredData = await filterDataByGeoJSON(processedData);

            if (filteredData.length === 0) {
              alert("Demo data doesn't match the map.");
              return;
            }

            onDataLoad(filteredData, valueColumn);

          } catch {
            alert("Error processing demo data.");
          }
        }
      });

    } catch {
      alert("Error loading demo data.");
    }
  };

  // -------------------------------------------------------------
  // GOOGLE SHEET LOADER (PATCHED)
  // -------------------------------------------------------------
  const extractSheetInfo = (url: string) => {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)(?:\/.*?gid=(\d+))?/);
    if (!match) return null;
    return { sheetId: match[1], gid: match[2] || '0' };
  };

  const handleLoadGoogleSheet = async () => {
    setSheetError(null);
    setLoadingSheet(true);

    const info = extractSheetInfo(googleSheetUrl);
    if (!info) {
      setSheetError("Invalid Google Sheet URL");
      setLoadingSheet(false);
      return;
    }

    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${info.sheetId}/gviz/tq?tqx=out:csv&gid=${info.gid}`;
      const response = await fetch(csvUrl);
      if (!response.ok) throw new Error();

      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        complete: async (result) => {
          try {
            const data = result.data as Array<Record<string, string>>;
            const headers = result.meta.fields || [];

            const requiredColumns = mode === 'districts' ? 3 : 2;
            if (headers.length < requiredColumns) {
              setSheetError("Invalid sheet format.");
              setLoadingSheet(false);
              return;
            }

            const stateColumn = headers[0];
            const locationColumn = mode === 'districts' ? headers[1] : headers[0];
            const valueColumn = headers[headers.length - 1];

            let validStateNames: string[] = [];
            let validDistrictNames: string[] = [];

            if (geojsonPath) validStateNames = await getUniqueStatesFromGeoJSON(geojsonPath);

            if (mode === "districts" && selectedDistrictMapType) {
              const config = DISTRICT_MAP_TYPES[selectedDistrictMapType];
              validDistrictNames = await getDistrictsFromGeoJSON(config.geojsonPath);
            }

            const processedData = data
              .filter(row =>
                mode === 'districts'
                  ? row[stateColumn] && row[locationColumn]
                  : row[locationColumn]
              )
              .map(row => ({
                state: correctStateName(row[stateColumn], validStateNames),
                district: mode === 'districts'
                  ? correctDistrictName(row[locationColumn], validDistrictNames)
                  : undefined,
                value: Number(row[valueColumn])
              }))
              .filter(row => !isNaN(row.value));

            const filteredData = await filterDataByGeoJSON(processedData);

            if (filteredData.length === 0) {
              setSheetError("Sheet data does not match map.");
              setLoadingSheet(false);
              return;
            }

            onDataLoad(filteredData, valueColumn);
            setLoadingSheet(false);

          } catch {
            setSheetError("Error processing sheet.");
            setLoadingSheet(false);
          }
        }
      });

    } catch {
      setSheetError("Failed to load sheet.");
      setLoadingSheet(false);
    }
  };

  // -------------------------------------------------------------
  // UI + TEMPLATE DOWNLOAD
  // -------------------------------------------------------------
  const handleUploadClick = () => fileInputRef.current?.click();

  const downloadCSVTemplate = async () => {
    try {
      const templateFile =
        templateCsvPath ||
        (mode === 'districts'
          ? '/bharatviz-district-template.csv'
          : '/bharatviz-state-template.csv');

      const response = await fetch(templateFile);
      if (!response.ok) throw new Error();

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download =
        mode === 'districts'
          ? 'bharatviz-district-template.csv'
          : 'bharatviz-state-template.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Error downloading template.");
    }
  };

  // -------------------------------------------------------------
  // RENDER UI
  // -------------------------------------------------------------
  return (
    <Card className="p-6 border-dashed border-2 hover:border-primary/50 transition-colors">
      <div className="text-center">
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">Upload Your Data</h3>

        <p className="text-sm text-muted-foreground mb-4">
          {mode === 'districts'
            ? "Upload a CSV with state, district, value."
            : "Upload a CSV with state and value."}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={handleUploadClick}>Choose File</Button>
          <Button variant="outline" onClick={handleLoadDemo} className="flex items-center gap-2">
            <Play className="h-4 w-4" />
            Load Demo
          </Button>
        </div>

        <div className="flex justify-center mt-3">
          <Button variant="outline" size="sm" onClick={downloadCSVTemplate}>
            Download CSV Template
          </Button>
        </div>

        {/* GOOGLE SHEET SECTION */}
        <div className="mt-4 p-4 border-t border-gray-200">
          <h4 className="text-sm font-medium mb-1">Load from Google Sheets</h4>

          <input
            type="text"
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={googleSheetUrl}
            onChange={e => setGoogleSheetUrl(e.target.value)}
          />

          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            disabled={loadingSheet || !googleSheetUrl}
            onClick={handleLoadGoogleSheet}
          >
            {loadingSheet ? "Loading..." : "Load Sheet"}
          </Button>

          {sheetError && <p className="text-xs text-red-500 mt-2">{sheetError}</p>}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>
    </Card>
  );
};
