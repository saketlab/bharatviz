import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDarkMode } from '@/hooks/useDarkMode';
import * as d3 from 'd3';
import { scaleSequential } from 'd3-scale';
import { interpolateSpectral, interpolateViridis, interpolatePlasma, interpolateInferno, interpolateMagma, interpolateRdYlBu, interpolateRdYlGn, interpolateBrBG, interpolatePiYG, interpolatePuOr, interpolateBlues, interpolateGreens, interpolateReds, interpolateOranges, interpolatePurples, interpolatePuRd } from 'd3-scale-chromatic';
import { saveAs } from 'file-saver';
import { type ColorScale, ColorBarSettings } from './ColorMapChooser';
import { isColorDark, roundToSignificantDigits, resolveBoundaryStroke, type BoundaryColor } from '@/lib/colorUtils';
import { getColorForValue, getDiscreteLegendStops } from '@/lib/discreteColorUtils';
import { DiscreteLegend } from '@/lib/discreteLegend';
import { CategoricalLegend } from '@/lib/categoricalLegend';
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
      coords = geometry.coordinates;
    }

    return polylabel(coords, 1.0) as [number, number];
  } catch (e) {
    console.warn('Polylabel failed:', e);
  }
  return d3.geoCentroid(geometry) as [number, number];
}

export interface CityWardData {
  ward: string;
  value: number | string;
}

interface NAInfo {
  wards?: string[];
  count: number;
}

interface IndiaCityMapProps {
  data: CityWardData[];
  colorScale: ColorScale;
  invertColors: boolean;
  dataTitle: string;
  colorBarSettings?: ColorBarSettings;
  geojsonPath: string;
  hideWardNames?: boolean;
  hideWardValues?: boolean;
  onHideWardNamesChange?: (hidden: boolean) => void;
  onHideWardValuesChange?: (hidden: boolean) => void;
  dataType?: DataType;
  categoryColors?: CategoryColorMapping;
  naInfo?: NAInfo;
  darkMode?: boolean;
  cityName?: string;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
}

export interface IndiaCityMapRef {
  exportPNG: () => void;
  exportSVG: () => void;
  exportPDF: () => void;
  copyToClipboard: () => void;
  downloadCSVTemplate: () => void;
}

interface GeoJSONFeature {
  type: string;
  properties: {
    ward_name?: string;
    ward_number?: number | string;
    [key: string]: unknown;
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
  spectral: (t: number) => interpolateSpectral(1 - t),
  brbg: interpolateBrBG,
  piyg: interpolatePiYG,
  puor: interpolatePuOr,
};

export const IndiaCityMap = forwardRef<IndiaCityMapRef, IndiaCityMapProps>(({
  data,
  colorScale,
  invertColors,
  dataTitle,
  colorBarSettings,
  geojsonPath,
  hideWardNames = false,
  hideWardValues = false,
  onHideWardNamesChange,
  onHideWardValuesChange,
  dataType = 'numerical',
  categoryColors = {},
  naInfo,
  darkMode: darkModeProp,
  cityName = 'City',
  boundaryColor = 'auto',
  boundaryWidth = 0.3
}, ref) => {
  const { dark: darkModeHook } = useDarkMode();
  const darkMode = darkModeProp !== undefined ? darkModeProp : darkModeHook;
  const mapBg = darkMode ? 'hsl(25, 8%, 6%)' : 'hsl(38, 30%, 97%)';
  const [geojsonData, setGeojsonData] = useState<{ features: GeoJSONFeature[] } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [renderingData, setRenderingData] = useState(false);
  const [hoveredWard, setHoveredWard] = useState<{ ward: string; value?: number | string } | null>(null);
  const [editingMainTitle, setEditingMainTitle] = useState(false);
  const [mainTitle, setMainTitle] = useState(cityName || 'BharatViz (double-click to edit)');

  const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 550, y: 100 });
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
  const [draggingLabel, setDraggingLabel] = useState<{ wardKey: string; offset: { x: number; y: number } } | null>(null);

