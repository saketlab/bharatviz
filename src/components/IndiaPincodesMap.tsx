import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle, useCallback, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDarkMode } from '@/hooks/useDarkMode';
import * as d3 from 'd3';
import { scaleSequential } from 'd3-scale';
import { interpolateBlues } from 'd3-scale-chromatic';
import { saveAs } from 'file-saver';
import { type ColorScale, ColorBarSettings } from './ColorMapChooser';
import { roundToSignificantDigits, resolveBoundaryStroke, type BoundaryColor } from '@/lib/colorUtils';
import { getColorForValue, createColorMapper } from '@/lib/discreteColorUtils';
import { DiscreteLegend } from '@/lib/discreteLegend';
import { CategoricalLegend } from '@/lib/categoricalLegend';
import { DataType, CategoryColorMapping, getCategoryColor, getUniqueCategories } from '@/lib/categoricalUtils';
import { svgToHighDpiBlob } from '@/lib/exportUtils';
import { colorScales } from '@/lib/colorScales';
import { fetchGeoJSON } from '@/lib/geoJsonCache';
import { DATA_FILES, ALL_INDIA_STATE } from '@/lib/constants';

export interface PincodeMapData {
  pincode: string;
  value: number | string;
}

interface NAInfo {
  pincodes?: string[];
  count: number;
}

interface IndiaPincodesMapProps {
  data: PincodeMapData[];
  colorScale: ColorScale;
  invertColors: boolean;
  dataTitle: string;
  selectedState: string;
  colorBarSettings?: ColorBarSettings;
  geojsonPath?: string;
  preFiltered?: boolean;
  dataType?: DataType;
  categoryColors?: CategoryColorMapping;
  naInfo?: NAInfo;
  mapTitle?: string;
  darkMode?: boolean;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
}

export interface IndiaPincodesMapRef {
  exportPNG: () => void;
  exportSVG: () => void;
  exportPDF: () => void;
  copyToClipboard: () => void;
  downloadCSVTemplate: () => void;
}

