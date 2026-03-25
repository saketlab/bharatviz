import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import * as d3 from 'd3';
import { scaleSequential } from 'd3-scale';
import { interpolateSpectral, interpolateViridis, interpolateWarm, interpolateCool, interpolatePlasma, interpolateInferno, interpolateMagma, interpolateTurbo, interpolateRdYlBu, interpolateRdYlGn, interpolateBrBG, interpolatePRGn, interpolatePiYG, interpolateRdBu, interpolateRdGy, interpolatePuOr, interpolateBlues, interpolateGreens, interpolateReds, interpolateOranges, interpolatePurples, interpolatePuRd, interpolateSpectral as interpolateSpectralReversed } from 'd3-scale-chromatic';
import { extent } from 'd3-array';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import { type ColorScale, ColorBarSettings } from './ColorMapChooser';
import { isColorDark, roundToSignificantDigits } from '@/lib/colorUtils';
import { getColorForValue, getDiscreteLegendStops } from '@/lib/discreteColorUtils';
import { DiscreteLegend } from '@/lib/discreteLegend';
import { CategoricalLegend } from '@/lib/categoricalLegend';
import { createRotationCalculator } from '@/lib/rotationUtils';
import { DataType, CategoryColorMapping, getCategoryColor, getUniqueCategories } from '@/lib/categoricalUtils';
import { svgToHighDpiBlob } from '@/lib/exportUtils';

import polylabel from "@mapbox/polylabel";

function getPolygonCenter(geometry: { type: string; coordinates: number[][][] | number[][][][] }): [number, number] {
  try {
    let coords: number[][][];

    if (geometry.type === 'MultiPolygon') {
      const polygons = geometry.coordinates as number[][][][];
      let largestIdx = 0;
      let largestArea = 0;

      for (let i = 0; i < polygons.length; i++) {
        const ring = polygons[i][0];
        let area = 0;
        for (let j = 0; j < ring.length - 1; j++) {
          area += ring[j][0] * ring[j + 1][1] - ring[j + 1][0] * ring[j][1];
        }
        area = Math.abs(area);
        if (area > largestArea) {
          largestArea = area;
          largestIdx = i;
        }
      }
      coords = polygons[largestIdx];
    } else {
      coords = geometry.coordinates as number[][][];
    }

    return polylabel(coords, 1.0) as [number, number];
  } catch (e) {
    console.warn('Polylabel failed:', e);
  }
  return d3.geoCentroid(geometry as d3.GeoGeometryObjects) as [number, number];
}

interface DistrictMapData {
  state: string;
  district: string;
  value: number | string;
}

interface NAInfo {
  states?: string[];
  districts?: Array<{ state: string; district: string }>;
  count: number;
}

interface IndiaDistrictsMapProps {
  data: DistrictMapData[];
  colorScale: ColorScale;
  invertColors: boolean;
  dataTitle: string;
  showStateBoundaries?: boolean;
  colorBarSettings?: ColorBarSettings;
  geojsonPath?: string;
  statesGeojsonPath?: string;
  selectedState?: string; // Optional: if provided, only show this state's districts
  gistUrlProvider?: (stateName: string) => string | null; // Optional: function to get gist URL for a state
  hideDistrictNames?: boolean; // Optional: hide district name labels (defaults to true)
  hideDistrictValues?: boolean; // Optional: hide district value labels
  onHideDistrictNamesChange?: (hidden: boolean) => void; // Callback when hiding district names
  onHideDistrictValuesChange?: (hidden: boolean) => void; // Callback when hiding district values
  enableRotation?: boolean; // Optional: enable expensive rotation calculation (defaults to false)
  dataType?: DataType;
  categoryColors?: CategoryColorMapping;
  naInfo?: NAInfo;
  mapTitle?: string;
  darkMode?: boolean;
  valueDomain?: [number, number];
}

export interface IndiaDistrictsMapRef {
  exportPNG: () => void;
  exportSVG: () => void;
  exportPDF: () => void;
  copyToClipboard: () => void;
  downloadCSVTemplate: () => void;
}

