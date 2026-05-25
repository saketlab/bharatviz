import { JSDOM } from 'jsdom';
import * as d3 from 'd3';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DistrictsMapRequest, ColorScale } from '../types/index.js';
import type { FeatureCollection, Feature, Geometry, Polygon, MultiPolygon } from 'geojson';
import { getColorForValue, getD3ColorInterpolator } from '../utils/discreteColorUtils.js';
import { isColorDark, roundToSignificantDigits, escapeHtml } from '../utils/colorUtils.js';
import { DEFAULT_LEGEND_POSITION, MAP_DIMENSIONS } from '../utils/constants.js';
import polylabel from 'polylabel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DistrictMapData {
  state: string;
  district: string;
  value: number;
}

export const DISTRICT_MAP_TYPES: Record<string, { id: string; name: string; geojsonPath: string; statesPath: string }> = {
  '1872': { id: '1872', name: 'Census 1872', geojsonPath: 'India-1872-districts.geojson', statesPath: 'India-1872-states.geojson' },
  '1881': { id: '1881', name: 'Census 1881', geojsonPath: 'India-1881-districts.geojson', statesPath: 'India-1881-states.geojson' },
  '1891': { id: '1891', name: 'Census 1891', geojsonPath: 'India-1891-districts.geojson', statesPath: 'India-1891-states.geojson' },
  '1901': { id: '1901', name: 'Census 1901', geojsonPath: 'India-1901-districts.geojson', statesPath: 'India-1901-states.geojson' },
  '1911': { id: '1911', name: 'Census 1911', geojsonPath: 'India-1911-districts.geojson', statesPath: 'India-1911-states.geojson' },
  '1921': { id: '1921', name: 'Census 1921', geojsonPath: 'India-1921-districts.geojson', statesPath: 'India-1921-states.geojson' },
  '1931': { id: '1931', name: 'Census 1931', geojsonPath: 'India-1931-districts.geojson', statesPath: 'India-1931-states.geojson' },
  '1941': { id: '1941', name: 'Census 1941', geojsonPath: 'India-1941-districts.geojson', statesPath: 'India-1941-states.geojson' },
  '1951': { id: '1951', name: 'Census 1951', geojsonPath: 'India-1951-districts.geojson', statesPath: 'India-1951-states.geojson' },
  '1961': { id: '1961', name: 'Census 1961', geojsonPath: 'India-1961-districts.geojson', statesPath: 'India-1961-states.geojson' },
  '1971': { id: '1971', name: 'Census 1971', geojsonPath: 'India-1971-districts.geojson', statesPath: 'India-1971-states.geojson' },
  '1981': { id: '1981', name: 'Census 1981', geojsonPath: 'India-1981-districts.geojson', statesPath: 'India-1981-states.geojson' },
  '1991': { id: '1991', name: 'Census 1991', geojsonPath: 'India-1991-districts.geojson', statesPath: 'India-1991-states.geojson' },
  '2001': { id: '2001', name: 'Census 2001', geojsonPath: 'India-2001-districts.geojson', statesPath: 'India-2001-states.geojson' },
  '2011': { id: '2011', name: 'Census 2011', geojsonPath: 'India-2011-districts.geojson', statesPath: 'India-2011-states.geojson' },
  LGD:   { id: 'LGD',   name: 'LGD',          geojsonPath: 'India_LGD_districts.geojson',              statesPath: 'India_LGD_states.geojson' },
  BHUVAN:{ id: 'BHUVAN',name: 'Bhuvan',        geojsonPath: 'India-bhuvan-districts.geojson',           statesPath: 'India-bhuvan-states.geojson' },
  SOI:   { id: 'SOI',   name: 'Survey of India',geojsonPath: 'India-soi-districts.geojson',             statesPath: 'India-soi-states.geojson' },
  NFHS5: { id: 'NFHS5', name: 'NFHS-5',        geojsonPath: 'India_NFHS5_districts_simplified.geojson', statesPath: 'India_LGD_states.geojson' },
  NFHS4: { id: 'NFHS4', name: 'NFHS-4',        geojsonPath: 'India_NFHS4_districts_simplified.geojson', statesPath: 'India_NFHS4_states_simplified.geojson' },
  NSSO:  { id: 'NSSO',  name: 'NSSO Regions',  geojsonPath: 'India_NFHS5_NSSO_regions_boundaries.geojson', statesPath: 'India_LGD_states.geojson' },
  SHRUG: { id: 'SHRUG', name: 'SHRUG (Census 2011)', geojsonPath: 'https://geo.bharatviz.org/geojsons/districts/India-shrug-district-pc11_simplified.geojson', statesPath: 'India_LGD_states.geojson' },
};