  const [titlePosition, setTitlePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingTitle, setDraggingTitle] = useState(false);
  const [titleDragOffset, setTitleDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showNALegend, setShowNALegend] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRafRef = useRef<number | null>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) {
      setLegendPosition({ x: -10, y: 160 });
    } else {
      setLegendPosition({ x: 550, y: 100 });
    }
  }, [isMobile]);

  useEffect(() => {
    if (cityName) {
      setMainTitle(cityName);
    }
  }, [cityName]);

  useEffect(() => {
    if (dataTitle) {
      setLegendTitle(dataTitle);
    }
  }, [dataTitle]);

  useEffect(() => {
    if (data.length > 0 && dataType === 'numerical') {
      const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 1;
      const meanValue = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0.5;
      setLegendMin(roundToSignificantDigits(minValue));
      setLegendMean(roundToSignificantDigits(meanValue));
      setLegendMax(roundToSignificantDigits(maxValue));
    } else {
      setLegendMin('0');
      setLegendMean('0.5');
      setLegendMax('1');
    }
  }, [data, dataType]);

  useEffect(() => {
    const loadGeoData = async () => {
      setRenderingData(true);
      try {
        if (!geojsonPath) {
          console.error('Missing GeoJSON path');
          setRenderingData(false);
          return;
        }

        const response = await fetch(geojsonPath);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const geoData = await response.json();

        // Normalize ward names: use "Ward <number>" when ward_name is missing or non-unique (e.g. "Na")
        const names = geoData.features.map((f: GeoJSONFeature) => (f.properties.ward_name || '').toLowerCase().trim());
        const uniqueNames = new Set(names.filter(Boolean));
        if (uniqueNames.size < geoData.features.length * 0.5) {
          for (const feature of geoData.features as GeoJSONFeature[]) {
            const wn = (feature.properties.ward_name || '').trim().toLowerCase();
            if (!wn || wn === 'na' || wn === 'n/a' || wn === 'm_ward') {
              const num = feature.properties.ward_number ?? feature.properties.wardcode;
              if (num != null) {
                feature.properties.ward_name = `Ward ${num}`;
              }
            }
          }
        }

        setGeojsonData(geoData);
        calculateBounds(geoData);

        setTimeout(() => {
          setRenderingData(false);
        }, 300);
      } catch (error) {
        console.error('Failed to load city GeoJSON data:', error);
        setRenderingData(false);
      }
    };

    loadGeoData();
  }, [geojsonPath]);

  useEffect(() => {
    if (geojsonData && bounds && data.length > 0) {
      setRenderingData(true);
      const timeoutId = setTimeout(() => {
        setRenderingData(false);
      }, 200);
      return () => clearTimeout(timeoutId);
    }
  }, [data, geojsonData, bounds, colorScale, invertColors, colorBarSettings, dataType, darkMode]);

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

  const calculateWardArea = (feature: GeoJSONFeature): number => {
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

  const projectCoordinate = (lng: number, lat: number, width = 800, height = 800): [number, number] => {
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

  const convertCoordinatesToPath = (coordinates: number[][][] | number[][][][], width = 800, height = 800, yOffset = 0, xOffset = 0): string => {
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

  const geoToScreen = (lng: number, lat: number): { x: number; y: number } => {
    const mapWidth = isMobile ? 320 : 760;
    const mapHeight = isMobile ? 400 : 760;
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

  const getWardColorForValue = (value: number | string | undefined, dataExtent: [number, number] | undefined, numericVals: number[]): string => {
    if (value === undefined) return darkMode ? '#1a1a1a' : 'white';

    if (dataType === 'categorical' && typeof value === 'string') {
      return getCategoryColor(value, categoryColors, darkMode ? '#1a1a1a' : '#e5e7eb');
    }

    if (typeof value === 'number') {
      if (!dataExtent) return darkMode ? '#1a1a1a' : 'white';
      if (isNaN(value)) return darkMode ? '#1a1a1a' : 'white';

      return getColorForValue(value, numericVals, colorScale, invertColors, colorBarSettings);
    }

    return darkMode ? '#1a1a1a' : '#e5e7eb';
  };

  const handleWardHover = (feature: GeoJSONFeature) => {
    const wardName = feature.properties.ward_name || '';
    const value = wardDataMap.get(wardName.toLowerCase().trim());
    setHoveredWard({
      ward: wardName,
      value
    });
  };

  const handleWardLeave = () => {
    setHoveredWard(null);
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
    if (dragRafRef.current) return;
    const cx = e.clientX, cy = e.clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      setLegendPosition({ x: cx - svgRect.left - dragOffset.x, y: cy - svgRect.top - dragOffset.y });
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
      const currentX = isMobile ? 175 : 400;
      const currentY = isMobile ? 35 : 30;
      setTitleDragOffset({
        x: e.clientX - (svgRect.left + currentX + titlePosition.x),
        y: e.clientY - (svgRect.top + currentY + titlePosition.y)
      });
    }
  };

  const handleTitleMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingTitle || !svgRef.current) return;
    if (dragRafRef.current) return;
    const cx = e.clientX, cy = e.clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const currentX = isMobile ? 175 : 400;
      const currentY = isMobile ? 35 : 30;
      setTitlePosition({ x: cx - svgRect.left - currentX - titleDragOffset.x, y: cy - svgRect.top - currentY - titleDragOffset.y });
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
      const currentX = isMobile ? 175 : 400;
      const currentY = isMobile ? 35 : 30;
      setTitleDragOffset({
        x: touch.clientX - (svgRect.left + currentX + titlePosition.x),
        y: touch.clientY - (svgRect.top + currentY + titlePosition.y)
      });
    }
  };

  const handleTitleTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingTitle || !svgRef.current || e.touches.length === 0) return;
    if (dragRafRef.current) return;
    const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const currentX = isMobile ? 175 : 400;
      const currentY = isMobile ? 35 : 30;
      setTitlePosition({ x: tx - svgRect.left - currentX - titleDragOffset.x, y: ty - svgRect.top - currentY - titleDragOffset.y });
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

  const handleLabelMouseDown = (e: React.MouseEvent, wardKey: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setDraggingLabel({
        wardKey,
        offset: {
          x: e.clientX - (svgRect.left + currentX),
          y: e.clientY - (svgRect.top + currentY)
        }
      });
    }
  };

  const handleLabelMouseMove = useCallback((e: MouseEvent) => {
    if (!draggingLabel || !svgRef.current) return;
    if (dragRafRef.current) return;
    const cx = e.clientX, cy = e.clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const newPositions = new Map(labelPositions);
      newPositions.set(draggingLabel.wardKey, { x: cx - svgRect.left - draggingLabel.offset.x, y: cy - svgRect.top - draggingLabel.offset.y });
      setLabelPositions(newPositions);
    });
  }, [draggingLabel, labelPositions]);

  const handleLabelMouseUp = () => {
    setDraggingLabel(null);
  };

  const handleLabelTouchStart = (e: React.TouchEvent, wardKey: string, currentX: number, currentY: number) => {
    e.stopPropagation();
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect && e.touches.length > 0) {
      const touch = e.touches[0];
      setDraggingLabel({
        wardKey,
        offset: {
          x: touch.clientX - (svgRect.left + currentX),
          y: touch.clientY - (svgRect.top + currentY)
        }
      });
    }
  };

  const handleLabelTouchMove = useCallback((e: TouchEvent) => {
    if (!draggingLabel || !svgRef.current || e.touches.length === 0) return;
    if (dragRafRef.current) return;
    const tx = e.touches[0].clientX, ty = e.touches[0].clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const newPositions = new Map(labelPositions);
      newPositions.set(draggingLabel.wardKey, { x: tx - svgRect.left - draggingLabel.offset.x, y: ty - svgRect.top - draggingLabel.offset.y });
      setLabelPositions(newPositions);
    });
  }, [draggingLabel, labelPositions]);

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

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('#city-legend-gradient').remove();

    if (data.length === 0 || colorBarSettings?.isDiscrete || dataType === 'categorical') return;

    let defs = svg.select('defs');
    if (defs.empty()) defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'city-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[];
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;

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
      const getAQIColor = (v: number) => {
        if (v <= 50) return '#10b981';
        if (v <= 100) return '#84cc16';
        if (v <= 200) return '#eab308';
        if (v <= 300) return '#f97316';
        if (v <= 400) return '#ef4444';
        return '#991b1b';
      };
      const color = colorScale === 'aqi' ? getAQIColor(value) : colorScaleFunction(value);
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color);
    }
  }, [colorScale, invertColors, data, colorBarSettings, dataType, geojsonData]);

  const fixCityLegendGradient = (svgClone: SVGSVGElement) => {
    if (data.length === 0) return;

    const numericValues = data
      .map(d => d.value)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));

    const legendRect = svgClone.querySelector('rect[fill*="city-legend-gradient"]');
    if (legendRect) {
      const x = parseFloat(legendRect.getAttribute('x') || '0');
      const y = parseFloat(legendRect.getAttribute('y') || '0');
      const width = parseFloat(legendRect.getAttribute('width') || '200');
      const height = parseFloat(legendRect.getAttribute('height') || '15');
      const stroke = legendRect.getAttribute('stroke');
      const strokeWidth = legendRect.getAttribute('stroke-width');
      const rx = legendRect.getAttribute('rx');

      const parent = legendRect.parentElement;
      if (parent) {
        legendRect.remove();
        const numSegments = 50;
        const segmentWidth = width / numSegments;

        for (let i = 0; i < numSegments; i++) {
          const t = i / (numSegments - 1);
          const value = (numericValues.length > 0 ? Math.min(...numericValues) : 0) +
            t * ((numericValues.length > 0 ? Math.max(...numericValues) : 1) - (numericValues.length > 0 ? Math.min(...numericValues) : 0));
          const color = getColorForValue(value, numericValues, colorScale, invertColors, colorBarSettings);

          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', (x + i * segmentWidth).toString());
          rect.setAttribute('y', y.toString());
          rect.setAttribute('width', segmentWidth.toString());
          rect.setAttribute('height', height.toString());
          rect.setAttribute('fill', color);

          if (i === 0 || i === numSegments - 1) {
            if (stroke) rect.setAttribute('stroke', stroke);
            if (strokeWidth) rect.setAttribute('stroke-width', strokeWidth);
          }
          if (rx && (i === 0 || i === numSegments - 1)) {
            rect.setAttribute('rx', rx);
          }

          parent.appendChild(rect);
        }
      }
    }

    const gradients = svgClone.querySelectorAll('#city-legend-gradient');
    gradients.forEach(gradient => gradient.remove());
  };

  const getMapDimensions = () => ({
    width: isMobile ? 350 : 800,
    height: isMobile ? 440 : 850,
  });

  const exportPNG = () => {
    if (!svgRef.current) return;
    const { width, height } = getMapDimensions();
    svgToHighDpiBlob(svgRef.current, { width, height }).then((blob) => {
      saveAs(blob, `bharatviz-city-${cityName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.png`);
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
      const allElements = svgElement.querySelectorAll('*');
      allElements.forEach(el => {
        const element = el as SVGElement;
        if (element.tagName === 'text') {
          element.setAttribute('font-family', "'DM Sans', Arial, sans-serif");
        }
      });
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      saveAs(blob, `bharatviz-city-${cityName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.svg`);
    },
    exportPDF: async () => {
      if (!svgRef.current) return;
      try {
        const [{ default: jsPDF }, { svg2pdf }] = await Promise.all([
          import('jspdf'),
          import('svg2pdf.js')
        ]);

        const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const svgWidth = isMobile ? 350 : 800;
        const svgHeight = isMobile ? 440 : 850;

        const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute('width', svgWidth.toString());
        svgClone.setAttribute('height', svgHeight.toString());
        svgClone.setAttribute('viewBox', `${isMobile ? '0 0 350 440' : '0 0 800 850'}`);
        svgClone.style.width = `${svgWidth}px`;
        svgClone.style.height = `${svgHeight}px`;
        svgClone.removeAttribute('class');

        const allElements = svgClone.querySelectorAll('*');
        allElements.forEach(el => {
          const element = el as SVGElement;
          element.style.visibility = 'visible';
          element.style.display = 'block';
          if (element.tagName === 'text') {
            element.setAttribute('font-family', "'DM Sans', Arial, sans-serif");
          }
        });

        fixCityLegendGradient(svgClone);

        const pdfMargin = 10;
        const availableWidth = pdfWidth - (2 * pdfMargin);
        const availableHeight = pdfHeight - (2 * pdfMargin);
        const svgWidthMm = svgWidth * 0.264583;
        const svgHeightMm = svgHeight * 0.264583;
        const scaleX = availableWidth / svgWidthMm;
        const scaleY = availableHeight / svgHeightMm;
        const scale = Math.min(scaleX, scaleY);
        const finalWidth = svgWidthMm * scale;
        const finalHeight = svgHeightMm * scale;
        const x = (pdfWidth - finalWidth) / 2;
        const y = (pdfHeight - finalHeight) / 2;

        await svg2pdf(svgClone, pdf, { x, y, width: finalWidth, height: finalHeight });
        pdf.save(`bharatviz-city-${cityName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
      } catch (error) {
        try {
          if (!svgRef.current) return;
          const svg = svgRef.current;
          const svgData = new XMLSerializer().serializeToString(svg);
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          const img = new Image();
          const dpiScale = 300 / 96;
          const originalWidth = isMobile ? 350 : 800;
          const originalHeight = isMobile ? 440 : 850;
          canvas.width = originalWidth * dpiScale;
          canvas.height = originalHeight * dpiScale;
          await new Promise<void>((resolve) => {
            img.onload = () => {
              ctx.scale(dpiScale, dpiScale);
              ctx.fillStyle = 'white';
              ctx.fillRect(0, 0, originalWidth, originalHeight);
              ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
              const imgData = canvas.toDataURL('image/png');
              const pdf = new jsPDF('portrait');
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = pdf.internal.pageSize.getHeight();
              const pdfMargin = 15;
              const availableWidth = pdfWidth - (2 * pdfMargin);
              const availableHeight = pdfHeight - (2 * pdfMargin);
              const canvasAspectRatio = canvas.width / canvas.height;
              let imgWidth = availableWidth;
              let imgHeight = availableWidth / canvasAspectRatio;
              if (imgHeight > availableHeight) {
                imgHeight = availableHeight;
                imgWidth = availableHeight * canvasAspectRatio;
              }
              const x = (pdfWidth - imgWidth) / 2;
              const y = (pdfHeight - imgHeight) / 2;
              pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
              pdf.save(`bharatviz-city-${cityName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.pdf`);
              resolve();
            };
            img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
          });
        } catch (fallbackError) {
          alert('Failed to export PDF. Please try using SVG export instead.');
        }
      }
    },
    downloadCSVTemplate: () => {
      if (!geojsonData) return;
      const wardNames = geojsonData.features
        .map(f => f.properties.ward_name || '')
        .filter(Boolean)
        .sort();
      const csv = 'ward,value\n' + wardNames.map((w, i) => `${w},${(i + 1) * 10}`).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      saveAs(blob, `${cityName.toLowerCase().replace(/\s+/g, '-')}-wards-template.csv`);
    }
  }));

  const { wardLabelData, maxArea, minArea, wardDataMap } = useMemo(() => {
    if (!geojsonData) return { wardLabelData: [], maxArea: 0, minArea: 0, wardDataMap: new Map() };

    const map = new Map<string, number | string | undefined>();
    data.forEach(d => {
      map.set(d.ward.toLowerCase().trim(), d.value);
    });

    let max = 0;
    let min = Infinity;
    const labels = geojsonData.features.map(feature => {
      const area = calculateWardArea(feature);
      if (area > max) max = area;
      if (area < min) min = area;
      return { feature, area };
    });

    return { wardLabelData: labels, maxArea: max, minArea: min === Infinity ? 0 : min, wardDataMap: map };
  }, [geojsonData, data]);

  const numericValues = useMemo(() =>
    data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v)) as number[],
    [data]
  );

  const dataExtent = useMemo(() =>
    numericValues.length > 0
      ? [Math.min(...numericValues), Math.max(...numericValues)] as [number, number]
      : undefined,
    [numericValues]
  );

  if (!geojsonData || !bounds) {
    return (
      <div className="w-full h-96 flex items-center justify-center border border-border rounded bg-background">
        <div className="text-xl text-muted-foreground">Loading city map...</div>
      </div>
    );
  }

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
        height={isMobile ? "440" : "850"}
        viewBox={isMobile ? "0 0 350 440" : "0 0 800 850"}
        className="max-w-full h-auto"
        style={{
          backgroundColor: mapBg,
          willChange: renderingData ? 'contents' : 'auto',
          transform: 'translateZ(0)',
        }}
      >

        {geojsonData.features.map((feature, index) => {
          const mapWidth = isMobile ? 320 : 760;
          const mapHeight = isMobile ? 400 : 760;
          const path = convertCoordinatesToPath(feature.geometry.coordinates, mapWidth, mapHeight, isMobile ? 55 : 45, isMobile ? 15 : 20);
          const wardName = feature.properties.ward_name || '';
          const wardValue = wardDataMap.get(wardName.toLowerCase().trim());
          const fillColor = getWardColorForValue(wardValue, dataExtent, numericValues);
          const isHovered = hoveredWard && hoveredWard.ward === wardName;

          return (
            <path
              key={index}
              d={path}
              fill={fillColor}
              stroke={
                data.length === 0
                  ? resolveBoundaryStroke(boundaryColor, darkMode ? '#1a1a1a' : 'white', darkMode)
                  : resolveBoundaryStroke(boundaryColor, fillColor, darkMode)
              }
              strokeWidth={isHovered ? boundaryWidth * 5 : boundaryWidth}
              className="cursor-pointer transition-all duration-200"
              onMouseEnter={() => handleWardHover(feature)}
              onMouseLeave={handleWardLeave}
            >
              <title>
                {wardName}
                {wardValue !== undefined ? `: ${typeof wardValue === 'number' ? roundToSignificantDigits(wardValue) : String(wardValue)}` : ''}
              </title>
            </path>
          );
        })}


        {((!hideWardNames) || (!hideWardValues)) && wardLabelData.length > 0 && (
          <g className="ward-labels">
            {wardLabelData.map(({ feature, area }, index) => {
              const wardName = feature.properties.ward_name || '';
              if (!wardName) return null;

              const [lng, lat] = getPolygonCenter(feature.geometry);
              const screenPos = geoToScreen(lng, lat);
              let labelPosition = { x: screenPos.x, y: screenPos.y };

              const minFontSize = isMobile ? 5 : 6;
              const maxFontSize = isMobile ? 12 : 14;
              const areaRange = maxArea - minArea;
              const normalizedArea = areaRange > 0 ? (area - minArea) / areaRange : 0.5;
              const scaledArea = Math.sqrt(normalizedArea);
              const finalFontSize = (minFontSize + scaledArea * (maxFontSize - minFontSize)) * 0.7;

              const wardKey = wardName;
              const customPosition = labelPositions.get(wardKey);
              if (customPosition) {
                labelPosition = customPosition;
              }

              const wardValue = wardDataMap.get(wardName.toLowerCase().trim());
              const displayValue = wardValue !== undefined
                ? (typeof wardValue === 'number' ? roundToSignificantDigits(wardValue) : String(wardValue))
                : '';

              const fillColor = getWardColorForValue(wardValue, dataExtent, numericValues);
              const textColor = fillColor === 'white' || fillColor === '#1a1a1a' || !isColorDark(fillColor) ? (darkMode ? '#ffffff' : '#0f172a') : '#ffffff';

              return (
                <g key={`label-${index}`}>
                  {!hideWardNames && (
                    <text
                      x={labelPosition.x}
                      y={labelPosition.y - (hideWardValues ? 0 : finalFontSize * 0.3)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={finalFontSize}
                      fontWeight="600"
                      fill={textColor}
                      stroke={textColor === '#ffffff' ? 'rgba(0,0,0,0.5)' : 'none'}
                      strokeWidth={textColor === '#ffffff' ? '1.5' : '0'}
                      paintOrder="stroke"
                      style={{ cursor: 'grab', userSelect: 'none' }}
                      onMouseDown={(e) => handleLabelMouseDown(e, wardKey, labelPosition.x, labelPosition.y)}
                      onTouchStart={(e) => handleLabelTouchStart(e, wardKey, labelPosition.x, labelPosition.y)}
                    >
                      {wardName}
                    </text>
                  )}
                  {!hideWardValues && displayValue && (
                    <text
                      x={labelPosition.x}
                      y={labelPosition.y + (hideWardNames ? 0 : finalFontSize * 0.7)}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={finalFontSize * 0.85}
                      fontWeight="500"
                      fill={textColor}
                      stroke={textColor === '#ffffff' ? 'rgba(0,0,0,0.5)' : 'none'}
                      strokeWidth={textColor === '#ffffff' ? '1' : '0'}
                      paintOrder="stroke"
                      style={{ cursor: 'grab', userSelect: 'none' }}
                      onMouseDown={(e) => handleLabelMouseDown(e, wardKey, labelPosition.x, labelPosition.y)}
                      onTouchStart={(e) => handleLabelTouchStart(e, wardKey, labelPosition.x, labelPosition.y)}
                    >
                      {displayValue}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        )}


        <text
          x={(isMobile ? 175 : 400) + titlePosition.x}
          y={(isMobile ? 35 : 30) + titlePosition.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={isMobile ? "16" : "22"}
          fontWeight="bold"
          fill={darkMode ? '#ffffff' : '#1e293b'}
          style={{ cursor: editingMainTitle ? 'text' : 'grab', userSelect: 'none' }}
          onMouseDown={handleTitleMouseDown}
          onTouchStart={handleTitleTouchStart}
          onDoubleClick={() => setEditingMainTitle(true)}
        >
          {mainTitle}
        </text>


        {hoveredWard && (
          <g>
            <rect
              x={isMobile ? 10 : 20}
              y={isMobile ? 430 : 810}
              width={isMobile ? 330 : 760}
              height="30"
              fill={darkMode ? 'hsl(25, 8%, 11%)' : 'hsl(38, 30%, 99%)'}
              rx="4"
              stroke={darkMode ? 'hsl(25, 8%, 18%)' : 'hsl(35, 18%, 84%)'}
              strokeWidth="0.5"
            />
            <text
              x={isMobile ? 175 : 400}
              y={isMobile ? 449 : 829}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="13"
              fontWeight="600"
              fill={darkMode ? 'hsl(35, 12%, 90%)' : 'hsl(28, 20%, 14%)'}
            >
              {hoveredWard.ward}
              {hoveredWard.value !== undefined ? `: ${typeof hoveredWard.value === 'number' ? roundToSignificantDigits(hoveredWard.value) : String(hoveredWard.value)}` : ''}
            </text>
          </g>
        )}


        {data.length > 0 && dataType === 'numerical' && !colorBarSettings?.isDiscrete && (
          <g
            transform={`translate(${legendPosition.x}, ${legendPosition.y})`}
            style={{ cursor: dragging ? 'grabbing' : 'grab' }}
            onMouseDown={handleLegendMouseDown}
          >
            <rect
              x={0}
              y={0}
              width={isMobile ? 150 : 200}
              height={isMobile ? 60 : 70}
              fill={darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)'}
              stroke={darkMode ? 'hsl(25,8%,20%)' : 'hsl(35,18%,84%)'}
              strokeWidth="0.5"
              rx="4"
            />
            {editingTitle ? (
              <foreignObject x={10} y={5} width={isMobile ? 130 : 180} height={20}>
                <input
                  type="text"
                  value={legendTitle}
                  onChange={(e) => setLegendTitle(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                  autoFocus
                  style={{ width: '100%', fontSize: '11px', fontWeight: 600, border: '1px solid #ccc', borderRadius: '2px', padding: '0 4px', background: darkMode ? 'hsl(25,8%,14%)' : 'white', color: darkMode ? '#fff' : '#000' }}
                />
              </foreignObject>
            ) : (
              <text
                x={10}
                y={17}
                fontSize="11"
                fontWeight="600"
                fill={darkMode ? '#ffffff' : '#1e293b'}
                style={{ cursor: 'pointer' }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); }}
              >
                {legendTitle}
              </text>
            )}
            <rect
              x={10}
              y={25}
              width={isMobile ? 130 : 180}
              height="15"
              fill="url(#city-legend-gradient)"
              stroke={darkMode ? 'hsl(25,8%,20%)' : 'hsl(35,18%,80%)'}
              strokeWidth="0.5"
              rx="2"
            />
            {editingMin ? (
              <foreignObject x={5} y={isMobile ? 43 : 45} width={50} height={18}>
                <input
                  type="text"
                  value={legendMin}
                  onChange={(e) => setLegendMin(e.target.value)}
                  onBlur={() => setEditingMin(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingMin(false)}
                  autoFocus
                  style={{ width: '100%', fontSize: '9px', border: '1px solid #ccc', borderRadius: '2px', padding: '0 2px', background: darkMode ? 'hsl(25,8%,14%)' : 'white', color: darkMode ? '#fff' : '#000' }}
                />
              </foreignObject>
            ) : (
              <text
                x={10}
                y={isMobile ? 55 : 57}
                fontSize="9"
                fill={darkMode ? 'hsl(35,10%,80%)' : 'hsl(28,8%,44%)'}
                style={{ cursor: 'pointer' }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingMin(true); }}
              >
                {legendMin}
              </text>
            )}
            {editingMean ? (
              <foreignObject x={(isMobile ? 55 : 75)} y={isMobile ? 43 : 45} width={50} height={18}>
                <input
                  type="text"
                  value={legendMean}
                  onChange={(e) => setLegendMean(e.target.value)}
                  onBlur={() => setEditingMean(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingMean(false)}
                  autoFocus
                  style={{ width: '100%', fontSize: '9px', textAlign: 'center', border: '1px solid #ccc', borderRadius: '2px', padding: '0 2px', background: darkMode ? 'hsl(25,8%,14%)' : 'white', color: darkMode ? '#fff' : '#000' }}
                />
              </foreignObject>
            ) : (
              <text
                x={isMobile ? 75 : 100}
                y={isMobile ? 55 : 57}
                textAnchor="middle"
                fontSize="9"
                fill={darkMode ? 'hsl(35,10%,80%)' : 'hsl(28,8%,44%)'}
                style={{ cursor: 'pointer' }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingMean(true); }}
              >
                {legendMean}
              </text>
            )}
            {editingMax ? (
              <foreignObject x={(isMobile ? 115 : 155)} y={isMobile ? 43 : 45} width={50} height={18}>
                <input
                  type="text"
                  value={legendMax}
                  onChange={(e) => setLegendMax(e.target.value)}
                  onBlur={() => setEditingMax(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setEditingMax(false)}
                  autoFocus
                  style={{ width: '100%', fontSize: '9px', textAlign: 'right', border: '1px solid #ccc', borderRadius: '2px', padding: '0 2px', background: darkMode ? 'hsl(25,8%,14%)' : 'white', color: darkMode ? '#fff' : '#000' }}
                />
              </foreignObject>
            ) : (
              <text
                x={isMobile ? 140 : 190}
                y={isMobile ? 55 : 57}
                textAnchor="end"
                fontSize="9"
                fill={darkMode ? 'hsl(35,10%,80%)' : 'hsl(28,8%,44%)'}
                style={{ cursor: 'pointer' }}
                onDoubleClick={(e) => { e.stopPropagation(); setEditingMax(true); }}
              >
                {legendMax}
              </text>
            )}
          </g>
        )}


        {data.length > 0 && dataType === 'numerical' && colorBarSettings?.isDiscrete && (
          <DiscreteLegend
            legendPosition={legendPosition}
            legendTitle={legendTitle}
            data={numericValues}
            colorScale={colorScale}
            invertColors={invertColors}
            colorBarSettings={colorBarSettings}
            isMobile={isMobile}
            darkMode={darkMode}
            editingTitle={editingTitle}
            onEditTitle={setEditingTitle}
            onTitleChange={setLegendTitle}
            onMouseDown={handleLegendMouseDown}
            dragging={dragging}
          />
        )}


        {data.length > 0 && dataType === 'categorical' && (
          <CategoricalLegend
            legendPosition={legendPosition}
            legendTitle={legendTitle}
            categories={getUniqueCategories(data.map(d => d.value))}
            categoryColors={categoryColors}
            isMobile={isMobile}
            darkMode={darkMode}
            editingTitle={editingTitle}
            onEditTitle={setEditingTitle}
            onTitleChange={setLegendTitle}
            onMouseDown={handleLegendMouseDown}
            dragging={dragging}
          />
        )}


        {naInfo && naInfo.count > 0 && showNALegend && (
          <g transform={`translate(${isMobile ? 10 : 20}, ${isMobile ? 410 : 790})`}>
            <rect
              x={0} y={0}
              width={isMobile ? 120 : 150} height={20}
              fill={darkMode ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)'}
              stroke={darkMode ? 'hsl(25,8%,20%)' : 'hsl(35,18%,84%)'} strokeWidth="0.5" rx="4"
            />
            <rect x={5} y={4} width={12} height={12} fill={darkMode ? 'hsl(25,8%,9%)' : 'white'} stroke={darkMode ? 'hsl(25,8%,20%)' : 'hsl(35,18%,80%)'} strokeWidth="0.5" />
            <text x={22} y={13} fontSize="10" fill={darkMode ? 'hsl(35,10%,80%)' : 'hsl(28,8%,44%)'}>
              NA ({naInfo.count} ward{naInfo.count !== 1 ? 's' : ''})
            </text>
            <text
              x={isMobile ? 110 : 140} y={13} fontSize="10"
              fill={darkMode ? 'hsl(30,8%,48%)' : 'hsl(28,8%,54%)'} textAnchor="end"
              style={{ cursor: 'pointer' }}
              onClick={() => setShowNALegend(false)}
            >
              x
            </text>
          </g>
        )}
      </svg>
    </div>
  );
});

IndiaCityMap.displayName = 'IndiaCityMap';