interface GeoJSONFeature {
  type: string;
  properties: {
    state_name?: string;
    district_name?: string;
    nss_region?: string;
    NAME_1?: string;
    name?: string;
    ST_NM?: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

interface Bounds {
  minLng: number;
  maxLng: number;
  minLat: number;
  maxLat: number;
}

const colorScales: Record<ColorScale, (t: number) => string> = {
  aqi: (t: number) => interpolateBlues(t),
  blues: interpolateBlues,
  greens: interpolateGreens,
  reds: interpolateReds,
  oranges: interpolateOranges,
  purples: interpolatePurples,
  pinks: interpolatePuRd,
  viridis: interpolateViridis,
  plasma: interpolatePlasma,
  inferno: interpolateInferno,
  magma: interpolateMagma,
  rdylbu: interpolateRdYlBu,
  rdylgn: interpolateRdYlGn,
  spectral: (t: number) => interpolateSpectral(1 - t), // Inverted so blue=low, red=high
  brbg: interpolateBrBG,
  piyg: interpolatePiYG,
  puor: interpolatePuOr,
};

export const IndiaDistrictsMap = forwardRef<IndiaDistrictsMapRef, IndiaDistrictsMapProps>(({
  data,
  colorScale,
  invertColors,
  dataTitle,
  showStateBoundaries = true,
  colorBarSettings,
  geojsonPath = '/India_LGD_Districts_simplified.geojson',
  statesGeojsonPath = '/India_LGD_states.geojson',
  selectedState,
  gistUrlProvider,
  hideDistrictNames = true,
  hideDistrictValues = false,
  onHideDistrictNamesChange,
  onHideDistrictValuesChange,
  enableRotation = false,
  dataType = 'numerical',
  categoryColors = {},
  naInfo,
  valueDomain,
  mapTitle,
  darkMode = false
}, ref) => {
  const [geojsonData, setGeojsonData] = useState<{ features: GeoJSONFeature[] } | null>(null);
  const [statesData, setStatesData] = useState<{ features: GeoJSONFeature[] } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [renderingData, setRenderingData] = useState(false);
  const [hoveredDistrict, setHoveredDistrict] = useState<{ district: string; state: string; value?: number | string } | null>(null);
  const [editingMainTitle, setEditingMainTitle] = useState(false);
  const [mainTitle, setMainTitle] = useState('BharatViz (double-click to edit)');

  const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 390, y: 200 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [legendTitle, setLegendTitle] = useState(dataTitle || 'Values (edit me)');
  const [legendMin, setLegendMin] = useState('');
  const [legendMean, setLegendMean] = useState('');
  const [legendMax, setLegendMax] = useState('');
  const [editingMean, setEditingMean] = useState(false);

  const [labelPositions, setLabelPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [draggingLabel, setDraggingLabel] = useState<{ districtKey: string; offset: { x: number; y: number } } | null>(null);
  const [labelDragOffset, setLabelDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [titlePosition, setTitlePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingTitle, setDraggingTitle] = useState(false);
  const [titleDragOffset, setTitleDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showNALegend, setShowNALegend] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rotationCalculator = useRef(createRotationCalculator());
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setLegendPosition({ x: 190, y: 10 });
    } else if (selectedState) {
      setLegendPosition({ x: 550, y: 100 });
    } else {
      setLegendPosition({ x: 390, y: 200 });
    }
  }, [isMobile, selectedState]);

  useEffect(() => {
    if (dataTitle) {
      setLegendTitle(dataTitle);
    }
  }, [dataTitle]);

  useEffect(() => {
    if (mapTitle !== undefined) {
      setMainTitle(mapTitle || 'BharatViz');
    }
  }, [mapTitle]);

  useEffect(() => {
    if (selectedState) {
      setMainTitle(selectedState);
    } else {
      setMainTitle('BharatViz (double-click to edit)');
    }
  }, [selectedState]);

  useEffect(() => {
    if (data.length > 0 && dataType === 'numerical') {
      if (valueDomain) {
        setLegendMin(roundToSignificantDigits(valueDomain[0]));
        setLegendMean(roundToSignificantDigits((valueDomain[0] + valueDomain[1]) / 2));
        setLegendMax(roundToSignificantDigits(valueDomain[1]));
      } else {
        const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
        const minValue = values.length > 0 ? Math.min(...values) : 0;
        const maxValue = values.length > 0 ? Math.max(...values) : 1;
        const meanValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0.5;
        setLegendMin(roundToSignificantDigits(minValue));
        setLegendMean(roundToSignificantDigits(meanValue));
        setLegendMax(roundToSignificantDigits(maxValue));
      }
    } else {
      setLegendMin('0');
      setLegendMean('0.5');
      setLegendMax('1');
    }
  }, [data, dataType, valueDomain]);

  useEffect(() => {
    const loadGeoData = async () => {
      setRenderingData(true);

      try {
        if (!geojsonPath || !statesGeojsonPath) {
          console.error('Missing required GeoJSON paths:', { geojsonPath, statesGeojsonPath });
          setRenderingData(false);
          return;
        }

        let districtsDataPromise;

        if (gistUrlProvider && selectedState) {
          const gistUrl = gistUrlProvider(selectedState);
          if (gistUrl) {
            districtsDataPromise = fetch(gistUrl).then(response => {
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
            });
          } else {
            districtsDataPromise = fetch(geojsonPath).then(response => {
              if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
              return response.json();
            });
          }
        } else {
          districtsDataPromise = fetch(geojsonPath).then(response => {
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            return response.json();
          });
        }

        const statesDataPromise = fetch(statesGeojsonPath).then(response => {
          if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
          return response.json();
        });

        const [districtsData, statesDataResponse] = await Promise.all([
          districtsDataPromise,
          statesDataPromise
        ]);

        let filteredDistrictsData = districtsData;
        if (selectedState) {
          filteredDistrictsData = {
            ...districtsData,
            features: districtsData.features.filter(
              (feature: GeoJSONFeature) => feature.properties.state_name === selectedState
            )
          };
        }

        setGeojsonData(filteredDistrictsData);
        setStatesData(statesDataResponse);
        calculateBounds(filteredDistrictsData);

        setTimeout(() => {
          setRenderingData(false);
        }, 300);
      } catch (error) {
        console.error('Failed to load GeoJSON data:', error);
        setRenderingData(false);
      }
    };

    loadGeoData();
  }, [geojsonPath, statesGeojsonPath, selectedState, gistUrlProvider]);

  useEffect(() => {
    rotationCalculator.current.clearCache();
  }, [geojsonData]);

  useEffect(() => {
    if (geojsonData && bounds && data.length > 0) {
      setRenderingData(true);
      const timeoutId = setTimeout(() => {
        setRenderingData(false);
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [data, geojsonData, bounds, colorScale, invertColors, selectedState, colorBarSettings, dataType, darkMode]);

  const calculateBounds = (data: { features: GeoJSONFeature[] }) => {
    let minLng = Infinity, maxLng = -Infinity;
    let minLat = Infinity, maxLat = -Infinity;

    const processCoordinates = (coords: number[] | number[][]) => {
      if (Array.isArray(coords[0])) {
        (coords as number[][]).forEach(processCoordinates);
      } else {
        const [lng, lat] = coords as number[];
        minLng = Math.min(minLng, lng);
        maxLng = Math.max(maxLng, lng);
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
      }
    };

    data.features.forEach((feature) => {
      if (feature.geometry.type === 'MultiPolygon') {
        feature.geometry.coordinates.forEach(polygon => {
          (polygon as number[][][]).forEach(ring => {
            processCoordinates(ring);
          });
        });
      } else if (feature.geometry.type === 'Polygon') {
        (feature.geometry.coordinates as number[][][]).forEach(ring => {
          processCoordinates(ring);
        });
      }
    });

    setBounds({ minLng, maxLng, minLat, maxLat });
  };

  const isPointInPolygonScreen = (point: [number, number], polygon: number[][]): boolean => {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

  const calculateDistrictArea = (feature: GeoJSONFeature): number => {
    let area = 0;

    const calculatePolygonArea = (coords: number[][]): number => {
      let polygonArea = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const [lng1, lat1] = coords[i];
        const [lng2, lat2] = coords[i + 1];
        polygonArea += (lng1 * lat2) - (lng2 * lat1);
      }
      return Math.abs(polygonArea) / 2;
    };

    if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach(polygon => {
        area += calculatePolygonArea(polygon[0] as number[][]);
      });
    } else if (feature.geometry.type === 'Polygon') {
      area += calculatePolygonArea(feature.geometry.coordinates[0] as number[][]);
    }

    return area;
  };

  const geoToScreen = (lng: number, lat: number): { x: number; y: number } => {
    const mapWidth = isMobile ? 320 : 760;
    const mapHeight = isMobile ? 400 : selectedState ? 1050 : 850;
    const xOffset = isMobile ? 15 : 20;
    const yOffset = isMobile ? 55 : 45;

    if (!bounds) return { x: 0, y: 0 };

    const geoWidth = bounds.maxLng - bounds.minLng;
    const geoHeight = bounds.maxLat - bounds.minLat;
    const geoAspectRatio = geoWidth / geoHeight;
    const canvasAspectRatio = mapWidth / mapHeight;

    let projectionWidth = mapWidth;
    let projectionHeight = mapHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (geoAspectRatio > canvasAspectRatio) {
      projectionHeight = mapWidth / geoAspectRatio;
      offsetY = (mapHeight - projectionHeight) / 2;
    } else {
      projectionWidth = mapHeight * geoAspectRatio;
      offsetX = (mapWidth - projectionWidth) / 2;
    }

    const x = ((lng - bounds.minLng) / geoWidth) * projectionWidth + offsetX + xOffset;
    const y = ((bounds.maxLat - lat) / geoHeight) * projectionHeight + offsetY + yOffset;

    return { x, y };
  };

  const isPointInsideDistrict = useCallback((
    screenPoint: { x: number; y: number },
    feature: GeoJSONFeature
  ): boolean => {
    if (!bounds) return false;

    const mapWidth = isMobile ? 320 : 760;
    const mapHeight = isMobile ? 400 : selectedState ? 1050 : 850;
    const offsetXParam = isMobile ? 55 : 45;
    const offsetYParam = isMobile ? 15 : 20;

    let polygonCoords: number[][] = [];
    if (feature.geometry.type === 'MultiPolygon') {
      polygonCoords = (feature.geometry.coordinates[0] as number[][][])[0];
    } else if (feature.geometry.type === 'Polygon') {
      polygonCoords = (feature.geometry.coordinates as number[][][])[0];
    }

    if (polygonCoords.length === 0) return false;

    const geoWidth = bounds.maxLng - bounds.minLng;
    const geoHeight = bounds.maxLat - bounds.minLat;
    const geoAspectRatio = geoWidth / geoHeight;
    const canvasAspectRatio = mapWidth / mapHeight;

    let projectionWidth = mapWidth;
    let projectionHeight = mapHeight;
    let offsetX = 0;
    let offsetY = 0;

    if (geoAspectRatio > canvasAspectRatio) {
      projectionHeight = mapWidth / geoAspectRatio;
      offsetY = (mapHeight - projectionHeight) / 2;
    } else {
      projectionWidth = mapHeight * geoAspectRatio;
      offsetX = (mapWidth - projectionWidth) / 2;
    }

    offsetX += offsetXParam;
    offsetY += offsetYParam;

    const screenPolygon = polygonCoords.map(([lng, lat]) => [
      ((lng - bounds.minLng) / geoWidth) * projectionWidth + offsetX,
      ((bounds.maxLat - lat) / geoHeight) * projectionHeight + offsetY
    ]);

return isPointInPolygonScreen([screenPoint.x, screenPoint.y], screenPolygon);

  }, [bounds, isMobile, selectedState]);

  const wouldLabelsOverlap = (
    pos1: { x: number; y: number }, text1: string, fontSize1: number,
    pos2: { x: number; y: number }, text2: string, fontSize2: number
  ): boolean => {
    const textWidth1 = text1.length * fontSize1 * 0.6;
    const textWidth2 = text2.length * fontSize2 * 0.6;
    const textHeight1 = fontSize1 * 1.2;
    const textHeight2 = fontSize2 * 1.2;

    const rect1 = {
      left: pos1.x - textWidth1 / 2,
      right: pos1.x + textWidth1 / 2,
      top: pos1.y - textHeight1 / 2,
      bottom: pos1.y + textHeight1 / 2
    };

    const rect2 = {
      left: pos2.x - textWidth2 / 2,
      right: pos2.x + textWidth2 / 2,
      top: pos2.y - textHeight2 / 2,
      bottom: pos2.y + textHeight2 / 2
    };

    return !(rect1.right < rect2.left || rect1.left > rect2.right ||
             rect1.bottom < rect2.top || rect1.top > rect2.bottom);
  };

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('#districts-legend-gradient').remove();

    if (data.length === 0 || colorBarSettings?.isDiscrete || dataType === 'categorical') {
      return;
    }
    
    let defs = svg.select('defs');
    if (defs.empty()) defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'districts-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
    const minValue = valueDomain ? valueDomain[0] : (values.length > 0 ? Math.min(...values) : 0);
    const maxValue = valueDomain ? valueDomain[1] : (values.length > 0 ? Math.max(...values) : 1);

    const getAQIColorAbsolute = (value: number): string => {
      if (value <= 50) return '#10b981';
      if (value <= 100) return '#84cc16';
      if (value <= 200) return '#eab308';
      if (value <= 300) return '#f97316';
      if (value <= 400) return '#ef4444';
      return '#991b1b';
    };

    const getColorInterpolator = (scale: ColorScale) => {
      const baseInterpolator = colorScales[scale] || colorScales.spectral;
      return invertColors ? (t: number) => baseInterpolator(1 - t) : baseInterpolator;
    };
    const colorScaleFunction = scaleSequential(getColorInterpolator(colorScale))
      .domain([minValue, maxValue]);

    const numStops = 10;
    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      const value = minValue + t * (maxValue - minValue);
      const color = colorScale === 'aqi' ? getAQIColorAbsolute(value) : colorScaleFunction(value);
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color);
    }
  }, [colorScale, invertColors, data, colorBarSettings, dataType, geojsonData, valueDomain]);

  const projectCoordinate = (lng: number, lat: number, width = 800, height = 890): [number, number] => {
    if (!bounds) return [0, 0];
    
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
  };

  const convertCoordinatesToPath = (coordinates: number[][][] | number[][][][], width = 800, height = 890, yOffset = 0, xOffset = 0): string => {
    if (!coordinates || !Array.isArray(coordinates)) return '';
    
    const convertRing = (ring: number[][]) => {
      return ring.map(coord => {
        const [lng, lat] = coord;
        const [x, y] = projectCoordinate(lng, lat, width, height);
        return `${x + xOffset},${y + yOffset}`;
      }).join(' L ');
    };

    if (coordinates[0] && Array.isArray(coordinates[0][0]) && Array.isArray((coordinates[0][0] as number[][])[0])) {
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
  };

  const getDistrictColorForValue = (value: number | string | undefined, dataExtent: [number, number] | undefined): string => {
    if (value === undefined) return darkMode ? '#1a1a1a' : 'white';

    if (dataType === 'categorical' && typeof value === 'string') {
      return getCategoryColor(value, categoryColors, darkMode ? '#1a1a1a' : '#e5e7eb');
    }

    if (typeof value === 'number') {
      if (!dataExtent) return darkMode ? '#1a1a1a' : 'white';
      if (isNaN(value)) {
        return darkMode ? '#1a1a1a' : 'white';
      }

      const [minVal, maxVal] = dataExtent;
      if (minVal === maxVal) return colorScales[colorScale](0.5);

      const valuesForScale = valueDomain ? [valueDomain[0], valueDomain[1]] : (data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[]);
      return getColorForValue(value, valuesForScale, colorScale, invertColors, colorBarSettings);
    }

    return darkMode ? '#1a1a1a' : '#e5e7eb';
  };

  const handleDistrictHover = (feature: GeoJSONFeature) => {
    const { district_name, nss_region, state_name } = feature.properties;
    const districtOrRegion = district_name || nss_region || '';
    const districtData = data.find(d =>
      d.district.toLowerCase().trim() === districtOrRegion.toLowerCase().trim() &&
      d.state.toLowerCase().trim() === (state_name || '').toLowerCase().trim()
    );
    setHoveredDistrict({
      district: districtOrRegion,
      state: state_name,
      value: districtData?.value
    });
  };

  const handleDistrictLeave = () => {
    setHoveredDistrict(null);
  };

  const handleLegendMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setDragOffset({
        x: e.clientX - (svgRect.left + legendPosition.x),
        y: e.clientY - (svgRect.top + legendPosition.y)
      });
    }
  };

