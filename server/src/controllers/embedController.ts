import { Request, Response } from 'express';
import { StatesMapRenderer } from '../services/mapRenderer.js';
import { DistrictsMapRenderer } from '../services/districtsMapRenderer.js';
import axios from 'axios';
import Papa from 'papaparse';
import { gunzipSync } from 'zlib';

type MapType = 'states' | 'districts' | 'state-districts';

interface CSVRow {
  [key: string]: string | number;
}

interface StateData {
  state: string;
  value: number;
  [key: string]: string | number;
}

interface DistrictData {
  state: string;
  district: string;
  value: number;
  [key: string]: string | number;
}

export class EmbedController {
  private async fetchAndDecompressCSV(dataUrl: string): Promise<string> {
    // Fetch the data - handle gzipped files
    const response = await axios.get(dataUrl, {
      responseType: dataUrl.endsWith('.gz') ? 'arraybuffer' : 'text'
    });

    if (dataUrl.endsWith('.gz')) {
      // Decompress gzipped data
      const buffer = Buffer.from(response.data);
      return gunzipSync(buffer).toString('utf-8');
    }

    return response.data;
  }

  private detectMapType(data: CSVRow[]): MapType {
    if (!data || data.length === 0) return 'states';

    const firstRow = data[0];
    const keys = Object.keys(firstRow).map(k => k.toLowerCase());
    const hasDistrict = keys.some(k =>
      k.includes('district') || k === 'district_name' || k === 'dist'
    );

    return hasDistrict ? 'districts' : 'states';
  }

  private findValueColumnName(row: CSVRow, explicitColumn?: string): string | null {
    if (explicitColumn) {
      if (row[explicitColumn] !== undefined && row[explicitColumn] !== null && row[explicitColumn] !== '') {
        const val = parseFloat(String(row[explicitColumn]));
        if (!isNaN(val)) return explicitColumn;
      }
      return null;
    }

    const commonValueNames = ['value', 'Value', 'VALUE', 'val', 'Val'];
    for (const name of commonValueNames) {
      if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
        const val = parseFloat(String(row[name]));
        if (!isNaN(val)) return name;
      }
    }