interface GeoJSONFeature {
  type: string;
  properties: {
    pincode?: string;
    office_name?: string;
    state_name?: string;
    district_name?: string;
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

interface PincodeRenderFeature {
  path: string;
  pincode: string;
  officeName: string;
  state: string;
  district: string;
  value?: number | string;
  fillColor: string;
  strokeColor: string;
  title: string;
}

const PincodePath = React.memo(({
  feature,
  isHovered,
  boundaryWidth,
  onHover,
  onLeave,
}: {
  feature: PincodeRenderFeature;
  isHovered: boolean;
  boundaryWidth: number;
  onHover: (feature: PincodeRenderFeature) => void;
  onLeave: () => void;
}) => (
  <path
    d={feature.path}
    fill={feature.fillColor}
    stroke={feature.strokeColor}
    strokeWidth={isHovered ? boundaryWidth * 5 : boundaryWidth}
    className="cursor-pointer"
    onMouseEnter={() => onHover(feature)}
    onMouseLeave={onLeave}
  >
    <title>{feature.title}</title>
  </path>
));
PincodePath.displayName = 'PincodePath';

export const IndiaPincodesMap = forwardRef<IndiaPincodesMapRef, IndiaPincodesMapProps>(({
  data,
  colorScale,
  invertColors,
  dataTitle,
  selectedState,
  colorBarSettings,
  geojsonPath = DATA_FILES.PINCODES_GEOJSON,
  preFiltered = false,
  dataType = 'numerical',
  categoryColors = {},
  naInfo,
  mapTitle,
  darkMode: darkModeProp,
  boundaryColor = 'auto',
  boundaryWidth = 0.3,
}, ref) => {
  const { dark: darkModeHook } = useDarkMode();
  const darkMode = darkModeProp !== undefined ? darkModeProp : darkModeHook;
  const mapBg = darkMode ? 'hsl(25, 8%, 6%)' : 'hsl(38, 30%, 97%)';
  const boundaryStroke = boundaryColor === 'white' ? '#ffffff' : boundaryColor === 'dark' ? '#0f172a' : (darkMode ? '#ffffff' : '#1f2937');

  const [geojsonData, setGeojsonData] = useState<{ features: GeoJSONFeature[] } | null>(null);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [renderingData, setRenderingData] = useState(false);
  const [hoveredPincode, setHoveredPincode] = useState<{ pincode: string; officeName: string; state: string; district: string; value?: number | string } | null>(null);
  const [editingMainTitle, setEditingMainTitle] = useState(false);
  const [mainTitle, setMainTitle] = useState(selectedState || 'Pincodes');

  const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>({ x: 550, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingMin, setEditingMin] = useState(false);
  const [editingMax, setEditingMax] = useState(false);
  const [editingMean, setEditingMean] = useState(false);
  const [legendTitle, setLegendTitle] = useState(dataTitle || 'Values (edit me)');
  const [legendMin, setLegendMin] = useState('');
  const [legendMean, setLegendMean] = useState('');
  const [legendMax, setLegendMax] = useState('');

  const [titlePosition, setTitlePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingTitle, setDraggingTitle] = useState(false);
  const [titleDragOffset, setTitleDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showNALegend, setShowNALegend] = useState(true);

  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRafRef = useRef<number | null>(null);
  const isMobile = useIsMobile();

  const numericValues = useMemo(() => {
    return data.map(d => d.value).filter((v): v is number => typeof v === 'number' && !isNaN(v));
  }, [data]);

  const dataExtent = useMemo((): { min: number; max: number; mean: number } => {
    if (numericValues.length === 0) return { min: 0, max: 1, mean: 0.5 };
    let min = numericValues[0], max = numericValues[0], sum = 0;
    for (const v of numericValues) {
      if (v < min) min = v;
      if (v > max) max = v;
      sum += v;
    }
    return { min, max, mean: sum / numericValues.length };
  }, [numericValues]);

  useEffect(() => {
    if (isMobile) {
      setLegendPosition({ x: 190, y: 10 });
    } else {
      setLegendPosition({ x: 550, y: 100 });
    }
  }, [isMobile]);

  useEffect(() => {
    if (dataTitle) setLegendTitle(dataTitle);
  }, [dataTitle]);

  useEffect(() => {
    if (mapTitle !== undefined && mapTitle !== '') {
      setMainTitle(mapTitle);
    } else {
      setMainTitle(selectedState || 'Pincodes');
    }
  }, [mapTitle, selectedState]);

  useEffect(() => {
    if (data.length > 0 && dataType === 'numerical') {
      setLegendMin(roundToSignificantDigits(dataExtent.min));
      setLegendMean(roundToSignificantDigits(dataExtent.mean));
      setLegendMax(roundToSignificantDigits(dataExtent.max));
    } else {
      setLegendMin('0');
      setLegendMean('0.5');
      setLegendMax('1');
    }
  }, [dataExtent, data.length, dataType]);

  useEffect(() => {
    if (!selectedState) return;
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout>;

    const loadGeoData = async () => {
      setRenderingData(true);
      try {
        const allData = await fetchGeoJSON(geojsonPath);
        if (cancelled) return;

        const filteredData = (preFiltered || selectedState === ALL_INDIA_STATE)
          ? allData
          : {
              ...allData,
              features: allData.features.filter(
                (feature) => (feature.properties as GeoJSONFeature['properties'])?.state_name === selectedState
              )
            };

        setGeojsonData(filteredData as { features: GeoJSONFeature[] });
        calculateBounds(filteredData as { features: GeoJSONFeature[] });
        timeoutId = setTimeout(() => setRenderingData(false), 300);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load pincode GeoJSON:', error);
          setRenderingData(false);
        }
      }
    };

    loadGeoData();
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [geojsonPath, selectedState]);

  useEffect(() => {
    if (geojsonData && bounds && data.length > 0) {
      setRenderingData(true);
      const timeoutId = setTimeout(() => setRenderingData(false), 200);
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
          (polygon as number[][][]).forEach(ring => processCoordinates(ring));
        });
      } else if (feature.geometry.type === 'Polygon') {
        (feature.geometry.coordinates as number[][][]).forEach(ring => processCoordinates(ring));
      }
    });

    setBounds({ minLng, maxLng, minLat, maxLat });
  };

  const handlePincodeHover = useCallback((feature: PincodeRenderFeature) => {
    setHoveredPincode({
      pincode: feature.pincode,
      officeName: feature.officeName,
      state: feature.state,
      district: feature.district,
      value: feature.value,
    });
  }, []);

  const handlePincodeLeave = useCallback(() => setHoveredPincode(null), []);

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

  const handleLegendMouseUp = () => setDragging(false);

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
    if (dragRafRef.current) return;
    const cx = e.clientX, cy = e.clientY;
    dragRafRef.current = requestAnimationFrame(() => {
      dragRafRef.current = null;
      if (!svgRef.current) return;
      const svgRect = svgRef.current.getBoundingClientRect();
      const currentX = isMobile ? 175 : 310;
      const currentY = isMobile ? 35 : 50;
      setTitlePosition({ x: cx - svgRect.left - currentX - titleDragOffset.x, y: cy - svgRect.top - currentY - titleDragOffset.y });
    });
  }, [draggingTitle, titleDragOffset, isMobile]);

  const handleTitleMouseUp = () => setDraggingTitle(false);

  useEffect(() => {
    if (draggingTitle) {
      document.addEventListener('mousemove', handleTitleMouseMove);
      document.addEventListener('mouseup', handleTitleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleTitleMouseMove);
        document.removeEventListener('mouseup', handleTitleMouseUp);
      };
    }
  }, [draggingTitle, titleDragOffset, handleTitleMouseMove]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('#pincodes-legend-gradient').remove();

    if (data.length === 0 || colorBarSettings?.isDiscrete || dataType === 'categorical') return;

    let defs = svg.select('defs');
    if (defs.empty()) defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'pincodes-legend-gradient')
      .attr('x1', '0%').attr('x2', '100%').attr('y1', '0%').attr('y2', '0%');

    const { min: minValue, max: maxValue } = dataExtent;

    const getColorInterpolator = (scale: ColorScale) => {
      const baseInterpolator = colorScales[scale] || colorScales.spectral;
      return invertColors ? (t: number) => baseInterpolator(1 - t) : baseInterpolator;
    };
    const colorScaleFunction = scaleSequential(getColorInterpolator(colorScale))
      .domain([minValue, maxValue]);

    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const value = minValue + t * (maxValue - minValue);
      const color = colorScale === 'aqi' ? interpolateBlues(t) : colorScaleFunction(value);
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color);
    }
  }, [colorScale, invertColors, dataExtent, colorBarSettings, dataType, data.length]);

  const pincodeDataMap = useMemo(() => {
    const map = new Map<string, number | string | undefined>();
    data.forEach(d => map.set(d.pincode, d.value));
    return map;
  }, [data]);

  // Must be before any early returns to satisfy Rules of Hooks
  const computedPaths = useMemo(() => {
    if (!geojsonData || !bounds) return [];
    const mapWidth = isMobile ? 320 : 760;
    const mapHeight = isMobile ? 400 : 1050;
    const yOffset = isMobile ? 55 : 45;
    const xOffset = isMobile ? 15 : 20;
    const geoWidth = bounds.maxLng - bounds.minLng;
    const geoHeight = bounds.maxLat - bounds.minLat;
    const geoAspectRatio = geoWidth / geoHeight;
    const canvasAspectRatio = mapWidth / mapHeight;
    let projectionWidth = mapWidth;
    let projectionHeight = mapHeight;
    let projectionOffsetX = 0;
    let projectionOffsetY = 0;

    if (geoAspectRatio > canvasAspectRatio) {
      projectionHeight = mapWidth / geoAspectRatio;
      projectionOffsetY = (mapHeight - projectionHeight) / 2;
    } else {
      projectionWidth = mapHeight * geoAspectRatio;
      projectionOffsetX = (mapWidth - projectionWidth) / 2;
    }

    const project = (lng: number, lat: number): [number, number] => [
      ((lng - bounds.minLng) / geoWidth) * projectionWidth + projectionOffsetX + xOffset,
      ((bounds.maxLat - lat) / geoHeight) * projectionHeight + projectionOffsetY + yOffset,
    ];

    const convertRing = (ring: number[][]) => {
      let path = '';
      for (let i = 0; i < ring.length; i++) {
        const [lng, lat] = ring[i];
        const [x, y] = project(lng, lat);
        path += `${i === 0 ? '' : ' L '}${x},${y}`;
      }
      return path;
    };

    const convertCoordinatesToPath = (coordinates: number[][][] | number[][][][]): string => {
      if (!coordinates || !Array.isArray(coordinates)) return '';

      if (coordinates[0] && Array.isArray(coordinates[0][0]) && Array.isArray((coordinates[0][0] as number[][])[0])) {
        return (coordinates as number[][][][]).map(polygon =>
          polygon.map(ring => `M ${convertRing(ring)} Z`).join(' ')
        ).join(' ');
      }

      if (coordinates[0] && Array.isArray(coordinates[0][0])) {
        return (coordinates as number[][][]).map(ring => `M ${convertRing(ring)} Z`).join(' ');
      }

      return '';
    };

    return geojsonData.features.map((feature) => convertCoordinatesToPath(feature.geometry.coordinates));
  }, [geojsonData, bounds, isMobile]);

  const colorMapper = useMemo(
    () => createColorMapper(numericValues, colorScale, invertColors, colorBarSettings),
    [numericValues, colorScale, invertColors, colorBarSettings]
  );

  const pincodeRenderFeatures = useMemo<PincodeRenderFeature[]>(() => {
    if (!geojsonData || !bounds) return [];
    const noDataColor = darkMode ? '#1a1a1a' : 'white';
    const categoricalFallback = darkMode ? '#1a1a1a' : '#e5e7eb';

    return geojsonData.features.map((feature, index) => {
      const pincode = feature.properties.pincode || '';
      const value = pincodeDataMap.get(pincode);
      let fillColor = noDataColor;

      if (dataType === 'categorical' && typeof value === 'string') {
        fillColor = getCategoryColor(value, categoryColors, categoricalFallback);
      } else if (typeof value === 'number') {
        fillColor = colorMapper(value);
      } else if (value !== undefined) {
        fillColor = categoricalFallback;
      }

      const officeName = feature.properties.office_name || '';
      const district = feature.properties.district_name || '';
      const title = `${pincode}${officeName ? ` — ${officeName}` : ''}${district ? `, ${district}` : ''}${value !== undefined ? `: ${typeof value === 'number' ? roundToSignificantDigits(value) : String(value)}` : ''}`;

      return {
        path: computedPaths[index],
        pincode,
        officeName,
        state: feature.properties.state_name || '',
        district,
        value,
        fillColor,
        strokeColor: data.length === 0 ? boundaryStroke : resolveBoundaryStroke(boundaryColor, fillColor, darkMode),
        title,
      };
    });
  }, [geojsonData, bounds, computedPaths, pincodeDataMap, darkMode, dataType, categoryColors, colorMapper, data.length, boundaryStroke, boundaryColor]);

  const fixLegendGradient = (svgClone: SVGSVGElement) => {
    if (data.length === 0) return;

    const legendRect = svgClone.querySelector('rect[fill*="pincodes-legend-gradient"]');
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
          const value = dataExtent.min + t * (dataExtent.max - dataExtent.min);
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
          if (rx && (i === 0 || i === numSegments - 1)) rect.setAttribute('rx', rx);
          parent.appendChild(rect);
        }
      }
    }
    const gradients = svgClone.querySelectorAll('linearGradient[id*="pincodes-legend"]');
    gradients.forEach(gradient => gradient.remove());
  };

  const exportFallbackPDF = async () => {
    if (!svgRef.current) return;
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    const dpiScale = 300 / 96;
    const originalWidth = isMobile ? 350 : 800;
    const originalHeight = isMobile ? 440 : 1100;

    canvas.width = originalWidth * dpiScale;
    canvas.height = originalHeight * dpiScale;

    return new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        ctx.scale(dpiScale, dpiScale);
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, originalWidth, originalHeight);
        ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
        const imgData = canvas.toDataURL('image/png');
        const { default: jsPDF } = await import('jspdf');
        const pdf = new jsPDF('landscape');
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
        const xPos = (pdfWidth - imgWidth) / 2;
        const yPos = (pdfHeight - imgHeight) / 2;
        pdf.addImage(imgData, 'PNG', xPos, yPos, imgWidth, imgHeight);
        pdf.save(`bharatviz-pincodes-${Date.now()}.pdf`);
        resolve();
      };
      img.onerror = () => reject(new Error('Failed to render SVG to canvas'));
      img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
    });
  };

  const getMapDimensions = () => ({
    width: isMobile ? 350 : 800,
    height: isMobile ? 440 : 1100,
  });

  const exportPNG = () => {
    if (!svgRef.current) return;
    const { width, height } = getMapDimensions();
    svgToHighDpiBlob(svgRef.current, { width, height }).then((blob) => {
      saveAs(blob, `bharatviz-pincodes-${Date.now()}.png`);
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
      saveAs(blob, `bharatviz-pincodes-${Date.now()}.svg`);
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
        const svgHeight = isMobile ? 440 : 1100;
        const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
        svgClone.setAttribute('width', svgWidth.toString());
        svgClone.setAttribute('height', svgHeight.toString());
        svgClone.setAttribute('viewBox', `${isMobile ? '0 0 350 440' : '0 0 800 1100'}`);
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
        fixLegendGradient(svgClone);
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
        const xPos = (pdfWidth - finalWidth) / 2;
        const yPos = (pdfHeight - finalHeight) / 2;
        await svg2pdf(svgClone, pdf, { x: xPos, y: yPos, width: finalWidth, height: finalHeight });
        pdf.save(`bharatviz-pincodes-${Date.now()}.pdf`);
      } catch {
        try {
          await exportFallbackPDF();
        } catch {
          alert('Failed to export PDF. Please try using SVG export instead.');
        }
      }
    },
    downloadCSVTemplate: () => {
      const template = `pincode,value\n110001,10\n110002,20\n110003,30\n400001,40\n400002,50`;
      const blob = new Blob([template], { type: 'text/csv' });
      saveAs(blob, 'pincodes-template.csv');
    }
  }));

  if (!selectedState) {
    return (
      <div className="w-full h-96 flex items-center justify-center border border-border rounded bg-background">
        <div className="text-xl text-muted-foreground">Select a state to view pincode map</div>
      </div>
    );
  }

  if (!geojsonData || !bounds) {
    return (
      <div className="w-full h-96 flex items-center justify-center border border-border rounded bg-background">
        <div className="text-xl text-muted-foreground">Loading pincodes map...</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full flex justify-center">
      {renderingData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto"></div>
            <p className="mt-3 text-sm font-medium text-foreground">
              {!geojsonData ? 'Loading pincode data...' : `Rendering ${geojsonData.features.length} pincodes...`}
            </p>
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        width={isMobile ? "350" : "800"}
        height={isMobile ? "440" : "1100"}
        viewBox={isMobile ? "0 0 350 440" : "0 0 800 1100"}
        className="max-w-full h-auto"
        style={{
          backgroundColor: mapBg,
          willChange: renderingData ? 'contents' : 'auto',
          transform: 'translateZ(0)',
        }}
        role="img"
        aria-label={dataTitle ? `India pincodes map — ${dataTitle} (${selectedState})` : `India pincodes choropleth map — ${selectedState}`}
      >
        {pincodeRenderFeatures.map((feature, index) => (
          <PincodePath
            key={`${feature.pincode}-${index}`}
            feature={feature}
            isHovered={hoveredPincode?.pincode === feature.pincode}
            boundaryWidth={boundaryWidth}
            onHover={handlePincodeHover}
            onLeave={handlePincodeLeave}
          />
        ))}

        {/* Main title */}
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
                  backgroundColor: darkMode ? '#1a1a1a' : 'white',
                  color: darkMode ? '#ffffff' : '#000000',
                }}
                onChange={e => setMainTitle(e.target.value)}
                onBlur={() => setEditingMainTitle(false)}
                onKeyDown={e => e.key === 'Enter' && setEditingMainTitle(false)}
              />
            </foreignObject>
          ) : (
            <text
              x={(isMobile ? 175 : 310) + titlePosition.x}
              y={(isMobile ? 35 : 50) + titlePosition.y}
              textAnchor="middle"
              style={{
                fontFamily: "'DM Sans', Arial, sans-serif",
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                fill: darkMode ? '#ffffff' : '#0f172a',
                cursor: draggingTitle ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              onDoubleClick={() => setEditingMainTitle(true)}
              onMouseDown={handleTitleMouseDown}
            >
              {mainTitle}
            </text>
          )}
        </g>

        {/* Legend */}
        {data.length > 0 && (
          <>
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
              <g
                className="legend-container"
                transform={`translate(${legendPosition.x}, ${legendPosition.y})`}
                onMouseDown={handleLegendMouseDown}
                style={{ cursor: dragging ? 'grabbing' : 'grab' }}
              >
                <rect
                  width={isMobile ? 150 : 200}
                  height={15}
                  fill="url(#pincodes-legend-gradient)"
                  stroke={darkMode ? 'none' : '#374151'}
                  strokeWidth={darkMode ? 0 : 0.5}
                  rx={3}
                />
                {editingMin ? (
                  <foreignObject x={-10} y={18} width={isMobile ? 30 : 40} height={30}>
                    <input type="text" value={legendMin} autoFocus style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                      onChange={e => setLegendMin(e.target.value)} onBlur={() => setEditingMin(false)} onKeyDown={e => e.key === 'Enter' && setEditingMin(false)} />
                  </foreignObject>
                ) : (
                  <text x={0} y={30} textAnchor="start"
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMin(true); }}>
                    {legendMin}
                  </text>
                )}
                {editingMean ? (
                  <foreignObject x={isMobile ? 60 : 80} y={18} width={isMobile ? 30 : 40} height={30}>
                    <input type="text" value={legendMean} autoFocus style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                      onChange={e => setLegendMean(e.target.value)} onBlur={() => setEditingMean(false)} onKeyDown={e => e.key === 'Enter' && setEditingMean(false)} />
                  </foreignObject>
                ) : (
                  <text x={isMobile ? 75 : 100} y={30} textAnchor="middle"
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMean(true); }}>
                    {legendMean}
                  </text>
                )}
                {editingMax ? (
                  <foreignObject x={isMobile ? 120 : 170} y={18} width={isMobile ? 30 : 40} height={30}>
                    <input type="text" value={legendMax} autoFocus style={{ width: isMobile ? 28 : 38, fontSize: isMobile ? 10 : 12 }}
                      onChange={e => setLegendMax(e.target.value)} onBlur={() => setEditingMax(false)} onKeyDown={e => e.key === 'Enter' && setEditingMax(false)} />
                  </foreignObject>
                ) : (
                  <text x={isMobile ? 150 : 200} y={30} textAnchor="end"
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMax(true); }}>
                    {legendMax}
                  </text>
                )}
                {editingTitle ? (
                  <foreignObject x={isMobile ? 40 : 60} y={-25} width={isMobile ? 70 : 90} height={30}>
                    <input type="text" value={legendTitle} autoFocus style={{ width: isMobile ? 68 : 88, fontSize: isMobile ? 11 : 13, fontWeight: 600, textAlign: 'center' }}
                      onChange={e => setLegendTitle(e.target.value)} onBlur={() => setEditingTitle(false)} onKeyDown={e => e.key === 'Enter' && setEditingTitle(false)} />
                  </foreignObject>
                ) : (
                  <text x={isMobile ? 75 : 100} y={-5} textAnchor="middle"
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 600, fill: darkMode ? '#ffffff' : '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}>
                    {legendTitle}
                  </text>
                )}
              </g>
            ) : null}
          </>
        )}

        {/* NA legend */}
        {naInfo && naInfo.count > 0 && showNALegend && (
          <g className="na-legend" transform={`translate(${isMobile ? 10 : 320}, ${isMobile ? 400 : 1050})`}>
            <rect width={isMobile ? 150 : 220} height={isMobile ? 30 : 35} fill="white" stroke="#d1d5db" strokeWidth={1} rx={4} />
            <rect x={5} y={isMobile ? 8 : 10} width={isMobile ? 15 : 20} height={isMobile ? 15 : 15} fill="white" stroke="#9ca3af" strokeWidth={1} />
            <text x={isMobile ? 25 : 30} y={isMobile ? 19 : 22}
              style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 11 : 13, fill: darkMode ? '#ffffff' : '#374151' }}>
              {`NA (${naInfo.count} ${naInfo.count === 1 ? 'pincode' : 'pincodes'})`}
            </text>
            <g onClick={() => setShowNALegend(false)} style={{ cursor: 'pointer' }} transform={`translate(${isMobile ? 135 : 200}, ${isMobile ? 8 : 10})`}>
              <circle r={isMobile ? 6 : 8} fill="#ef4444" opacity={0.8} />
              <text textAnchor="middle" dy={isMobile ? 3 : 4}
                style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 'bold', fill: 'white' }}>
                x
              </text>
            </g>
          </g>
        )}
      </svg>

      {/* Hover tooltip */}
      {hoveredPincode && (
        <div
          className="absolute top-2 left-7 rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
          style={{
            backgroundColor: darkMode ? 'hsl(25, 8%, 11%)' : 'hsl(38, 30%, 99%)',
            border: `1px solid ${darkMode ? 'hsl(25, 8%, 18%)' : 'hsl(35, 18%, 84%)'}`,
            color: darkMode ? 'hsl(35, 12%, 90%)' : 'hsl(28, 20%, 14%)',
          }}
        >
          <div className="font-medium text-sm">{hoveredPincode.pincode}</div>
          {hoveredPincode.officeName && (
            <div className="text-xs mt-0.5" style={{ color: darkMode ? 'hsl(30, 8%, 62%)' : 'hsl(28, 10%, 46%)' }}>
              {hoveredPincode.officeName}
            </div>
          )}
          {hoveredPincode.district && (
            <div className="text-xs mt-0.5" style={{ color: darkMode ? 'hsl(30, 8%, 55%)' : 'hsl(28, 10%, 46%)' }}>
              {hoveredPincode.district}, {hoveredPincode.state}
            </div>
          )}
          {hoveredPincode.value !== undefined && (
            <div className="text-xs mt-0.5" style={{ color: darkMode ? 'hsl(30, 8%, 62%)' : 'hsl(28, 10%, 46%)' }}>
              {typeof hoveredPincode.value === 'number' ? roundToSignificantDigits(hoveredPincode.value) : String(hoveredPincode.value)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

IndiaPincodesMap.displayName = 'IndiaPincodesMap';