export type DistrictMapType = string;

export class DistrictsMapRenderer {
  private districtsGeojson: GeoJSON.FeatureCollection | null = null;
  private statesGeojson: GeoJSON.FeatureCollection | null = null;
  private currentMapType: DistrictMapType = 'LGD';

  constructor() {}

  async loadGeoJSON(mapType: DistrictMapType = 'LGD'): Promise<void> {
    const config = DISTRICT_MAP_TYPES[mapType] || DISTRICT_MAP_TYPES['LGD'];

    if (this.districtsGeojson && this.currentMapType === mapType) return;

    this.currentMapType = mapType;

    const loadOne = async (filename: string): Promise<GeoJSON.FeatureCollection> => {
      if (filename.startsWith('http')) {
        const response = await fetch(filename);
        if (!response.ok) throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
        return response.json() as Promise<GeoJSON.FeatureCollection>;
      }
      const filePath = join(__dirname, '../../public', filename);
      try {
        return JSON.parse(await readFile(filePath, 'utf-8'));
      } catch {
        const response = await fetch(`https://bharatviz.org/${filename}`);
        if (!response.ok) throw new Error(`Failed to fetch ${filename}: ${response.status} ${response.statusText}`);
        return response.json() as Promise<GeoJSON.FeatureCollection>;
      }
    };

    [this.districtsGeojson, this.statesGeojson] = await Promise.all([
      loadOne(config.geojsonPath),
      loadOne(config.statesPath),
    ]);
  }

  async loadGeoJSONFromPaths(districtsPath: string, statesPath?: string): Promise<void> {
    const load = async (p: string): Promise<GeoJSON.FeatureCollection> => {
      if (p.startsWith('http')) {
        const r = await fetch(p);
        if (!r.ok) throw new Error(`Failed to fetch ${p}: ${r.status}`);
        return r.json() as Promise<GeoJSON.FeatureCollection>;
      }
      return JSON.parse(await readFile(p, 'utf-8'));
    };

    this.districtsGeojson = await load(districtsPath);
    this.statesGeojson = statesPath ? await load(statesPath) : null;
  }

  private calculateBounds(geojson: GeoJSON.FeatureCollection): { minLng: number; maxLng: number; minLat: number; maxLat: number } {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;

    const processCoordinates = (coords: unknown): void => {
      if (Array.isArray(coords)) {
        if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
          const [lng, lat] = coords;
          minLng = Math.min(minLng, lng);
          maxLng = Math.max(maxLng, lng);
          minLat = Math.min(minLat, lat);
          maxLat = Math.max(maxLat, lat);
        } else {
          coords.forEach(processCoordinates);
        }
      }
    };

