import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { StatesMapRequest, ColorScale } from '../types/index.js';
import { getColorForValue, getD3ColorInterpolator } from '../utils/discreteColorUtils.js';
import { isColorDark, roundToSignificantDigits } from '../utils/colorUtils.js';
import {
  BLACK_TEXT_STATES,
  EXTERNAL_LABEL_STATES,
  STATE_ABBREVIATIONS,
  MAP_DIMENSIONS,
  DEFAULT_LEGEND_POSITION
} from '../utils/constants.js';
import type { FeatureCollection, Feature, Geometry } from 'geojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MapData {
  state: string;
  value: number;
}

interface StateProperties {
  state_name?: string;
  NAME_1?: string;
  name?: string;
  ST_NM?: string;
  [key: string]: unknown;
}

type StateFeature = Feature<Geometry, StateProperties>;
type StateFeatureCollection = FeatureCollection<Geometry, StateProperties>;

type D3Selection = d3.Selection<SVGSVGElement, unknown, null, undefined>;
type D3GeoPath = d3.GeoPath<unknown, d3.GeoPermissibleObjects>;

const STATE_MAP_FILES: Record<string, string> = {
  '1872': 'India-1872-states.geojson',
  '1881': 'India-1881-states.geojson',
  '1891': 'India-1891-states.geojson',
  '1901': 'India-1901-states.geojson',
  '1911': 'India-1911-states.geojson',
  '1921': 'India-1921-states.geojson',
  '1931': 'India-1931-states.geojson',
  '1941': 'India-1941-states.geojson',
  '1951': 'India-1951-states.geojson',
  '1961': 'India-1961-states.geojson',
  '1971': 'India-1971-states.geojson',
  '1981': 'India-1981-states.geojson',
  '1991': 'India-1991-states.geojson',
  '2001': 'India-2001-states.geojson',
  '2011': 'India-2011-states.geojson',
  LGD:    'India_LGD_states.geojson',
  BHUVAN: 'India-bhuvan-states.geojson',
  SOI:    'India-soi-states.geojson',
  NFHS5:  'India_NFHS5_states_simplified.geojson',
  NFHS4:  'India_NFHS4_states_simplified.geojson',
};

export class StatesMapRenderer {
  private geojsonData: StateFeatureCollection | null = null;
  private currentMapType: string = 'LGD';

  constructor() {}

