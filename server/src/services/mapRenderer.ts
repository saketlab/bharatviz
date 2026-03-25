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

/**
 * Renders a state-level India map as SVG using D3 and JSDOM
 */
export class StatesMapRenderer {
  private geojsonData: StateFeatureCollection | null = null;

  constructor() {}

  /**
   * Load GeoJSON data
   */
  async loadGeoJSON(): Promise<void> {
    if (this.geojsonData) return;

    // Try to load from local file first
    const geojsonPath = join(__dirname, '../../public/india_map_states.geojson');

    try {
      const geojsonContent = await readFile(geojsonPath, 'utf-8');
      this.geojsonData = JSON.parse(geojsonContent);
    } catch (error) {
      // If local file doesn't exist, fetch from the live BharatViz site
      const response = await fetch('https://bharatviz.saketlab.org/India_LGD_states.geojson');
      if (!response.ok) {
        throw new Error(`Failed to fetch GeoJSON: ${response.status} ${response.statusText}`);
      }
      this.geojsonData = await response.json() as StateFeatureCollection;
    }
  }

  /**
   * Load GeoJSON data from a custom file path
   */
  async loadGeoJSONFromPath(geojsonPath: string): Promise<void> {
    const geojsonContent = await readFile(geojsonPath, 'utf-8');
    this.geojsonData = JSON.parse(geojsonContent);
  }