    geojson.features.forEach((feature: Feature) => {
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const geometry = feature.geometry as Polygon | MultiPolygon;
        processCoordinates(geometry.coordinates);
      }
    });

    return { minLng, maxLng, minLat, maxLat };
  }

  private projectCoordinate(
    lng: number,
    lat: number,
    bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
    width: number,
    height: number
  ): [number, number] {
    const geoWidth = bounds.maxLng - bounds.minLng;
    const geoHeight = bounds.maxLat - bounds.minLat;
    const geoAspectRatio = geoWidth / geoHeight;
    const canvasAspectRatio = width / height;

    let projectionWidth = width;
    let projectionHeight = height;
    let offsetX = 0;
    let offsetY = 0;

    if (geoAspectRatio > canvasAspectRatio) {
      projectionHeight = width / geoAspectRatio;
      offsetY = (height - projectionHeight) / 2;
    } else {
      projectionWidth = height * geoAspectRatio;
      offsetX = (width - projectionWidth) / 2;
    }

    const x = ((lng - bounds.minLng) / geoWidth) * projectionWidth + offsetX;
    const y = ((bounds.maxLat - lat) / geoHeight) * projectionHeight + offsetY;

    return [x, y];
  }

  private convertCoordinatesToPath(
    coordinates: number[][] | number[][][] | number[][][][],
    bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number },
    width: number,
    height: number
  ): string {
    if (!coordinates || !Array.isArray(coordinates)) return '';

    const convertRing = (ring: number[][]): string => {
      return ring.map(coord => {
        const [lng, lat] = coord;
        const [x, y] = this.projectCoordinate(lng, lat, bounds, width, height);
        return `${x},${y}`;
      }).join(' L ');
    };

    if (coordinates[0] && Array.isArray(coordinates[0][0]) && Array.isArray(coordinates[0][0][0])) {
      return (coordinates as number[][][][]).map(polygon => {
        return polygon.map(ring => {
          const pathData = convertRing(ring);
          return `M ${pathData} Z`;
        }).join(' ');
      }).join(' ');
    } else if (coordinates[0] && Array.isArray(coordinates[0][0])) {
      return (coordinates as number[][][]).map(ring => {
        const pathData = convertRing(ring);
        return `M ${pathData} Z`;
      }).join(' ');
    }

    return '';
  }

  async renderMap(request: DistrictsMapRequest): Promise<string> {
    const mapType = (request.mapType || 'LGD') as DistrictMapType;
    await this.loadGeoJSON(mapType);

    const {
      data,
      colorScale = 'spectral',
      invertColors = false,
      hideDistrictNames = false,
      hideValues = false,
      mainTitle = 'BharatViz',
      legendTitle = 'Values',
      showStateBoundaries = true,
      state,
      darkMode = false,
      featureNameProp = 'district_name',
    } = request;

    const values = data.map(d => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const meanValue = values.reduce((a, b) => a + b, 0) / values.length;

    const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
    const document = dom.window.document;

    const width = 800;
    const height = state ? 1100 : 890;

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

    const mapGroup = svg.append('g')
      .attr('class', 'map-content');

    let geojsonForBounds = this.districtsGeojson;
    if (state) {
      const stateNormalized = state.toLowerCase().trim();
      geojsonForBounds = {
        ...this.districtsGeojson,
        features: this.districtsGeojson.features.filter((feature: Feature) => {
          const featureStateName = String(feature.properties?.state_name || feature.properties?.STATE || '').toLowerCase().trim();
          return featureStateName === stateNormalized;
        })
      };
    }

    const bounds = this.calculateBounds(geojsonForBounds);
    const interpolator = getD3ColorInterpolator(colorScale);
    const valueMap = new Map<string, number>();
    data.forEach(d => {
      const key = `${d.state.toLowerCase().trim()}|${d.district.toLowerCase().trim()}`;
      valueMap.set(key, d.value);
    });

    const getDistrictValue = (properties: Record<string, unknown>): number | undefined => {
      const stateName = String(properties.state_name || properties.STATE || '').toLowerCase().trim();
      const rawName = featureNameProp !== 'district_name'
        ? String(properties[featureNameProp] || '').toLowerCase().trim()
        : String(properties.district_name || properties.DISTRICT || '').toLowerCase().trim();
      const key = `${stateName}|${rawName}`;
      return valueMap.get(key);
    };

    const featuresToRender = geojsonForBounds.features;

    const calculateVisualCenter = (coordinates: number[][] | number[][][] | number[][][][], type: string): [number, number] | null => {
      try {
        if (type === 'Polygon') {
          const center = polylabel(coordinates as number[][][], 1.0);
          return [center[0], center[1]];
        } else if (type === 'MultiPolygon') {
          const multiCoords = coordinates as number[][][][];
          let largestPolygon: number[][][] | null = null;
          let largestArea = 0;
          multiCoords.forEach(polygon => {
            const ring = polygon[0];
            let area = 0;
            for (let i = 0; i < ring.length - 1; i++) {
              area += (ring[i][0] * ring[i + 1][1]) - (ring[i + 1][0] * ring[i][1]);
            }
            area = Math.abs(area) / 2;
            if (area > largestArea) { largestArea = area; largestPolygon = polygon; }
          });
          if (largestPolygon) {
            const center = polylabel(largestPolygon, 1.0);
            return [center[0], center[1]];
          }
        }
        return null;
      } catch {
        return null;
      }
    };

    featuresToRender.forEach((feature: Feature) => {
      const value = getDistrictValue(feature.properties);

      let fillColor = darkMode ? '#1a1a1a' : 'white';

      if (value !== undefined) {
        const t = (value - minValue) / (maxValue - minValue);
        const colorT = invertColors ? (1 - t) : t;
        fillColor = interpolator(colorT);
      }

      const strokeColor = (fillColor === 'white' || fillColor === '#1a1a1a' || !isColorDark(fillColor))
        ? (darkMode ? '#ffffff' : '#0f172a')
        : '#ffffff';

      let pathData = '';
      if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
        const geometry = feature.geometry as Polygon | MultiPolygon;
        pathData = this.convertCoordinatesToPath(geometry.coordinates, bounds, width, height);
      }

      const pathElement = mapGroup.append('path')
        .attr('d', pathData)
        .attr('fill', fillColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 0.3);

      const districtName = String(feature.properties?.district_name || feature.properties?.DISTRICT || '');
      if (districtName) {
        if (value !== undefined) {
          pathElement.append('title')
            .text(`${districtName}: ${roundToSignificantDigits(value)}`);
        } else {
          pathElement.append('title')
            .text(districtName);
        }
      }
    });

    if (!hideDistrictNames || !hideValues) {
      featuresToRender.forEach((feature: Feature) => {
        const value = getDistrictValue(feature.properties);

        if (value === undefined) return;

        let visualCenter: [number, number] | null = null;
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const geometry = feature.geometry as Polygon | MultiPolygon;
          visualCenter = calculateVisualCenter(geometry.coordinates, feature.geometry.type);
        }

        if (!visualCenter) return;

        const [x, y] = this.projectCoordinate(visualCenter[0], visualCenter[1], bounds, width, height);

        const districtName = String(feature.properties?.district_name || feature.properties?.DISTRICT || '');
        const fillColor = (() => {
          const t = (value - minValue) / (maxValue - minValue);
          const colorT = invertColors ? (1 - t) : t;
          return interpolator(colorT);
        })();

        const textColor = (fillColor === 'white' || !isColorDark(fillColor)) ? '#0f172a' : '#ffffff';

        const fontSize = 9;
        let tspanElements = '';
        let currentDy = 0;

        if (!hideDistrictNames) {
          tspanElements += `<tspan x="${x}" dy="${currentDy}">${escapeHtml(districtName)}</tspan>`;
          currentDy = 13;
        }

        if (!hideValues) {
          tspanElements += `<tspan x="${x}" dy="${currentDy}">${roundToSignificantDigits(value)}</tspan>`;
        }

        if (tspanElements) {
          const textElement = mapGroup.append('text')
            .attr('x', x)
            .attr('y', y)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('font-size', `${fontSize}px`)
            .attr('font-weight', '600')
            .attr('fill', textColor)
            .style('pointer-events', 'none');

          const textNode = textElement.node();
          if (textNode) {
            textNode.innerHTML = tspanElements;
          }
        }
      });
    }

    if (showStateBoundaries && this.statesGeojson) {
      const statesToRender = state
        ? this.statesGeojson.features.filter((feature: Feature) => {
            const featureStateName = String(feature.properties?.state_name || feature.properties?.STATE || '').toLowerCase().trim();
            return featureStateName === state.toLowerCase().trim();
          })
        : this.statesGeojson.features;

      statesToRender.forEach((feature: Feature) => {
        let pathData = '';
        if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
          const geometry = feature.geometry as Polygon | MultiPolygon;
          pathData = this.convertCoordinatesToPath(geometry.coordinates, bounds, width, height);
        }

        mapGroup.append('path')
          .attr('d', pathData)
          .attr('fill', 'none')
          .attr('stroke', darkMode ? '#ffffff' : '#1f2937')
          .attr('stroke-width', 1.2);
      });
    }

    svg.append('text')
      .attr('x', width / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '20px')
      .attr('font-weight', 'bold')
      .attr('fill', darkMode ? '#ffffff' : '#000000')
      .text(mainTitle);

    this.addLegend(svg, {
      minValue,
      maxValue,
      meanValue,
      colorScale,
      invertColors,
      legendTitle,
      darkMode
    });

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
    const legendPosition = { x: 570, y: 130 };
    const legendWidth = 200;
    const legendHeight = 15;

    const legendGroup = svg.append('g')
      .attr('class', 'legend')
      .attr('transform', `translate(${legendPosition.x}, ${legendPosition.y})`);

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', -5)
      .attr('text-anchor', 'middle')
      .attr('font-size', '13px')
      .attr('font-weight', '600')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(options.legendTitle);

    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'districts-legend-gradient')
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
      .style('fill', 'url(#districts-legend-gradient)')
      .attr('stroke', '#374151')
      .attr('stroke-width', '0.5')
      .attr('rx', '3');

    legendGroup.append('text')
      .attr('x', 0)
      .attr('y', 30)
      .attr('text-anchor', 'start')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.minValue));

    legendGroup.append('text')
      .attr('x', legendWidth / 2)
      .attr('y', 30)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.meanValue));

    legendGroup.append('text')
      .attr('x', legendWidth)
      .attr('y', 30)
      .attr('text-anchor', 'end')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('fill', options.darkMode ? '#ffffff' : '#374151')
      .text(roundToSignificantDigits(options.maxValue));
  }
}