  async loadGeoJSON(mapType: string = 'LGD'): Promise<void> {
    if (this.geojsonData && this.currentMapType === mapType) return;

    this.currentMapType = mapType;
    const filename = STATE_MAP_FILES[mapType] || STATE_MAP_FILES['LGD'];
    const geojsonPath = join(__dirname, '../../public', filename);

    try {
      const geojsonContent = await readFile(geojsonPath, 'utf-8');
      this.geojsonData = JSON.parse(geojsonContent);
    } catch (error) {
      const response = await fetch(`https://bharatviz.org/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
      }
      this.geojsonData = await response.json() as StateFeatureCollection;
    }
  }

  async loadGeoJSONFromPath(geojsonPath: string): Promise<void> {
    if (geojsonPath.startsWith('http')) {
      const r = await fetch(geojsonPath);
      if (!r.ok) throw new Error(`Failed to fetch ${geojsonPath}: ${r.status}`);
      this.geojsonData = await r.json() as StateFeatureCollection;
    } else {
      const geojsonContent = await readFile(geojsonPath, 'utf-8');
      this.geojsonData = JSON.parse(geojsonContent);
    }
  }

  async renderMap(request: StatesMapRequest): Promise<string> {
    await this.loadGeoJSON(request.mapType || 'LGD');

    const {
      data,
      colorScale = 'spectral',
      invertColors = false,
      hideStateNames = false,
      hideValues = false,
      mainTitle = 'BharatViz',
      legendTitle = 'Values',
      darkMode = false
    } = request;

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;

    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    const width = 800;
    const height = 800;
    const margin = { top: 70, right: 20, bottom: 70, left: 20 };

    const svg = d3.select(document.body)
      .append('svg')
      .attr('xmlns', 'http://www.w3.org/2000/svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('font-family', 'Arial, Helvetica, sans-serif')
      .style('background-color', darkMode ? '#000000' : '#ffffff');

    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', darkMode ? '#000000' : 'white');

    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], this.geojsonData);

    const path = d3.geoPath().projection(projection);

    const dataMap = new Map(data.map(d => [d.state.toLowerCase().trim(), d.value]));

    const mapGroup = svg.append('g')
      .attr('class', 'map-content')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    mapGroup.selectAll('path')
      .data(this.geojsonData.features)
      .join('path')
      .attr('d', path as unknown as string)
      .attr('fill', (d: StateFeature) => {
        const stateName = this.getStateName(d.properties);
        const value = dataMap.get(stateName);
        if (value === undefined) return darkMode ? '#1a1a1a' : 'white';
        return getColorForValue(value, values, colorScale, invertColors);
      })
      .attr('stroke', (d: StateFeature) => {
        const stateName = this.getStateName(d.properties);
        const value = dataMap.get(stateName);
        if (value === undefined) return darkMode ? '#ffffff' : '#0f172a';
        const fillColor = getColorForValue(value, values, colorScale, invertColors);
        return isColorDark(fillColor) ? '#ffffff' : '#0f172a';
      })
      .attr('stroke-width', 0.5)
      .each((d: StateFeature, i: number, nodes: HTMLElement[]) => {
        const pathElement = d3.select(nodes[i]);
        const stateName = this.getStateName(d.properties);
        const displayName = this.getDisplayName(stateName);
        const value = dataMap.get(stateName);

        if (value !== undefined) {
          pathElement.append('title')
            .text(`${displayName}: ${roundToSignificantDigits(value)}`);
        } else {
          pathElement.append('title')
            .text(displayName);
        }
      });

    if (!hideStateNames || !hideValues) {
      mapGroup.selectAll('text.state-label')
        .data(this.geojsonData.features)
        .join('text')
        .attr('class', 'state-label')
        .attr('transform', (d: StateFeature) => {
          const stateName = this.getStateName(d.properties);
          const centroid = path.centroid(d);
          const { x, y } = this.getStatePosition(stateName, centroid, d, path);
          return `translate(${x}, ${y})`;
        })
        .attr('text-anchor', (d: StateFeature) => {
          const stateName = this.getStateName(d.properties);
          if (EXTERNAL_LABEL_STATES.includes(stateName)) {
            const centered = ['mizoram', 'lakshadweep', 'sikkim', 'andhra pradesh', 'karnataka', 'delhi', 'chandigarh', 'a & n islands', 'andaman and nicobar islands'];
            return centered.includes(stateName) ? 'middle' : 'start';
          }
          return 'middle';
        })
        .attr('dominant-baseline', 'middle')
        .style('font-family', 'Arial, Helvetica, sans-serif')
        .style('font-weight', '600')
        .style('pointer-events', 'none')
        .each((d: StateFeature, i: number, nodes: HTMLElement[]) => {
          const text = d3.select(nodes[i]);
          const stateName = this.getStateName(d.properties);
          const value = dataMap.get(stateName);

          if (value === undefined) return;

          const bounds = path.bounds(d);
          const width = bounds[1][0] - bounds[0][0];
          const height = bounds[1][1] - bounds[0][1];
          const area = width * height;
          let fontSize = Math.sqrt(area) / 12;
          fontSize = Math.max(7, Math.min(14, fontSize));

          const smallerStates = ['delhi', 'chandigarh', 'sikkim', 'tripura', 'manipur', 'mizoram', 'nagaland', 'meghalaya', 'puducherry', 'lakshadweep'];
          if (smallerStates.includes(stateName)) {
            fontSize = Math.max(6, fontSize * 0.7);
          }

          const color = getColorForValue(value, values, colorScale, invertColors);
          const textColor = this.shouldUseWhiteText(stateName, color) ? 'white' : 'black';

          text.attr('font-size', `${fontSize}px`);
          text.attr('fill', textColor);

          if (!hideStateNames) {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', 0)
              .text(this.getDisplayName(stateName));
          }

          if (!hideValues) {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', hideStateNames ? 0 : 13)
              .text(roundToSignificantDigits(value));
          }
        });
    }

    this.addLegend(svg, {
      minValue,
      maxValue,
      meanValue,
      colorScale,
      invertColors,
      legendTitle,
      darkMode
    });

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', darkMode ? '#ffffff' : '#000000')
      .text(mainTitle);

    return document.body.innerHTML;
  }

  private addLegend(
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
    options: {
      minValue: number;
      maxValue: number;
      meanValue: number;
      colorScale: string;
      invertColors: boolean;
      legendTitle: string;
      darkMode?: boolean;
    }
  ): void {
    const legendPosition = DEFAULT_LEGEND_POSITION.STATES;
    const legendWidth = 180;
    const legendHeight = 20;

    const legendGroup = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendPosition.x}, ${legendPosition.y})`);

    legendGroup.append('rect')
      .attr('x', -10)
      .attr('y', -35)
      .attr('width', legendWidth + 20)
      .attr('height', 90)
      .attr('fill', options.darkMode ? '#1a1a1a' : 'white')
      .attr('stroke', 'none')
      .attr('rx', 5);

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(options.legendTitle);

    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'states-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const interpolator = getD3ColorInterpolator(options.colorScale as ColorScale);

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      let color: string;

      if (options.colorScale === 'aqi') {
        const value = options.minValue + t * (options.maxValue - options.minValue);
        color = getColorForValue(value, [options.minValue, options.maxValue], 'aqi', options.invertColors);
      } else {
        color = interpolator(options.invertColors ? (1 - t) : t);
      }

      gradient.append('stop')
        .attr('offset', `${i * 10}%`)
        .attr('stop-color', color);
    }

    legendGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#states-legend-gradient)')
      .attr('stroke', 'none');

    legendGroup.append('text')
      .attr('x', 0)
      .attr('y', legendHeight + 18)
      .attr('text-anchor', 'start')
      .attr('font-size', '11px')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.minValue));

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', legendHeight + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11px')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.meanValue));

    legendGroup.append('text')
      .attr('x', legendWidth)
      .attr('y', legendHeight + 18)
      .attr('text-anchor', 'end')
      .attr('font-size', '11px')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.maxValue));
  }

  private getStateName(properties: Record<string, unknown>): string {
    const name = String(properties.state_name || properties.NAME_1 || properties.name || properties.ST_NM || '');
    return name.toLowerCase().trim();
  }

  private getDisplayName(stateName: string): string {
    return STATE_ABBREVIATIONS[stateName] || this.toTitleCase(stateName);
  }

  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  private shouldUseWhiteText(stateName: string, color: string): boolean {
    if (BLACK_TEXT_STATES.includes(stateName)) {
      return false;
    }
    return isColorDark(color);
  }

  private getStatePosition(stateName: string, centroid: [number, number], feature: StateFeature, path: d3.GeoPath<unknown, d3.GeoPermissibleObjects>): { x: number; y: number } {
    let [x, y] = centroid;

    if (EXTERNAL_LABEL_STATES.includes(stateName)) {
      const bounds = path.bounds(feature);

      switch (stateName) {
        case 'goa':
          x = bounds[0][0] - 22;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'dnhdd':
          x = bounds[0][0] + 5;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'kerala':
          x = bounds[0][0] - 10;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'nagaland':
          x = bounds[1][0] + 8;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'tripura':
          x = bounds[0][0] - 10;
          y = bounds[1][1] + 8;
          break;
        case 'mizoram':
          x = (bounds[0][0] + bounds[1][0]) / 2;
          y = bounds[1][1] + 8;
          break;
        case 'lakshadweep':
          x = (bounds[0][0] + bounds[1][0]) / 2 - 15;
          y = bounds[0][1] - 15;
          break;
        case 'manipur':
          x = bounds[1][0] + 5;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'sikkim':
          x = (bounds[0][0] + bounds[1][0]) / 2;
          y = bounds[0][1] - 15;
          break;
        case 'andhra pradesh':
          x = (bounds[0][0] + bounds[1][0]) / 2 - 36;
          y = (bounds[0][1] + bounds[1][1]) / 2 + 20;
          break;
        case 'karnataka':
          x = (bounds[0][0] + bounds[1][0]) / 2 - 12;
          y = (bounds[0][1] + bounds[1][1]) / 2 + 5;
          break;
        case 'delhi':
          x = (bounds[0][0] + bounds[1][0]) / 2 + 15;
          y = (bounds[0][1] + bounds[1][1]) / 2;
          break;
        case 'chandigarh':
          x = (bounds[0][0] + bounds[1][0]) / 2 + 9;
          y = (bounds[0][1] + bounds[1][1]) / 2 - 9;
          break;
        case 'puducherry':
          x = (bounds[0][0] + bounds[1][0]) / 2 + 22;
          y = (bounds[0][1] + bounds[1][1]) / 2 + 36;
          break;
        case 'a & n islands':
        case 'andaman and nicobar islands':
          x = (bounds[0][0] + bounds[1][0]) / 2 - 39;
          y = (bounds[0][1] + bounds[1][1]) / 2 + 3;
          break;
      }
    } else {
      switch (stateName) {
        case 'west bengal':
          y += 13;
          x -= 6.5;
          break;
        case 'jharkhand':
          x -= 5;
          break;
        case 'maharashtra':
          x -= 5;
          break;
        case 'madhya pradesh':
          y += 4;
          break;
        case 'gujarat':
          y -= 4;
          x += 4;
          break;
      }
    }

    return { x, y };
  }
}