  const handleLegendMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    setLegendPosition({
      x: e.clientX - svgRect.left - dragOffset.x,
      y: e.clientY - svgRect.top - dragOffset.y
    });
  }, [dragging, dragOffset]);

  const handleLegendMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleLegendMouseMove);
      document.addEventListener('mouseup', handleLegendMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleLegendMouseMove);
        document.removeEventListener('mouseup', handleLegendMouseUp);
      };
    }
  }, [dragging, dragOffset, handleLegendMouseMove]);

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingTitle(true);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      const currentX = isMobile ? 175 : 310;
      const currentY = isMobile ? 35 : 50;
      setTitleDragOffset({
        x: e.clientX - (svgRect.left + currentX + titlePosition.x),
        y: e.clientY - (svgRect.top + currentY + titlePosition.y)
      });
    }
  };

  const handleTitleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingTitle || !svgRef.current) return;
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentX = isMobile ? 175 : 310;
    const currentY = isMobile ? 35 : 50;
    setTitlePosition({
      x: e.clientX - svgRect.left - currentX - titleDragOffset.x,
      y: e.clientY - svgRect.top - currentY - titleDragOffset.y
    });
  }, [draggingTitle, titleDragOffset, isMobile]);

  const handleTitleMouseUp = () => {
    setDraggingTitle(false);
  };

  const handleTitleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    setDraggingTitle(true);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect && e.touches.length > 0) {
      const touch = e.touches[0];
      const currentX = isMobile ? 175 : 310;
      const currentY = isMobile ? 35 : 50;
      setTitleDragOffset({
        x: touch.clientX - (svgRect.left + currentX + titlePosition.x),
        y: touch.clientY - (svgRect.top + currentY + titlePosition.y)
      });
    }
  };

  const handleTitleTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingTitle || !svgRef.current || e.touches.length === 0) return;
    const touch = e.touches[0];
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentX = isMobile ? 175 : 310;
    const currentY = isMobile ? 35 : 50;
    setTitlePosition({
      x: touch.clientX - svgRect.left - currentX - titleDragOffset.x,
      y: touch.clientY - svgRect.top - currentY - titleDragOffset.y
    });
  }, [draggingTitle, titleDragOffset, isMobile]);

  const handleTitleTouchEnd = () => {
    setDraggingTitle(false);
  };

  useEffect(() => {
    if (draggingTitle) {
      document.addEventListener('mousemove', handleTitleMouseMove);
      document.addEventListener('mouseup', handleTitleMouseUp);
      document.addEventListener('touchmove', handleTitleTouchMove);
      document.addEventListener('touchend', handleTitleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleTitleMouseMove);
        document.removeEventListener('mouseup', handleTitleMouseUp);
        document.removeEventListener('touchmove', handleTitleTouchMove);
        document.removeEventListener('touchend', handleTitleTouchEnd);
      };
    }
  }, [draggingTitle, titleDragOffset, handleTitleMouseMove, handleTitleTouchMove]);

  const handleLabelMouseDown = (e: React.MouseEvent, districtKey: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setDraggingLabel({
        districtKey,
        offset: {
          x: e.clientX - (svgRect.left + currentX),
          y: e.clientY - (svgRect.top + currentY)
        }
      });
    }
  };

  const handleLabelMouseMove = useCallback(
  (e: MouseEvent) => {
    if (!draggingLabel || !svgRef.current) return;

    const svgRect = svgRef.current.getBoundingClientRect();

    const newPosition = {
      x: e.clientX - svgRect.left - draggingLabel.offset.x,
      y: e.clientY - svgRect.top - draggingLabel.offset.y
    };

    // ✅ Find the district feature for this label
    const [stateName, districtName] = draggingLabel.districtKey.split("|");

    const feature = geojsonData?.features.find((f) => {
      const dn = f.properties.district_name || f.properties.nss_region || "";
      const sn = f.properties.state_name || "";
      return dn === districtName && sn === stateName;
    });

    // ✅ Only update if label is inside district
    if (feature) {
      const inside = isPointInsideDistrict(newPosition, feature);
      if (!inside) return; // ❌ stop if outside
    }

    const newPositions = new Map(labelPositions);
    newPositions.set(draggingLabel.districtKey, newPosition);
    setLabelPositions(newPositions);
  },
  [draggingLabel, labelPositions, geojsonData, isPointInsideDistrict]
);
const handleLabelMouseUp = () => {
  setDraggingLabel(null);
};

  const handleLabelTouchStart = (e: React.TouchEvent, districtKey: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect && e.touches.length > 0) {
      const touch = e.touches[0];
      setDraggingLabel({
        districtKey,
        offset: {
          x: touch.clientX - (svgRect.left + currentX),
          y: touch.clientY - (svgRect.top + currentY)
        }
      });
    }
  };