  /**
   * Render the map and return SVG string
   */
  async renderMap(request: StatesMapRequest): Promise<string> {
    await this.loadGeoJSON();

    const {
      data,
      colorScale = 'spectral',
      invertColors = false,
      hideStateNames = false,
      hideValues = false,
      mainTitle = 'BharatViz',
      legendTitle = 'Values',
      darkMode = false,
      domain: domainOverride
    } = request;

    const values = data.map(d => d.value);
    const minValue = domainOverride ? domainOverride[0] : Math.min(...values);
    const maxValue = domainOverride ? domainOverride[1] : Math.max(...values);
    const meanValue = domainOverride
      ? (domainOverride[0] + domainOverride[1]) / 2
      : values.reduce((a, b) => a + b, 0) / values.length;
    const valuesForScale = domainOverride ? [domainOverride[0], domainOverride[1]] : values;

    // Create a virtual DOM
    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    // Canvas dimensions (matching frontend)
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

    // Add background rectangle as fallback
    svg.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', width)
      .attr('height', height)
      .attr('fill', darkMode ? '#000000' : 'white');

    // Create projection using fitSize (CRITICAL - this is what frontend uses!)
    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], this.geojsonData);

    const path = d3.geoPath().projection(projection);

    // Create data lookup map
    const dataMap = new Map(data.map(d => [d.state.toLowerCase().trim(), d.value]));

    // Create main map group with margin transform
    const mapGroup = svg.append('g')
      .attr('class', 'map-content')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Render map paths
    mapGroup.selectAll('path')
      .data(this.geojsonData.features)
      .join('path')
      .attr('d', path as unknown as string)
      .attr('fill', (d: StateFeature) => {
        const stateName = this.getStateName(d.properties);
        const value = dataMap.get(stateName);
        if (value === undefined) return darkMode ? '#1a1a1a' : 'white';
        return getColorForValue(value, valuesForScale, colorScale, invertColors);
      })
      .attr('stroke', (d: StateFeature) => {
        const stateName = this.getStateName(d.properties);
        const value = dataMap.get(stateName);
        if (value === undefined) return darkMode ? '#ffffff' : '#0f172a';
        const fillColor = getColorForValue(value, valuesForScale, colorScale, invertColors);
        return isColorDark(fillColor) ? '#ffffff' : '#0f172a';
      })
      .attr('stroke-width', 0.5)
      .each((d: StateFeature, i: number, nodes: HTMLElement[]) => {
        // Add title element for hover tooltips
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

    // Add state labels and values
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

          // Smaller states get reduced font size
          const smallerStates = ['delhi', 'chandigarh', 'sikkim', 'tripura', 'manipur', 'mizoram', 'nagaland', 'meghalaya', 'puducherry', 'lakshadweep'];
          if (smallerStates.includes(stateName)) {
            fontSize = Math.max(6, fontSize * 0.7);
          }

          const color = getColorForValue(value, valuesForScale, colorScale, invertColors);
          const textColor = this.shouldUseWhiteText(stateName, color) ? 'white' : 'black';

          text.attr('font-size', `${fontSize}px`);
          text.attr('fill', textColor);

          // State name
          if (!hideStateNames) {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', 0)
              .text(this.getDisplayName(stateName));
          }

          // Value
          if (!hideValues) {
            text.append('tspan')
              .attr('x', 0)
              .attr('dy', hideStateNames ? 0 : 13)
              .text(roundToSignificantDigits(value));
          }
        });
    }

    // Add legend
    this.addLegend(svg, {
      minValue,
      maxValue,
      meanValue,
      colorScale,
      invertColors,
      legendTitle,
      darkMode
    });

    // Add main title
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '24px')
      .attr('font-weight', 'bold')
      .attr('fill', darkMode ? '#ffffff' : '#000000')
      .text(mainTitle);

    // Return the SVG as string
    return document.body.innerHTML;
  }

  /**
   * Add legend to the map (matches frontend design exactly - horizontal gradient)
   */
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
    const legendWidth = 180;  // Horizontal gradient width
    const legendHeight = 20;   // Horizontal gradient height

    const legendGroup = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendPosition.x}, ${legendPosition.y})`);

    // Add legend background box (no border)
    legendGroup.append('rect')
      .attr('x', -10)
      .attr('y', -35)
      .attr('width', legendWidth + 20)
      .attr('height', 90)
      .attr('fill', options.darkMode ? '#1a1a1a' : 'white')
      .attr('stroke', 'none')
      .attr('rx', 5);

    // Add title
    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -15)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', 'bold')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(options.legendTitle);

    // Create horizontal gradient
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'states-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const interpolator = getD3ColorInterpolator(options.colorScale as ColorScale);

    // Create gradient stops
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      let color: string;

      if (options.colorScale === 'aqi') {
        // For AQI, use absolute value mapping
        const value = options.minValue + t * (options.maxValue - options.minValue);
        color = getColorForValue(value, [options.minValue, options.maxValue], 'aqi', options.invertColors);
      } else {
        // For other scales, use normalized interpolation
        const normalizedT = options.invertColors ? (1 - t) : t;
        color = interpolator(normalizedT);
      }

      gradient.append('stop')
        .attr('offset', `${i * 10}%`)
        .attr('stop-color', color);
    }

    // Add gradient rectangle (horizontal) - NO BORDER
    legendGroup.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#states-legend-gradient)')
      .attr('stroke', 'none');

    // Add min, mean, max labels (positioned below the horizontal bar)
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

  /**
   * Get state name from GeoJSON properties
   */
  private getStateName(properties: Record<string, unknown>): string {
    const name = String(properties.state_name || properties.NAME_1 || properties.name || properties.ST_NM || '');
    return name.toLowerCase().trim();
  }

  /**
   * Get display name for state
   */
  private getDisplayName(stateName: string): string {
    return STATE_ABBREVIATIONS[stateName] || this.toTitleCase(stateName);
  }

  /**
   * Convert string to title case
   */
  private toTitleCase(str: string): string {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase());
  }

  /**
   * Determine if white text should be used
   */
  private shouldUseWhiteText(stateName: string, color: string): boolean {
    if (BLACK_TEXT_STATES.includes(stateName)) {
      return false;
    }
    return isColorDark(color);
  }

  /**
   * Get adjusted position for state labels (matches frontend exactly)
   */
  private getStatePosition(stateName: string, centroid: [number, number], feature: StateFeature, path: d3.GeoPath<unknown, d3.GeoPermissibleObjects>): { x: number; y: number } {
    let [x, y] = centroid;

    // External label states (positioned outside their boundaries)
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
      // Internal adjustments for regular states
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
