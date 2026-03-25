import { Request, Response } from 'express';
import { StatesMapRenderer } from '../services/mapRenderer.js';
import { DistrictsMapRenderer } from '../services/districtsMapRenderer.js';
import { extractNumericColumns } from '../utils/csvUtils.js';
import axios from 'axios';
import Papa from 'papaparse';
import { gunzipSync } from 'zlib';
import crypto from 'crypto';

type MapType = 'states' | 'districts' | 'state-districts';

interface CacheEntry {
  data: string;
  timestamp: number;
}

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
  private csvCache: Map<string, CacheEntry> = new Map();
  private svgCache: Map<string, CacheEntry> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000;

  private generateCacheKey(prefix: string, params: Record<string, unknown>): string {
    const hash = crypto.createHash('md5').update(JSON.stringify(params)).digest('hex');
    return `${prefix}:${hash}`;
  }

  private getCachedData(cache: Map<string, CacheEntry>, key: string): string | null {
    const entry = cache.get(key);
    if (entry && (Date.now() - entry.timestamp) < this.CACHE_TTL) {
      return entry.data;
    }
    if (entry) {
      cache.delete(key);
    }
    return null;
  }

  private setCachedData(cache: Map<string, CacheEntry>, key: string, data: string): void {
    cache.set(key, { data, timestamp: Date.now() });

    if (cache.size > 100) {
      const oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  private async fetchAndDecompressCSV(dataUrl: string): Promise<string> {
    const cacheKey = this.generateCacheKey('csv', { dataUrl });
    const cached = this.getCachedData(this.csvCache, cacheKey);
    if (cached) {
      return cached;
    }

    const response = await axios.get(dataUrl, {
      responseType: dataUrl.endsWith('.gz') ? 'arraybuffer' : 'text',
      timeout: 30000
    });

    let csvData: string;
    if (dataUrl.endsWith('.gz')) {
      const buffer = Buffer.from(response.data);
      csvData = gunzipSync(buffer).toString('utf-8');
    } else {
      csvData = response.data;
    }

    this.setCachedData(this.csvCache, cacheKey, csvData);
    return csvData;
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

  private globalMinMax(data: CSVRow[], columnNames: string[]): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (const row of data) {
      for (const col of columnNames) {
        const v = parseFloat(String(row[col] ?? ''));
        if (Number.isFinite(v)) {
          if (v < min) min = v;
          if (v > max) max = v;
        }
      }
    }
    if (min === Infinity) min = 0;
    if (max === -Infinity) max = 1;
    return { min, max };
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
        valueColumn: valueColumnParam,
        colorScaleMode = 'independent',
        darkMode = 'false'
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

      const rows = parseResult.data as CSVRow[];
      if (!rows.length) {
        return res.status(400).json({
          success: false,
          error: { message: 'No valid data found in CSV', code: 'NO_DATA' }
        });
      }

      const numericColumns = extractNumericColumns(rows);
      const wideFormat = numericColumns.length > 2;
      const valueColumn = valueColumnParam
        ? (numericColumns.includes(valueColumnParam as string) ? valueColumnParam : numericColumns[0])
        : (wideFormat ? numericColumns[0] : this.findValueColumnName(rows[0]));
      const resolvedColumn = (valueColumn as string) || undefined;

      const parsedData = this.parseCSVData(rows, mapType, resolvedColumn);

      let autoDetectedColumnName: string | null = null;
      autoDetectedColumnName = this.findValueColumnName(rows[0], resolvedColumn);

      const finalTitle = (title === 'BharatViz' && autoDetectedColumnName) ? autoDetectedColumnName : title;
      const finalLegendTitle = (legendTitle === 'Values' && autoDetectedColumnName) ? autoDetectedColumnName : legendTitle;

      let domain: [number, number] | undefined;
      if (mapType === 'states' && wideFormat && colorScaleMode === 'single' && numericColumns.length > 0) {
        const { min, max } = this.globalMinMax(rows, numericColumns);
        domain = [min, max];
      }

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
        legendTitle: finalLegendTitle as string,
        darkMode: darkMode === 'true',
        ...(domain && { domain })
      });

      const html = this.generateEmbedHTML(svgContent, finalTitle as string, darkMode === 'true');
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
        valueColumn: valueColumnParam,
        colorScaleMode = 'independent',
        darkMode = 'false'
      } = req.query;

      if (!dataUrl || typeof dataUrl !== 'string') {
        return res.status(400).json({
          success: false,
          error: { message: 'dataUrl parameter is required', code: 'MISSING_DATA_URL' }
        });
      }

      const svgCacheKey = this.generateCacheKey('svg', req.query);
      const cachedSVG = this.getCachedData(this.svgCache, svgCacheKey);
      if (cachedSVG) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.setHeader('X-Cache', 'HIT');
        return res.send(cachedSVG);
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

      const rows = parseResult.data as CSVRow[];
      if (!rows.length) {
        return res.status(400).json({
          success: false,
          error: { message: 'No valid data found in CSV', code: 'NO_DATA' }
        });
      }

      const numericColumns = extractNumericColumns(rows);
      const wideFormat = numericColumns.length > 2;
      const valueColumn = valueColumnParam
        ? (numericColumns.includes(valueColumnParam as string) ? valueColumnParam : numericColumns[0])
        : (wideFormat ? numericColumns[0] : this.findValueColumnName(rows[0]));
      const resolvedColumn = (valueColumn as string) || undefined;

      const parsedData = this.parseCSVData(rows, mapType, resolvedColumn);

      const autoDetectedColumnName = this.findValueColumnName(rows[0], resolvedColumn);

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

      let domain: [number, number] | undefined;
      if (mapType === 'states' && wideFormat && colorScaleMode === 'single' && numericColumns.length > 0) {
        const { min, max } = this.globalMinMax(rows, numericColumns);
        domain = [min, max];
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
        legendTitle: finalLegendTitle as string,
        darkMode: darkMode === 'true',
        ...(domain && { domain })
      });

      this.setCachedData(this.svgCache, svgCacheKey, svgContent);

      res.setHeader('Content-Type', 'image/svg+xml');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'public, max-age=300');
      res.setHeader('X-Cache', 'MISS');
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
        valueColumn,
        colorScaleMode = 'independent',
        darkMode = false
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

      const rawRows = data as CSVRow[];
      const numericCols = extractNumericColumns(rawRows);
      const wide = numericCols.length > 2;
      let domain: [number, number] | undefined;
      if (mapType === 'states' && wide && colorScaleMode === 'single' && numericCols.length > 0) {
        const { min, max } = this.globalMinMax(rawRows, numericCols);
        domain = [min, max];
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
        legendTitle,
        darkMode,
        ...(domain && { domain })
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
        const html = this.generateEmbedHTML(svgContent, title, darkMode);
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
    darkMode?: boolean;
    domain?: [number, number];
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
      legendTitle,
      darkMode = false,
      domain
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
        legendTitle,
        darkMode,
        ...(domain && { domain })
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
        legendTitle,
        darkMode
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
        legendTitle,
        darkMode
      });
    }
  }

  private generateEmbedHTML(svgContent: string, title: string, darkMode: boolean = false): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - BharatViz</title>
    <script src="https://d3js.org/d3.v7.min.js"></script>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        html, body {
            height: 100%;
            overflow: auto;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: ${darkMode ? '#000000' : '#ffffff'};
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px;
            padding-bottom: 50px;
        }
        .map-container {
            max-width: 100%;
            width: auto;
            height: auto;
            position: relative;
            flex-shrink: 0;
        }
        .map-container svg {
            max-width: 100%;
            height: auto;
            cursor: grab;
        }
        .map-container svg:active {
            cursor: grabbing;
        }
        .tooltip {
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 14px;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.2s;
            z-index: 1000;
        }
        .credits {
            margin-top: 16px;
            padding: 8px 0;
            font-size: 12px;
            color: ${darkMode ? '#999' : '#666'};
            text-align: center;
            flex-shrink: 0;
        }
        .credits a {
            color: ${darkMode ? '#60a5fa' : '#0066cc'};
            text-decoration: none;
        }
        .credits a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="map-container" id="map-container">
        ${svgContent}
        <div class="tooltip" id="tooltip"></div>
    </div>
    <div class="credits">
        Created with <a href="https://bharatviz.saketlab.org" target="_blank">BharatViz</a>
    </div>
    <script>
        // Add interactivity to the embedded map
        (function() {
            const svg = d3.select('#map-container svg');
            const tooltip = d3.select('#tooltip');

            // Add zoom behavior
            const zoom = d3.zoom()
                .scaleExtent([1, 8])
                .on('zoom', (event) => {
                    svg.select('g').attr('transform', event.transform);
                });

            svg.call(zoom);

            // Add hover effects to paths
            svg.selectAll('path, circle')
                .on('mouseenter', function(event) {
                    const el = d3.select(this);
                    const title = el.select('title').text();

                    if (title) {
                        el.style('opacity', 0.8);
                        tooltip
                            .style('opacity', 1)
                            .html(title)
                            .style('left', (event.pageX + 10) + 'px')
                            .style('top', (event.pageY - 10) + 'px');
                    }
                })
                .on('mousemove', function(event) {
                    tooltip
                        .style('left', (event.pageX + 10) + 'px')
                        .style('top', (event.pageY - 10) + 'px');
                })
                .on('mouseleave', function() {
                    d3.select(this).style('opacity', 1);
                    tooltip.style('opacity', 0);
                });

            // Reset zoom on double-click
            svg.on('dblclick.zoom', function() {
                svg.transition()
                    .duration(750)
                    .call(zoom.transform, d3.zoomIdentity);
            });
        })();
    </script>
</body>
</html>`;
  }
}