const handleLabelTouchMove = useCallback(
  (e: TouchEvent) => {
    if (!draggingLabel || !svgRef.current || e.touches.length === 0) return;

    const touch = e.touches[0];
    const svgRect = svgRef.current.getBoundingClientRect();

    const newPosition = {
      x: touch.clientX - svgRect.left - draggingLabel.offset.x,
      y: touch.clientY - svgRect.top - draggingLabel.offset.y
    };

    // ✅ Find the district feature for this label
    const [stateName, districtName] = draggingLabel.districtKey.split("|");

    const feature = geojsonData?.features.find((f) => {
      const dn = f.properties.district_name || f.properties.nss_region || "";
      const sn = f.properties.state_name || "";
      return dn === districtName && sn === stateName;
    });

    // ✅ Only update if label is inside district
    if (feature) {
      const inside = isPointInsideDistrict(newPosition, feature);
      if (!inside) return;
    }

    const newPositions = new Map(labelPositions);
    newPositions.set(draggingLabel.districtKey, newPosition);
    setLabelPositions(newPositions);
  },
  [draggingLabel, labelPositions, geojsonData, isPointInsideDistrict]
);


  const handleLabelTouchEnd = () => {
    setDraggingLabel(null);
  };

  useEffect(() => {
    if (draggingLabel) {
      document.addEventListener('mousemove', handleLabelMouseMove);
      document.addEventListener('mouseup', handleLabelMouseUp);
      document.addEventListener('touchmove', handleLabelTouchMove);
      document.addEventListener('touchend', handleLabelTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleLabelMouseMove);
        document.removeEventListener('mouseup', handleLabelMouseUp);
        document.removeEventListener('touchmove', handleLabelTouchMove);
        document.removeEventListener('touchend', handleLabelTouchEnd);
      };
    }
  }, [draggingLabel, handleLabelMouseMove, handleLabelTouchMove]);

  const fixDistrictsLegendGradient = (svgClone: SVGSVGElement) => {
    if (data.length === 0) return;

    const getAQIColorAbsolute = (value: number): string => {
      if (value <= 50) return '#10b981';
      if (value <= 100) return '#84cc16';
      if (value <= 200) return '#eab308';
      if (value <= 300) return '#f97316';
      if (value <= 400) return '#ef4444';
      return '#991b1b';
    };

    const colorScales = {
      aqi: (t: number) => d3.interpolateBlues(t), // Placeholder, AQI uses absolute values
      spectral: (t: number) => d3.interpolateSpectral(1 - t),
      rdylbu: d3.interpolateRdYlBu,
      rdylgn: d3.interpolateRdYlGn,
      brbg: d3.interpolateBrBG,
      piyg: d3.interpolatePiYG,
      puor: d3.interpolatePuOr,
      blues: d3.interpolateBlues,
      greens: d3.interpolateGreens,
      reds: d3.interpolateReds,
      oranges: d3.interpolateOranges,
      purples: d3.interpolatePurples,
      pinks: d3.interpolatePuRd,
      viridis: d3.interpolateViridis,
      plasma: d3.interpolatePlasma,
      inferno: d3.interpolateInferno,
      magma: d3.interpolateMagma
    };

    const getLocalColorForValue = (value: number | undefined, dataExtent: [number, number] | undefined): string => {
      if (value === undefined || !dataExtent || isNaN(value)) return '#d1d5db';

      const [minVal, maxVal] = dataExtent;
      if (minVal === maxVal) return colorScales[colorScale](0.5);

      const valuesForScale = valueDomain ? [valueDomain[0], valueDomain[1]] : (data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[]);
      return getColorForValue(value, valuesForScale, colorScale, invertColors, colorBarSettings);
    };

    // Calculate color scale values
   const numericValues = data
  .map(d => d.value)
  .filter((v): v is number => typeof v === "number" && !isNaN(v));

const minValue = valueDomain ? valueDomain[0] : (numericValues.length > 0 ? Math.min(...numericValues) : 0);
const maxValue = valueDomain ? valueDomain[1] : (numericValues.length > 0 ? Math.max(...numericValues) : 1);

    
    // Find the legend rectangle that uses the gradient
    const legendRect = svgClone.querySelector('rect[fill*="districts-legend-gradient"]');
    if (legendRect) {
      // Get the rect's position and dimensions
      const x = parseFloat(legendRect.getAttribute('x') || '0');
      const y = parseFloat(legendRect.getAttribute('y') || '0');
      const width = parseFloat(legendRect.getAttribute('width') || '200');
      const height = parseFloat(legendRect.getAttribute('height') || '15');
      const stroke = legendRect.getAttribute('stroke');
      const strokeWidth = legendRect.getAttribute('stroke-width');
      const rx = legendRect.getAttribute('rx');
      
      // Get parent element
      const parent = legendRect.parentElement;
      if (parent) {
        // Remove the original gradient rect
        legendRect.remove();
        
        // Create multiple small rectangles with solid colors
        const numSegments = 50; // More segments for smoother gradient
        const segmentWidth = width / numSegments;
        
        for (let i = 0; i < numSegments; i++) {
          const t = i / (numSegments - 1);
          const value = minValue + t * (maxValue - minValue);
         const color = getColorForValue(value, numericValues, colorScale, invertColors, colorBarSettings);

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', (x + i * segmentWidth).toString());
          rect.setAttribute('y', y.toString());
          rect.setAttribute('width', segmentWidth.toString());
          rect.setAttribute('height', height.toString());
          rect.setAttribute('fill', color);
          
          // Add stroke only to first and last segment to maintain border
          if (i === 0 || i === numSegments - 1) {
            if (stroke) rect.setAttribute('stroke', stroke);
            if (strokeWidth) rect.setAttribute('stroke-width', strokeWidth);
          }
          
          // Add border radius to first and last segments
          if (rx && (i === 0 || i === numSegments - 1)) {
            rect.setAttribute('rx', rx);
          }
          
          parent.appendChild(rect);
        }
      }
    }
    
    // Also remove any gradient definitions that are no longer needed
    const gradients = svgClone.querySelectorAll('#districts-legend-gradient');
    gradients.forEach(gradient => gradient.remove());
  };

  const exportDistrictsFallbackPDF = async () => {
    if (!svgRef.current) return;

    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const img = new Image();
    const dpiScale = 300 / 96;
    const originalWidth = isMobile ? 350 : 800;
    const originalHeight = isMobile ? 440 : selectedState ? 1100 : 890;
    
    canvas.width = originalWidth * dpiScale;
    canvas.height = originalHeight * dpiScale;
    
    return new Promise<void>((resolve) => {
      img.onload = () => {
        ctx.scale(dpiScale, dpiScale);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, originalWidth, originalHeight);
        ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('landscape');
        
        // Get PDF dimensions
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate margins and available space
        const pdfMargin = 15; // 15mm margin
        const availableWidth = pdfWidth - (2 * pdfMargin);
        const availableHeight = pdfHeight - (2 * pdfMargin);
        
        // Calculate aspect ratio preserving dimensions
        const canvasAspectRatio = canvas.width / canvas.height;
        let imgWidth = availableWidth;
        let imgHeight = availableWidth / canvasAspectRatio;
        
        // If height exceeds available space, scale by height instead
        if (imgHeight > availableHeight) {
          imgHeight = availableHeight;
          imgWidth = availableHeight * canvasAspectRatio;
        }
        
        // Center the image
        const x = (pdfWidth - imgWidth) / 2;
        const y = (pdfHeight - imgHeight) / 2;
        
        pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
        pdf.save(`bharatviz-districts-${Date.now()}.pdf`);
        resolve();
      };
      
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const getMapDimensions = () => ({
    width: isMobile ? 350 : 800,
    height: isMobile ? 440 : selectedState ? 1100 : 890,
  });

  const exportPNG = () => {
    if (!svgRef.current) return;
    const { width, height } = getMapDimensions();
    svgToHighDpiBlob(svgRef.current, { width, height }).then((blob) => {
      saveAs(blob, `bharatviz-districts-${Date.now()}.png`);
    });
  };

  const copyToClipboard = () => {
    if (!svgRef.current) return;
    const { width, height } = getMapDimensions();
    svgToHighDpiBlob(svgRef.current, { width, height }).then((blob) => {
      navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ]).catch((err) => console.error('Failed to copy to clipboard:', err));
    });
  };

  useImperativeHandle(ref, () => ({
    exportPNG,
    copyToClipboard,
    exportSVG: () => {
      if (!svgRef.current) return;
      
      const svgElement = svgRef.current.cloneNode(true) as SVGElement;
      svgElement.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      
      // Ensure consistent font handling
      const allElements = svgElement.querySelectorAll('*');
      allElements.forEach(el => {
        const element = el as SVGElement;
        if (element.tagName === 'text') {
          element.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
        }
      });
      
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      saveAs(blob, `bharatviz-districts-${Date.now()}.svg`);
    },
    exportPDF: async () => {
      if (!svgRef.current) return;
      
      try {
        // Dynamically import PDF libraries
        const [{ default: jsPDF }, { svg2pdf }] = await Promise.all([
          import('jspdf'),
          import('svg2pdf.js')
        ]);
        
        // Create PDF document
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        // Get the actual SVG dimensions
        const svgWidth = isMobile ? 350 : 800;
        const svgHeight = isMobile ? 440 : selectedState ? 1100 : 890;

        // Clone the SVG to avoid modifying the original
        const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;

        // Ensure the cloned SVG has proper attributes for full capture
        svgClone.setAttribute('width', svgWidth.toString());
        svgClone.setAttribute('height', svgHeight.toString());
        svgClone.setAttribute('viewBox', `${isMobile ? '0 0 350 440' : selectedState ? '0 0 800 1100' : '0 0 800 890'}`);
        svgClone.style.width = `${svgWidth}px`;
        svgClone.style.height = `${svgHeight}px`;

        // Remove any CSS classes that might interfere with export
        svgClone.removeAttribute('class');

        // Force all elements to be visible and properly positioned
        const allElements = svgClone.querySelectorAll('*');
        allElements.forEach(el => {
          const element = el as SVGElement;
          element.style.visibility = 'visible';
          element.style.display = 'block';
          // Ensure text elements are properly rendered with consistent font
          if (element.tagName === 'text') {
            element.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
          }
        });

        // Fix the legend gradient to match the selected color scale
        fixDistrictsLegendGradient(svgClone);

        // Calculate PDF margins and available space
        const pdfMargin = 10; // 10mm margin
        const availableWidth = pdfWidth - (2 * pdfMargin);
        const availableHeight = pdfHeight - (2 * pdfMargin);
        
        // Convert SVG dimensions to mm (1px = 0.264583mm at 96dpi)
        const svgWidthMm = svgWidth * 0.264583;
        const svgHeightMm = svgHeight * 0.264583;
        
        // Calculate scale to fit entire SVG in PDF
        const scaleX = availableWidth / svgWidthMm;
        const scaleY = availableHeight / svgHeightMm;
        const scale = Math.min(scaleX, scaleY);
        
        // Calculate final dimensions and position
        const finalWidth = svgWidthMm * scale;
        const finalHeight = svgHeightMm * scale;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;
        
        // Use svg2pdf.js for true vector conversion
        await svg2pdf(svgClone, pdf, {
          x: x,
          y: y,
          width: finalWidth,
          height: finalHeight
        });
        
        // Save the PDF
        pdf.save(`bharatviz-districts-${Date.now()}.pdf`);
        
      } catch (error) {
        // Fallback to raster PDF if vector conversion fails
        try {
          await exportDistrictsFallbackPDF();
        } catch (fallbackError) {
          alert('Failed to export PDF. Please try using SVG export instead.');
        }
      }
    },
    downloadCSVTemplate: () => {
      const template = `district,value
Nicobars,10
North And Middle Andaman,20
South Andaman,30
Anantapur,40
Chittoor,50`;
      
      const blob = new Blob([template], { type: 'text/csv' });
      saveAs(blob, 'districts-template.csv');
    }
  }));

  // PERFORMANCE OPTIMIZATION: Memoize expensive district label calculations
  // This prevents recalculating for every render (must be before early return)
  const { districtLabelData, maxArea, minArea, districtDataMap } = useMemo(() => {
    if (!geojsonData) return { districtLabelData: [], maxArea: 0, minArea: 0, districtDataMap: new Map() };

    // Create a map for O(1) district data lookup instead of O(n) array search
    const map = new Map<string, number | string | undefined>();
    data.forEach(d => {
      const key = `${d.state.toLowerCase().trim()}|${d.district.toLowerCase().trim()}`;
      map.set(key, d.value);
    });

    // Calculate min and max area once instead of for every feature
    let max = 0;
    let min = Infinity;
    const labels = geojsonData.features.map(feature => {
      const area = calculateDistrictArea(feature);
      if (area > max) max = area;
      if (area < min) min = area;
      return { feature, area };
    });

    return { districtLabelData: labels, maxArea: max, minArea: min === Infinity ? 0 : min, districtDataMap: map };
  }, [geojsonData, data]);

  if (!geojsonData || !bounds) {
    return (
      <div className="w-full h-96 flex items-center justify-center border border-border rounded bg-background">
        <div className="text-xl text-muted-foreground">Loading districts map...</div>
      </div>
    );
  }

  const numericValues = data
  .map(d => d.value)
  .filter(v => typeof v === 'number' && !isNaN(v)) as number[];

  const dataExtent =
    valueDomain
      ? valueDomain
      : numericValues.length > 0
        ? ([Math.min(...numericValues), Math.max(...numericValues)] as [number, number])
        : undefined;


  return (
    <div className="w-full flex justify-center relative" ref={containerRef}>
      {renderingData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {!geojsonData ? 'Loading map data...' : 'Rendering map...'}
            </p>
          </div>
        </div>
      )}
            <svg
              ref={svgRef}
              width={isMobile ? "350" : "800"}
              height={isMobile ? "440" : selectedState ? "1100" : "890"}
              viewBox={isMobile ? "0 0 350 440" : selectedState ? "0 0 800 1100" : "0 0 800 890"}
              className="max-w-full h-auto"
              style={{
                backgroundColor: darkMode ? '#000000' : '#ffffff',
                willChange: renderingData ? 'contents' : 'auto',
                transform: 'translateZ(0)', // Force GPU acceleration
              }}
            >
              {geojsonData.features.map((feature, index) => {
                const mapWidth = isMobile ? 320 : 760;
                const mapHeight = isMobile ? 400 : selectedState ? 1050 : 850;
                const path = convertCoordinatesToPath(feature.geometry.coordinates, mapWidth, mapHeight, isMobile ? 55 : 45, isMobile ? 15 : 20);
                const districtOrRegion = feature.properties.district_name || feature.properties.nss_region || '';
                const districtData = data.find(d =>
                  d.district.toLowerCase().trim() === districtOrRegion.toLowerCase().trim() &&
                  d.state.toLowerCase().trim() === (feature.properties.state_name || '').toLowerCase().trim()
                );
                const fillColor = getDistrictColorForValue(districtData?.value, dataExtent);
                const isHovered = hoveredDistrict &&
                  hoveredDistrict.district === districtOrRegion &&
                  hoveredDistrict.state === feature.properties.state_name;
                
                return (
                  <path
                    key={index}
                    d={path}
                    fill={fillColor}
                    stroke={
                      data.length === 0 ? (darkMode ? "#ffffff" : "#0f172a") :
                      fillColor === 'white' || fillColor === '#1a1a1a' || !isColorDark(fillColor) ? (darkMode ? "#ffffff" : "#0f172a") : "#ffffff"
                    }
                    strokeWidth={isHovered ? "1.5" : "0.3"}
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => handleDistrictHover(feature)}
                    onMouseLeave={handleDistrictLeave}
                  >
                    <title>
                      {districtOrRegion}, {feature.properties.state_name}
                      {districtData?.value !== undefined ? `: ${typeof districtData.value === 'number' ? roundToSignificantDigits(districtData.value) : String(districtData.value)}` : ''}
                    </title>
                  </path>
                );
              })}
              
              {/* District Name Labels - OPTIMIZED with dragging and values */}
{((!hideDistrictNames && !hideDistrictValues) || (!hideDistrictNames) || (!hideDistrictValues)) &&
  districtLabelData.length > 0 && (
    <g className="district-labels">
      {districtLabelData.map(({ feature, area }, index) => {
        const districtName = feature.properties.district_name || feature.properties.nss_region || '';
        const stateName = feature.properties.state_name || '';
        if (!districtName) return null;

        // Get label center using polylabel (guaranteed inside polygon)
        const [lng, lat] = getPolygonCenter(feature.geometry);
        const screenPos = geoToScreen(lng, lat);
        let labelPosition = { x: screenPos.x, y: screenPos.y };

        // Font size based on area
        const minFontSize = isMobile ? 6 : 7;
        const maxFontSize = isMobile ? 16 : 18;
        const areaRange = maxArea - minArea;
        const normalizedArea = areaRange > 0 ? (area - minArea) / areaRange : 0.5;
        const scaledArea = Math.sqrt(normalizedArea);
        const baseFinalFontSize = minFontSize + scaledArea * (maxFontSize - minFontSize);
        const fontSizingFactor = selectedState ? 0.75 : 0.65;
        const finalFontSize = baseFinalFontSize * fontSizingFactor;

        // Apply custom position if dragged
        const districtKey = `${stateName}|${districtName}`;
        const customPosition = labelPositions.get(districtKey);
        if (customPosition) {
          labelPosition = customPosition;
        }

        // ✅ O(1) district value lookup
        const lookupKey = `${stateName.toLowerCase().trim()}|${districtName.toLowerCase().trim()}`;
        const districtValue = districtDataMap.get(lookupKey);

        const fillColor = getDistrictColorForValue(districtValue, dataExtent);

        // ✅ Text color based on fill color
        const textColor =
          fillColor === 'white' || !isColorDark(fillColor) ? '#0f172a' : '#ffffff';

        // ✅ Respect hideDistrictNames flag
        if (hideDistrictNames) return null;

        // ✅ Rotation OFF (kept same)
        const rotationAngle = 0;
        const transform = `translate(${labelPosition.x}, ${labelPosition.y}) rotate(${rotationAngle})`;

        return (
          <g key={`label-group-${index}`} transform={transform}>
            {/* District name */}
            <text
              x={0}
              y={-finalFontSize / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: `${finalFontSize}px`,
                fontWeight: '600',
                fill: textColor,
                pointerEvents: 'auto',
                userSelect: 'none',
                cursor: draggingLabel?.districtKey === districtKey ? 'grabbing' : 'grab',
                opacity: 1
              }}
              onMouseDown={(e) =>
                handleLabelMouseDown(e, districtKey, labelPosition.x, labelPosition.y)
              }
              onTouchStart={(e) =>
                handleLabelTouchStart(e, districtKey, labelPosition.x, labelPosition.y)
              }
            >
              {districtName}
            </text>

            {/* District value */}
            {districtValue !== undefined && (
              <text
                x={0}
                y={finalFontSize / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                style={{
                  fontFamily: 'Arial, Helvetica, sans-serif',
                  fontSize: `${finalFontSize * 0.7}px`,
                  fontWeight: '400',
                  fill: textColor,
                  pointerEvents: 'none',
                  userSelect: 'none',
                  opacity: 0.8
                }}
              >
                {typeof districtValue === 'number'
                  ? roundToSignificantDigits(districtValue)
                  : String(districtValue)}
              </text>
            )}
          </g>
        );
      })}
    </g>
  )}

              {/* State boundaries overlay */}
              {showStateBoundaries && statesData && statesData.features
                .filter(stateFeature => {
                  // If selectedState is provided, only show that state's boundary
                  if (selectedState) {
                    // Check various possible state name properties in the GeoJSON
                    const stateName = stateFeature.properties.state_name || 
                                     stateFeature.properties.NAME_1 || 
                                     stateFeature.properties.name || 
                                     stateFeature.properties.ST_NM;
                    return stateName === selectedState;
                  }
                  // If no selectedState, show all state boundaries (for Districts tab)
                  return true;
                })
                .map((stateFeature, index) => {
                const mapWidth = isMobile ? 320 : 760;
                const mapHeight = isMobile ? 400 : selectedState ? 1050 : 850;
                const path = convertCoordinatesToPath(stateFeature.geometry.coordinates, mapWidth, mapHeight, isMobile ? 55 : 45, isMobile ? 15 : 20);
                
                return (
                  <path
                    key={`state-boundary-${index}`}
                    d={path}
                    fill="none"
                    stroke={darkMode ? "#ffffff" : "#1f2937"}
                    strokeWidth="1.2"
                    pointerEvents="none"
                    className="state-boundary"
                  />
                );
              })}
              
              {/* Main Title */}
              <g className="main-title-container">
                {editingMainTitle ? (
                  <foreignObject x={isMobile ? 75 : 160} y={isMobile ? 15 : 25} width={isMobile ? 200 : 300} height={40}>
                    <input
                      type="text"
                      value={mainTitle}
                      autoFocus
                      style={{ 
                        width: isMobile ? 198 : 298, 
                        fontSize: isMobile ? 16 : 20, 
                        fontWeight: 700, 
                        textAlign: 'center',
                        border: '2px solid #3b82f6',
                        borderRadius: '4px',
                        outline: 'none',
                        padding: '4px 8px',
                        backgroundColor: 'white'
                      }}
                      onChange={e => setMainTitle(e.target.value)}
                      onBlur={() => setEditingMainTitle(false)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          setEditingMainTitle(false);
                        }
                      }}
                    />
                  </foreignObject>
                ) : (
                  <text
                    x={isMobile ? 175 : 310 + titlePosition.x}
                    y={isMobile ? 35 : 50 + titlePosition.y}
                    textAnchor="middle"
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: isMobile ? 16 : 20,
                      fontWeight: 700,
                      fill: darkMode ? '#ffffff' : '#1f2937',
                      cursor: draggingTitle ? 'grabbing' : 'grab',
                      userSelect: 'none'
                    }}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setEditingMainTitle(true);
                    }}
                    onMouseDown={handleTitleMouseDown}
                    onTouchStart={handleTitleTouchStart}
                  >
                    {mainTitle}
                  </text>
                )}
              </g>

              {/* Legend */}
              {data.length > 0 && (
                <>
                  {/* Categorical Legend */}
                  {dataType === 'categorical' ? (
                    <CategoricalLegend
                      categories={getUniqueCategories(data.map(d => d.value))}
                      categoryColors={categoryColors}
                      legendPosition={legendPosition}
                      isMobile={isMobile}
                      onMouseDown={handleLegendMouseDown}
                      dragging={dragging}
                      legendTitle={legendTitle}
                      editingTitle={editingTitle}
                      setEditingTitle={setEditingTitle}
                      setLegendTitle={setLegendTitle}
                      darkMode={darkMode}
                    />
                  ) : dataType === 'numerical' && colorBarSettings?.isDiscrete ? (
                    /* Discrete Legend */
                    <DiscreteLegend
                      data={data.map(d => d.value).filter(v => typeof v === 'number') as number[]}
                      colorScale={colorScale}
                      invertColors={invertColors}
                      colorBarSettings={colorBarSettings}
                      legendPosition={legendPosition}
                      isMobile={isMobile}
                      onMouseDown={handleLegendMouseDown}
                      dragging={dragging}
                      legendTitle={legendTitle}
                      editingTitle={editingTitle}
                      setEditingTitle={setEditingTitle}
                      setLegendTitle={setLegendTitle}
                      darkMode={darkMode}
                    />
                  ) : dataType === 'numerical' ? (
                    /* Continuous Legend */
                    <g
                      className="legend-container"
                      transform={`translate(${legendPosition.x}, ${legendPosition.y})`}
                      onMouseDown={handleLegendMouseDown}
                      style={{ cursor: dragging ? 'grabbing' : 'grab' }}
                    >
                      <rect
                        width={isMobile ? 150 : 200}
                        height={15}
                        fill="url(#districts-legend-gradient)"
                        stroke={darkMode ? 'none' : '#374151'}
                        strokeWidth={darkMode ? 0 : 0.5}
                        rx={3}
                      />
                      {editingMin ? (
                        <foreignObject x={-10} y={18} width={isMobile ? 30 : 40} height={30}>
                          <input
                            type="text"
                            value={legendMin}
                            autoFocus
                            style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                            onChange={e => setLegendMin(e.target.value)}
                            onBlur={() => setEditingMin(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingMin(false)}
                          />
                        </foreignObject>
                      ) : (
                        <text
                          x={0}
                          y={30}
                          textAnchor="start"
                          style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingMin(true); }}
                        >
                          {legendMin}
                        </text>
                      )}
                      {editingMean ? (
                        <foreignObject x={isMobile ? 60 : 80} y={18} width={isMobile ? 30 : 40} height={30}>
                          <input
                            type="text"
                            value={legendMean}
                            autoFocus
                            style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                            onChange={e => setLegendMean(e.target.value)}
                            onBlur={() => setEditingMean(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingMean(false)}
                          />
                        </foreignObject>
                      ) : (
                        <text
                          x={isMobile ? 75 : 100}
                          y={30}
                          textAnchor="middle"
                          style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingMean(true); }}
                        >
                          {legendMean}
                        </text>
                      )}
                      {editingMax ? (
                        <foreignObject x={isMobile ? 120 : 170} y={18} width={isMobile ? 30 : 40} height={30}>
                          <input
                            type="text"
                            value={legendMax}
                            autoFocus
                            style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                            onChange={e => setLegendMax(e.target.value)}
                            onBlur={() => setEditingMax(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingMax(false)}
                          />
                        </foreignObject>
                      ) : (
                        <text
                          x={isMobile ? 150 : 200}
                          y={30}
                          textAnchor="end"
                          style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingMax(true); }}
                        >
                          {legendMax}
                        </text>
                      )}
                      {editingTitle ? (
                        <foreignObject x={isMobile ? 40 : 60} y={-25} width={isMobile ? 70 : 90} height={30}>
                          <input
                            type="text"
                            value={legendTitle}
                            autoFocus
                            style={{ width: isMobile ? 68 : 88, fontSize: isMobile ? 11 : 13, fontWeight: 600, textAlign: 'center' }}
                            onChange={e => setLegendTitle(e.target.value)}
                            onBlur={() => setEditingTitle(false)}
                            onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)}
                          />
                        </foreignObject>
                      ) : (
                        <text
                          x={isMobile ? 75 : 100}
                          y={-5}
                          textAnchor="middle"
                          style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 11 : 13, fontWeight: 600, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                          onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                        >
                          {legendTitle}
                        </text>
                      )}
                    </g>
                  ) : null}
                </>
              )}

              {/* NA Legend */}
              {naInfo && naInfo.count > 0 && showNALegend && (
                <g
                  className="na-legend"
                  transform={`translate(${isMobile ? 10 : 320}, ${isMobile ? 400 : selectedState ? 1050 : 850})`}
                >
                  <rect
                    width={isMobile ? 150 : 220}
                    height={isMobile ? 30 : 35}
                    fill="white"
                    stroke="#d1d5db"
                    strokeWidth={1}
                    rx={4}
                  />

                  <rect
                    x={5}
                    y={isMobile ? 8 : 10}
                    width={isMobile ? 15 : 20}
                    height={isMobile ? 15 : 15}
                    fill="white"
                    stroke="#9ca3af"
                    strokeWidth={1}
                  />

                  <text
                    x={isMobile ? 25 : 30}
                    y={isMobile ? 19 : 22}
                    style={{
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: isMobile ? 11 : 13,
                      fill: darkMode ? '#ffffff' : '#374151'
                    }}
                  >
                    {naInfo.districts
                      ? `NA (${naInfo.count} ${naInfo.count === 1 ? 'district' : 'districts'})`
                      : `NA (${naInfo.count} ${naInfo.count === 1 ? 'state' : 'states'})`
                    }
                  </text>

                  <g
                    onClick={() => setShowNALegend(false)}
                    style={{ cursor: 'pointer' }}
                    transform={`translate(${isMobile ? 135 : 200}, ${isMobile ? 8 : 10})`}
                  >
                    <circle r={isMobile ? 6 : 8} fill="#ef4444" opacity={0.8} />
                    <text
                      textAnchor="middle"
                      dy={isMobile ? 3 : 4}
                      style={{
                        fontFamily: 'Arial, Helvetica, sans-serif',
                        fontSize: isMobile ? 10 : 12,
                        fontWeight: 'bold',
                        fill: 'white'
                      }}
                    >
                      ×
                    </text>
                  </g>
                </g>
              )}
            </svg>

            {/* Hover Tooltip */}
            {hoveredDistrict && (
              <div className="absolute top-2 left-7 bg-white border border-gray-300 rounded-lg p-3 shadow-lg z-10 pointer-events-none">
                <div className="font-medium">{hoveredDistrict.district}</div>
                <div className="text-xs text-muted-foreground">{hoveredDistrict.state}</div>
                {hoveredDistrict.value !== undefined && (
                  <div className="text-xs">
                    {typeof hoveredDistrict.value === 'number' ? roundToSignificantDigits(hoveredDistrict.value) : String(hoveredDistrict.value)}
                  </div>
                )}
              </div>
            )}

    </div>
  );
});

IndiaDistrictsMap.displayName = 'IndiaDistrictsMap';
