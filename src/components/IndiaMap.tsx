import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useDarkMode } from '@/hooks/useDarkMode';
import { getMapTheme } from '@/lib/mapTheme';
import * as d3 from 'd3';
import { ColorScale, ColorBarSettings } from './ColorMapChooser';
import { isColorDark, roundToSignificantDigits, resolveBoundaryStroke, type BoundaryColor } from '@/lib/colorUtils';
import { getColorForValue, getDiscreteLegendStops } from '@/lib/discreteColorUtils';
import { DiscreteLegend } from '@/lib/discreteLegend';
import { CategoricalLegend } from '@/lib/categoricalLegend';
import { GeoJSON } from 'geojson';
import { DataType, CategoryColorMapping, getCategoryColor, getUniqueCategories } from '@/lib/categoricalUtils';
import { svgToHighDpiBlob } from '@/lib/exportUtils';
import { 
  BLACK_TEXT_STATES, 
  ABBREVIATED_STATES, 
  EXTERNAL_LABEL_STATES, 
  STATE_ABBREVIATIONS,
  MAP_DIMENSIONS,
  DEFAULT_LEGEND_POSITION,
  DATA_FILES,
  EXPORT_FILENAMES
} from '@/lib/constants';

interface MapData {
  state: string;
  value: number | string;
}

interface NAInfo {
  states?: string[];
  districts?: Array<{ state: string; district: string }>;
  count: number;
}

interface IndiaMapProps {
  data: MapData[];
  colorScale?: ColorScale;
  invertColors?: boolean;
  hideStateNames?: boolean;
  hideValues?: boolean;
  dataTitle?: string;
  mapTitle?: string;
  colorBarSettings?: ColorBarSettings;
  dataType?: DataType;
  categoryColors?: CategoryColorMapping;
  naInfo?: NAInfo;
  darkMode?: boolean;
  boundaryColor?: BoundaryColor;
  boundaryWidth?: number;
}

export interface IndiaMapRef {
  exportPNG: () => void;
  exportSVG: () => void;
  exportPDF: () => void;
  copyToClipboard: () => void;
  downloadCSVTemplate: () => void;
  getSVGElement: () => SVGSVGElement | null;
}