    const keys = Object.keys(row);
    for (const key of keys) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('state') || lowerKey.includes('district')) continue;

      const val = parseFloat(String(row[key]));
      if (!isNaN(val)) return key;
    }

    return null;
  }

  private findValueColumn(row: CSVRow, explicitColumn?: string): number {
    const columnName = this.findValueColumnName(row, explicitColumn);
    if (!columnName) return 0;

    const val = parseFloat(String(row[columnName]));
    return isNaN(val) ? 0 : val;
  }

  private parseCSVData(data: CSVRow[], mapType: MapType, explicitColumn?: string): StateData[] | DistrictData[] {
    if (mapType === 'states') {
      return data.map((row: CSVRow) => ({
        state: String(row.state || row.State || row.STATE || row.state_name || row.State_Name || ''),
        value: this.findValueColumn(row, explicitColumn)
      })).filter((item): item is StateData => Boolean(item.state) && !isNaN(item.value));
    } else {
      return data.map((row: CSVRow) => ({
        state: String(row.state_name || row.state || row.State || row.STATE || ''),
        district: String(row.district_name || row.district || row.District || row.DISTRICT || ''),
        value: this.findValueColumn(row, explicitColumn)
      })).filter((item): item is DistrictData => Boolean(item.state) && Boolean(item.district) && !isNaN(item.value));
    }
  }

  async getEmbedPage(req: Request, res: Response) {
    try {
      const {
        dataUrl,
        colorScale = 'spectral',
        title = 'BharatViz',
        legendTitle = 'Values',
        mapType: explicitMapType,
        state,
        boundary = 'LGD',
        invertColors = 'false',
        hideValues = 'false',
        hideStateNames = 'false',
        hideDistrictNames = 'true',
        showStateBoundaries = 'true',
        valueColumn
      } = req.query;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'dataUrl parameter is required', code: 'MISSING_DATA_URL' }
        });
      }

      const csvData = await this.fetchAndDecompressCSV(dataUrl);
      const parseResult = Papa.parse(csvData, { header: true, skipEmptyLines: true });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Failed to parse CSV data', code: 'INVALID_CSV', details: parseResult.errors }
        });
      }

      const detectedMapType = this.detectMapType(parseResult.data as CSVRow[]);
      let mapType: MapType = (explicitMapType as MapType) || detectedMapType;

      if (state && mapType === 'districts') {
        mapType = 'state-districts';
      }

      const parsedData = this.parseCSVData(parseResult.data as CSVRow[], mapType, valueColumn as string);

      let autoDetectedColumnName: string | null = null;
      if (parseResult.data.length > 0) {
        autoDetectedColumnName = this.findValueColumnName(parseResult.data[0] as CSVRow, valueColumn as string);
      }

      const finalTitle = (title === 'BharatViz' && autoDetectedColumnName) ? autoDetectedColumnName : title;
      const finalLegendTitle = (legendTitle === 'Values' && autoDetectedColumnName) ? autoDetectedColumnName : legendTitle;

      const hideDistrictNamesProvided = req.query.hideDistrictNames !== undefined;
      const finalHideDistrictNames = hideDistrictNamesProvided ?
        (hideDistrictNames === 'true') :
        (mapType === 'districts' ? true : false);

      const hideValuesProvided = req.query.hideValues !== undefined;
      const finalHideValues = hideValuesProvided ?
        (hideValues === 'true') :
        (mapType === 'districts' ? true : false);

      if (parsedData.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No valid data found in CSV', code: 'NO_DATA' }
        });
      }

      const svgContent = await this.generateSVG({
        data: parsedData,
        mapType,
        state: state as string,
        boundary: boundary as string,
        colorScale: colorScale as string,
        invertColors: invertColors === 'true',
        hideValues: finalHideValues,
        hideStateNames: hideStateNames === 'true',
        hideDistrictNames: finalHideDistrictNames,
        showStateBoundaries: showStateBoundaries === 'true',
        mainTitle: finalTitle as string,
        legendTitle: finalLegendTitle as string
      });

      const html = this.generateEmbedHTML(svgContent, finalTitle as string);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('X-Frame-Options', 'ALLOWALL');
      res.send(html);

    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: {
          message: err.message || 'Failed to generate embed',
          code: 'EMBED_ERROR'
        }
      });
    }
  }

  async getEmbedSVG(req: Request, res: Response) {
    try {
      const {
        dataUrl,
        colorScale = 'spectral',
        legendTitle = 'Values',
        mapType: explicitMapType,
        state,
        boundary = 'LGD',
        invertColors = 'false',
        hideValues = 'false',
        hideStateNames = 'false',
        hideDistrictNames = 'true',
        showStateBoundaries = 'true',
        valueColumn
      } = req.query;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'dataUrl parameter is required', code: 'MISSING_DATA_URL' }
        });
      }

      const csvData = await this.fetchAndDecompressCSV(dataUrl);
      const parseResult = Papa.parse(csvData, { header: true, skipEmptyLines: true });

      if (parseResult.errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'Failed to parse CSV data', code: 'INVALID_CSV' }
        });
      }

      const detectedMapType = this.detectMapType(parseResult.data as CSVRow[]);
      let mapType: MapType = (explicitMapType as MapType) || detectedMapType;

      if (state && mapType === 'districts') {
        mapType = 'state-districts';
      }

      const parsedData = this.parseCSVData(parseResult.data as CSVRow[], mapType, valueColumn as string);

      let autoDetectedColumnName: string | null = null;
      if (parseResult.data.length > 0) {
        autoDetectedColumnName = this.findValueColumnName(parseResult.data[0] as CSVRow, valueColumn as string);
      }

      const finalLegendTitle = (legendTitle === 'Values' && autoDetectedColumnName) ? autoDetectedColumnName : legendTitle;

      const hideDistrictNamesProvided = req.query.hideDistrictNames !== undefined;
      const finalHideDistrictNames = hideDistrictNamesProvided ?
        (hideDistrictNames === 'true') :
        (mapType === 'districts' ? true : false);

      const hideValuesProvided = req.query.hideValues !== undefined;
      const finalHideValues = hideValuesProvided ?
        (hideValues === 'true') :
        (mapType === 'districts' ? true : false);

      if (parsedData.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No valid data found in CSV', code: 'NO_DATA' }
        });
      }

      const svgContent = await this.generateSVG({
        data: parsedData,
        mapType,
        state: state as string,
        boundary: boundary as string,
        colorScale: colorScale as string,
        invertColors: invertColors === 'true',
        hideValues: finalHideValues,
        hideStateNames: hideStateNames === 'true',
        hideDistrictNames: finalHideDistrictNames,
        showStateBoundaries: showStateBoundaries === 'true',
        mainTitle: '',
        legendTitle: finalLegendTitle as string
      });

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.send(svgContent);

    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to generate SVG', code: 'SVG_ERROR' }
      });
    }
  }

  async generateEmbed(req: Request, res: Response) {
    try {
      const {
        data,
        colorScale = 'spectral',
        title = 'BharatViz',
        legendTitle = 'Values',
        mapType: explicitMapType,
        state,
        boundary = 'LGD',
        invertColors = false,
        hideValues = false,
        hideStateNames = false,
        hideDistrictNames = true,
        showStateBoundaries = true,
        format = 'html',
        valueColumn
      } = req.body;

      if (!data || !Array.isArray(data)) {
        return res.status(400).json({
          success: false,
          error: { message: 'data array is required', code: 'MISSING_DATA' }
        });
      }

      const detectedMapType = this.detectMapType(data as CSVRow[]);
      let mapType: MapType = explicitMapType || detectedMapType;

      if (state && mapType === 'districts') {
        mapType = 'state-districts';
      }

      let parsedData: StateData[] | DistrictData[];

      if (valueColumn) {
        parsedData = this.parseCSVData(data as CSVRow[], mapType, valueColumn);
      } else {
        if (mapType === 'states') {
          parsedData = (data as CSVRow[]).filter((item): item is StateData =>
            'state' in item && 'value' in item && item.state !== undefined && item.value !== undefined
          );
        } else {
          parsedData = (data as CSVRow[]).filter((item): item is DistrictData =>
            'state' in item && 'district' in item && 'value' in item &&
            item.state !== undefined && item.district !== undefined && item.value !== undefined
          );
        }
      }

      if (parsedData.length === 0) {
        return res.status(400).json({
          success: false,
          error: { message: 'No valid data provided', code: 'NO_DATA' }
        });
      }

      const svgContent = await this.generateSVG({
        data: parsedData,
        mapType,
        state,
        boundary,
        colorScale,
        invertColors,
        hideValues,
        hideStateNames,
        hideDistrictNames,
        showStateBoundaries,
        mainTitle: title,
        legendTitle
      });

      if (format === 'svg') {
        res.json({
          success: true,
          svg: svgContent,
          mapType,
          metadata: {
            dataPoints: parsedData.length,
            detectedMapType: detectedMapType,
            usedMapType: mapType
          }
        });
      } else {
        const html = this.generateEmbedHTML(svgContent, title);
        res.json({
          success: true,
          html,
          mapType,
          metadata: {
            dataPoints: parsedData.length,
            detectedMapType: detectedMapType,
            usedMapType: mapType
          }
        });
      }

    } catch (error) {
      const err = error as Error;
      res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to generate embed', code: 'GENERATE_ERROR' }
      });
    }
  }

  private async generateSVG(options: {
    data: StateData[] | DistrictData[];
    mapType: MapType;
    state?: string;
    boundary: string;
    colorScale: string;
    invertColors: boolean;
    hideValues: boolean;
    hideStateNames: boolean;
    hideDistrictNames: boolean;
    showStateBoundaries: boolean;
    mainTitle: string;
    legendTitle: string;
  }): Promise<string> {
    const {
      data,
      mapType,
      state,
      boundary,
      colorScale,
      invertColors,
      hideValues,
      hideStateNames,
      hideDistrictNames,
      showStateBoundaries,
      mainTitle,
      legendTitle
    } = options;

    if (mapType === 'states') {
      const renderer = new StatesMapRenderer();
      return await renderer.renderMap({
        data: data as StateData[],
        colorScale: colorScale as 'spectral',
        invertColors,
        hideValues,
        hideStateNames,
        mainTitle,
        legendTitle
      });
    } else if (mapType === 'state-districts') {
      if (!state) {
        throw new Error('state parameter is required for state-districts map');
      }

      const renderer = new DistrictsMapRenderer();
      return await renderer.renderMap({
        data: data as DistrictData[],
        state,
        mapType: boundary as 'LGD' | 'NFHS4' | 'NFHS5',
        colorScale: colorScale as 'spectral',
        invertColors,
        hideValues,
        hideDistrictNames,
        mainTitle,
        legendTitle
      });
    } else {
      const renderer = new DistrictsMapRenderer();
      return await renderer.renderMap({
        data: data as DistrictData[],
        mapType: boundary as 'LGD' | 'NFHS4' | 'NFHS5',
        colorScale: colorScale as 'spectral',
        invertColors,
        hideValues,
        hideDistrictNames,
        showStateBoundaries,
        mainTitle,
        legendTitle
      });
    }
  }

  private generateEmbedHTML(svgContent: string, title: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - BharatViz</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }
        .map-container {
            max-width: 100%;
            width: auto;
            height: auto;
        }
        .map-container svg {
            max-width: 100%;
            height: auto;
        }
        .credits {
            margin-top: 20px;
            font-size: 12px;
            color: #666;
            text-align: center;
        }
        .credits a {
            color: #0066cc;
            text-decoration: none;
        }
        .credits a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="map-container">
        ${svgContent}
    </div>
    <div class="credits">
        Created with <a href="https://bharatviz.saketlab.in" target="_blank">BharatViz</a>
    </div>
</body>
</html>`;
  }
}