export const IndiaMap = forwardRef<IndiaMapRef, IndiaMapProps>(({ data, colorScale = 'spectral', invertColors = false, hideStateNames = false, hideValues = false, dataTitle = '', mapTitle, colorBarSettings, dataType = 'numerical', categoryColors = {}, naInfo, darkMode: darkModeProp, boundaryColor = 'auto', boundaryWidth = 0.3 }, ref) => {
  const { dark: darkModeHook } = useDarkMode();
  const darkMode = darkModeProp !== undefined ? darkModeProp : darkModeHook;
  const svgRef = useRef<SVGSVGElement>(null);
  const boundaryWidthRef = useRef(boundaryWidth);
  boundaryWidthRef.current = boundaryWidth;
  const dragRafRef = useRef<number | null>(null);
  const [mapData, setMapData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [renderingData, setRenderingData] = useState(false);

  const [legendPosition, setLegendPosition] = useState<{ x: number; y: number }>(DEFAULT_LEGEND_POSITION.STATES);
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
  const [hoveredState, setHoveredState] = useState<{ state: string; value?: number | string } | null>(null);

  const [editingMainTitle, setEditingMainTitle] = useState(false);
  const [mainTitle, setMainTitle] = useState('BharatViz (double-click to edit)');

  const [titlePosition, setTitlePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingTitle, setDraggingTitle] = useState(false);
  const [titleDragOffset, setTitleDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const [showNALegend, setShowNALegend] = useState(true);

  const isMobile = useIsMobile();
  const mapBg = darkMode ? 'hsl(25, 8%, 6%)' : 'hsl(38, 30%, 97%)';
  const labelColor = darkMode ? '#e8e0d4' : '#374151';
  const labelSecondaryColor = darkMode ? '#8a7f72' : '#6b7280';

  useEffect(() => {
    setLegendPosition(isMobile ? { x: 10, y: 290 } : DEFAULT_LEGEND_POSITION.STATES);
  }, [isMobile]);

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

  const getMapDimensions = () => ({
    width: isMobile ? 350 : 800,
    height: isMobile ? 350 : 800,
  });

  const exportPNG = () => {
    if (!svgRef.current) return;
    const { width, height } = getMapDimensions();
    svgToHighDpiBlob(svgRef.current, { width, height }).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bharatviz-states-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
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

  const exportSVG = () => {
    if (!svgRef.current) return;
    
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as SVGElement;
      if (element.tagName === 'text') {
        element.setAttribute('font-family', "'DM Sans', Arial, sans-serif");
        element.style.fontFamily = "'DM Sans', Arial, sans-serif";
      }
    });
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `bharatviz-states-${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const fixLegendGradient = (svgClone: SVGSVGElement) => {
    if (data.length === 0) return;

    const getAQIColorAbsolute = (value: number): string => {
      if (value <= 50) return '#10b981';
      if (value <= 100) return '#84cc16';
      if (value <= 200) return '#eab308';
      if (value <= 300) return '#f97316';
      if (value <= 400) return '#ef4444';
      return '#991b1b';
    };

    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
        aqi: (t: number) => d3.interpolateBlues(t), // Placeholder, won't be used with AQI
        blues: d3.interpolateBlues,
        greens: d3.interpolateGreens,
        reds: d3.interpolateReds,
        oranges: d3.interpolateOranges,
        purples: d3.interpolatePurples,
        pinks: d3.interpolatePuRd,
        viridis: d3.interpolateViridis,
        plasma: d3.interpolatePlasma,
        inferno: d3.interpolateInferno,
        magma: d3.interpolateMagma,
        rdylbu: d3.interpolateRdYlBu,
        rdylgn: d3.interpolateRdYlGn,
        spectral: (t: number) => d3.interpolateSpectral(1 - t), // Inverted so blue=low, red=high
        brbg: d3.interpolateBrBG,
        piyg: d3.interpolatePiYG,
        puor: d3.interpolatePuOr
      };
      const baseInterpolator = interpolators[scale] || d3.interpolateBlues;
      return invertColors ? (t: number) => baseInterpolator(1 - t) : baseInterpolator;
    };

    const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;
    const colorInterpolator = getColorInterpolator(colorScale);
    const colorScaleFunction = d3.scaleSequential(colorInterpolator)
      .domain([minValue, maxValue]);

    const legendRect = svgClone.querySelector('rect[fill*="states-legend-gradient"]');
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
          const value = minValue + t * (maxValue - minValue);
          const color = colorScale === 'aqi' ? getAQIColorAbsolute(value) : colorScaleFunction(value);

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

    const gradients = svgClone.querySelectorAll('#states-legend-gradient');
    gradients.forEach(gradient => gradient.remove());
  };

  const exportPDF = async () => {
    if (!svgRef.current) return;

    try {
      const [{ default: jsPDF }, { svg2pdf }] = await Promise.all([
        import('jspdf'),
        import('svg2pdf.js')
      ]);

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const svgWidth = isMobile ? 350 : 800;
      const svgHeight = isMobile ? 350 : 800;

      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;

      svgClone.setAttribute('width', svgWidth.toString());
      svgClone.setAttribute('height', svgHeight.toString());
      svgClone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
      svgClone.style.width = `${svgWidth}px`;
      svgClone.style.height = `${svgHeight}px`;

      svgClone.removeAttribute('class');

      const allElements = svgClone.querySelectorAll('*');
      allElements.forEach(el => {
        const element = el as SVGElement;
        element.style.visibility = 'visible';
        element.style.display = 'block';
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
      const x = (pdfWidth - finalWidth) / 2;
      const y = (pdfHeight - finalHeight) / 2;


      await svg2pdf(svgClone, pdf, {
        xOffset: x,
        yOffset: y,
        scale: scale,
        preserveAspectRatio: 'xMidYMid meet',
        width: finalWidth,
        height: finalHeight
      });
      pdf.save(`bharatviz-states-${Date.now()}.pdf`);
      
    } catch (error) {
      try {
        await exportFallbackPDF();
      } catch (fallbackError) {
        try {
          await exportHtml2CanvasPDF();
        } catch (html2canvasError) {
          alert('Failed to export PDF. Please try using SVG export instead.');
        }
      }
    }
  };

  const exportFallbackPDF = async () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    const svgWidth = isMobile ? 350 : 800;
    const svgHeight = isMobile ? 350 : 800;
    
    svgClone.setAttribute('width', svgWidth.toString());
    svgClone.setAttribute('height', svgHeight.toString());
    svgClone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svgClone.removeAttribute('class');
    
    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as SVGElement;
      element.style.visibility = 'visible';
      element.style.display = 'block';
      if (element.tagName === 'text') {
        element.setAttribute('font-family', "'DM Sans', Arial, sans-serif");
        element.style.fontFamily = "'DM Sans', Arial, sans-serif";
      }
    });
    
    fixLegendGradient(svgClone);
    
    const svgData = new XMLSerializer().serializeToString(svgClone);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    return new Promise<void>((resolve, reject) => {
      img.onload = async () => {
        try {
          const { default: jsPDF } = await import('jspdf');
          const dpiScale = 8;
          canvas.width = svgWidth * dpiScale;
          canvas.height = svgHeight * dpiScale;
          
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            
            ctx.scale(dpiScale, dpiScale);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, svgWidth, svgHeight);
            ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
            
            const imgData = canvas.toDataURL('image/png', 1.0);
            
            const pdf = new jsPDF({
              orientation: 'landscape',
              unit: 'mm',
              format: 'a4'
            });
            
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();
            const margin = 15;
            
            const availableWidth = pdfWidth - (2 * margin);
            const availableHeight = pdfHeight - (2 * margin);
            
            const imgAspectRatio = svgWidth / svgHeight;
            const availableAspectRatio = availableWidth / availableHeight;
            
            let imgWidth, imgHeight;
            if (imgAspectRatio > availableAspectRatio) {
              imgWidth = availableWidth;
              imgHeight = availableWidth / imgAspectRatio;
            } else {
              imgHeight = availableHeight;
              imgWidth = availableHeight * imgAspectRatio;
            }
            
            const x = (pdfWidth - imgWidth) / 2;
            const y = (pdfHeight - imgHeight) / 2;
            
            
            pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
            pdf.save(`bharatviz-states-${Date.now()}.pdf`);
            resolve();
          } else {
            reject(new Error('Could not get canvas context'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load SVG'));
      img.src = url;
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  };

  const exportHtml2CanvasPDF = async () => {
    if (!svgRef.current) return;
    
    try {
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
      
      const canvas = await html2canvas(svgRef.current, {
        backgroundColor: '#ffffff',
        scale: 4, // High resolution
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: isMobile ? 350 : 800,
        height: isMobile ? 350 : 800,
        onclone: (clonedDoc) => {
          const clonedSvg = clonedDoc.querySelector('svg');
          if (clonedSvg) {
            const allElements = clonedSvg.querySelectorAll('*');
            allElements.forEach(el => {
              const element = el as SVGElement;
              element.style.visibility = 'visible';
              element.style.display = 'block';
            });
            fixLegendGradient(clonedSvg);
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      
      const availableWidth = pdfWidth - (2 * margin);
      const availableHeight = pdfHeight - (2 * margin);
      
      const imgAspectRatio = canvas.width / canvas.height;
      const availableAspectRatio = availableWidth / availableHeight;
      
      let imgWidth, imgHeight;
      if (imgAspectRatio > availableAspectRatio) {
        imgWidth = availableWidth;
        imgHeight = availableWidth / imgAspectRatio;
      } else {
        imgHeight = availableHeight;
        imgWidth = availableHeight * imgAspectRatio;
      }
      
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;
      
      
      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
      pdf.save(`bharatviz-states-${Date.now()}.pdf`);

    } catch (error) {
      console.error('Error exporting PDF with html2canvas:', error);
      throw error;
    }
  };

  const downloadCSVTemplate = () => {
    const stateNames = [
      'A & N Islands',
      'Andhra Pradesh', 
      'Arunachal Pradesh',
      'Assam',
      'Bihar',
      'Chandigarh',
      'Chhattisgarh',
      'Delhi',
      'DNHDD',
      'Goa',
      'Gujarat',
      'Haryana',
      'Himachal Pradesh',
      'Jammu & Kashmir',
      'Jharkhand',
      'Karnataka',
      'Kerala',
      'Ladakh',
      'Lakshadweep',
      'Madhya Pradesh',
      'Maharashtra',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Odisha',
      'Puducherry',
      'Punjab',
      'Rajasthan',
      'Sikkim',
      'Tamil Nadu',
      'Telangana',
      'Tripura',
      'Uttar Pradesh',
      'Uttarakhand',
      'West Bengal'
    ];

    const csvContent = 'state,value\n' + stateNames.map(state => `${state},NA`).join('\n');
    const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(csvBlob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'india-states-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  useImperativeHandle(ref, () => ({
    exportPNG,
    exportSVG,
    exportPDF,
    copyToClipboard,
    downloadCSVTemplate,
    getSVGElement: () => svgRef.current,
  }));

  useEffect(() => {
    const loadMapData = async () => {
      try {
        const response = await fetch(DATA_FILES.STATES_GEOJSON);
        if (!response.ok) {
          throw new Error(`Failed to load map data: ${response.status} ${response.statusText}`);
        }
        
        const geoData = await response.json();
        setMapData(geoData);
      } catch (_) {
        // ignore fetch errors
      }
    };

    loadMapData();
  }, []);

  useEffect(() => {
    if (!mapData || !svgRef.current) return;

    if (!mapData.features || !Array.isArray(mapData.features)) {
      return;
    }

    setRenderingData(true);
    const theme = getMapTheme(darkMode);

    try {
      const svg = d3.select(svgRef.current);

    svg.selectAll(".map-content").remove();

    const width = isMobile ? 350 : 800;
    const height = isMobile ? 350 : 800;
    const margin = { top: isMobile ? 50 : 70, right: 20, bottom: isMobile ? 50 : 70, left: 20 };

    svg.attr("width", width).attr("height", height);

    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], mapData);

    const path = d3.geoPath().projection(projection);

    const dataMap = new Map(data.map(d => [d.state.toLowerCase().trim(), d.value]));

    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
        aqi: (t: number) => d3.interpolateBlues(t),
        blues: d3.interpolateBlues,
        greens: d3.interpolateGreens,
        reds: d3.interpolateReds,
        oranges: d3.interpolateOranges,
        purples: d3.interpolatePurples,
        pinks: d3.interpolatePuRd,
        viridis: d3.interpolateViridis,
        plasma: d3.interpolatePlasma,
        inferno: d3.interpolateInferno,
        magma: d3.interpolateMagma,
        rdylbu: d3.interpolateRdYlBu,
        rdylgn: d3.interpolateRdYlGn,
        spectral: (t: number) => d3.interpolateSpectral(1 - t), // Inverted so blue=low, red=high
        brbg: d3.interpolateBrBG,
        piyg: d3.interpolatePiYG,
        puor: d3.interpolatePuOr
      };
      const baseInterpolator = interpolators[scale] || d3.interpolateBlues;
      return invertColors ? (t: number) => baseInterpolator(1 - t) : baseInterpolator;
    };

    let colorScaleFunction;
    if (data.length > 0) {
      const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 1;
      
      
      const divergingScales = ['rdylbu', 'rdylgn', 'spectral', 'brbg', 'piyg', 'puor'];
      const isDiverging = divergingScales.includes(colorScale);
      
      if (isDiverging) {
        const midpoint = (minValue + maxValue) / 2;
        colorScaleFunction = d3.scaleSequential(getColorInterpolator(colorScale))
          .domain([minValue, maxValue]);
      } else {
        colorScaleFunction = d3.scaleSequential(getColorInterpolator(colorScale))
          .domain([minValue, maxValue]);
      }
    }

    const g = svg.append("g")
      .attr("class", "map-content")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    g.selectAll("path")
      .data(mapData.features)
      .enter()
      .append("path")
      .attr("class", "state-path")
      .attr("d", path)
      .attr("fill", (d: GeoJSON.Feature) => {
        if (data.length === 0) {
          return theme.emptyFill;
        }

        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);

        if (value === undefined) {
          return theme.noDataFill;
        }

        if (dataType === 'categorical' && typeof value === 'string') {
          return getCategoryColor(value, categoryColors, '#e5e7eb');
        }

        const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v)) as number[];
        return getColorForValue(value as number, values, colorScale, invertColors, colorBarSettings);
      })
      .attr("stroke", (d: GeoJSON.Feature) => {
        if (boundaryColor !== 'auto') return resolveBoundaryStroke(boundaryColor, '', darkMode);

        if (data.length === 0) return theme.stroke;

        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);

        if (value === undefined || isNaN(value)) return theme.stroke;

        if (colorScaleFunction) {
          const fillColor = colorScaleFunction(value);
          return resolveBoundaryStroke('auto', fillColor, darkMode);
        }

        return theme.stroke;
      })
      .attr("stroke-width", boundaryWidthRef.current)
      .style("cursor", "pointer")
      .on("mouseenter", function(event: MouseEvent, d: GeoJSON.Feature) {
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const originalName = d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM;
        const value = dataMap.get(stateName);

        setHoveredState({
          state: originalName,
          value: value
        });

        d3.select(this)
          .attr("stroke-width", boundaryWidthRef.current * 5)
          .style("filter", "brightness(1.1)");
      })
      .on("mouseleave", function() {
        setHoveredState(null);

        d3.select(this)
          .attr("stroke-width", boundaryWidthRef.current)
          .style("filter", null);
      });

    const stateAbbreviations = STATE_ABBREVIATIONS;

    g.selectAll("text")
      .data(mapData.features)
      .enter()
      .append("text")
      .attr("transform", (d: GeoJSON.Feature) => {
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const centroid = path.centroid(d);
        
        const externalLabelStates = EXTERNAL_LABEL_STATES;
        if (externalLabelStates.includes(stateName)) {
          const bounds = path.bounds(d);
          let posX, posY;
          
          if (stateName === 'goa') {
            posX = bounds[0][0] - (isMobile ? 12 : 22); // Move Goa text right by another 4
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'dnhdd') {
            posX = bounds[0][0] + (isMobile ? 2 : 5); // Move DNHDD text further to the right
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'kerala') {
            posX = bounds[0][0] - (isMobile ? 6 : 10); // Move Kerala text right by 6
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'nagaland') {
            posX = bounds[1][0] + (isMobile ? 5 : 8); // Move Nagaland text slightly more left
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'tripura') {
            posX = bounds[0][0] - (isMobile ? 5 : 10); // Move Tripura text slightly right
            posY = bounds[1][1] + (isMobile ? 5 : 8); // Move slightly above previous position
          } else if (stateName === 'mizoram') {
            posX = (bounds[0][0] + bounds[1][0]) / 2; // Horizontal center
            posY = bounds[1][1] + (isMobile ? 5 : 8); // Move Mizoram slightly up
          } else if (stateName === 'lakshadweep') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 - (isMobile ? 10 : 15); // Move slightly left from center
            posY = bounds[0][1] - (isMobile ? 10 : 15); // Move above the state
          } else if (stateName === 'manipur') {
            posX = bounds[1][0] + (isMobile ? 3 : 5); // Move Manipur text slightly more left
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'sikkim') {
            posX = (bounds[0][0] + bounds[1][0]) / 2; // Horizontal center
            posY = bounds[0][1] - (isMobile ? 10 : 15); // Move Sikkim text above the state
          } else if (stateName === 'andhra pradesh') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 - (isMobile ? 26 : 36); // Move Andhra text left by 6 more
            posY = (bounds[0][1] + bounds[1][1]) / 2 + (isMobile ? 15 : 20); // Move Andhra text down
          } else if (stateName === 'karnataka') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 - (isMobile ? 8 : 12); // Move Karnataka text very slightly left
            posY = (bounds[0][1] + bounds[1][1]) / 2 + (isMobile ? 3 : 5); // Move Karnataka text slightly down
          } else if (stateName === 'delhi') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 + (isMobile ? 10 : 15); // Move Delhi text very slightly right
            posY = (bounds[0][1] + bounds[1][1]) / 2; // Vertical center
          } else if (stateName === 'chandigarh') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 + (isMobile ? 6 : 9); // Move Chandigarh text more right (northeast)
            posY = (bounds[0][1] + bounds[1][1]) / 2 - (isMobile ? 6 : 9); // Move Chandigarh text more up (northeast)
          } else if (stateName === 'puducherry') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 + (isMobile ? 15 : 22); // Puducherry move more right
            posY = (bounds[0][1] + bounds[1][1]) / 2 + (isMobile ? 26 : 36); // Puducherry move further down
          } else if (stateName === 'a & n islands' || stateName === 'andaman and nicobar islands') {
            posX = (bounds[0][0] + bounds[1][0]) / 2 - (isMobile ? 24 : 39); // Move A&N Islands even further left
            posY = (bounds[0][1] + bounds[1][1]) / 2 + (isMobile ? 3 : 3); // Move A&N Islands down
          } else {
            posX = bounds[0][0] - (isMobile ? 15 : 20);
            posY = (bounds[0][1] + bounds[1][1]) / 2;
          }
          
          return `translate(${posX}, ${posY})`;
        }
        
        if (!externalLabelStates.includes(stateName)) {
          if (stateName === 'west bengal') {
            centroid[1] += (isMobile ? 13 : 13); // Move West Bengal down by 13 (10+3)
            centroid[0] -= (isMobile ? 6.5 : 6.5); // Move West Bengal left by 6.5 (5+1.5)
          } else if (stateName === 'jharkhand') {
            centroid[0] -= (isMobile ? 5 : 5); // Move Jharkhand left by 5
          } else if (stateName === 'maharashtra') {
            centroid[0] -= (isMobile ? 5 : 5); // Move Maharashtra left by 5
          } else if (stateName === 'madhya pradesh') {
            centroid[1] += (isMobile ? 4 : 4); // Move MP down by 4
          } else if (stateName === 'gujarat') {
            centroid[1] -= (isMobile ? 4 : 4); // Move Gujarat up by 4
            centroid[0] += (isMobile ? 4 : 4); // Move Gujarat right by 4
          }
        }
        
        return `translate(${centroid[0]}, ${centroid[1]})`;
      })
      .attr("text-anchor", (d: GeoJSON.Feature) => {
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const externalLabelStates = EXTERNAL_LABEL_STATES;
        if (externalLabelStates.includes(stateName)) {
          if (stateName === 'mizoram' || stateName === 'lakshadweep' || stateName === 'sikkim' || stateName === 'andhra pradesh' || stateName === 'karnataka' || stateName === 'delhi' || stateName === 'chandigarh' || stateName === 'a & n islands' || stateName === 'andaman and nicobar islands') {
            return "middle"; // Center-aligned for below/above positioning and centered states
          }
          return "start"; // Left-aligned for most external labels
        }
        return "middle";
      })
      .attr("dominant-baseline", "middle")
      .style("font-family", "'DM Sans', Arial, sans-serif")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .each(function(d: GeoJSON.Feature) {
        const text = d3.select(this);
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);
        const originalName = d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM;
        
        if (data.length > 0 && value !== undefined && originalName) {
          const bounds = path.bounds(d);
          const width = bounds[1][0] - bounds[0][0];
          const height = bounds[1][1] - bounds[0][1];
          const area = width * height;
          let fontSize = Math.sqrt(area) / (isMobile ? 16 : 12);
          fontSize = Math.max(isMobile ? 5 : 7, Math.min(isMobile ? 10 : 14, fontSize));
          
          const smallerStates = ['delhi', 'chandigarh', 'sikkim', 'tripura', 'manipur', 'mizoram', 'nagaland', 'meghalaya', 'puducherry', 'lakshadweep'];
          if (smallerStates.includes(stateName)) {
            fontSize = Math.max(isMobile ? 4 : 6, fontSize * 0.7);
          }
          
          const blackTextStates = BLACK_TEXT_STATES;
          const abbreviatedStates = ABBREVIATED_STATES;
          let textColor, valueColor;
          if (blackTextStates.includes(stateName)) {
            if (stateName === 'delhi') {
              fontSize = isMobile ? 4 : 6; // Even smaller size for Delhi
            } else if (stateName === 'chandigarh') {
              fontSize = isMobile ? 3 : 5; // Even smaller size for Chandigarh
            } else if (stateName === 'himachal pradesh') {
              fontSize = isMobile ? 4 : 6; // Smaller size for Himachal Pradesh
            } else if (stateName === 'puducherry') {
              fontSize = isMobile ? 5 : 7; // Increased size for Puducherry
            } else if (stateName === 'dnhdd') {
              fontSize = isMobile ? 5 : 7; // Smaller size for DNHDD
            } else if (stateName === 'karnataka') {
              fontSize = isMobile ? 5 : 8; // Slightly larger size for Karnataka (KA)
            } else if (stateName === 'mizoram' || stateName === 'tripura') {
              fontSize = isMobile ? 5 : 7; // Smaller size for Mizoram and Tripura
            } else if (stateName === 'nagaland' || stateName === 'manipur') {
              fontSize = isMobile ? 5 : 7; // Smaller size for Nagaland and Manipur
            } else {
              fontSize = isMobile ? 6 : 9; // Standard size for other external labels
            }
            textColor = "#000000";
            valueColor = "#000000";
          } else if (abbreviatedStates.includes(stateName)) {
            if (stateName === 'karnataka') {
              fontSize = isMobile ? 5 : 8;
            }
            const backgroundColor = colorScaleFunction ? colorScaleFunction(value) : "#e5e7eb";
            textColor = isColorDark(backgroundColor) ? "#ffffff" : "#1f2937";
            valueColor = textColor;
          } else {
            if (stateName === 'rajasthan') {
              fontSize = Math.max(8, fontSize * 0.7);
            } else if (stateName === 'andhra pradesh') {
              fontSize = Math.max(isMobile ? 5 : 7, fontSize * 0.8);
            }
            const backgroundColor = colorScaleFunction ? colorScaleFunction(value) : "#e5e7eb";
            textColor = isColorDark(backgroundColor) ? "#ffffff" : "#1f2937";
            valueColor = textColor;
          }
          
          const displayName = stateAbbreviations[stateName] || originalName;
          if (!hideStateNames) {
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "-0.4em")
              .style("font-size", `${fontSize}px`)
              .style("font-weight", "600")
              .style("fill", textColor)
              .text(displayName);
          }
          if (!hideValues && !hideStateNames) {
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "1.3em")
              .style("font-size", `${fontSize * 0.85}px`)
              .style("font-weight", "700")
              .style("fill", valueColor)
              .text(typeof value === 'number' ? roundToSignificantDigits(value) : String(value));
          } else if (hideStateNames && !hideValues) {
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "0.4em")
              .style("font-size", `${fontSize * 0.95}px`)
              .style("font-weight", "700")
              .style("fill", valueColor)
              .text(typeof value === 'number' ? roundToSignificantDigits(value) : String(value));
          }
        }
      });

    } catch (_) {
      // ignore render errors
    } finally {
      setTimeout(() => {
        setRenderingData(false);
      }, 300);
    }

  }, [mapData, data, colorScale, invertColors, hideStateNames, hideValues, isMobile, colorBarSettings, categoryColors, dataType, darkMode, boundaryColor]);

  useEffect(() => {
    if (!svgRef.current) return;
    d3.select(svgRef.current).selectAll<SVGPathElement, GeoJSON.Feature>('path.state-path')
      .attr('stroke-width', boundaryWidth);
  }, [boundaryWidth]);

  useEffect(() => {
    if (data.length > 0 && dataType === 'numerical') {
      const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v)) as number[];
      if (values.length > 0) {
        const meanValue = values.reduce((a, b) => a + b, 0) / values.length;
        setLegendMin(roundToSignificantDigits(Math.min(...values)));
        setLegendMean(roundToSignificantDigits(meanValue));
        setLegendMax(roundToSignificantDigits(Math.max(...values)));
      } else {
        setLegendMin('0');
        setLegendMean('0.5');
        setLegendMax('1');
      }
    } else {
      setLegendMin('0');
      setLegendMean('0.5');
      setLegendMax('1');
    }
  }, [data, dataType]);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('#states-legend-gradient').remove();
    if (data.length === 0 || colorBarSettings?.isDiscrete || dataType === 'categorical') {
      return;
    }

    let defs = svg.select('defs');
    if (defs.empty()) defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'states-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    const values = data.map(d => d.value).filter(v => typeof v === 'number' && !isNaN(v) && isFinite(v)) as number[];
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;

    const getAQIColorAbsolute = (value: number): string => {
      if (value <= 50) return '#10b981';
      if (value <= 100) return '#84cc16';
      if (value <= 200) return '#eab308';
      if (value <= 300) return '#f97316';
      if (value <= 400) return '#ef4444';
      return '#991b1b';
    };

    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
        aqi: (t: number) => d3.interpolateBlues(t),
        blues: d3.interpolateBlues,
        greens: d3.interpolateGreens,
        reds: d3.interpolateReds,
        oranges: d3.interpolateOranges,
        purples: d3.interpolatePurples,
        pinks: d3.interpolatePuRd,
        viridis: d3.interpolateViridis,
        plasma: d3.interpolatePlasma,
        inferno: d3.interpolateInferno,
        magma: d3.interpolateMagma,
        rdylbu: d3.interpolateRdYlBu,
        rdylgn: d3.interpolateRdYlGn,
        spectral: (t: number) => d3.interpolateSpectral(1 - t), // Inverted so blue=low, red=high
        brbg: d3.interpolateBrBG,
        piyg: d3.interpolatePiYG,
        puor: d3.interpolatePuOr
      };
      const baseInterpolator = interpolators[scale] || d3.interpolateBlues;
      return invertColors ? (t: number) => baseInterpolator(1 - t) : baseInterpolator;
    };
    const colorScaleFunction = d3.scaleSequential(getColorInterpolator(colorScale))
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
  }, [colorScale, invertColors, data, colorBarSettings, dataType, mapData]);

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
  const handleLegendMouseMove = useCallback((e: React.MouseEvent) => {
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
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => handleLegendMouseMove(e as React.MouseEvent<SVGElement>);
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, dragOffset, handleLegendMouseMove]);

  const handleTitleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraggingTitle(true);
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      const currentX = isMobile ? 175 : 400;
      const currentY = isMobile ? 35 : 60;
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
      const currentY = isMobile ? 35 : 60;
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
      const currentY = isMobile ? 35 : 60;
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
      const currentY = isMobile ? 35 : 60;
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

  if (!mapData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-sm text-muted-foreground">Loading map data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full flex justify-center relative">
      {renderingData && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-50 rounded-lg">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm font-medium text-foreground">Rendering data...</p>
          </div>
        </div>
      )}
      {data.length === 0 && !renderingData && (
        <div className="absolute left-0 right-[28%] top-[12%] flex justify-end pointer-events-none z-10">
          <div className="px-3 py-2 rounded-lg bg-[hsl(38,30%,97%)] border border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,16%)]">
            <p className="text-xs font-medium mb-0.5 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">
              Load data to colour the map
            </p>
            <p className="text-xs text-[hsl(28,8%,50%)] dark:text-[hsl(30,8%,52%)]">
              Use <strong>Load Demo</strong> or upload a CSV
            </p>
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        className="max-w-full h-auto"
        width={isMobile ? 350 : MAP_DIMENSIONS.STATES.width}
        height={isMobile ? 350 : MAP_DIMENSIONS.STATES.height}
        style={{ userSelect: 'none', backgroundColor: mapBg }}
        viewBox={isMobile ? "0 0 350 350" : `0 0 ${MAP_DIMENSIONS.STATES.width} ${MAP_DIMENSIONS.STATES.height}`}
        role="img"
        aria-label={mapTitle || dataTitle ? `India states map${mapTitle ? `: ${mapTitle}` : ''}${dataTitle ? ` — ${dataTitle}` : ''}` : 'India states choropleth map'}
      >

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
                  fill="url(#states-legend-gradient)"
                  stroke="#374151"
                  strokeWidth={0.5}
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
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: labelColor, cursor: 'pointer' }}
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
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: labelColor, cursor: 'pointer' }}
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
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: labelColor, cursor: 'pointer' }}
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
                    style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 600, fill: labelColor, cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                  >
                    {legendTitle}
                  </text>
                )}
              </g>
            ) : null}
          </>
        )}
        

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
                  border: '1px solid #ccc',
                  borderRadius: '4px',
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
              x={isMobile ? 175 : 400 + titlePosition.x}
              y={isMobile ? 35 : 60 + titlePosition.y}
              textAnchor="middle"
              style={{
                fontFamily: "'DM Sans', Arial, sans-serif",
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                fill: labelColor,
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


        {naInfo && naInfo.count > 0 && showNALegend && (
          <g
            className="na-legend"
            transform={`translate(${isMobile ? 10 : 560}, ${isMobile ? 310 : 750})`}
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
                fontFamily: "'DM Sans', Arial, sans-serif",
                fontSize: isMobile ? 11 : 13,
                fill: labelColor
              }}
            >
              {naInfo.states
                ? `NA (${naInfo.count} ${naInfo.count === 1 ? 'state' : 'states'})`
                : `NA (${naInfo.count} ${naInfo.count === 1 ? 'district' : 'districts'})`
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
                  fontFamily: "'DM Sans', Arial, sans-serif",
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


      {hoveredState && (
        <div
          className="absolute top-2 left-7 rounded-lg px-3 py-2 shadow-lg z-10 pointer-events-none"
          style={{
            backgroundColor: darkMode ? 'hsl(25, 8%, 11%)' : 'hsl(38, 30%, 99%)',
            border: `1px solid ${darkMode ? 'hsl(25, 8%, 18%)' : 'hsl(35, 18%, 84%)'}`,
            color: darkMode ? 'hsl(35, 12%, 90%)' : 'hsl(28, 20%, 14%)',
          }}
        >
          <div className="font-medium text-sm">{hoveredState.state}</div>
          {hoveredState.value !== undefined && (
            <div className="text-xs mt-0.5" style={{ color: darkMode ? 'hsl(30, 8%, 62%)' : 'hsl(28, 10%, 46%)' }}>
              {typeof hoveredState.value === 'number' ? roundToSignificantDigits(hoveredState.value) : String(hoveredState.value)}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
