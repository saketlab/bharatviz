import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import * as d3 from 'd3';
import { ColorScale, ColorBarSettings } from './ColorMapChooser';
import { isColorDark, roundToSignificantDigits } from '@/lib/colorUtils';
import { getColorForValue, getDiscreteLegendStops } from '@/lib/discreteColorUtils';
import { DiscreteLegend } from '@/lib/discreteLegend';
import { GeoJSON } from 'geojson';
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
  value: number;
}

interface IndiaMapProps {
  data: MapData[];
  colorScale?: ColorScale;
  invertColors?: boolean;
  hideStateNames?: boolean;
  hideValues?: boolean;
  dataTitle?: string;
  colorBarSettings?: ColorBarSettings;
}

export interface IndiaMapRef {
  exportPNG: () => void;
  exportSVG: () => void;
  exportPDF: () => void;
  downloadCSVTemplate: () => void;
}

export const IndiaMap = forwardRef<IndiaMapRef, IndiaMapProps>(({ data, colorScale = 'spectral', invertColors = false, hideStateNames = false, hideValues = false, dataTitle = '', colorBarSettings }, ref) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [mapData, setMapData] = useState<GeoJSON.FeatureCollection | null>(null);

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
  const [hoveredState, setHoveredState] = useState<{ state: string; value?: number } | null>(null);

  const [editingMainTitle, setEditingMainTitle] = useState(false);
  const [mainTitle, setMainTitle] = useState('BharatViz (double-click to edit)');

  const [titlePosition, setTitlePosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [draggingTitle, setDraggingTitle] = useState(false);
  const [titleDragOffset, setTitleDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const isMobile = useIsMobile();

  useEffect(() => {
    setLegendPosition(isMobile ? { x: -10, y: 160 } : DEFAULT_LEGEND_POSITION.STATES);
  }, [isMobile]);

  useEffect(() => {
    if (dataTitle) {
      setLegendTitle(dataTitle);
    }
  }, [dataTitle]);

  const exportPNG = () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    // High DPI settings for 300 DPI output
    const dpiScale = 300 / 96; // 300 DPI vs standard 96 DPI
    const originalWidth = isMobile ? 350 : 800;
    const originalHeight = isMobile ? 350 : 800;
    
    canvas.width = originalWidth * dpiScale;
    canvas.height = originalHeight * dpiScale;
    
    img.onload = () => {
      if (ctx) {
        // Scale the context to match the DPI
        ctx.scale(dpiScale, dpiScale);
        
        // Fill background with white
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, originalWidth, originalHeight);
        
        // Draw the image at original size (context scaling handles the DPI)
        ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `bharatviz-states-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
          }
        });
      }
    };
    
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    img.src = url;
  };

  const exportSVG = () => {
    if (!svgRef.current) return;
    
    const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
    svgClone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    
    // Ensure consistent font handling
    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as SVGElement;
      if (element.tagName === 'text') {
        // Use both attribute and style to ensure compatibility
        element.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
        element.style.fontFamily = 'Arial, Helvetica, sans-serif';
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

  // Helper function to fix legend gradient in cloned SVG by replacing with solid color rectangles
  const fixLegendGradient = (svgClone: SVGSVGElement) => {
    if (data.length === 0) return;
    
    // Get the appropriate D3 color interpolator
    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
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
    
    // Calculate color scale values
    const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;
    const colorInterpolator = getColorInterpolator(colorScale);
    const colorScaleFunction = d3.scaleSequential(colorInterpolator)
      .domain([minValue, maxValue]);
    
    // Find the legend rectangle that uses the gradient
    const legendRect = svgClone.querySelector('rect[fill*="states-legend-gradient"]');
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
          const color = colorScaleFunction(value);
          
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
    const gradients = svgClone.querySelectorAll('#states-legend-gradient');
    gradients.forEach(gradient => gradient.remove());
  };

  const exportPDF = async () => {
    if (!svgRef.current) return;
    
    try {
      // Dynamically import PDF libraries
      const [{ default: jsPDF }, { svg2pdf }] = await Promise.all([
        import('jspdf'),
        import('svg2pdf.js')
      ]);
      
      // Create PDF document
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      // Get the actual SVG dimensions
      const svgWidth = isMobile ? 350 : 800;
      const svgHeight = isMobile ? 350 : 800;
      
      // Clone the SVG to avoid modifying the original
      const svgClone = svgRef.current.cloneNode(true) as SVGSVGElement;
      
      // Ensure the cloned SVG has proper attributes for full capture
      svgClone.setAttribute('width', svgWidth.toString());
      svgClone.setAttribute('height', svgHeight.toString());
      svgClone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
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
      });
      
      // Fix the legend gradient to match the selected color scale
      fixLegendGradient(svgClone);
      
      // Calculate PDF margins and available space
      const pdfMargin = 15; // 15mm margin
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
        xOffset: x,
        yOffset: y,
        scale: scale,
        preserveAspectRatio: 'xMidYMid meet',
        width: finalWidth,
        height: finalHeight
      });
      
      // Save the PDF
      pdf.save(`bharatviz-states-${Date.now()}.pdf`);
      
    } catch (error) {
      // Fallback to raster PDF if vector conversion fails
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

  // Fallback raster PDF export method
  const exportFallbackPDF = async () => {
    if (!svgRef.current) return;
    
    const svg = svgRef.current;
    
    // Create a clean SVG clone for raster export
    const svgClone = svg.cloneNode(true) as SVGSVGElement;
    const svgWidth = isMobile ? 350 : 800;
    const svgHeight = isMobile ? 350 : 800;
    
    // Ensure proper dimensions and viewBox
    svgClone.setAttribute('width', svgWidth.toString());
    svgClone.setAttribute('height', svgHeight.toString());
    svgClone.setAttribute('viewBox', `0 0 ${svgWidth} ${svgHeight}`);
    svgClone.removeAttribute('class');
    
    // Force all elements to be visible and properly positioned
    const allElements = svgClone.querySelectorAll('*');
    allElements.forEach(el => {
      const element = el as SVGElement;
      element.style.visibility = 'visible';
      element.style.display = 'block';
      // Ensure text elements are properly rendered with consistent font
      if (element.tagName === 'text') {
        // Use both attribute and style to ensure compatibility
        element.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
        element.style.fontFamily = 'Arial, Helvetica, sans-serif';
      }
    });
    
    // Fix the legend gradient to match the selected color scale
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
          // Dynamically import jsPDF for fallback
          const { default: jsPDF } = await import('jspdf');
          
          // Use very high resolution for crisp output
          const dpiScale = 8; // 8x resolution for maximum quality
          canvas.width = svgWidth * dpiScale;
          canvas.height = svgHeight * dpiScale;
          
          if (ctx) {
            // Set high quality rendering
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
            const margin = 15; // 15mm margin
            
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

  // Final fallback using html2canvas for maximum compatibility
  const exportHtml2CanvasPDF = async () => {
    if (!svgRef.current) return;
    
    try {
      // Dynamically import libraries
      const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
        import('jspdf'),
        import('html2canvas')
      ]);
      
      // Use html2canvas to render the SVG element
      const canvas = await html2canvas(svgRef.current, {
        backgroundColor: '#ffffff',
        scale: 4, // High resolution
        useCORS: true,
        allowTaint: false,
        logging: false,
        width: isMobile ? 350 : 800,
        height: isMobile ? 350 : 800,
        onclone: (clonedDoc) => {
          // Ensure all elements are visible in the clone
          const clonedSvg = clonedDoc.querySelector('svg');
          if (clonedSvg) {
            const allElements = clonedSvg.querySelectorAll('*');
            allElements.forEach(el => {
              const element = el as SVGElement;
              element.style.visibility = 'visible';
              element.style.display = 'block';
            });
            
            // Fix the legend gradient to match the selected color scale
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
      const margin = 15; // 15mm margin
      
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
    downloadCSVTemplate,
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
      } catch (error) {
        // Map data loading failed - component will show loading state
      }
    };

    loadMapData();
  }, []);

  useEffect(() => {
    if (!mapData || !svgRef.current) return;
    
    // Check if mapData has features property
    if (!mapData.features || !Array.isArray(mapData.features)) {
      // Invalid GeoJSON data - skip rendering
      return;
    }

    try {
      const svg = d3.select(svgRef.current);
    
    // Only remove map content, not legend
    svg.selectAll(".map-content").remove();

    const width = isMobile ? 350 : 800;
    const height = isMobile ? 350 : 800;
    const margin = { top: isMobile ? 50 : 70, right: 20, bottom: isMobile ? 50 : 70, left: 20 };

    svg.attr("width", width).attr("height", height);

    // Create projection
    const projection = d3.geoMercator()
      .fitSize([width - margin.left - margin.right, height - margin.top - margin.bottom], mapData);

    const path = d3.geoPath().projection(projection);

    // Create data map for quick lookup (normalize state names for better matching)
    const dataMap = new Map(data.map(d => [d.state.toLowerCase().trim(), d.value]));

    // Get the appropriate D3 color interpolator
    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
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

    // Create color scale only if we have data
    let colorScaleFunction;
    if (data.length > 0) {
      const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
      const minValue = values.length > 0 ? Math.min(...values) : 0;
      const maxValue = values.length > 0 ? Math.max(...values) : 1;
      
      
      // Check if it's a diverging scale
      const divergingScales = ['rdylbu', 'rdylgn', 'spectral', 'brbg', 'piyg', 'puor'];
      const isDiverging = divergingScales.includes(colorScale);
      
      if (isDiverging) {
        // For diverging scales, use the full range with center at midpoint
        const midpoint = (minValue + maxValue) / 2;
        colorScaleFunction = d3.scaleSequential(getColorInterpolator(colorScale))
          .domain([minValue, maxValue]);
      } else {
        // For sequential scales, use normal domain
        colorScaleFunction = d3.scaleSequential(getColorInterpolator(colorScale))
          .domain([minValue, maxValue]);
      }
    }

    const g = svg.append("g")
      .attr("class", "map-content")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Draw states
    g.selectAll("path")
      .data(mapData.features)
      .enter()
      .append("path")
      .attr("d", path)
      .attr("fill", (d: GeoJSON.Feature) => {
        // If no data, show all states as white
        if (data.length === 0) {
          return "#ffffff";
        }
        
        // Try different possible field names for state
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);

        if (value === undefined) {
          return "#e5e7eb"; // Light gray for no data
        }

        // Use the new discrete color utility
        const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
        return getColorForValue(value, values, colorScale, invertColors, colorBarSettings);
      })
      .attr("stroke", (d: GeoJSON.Feature) => {
        // If no data, use default gray stroke
        if (data.length === 0) {
          return "#0f172a";
        }
        
        // Try different possible field names for state
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);
        
        if (value === undefined || isNaN(value)) {
          return "#0f172a"; // Default gray for no data or NaN
        }
        
        if (colorScaleFunction) {
          const fillColor = colorScaleFunction(value);
          return fillColor === "#ffffff" || !isColorDark(fillColor) ? "#0f172a" : "#ffffff";
        }
        
        return "#0f172a";
      })
      .attr("stroke-width", 0.5)
      .style("cursor", "pointer")
      .on("mouseenter", function(event: MouseEvent, d: GeoJSON.Feature) {
        // Get state name and value for hover
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const originalName = d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM;
        const value = dataMap.get(stateName);
        
        setHoveredState({ 
          state: originalName, 
          value: value 
        });
        
        // Visual feedback - increase stroke width
        d3.select(this)
          .attr("stroke-width", 1.5)
          .style("filter", "brightness(1.1)");
      })
      .on("mouseleave", function() {
        setHoveredState(null);
        
        // Reset visual feedback
        d3.select(this)
          .attr("stroke-width", 0.5)
          .style("filter", null);
      });

    // State name abbreviations
    const stateAbbreviations = STATE_ABBREVIATIONS;

    // Add text labels
    g.selectAll("text")
      .data(mapData.features)
      .enter()
      .append("text")
      .attr("transform", (d: GeoJSON.Feature) => {
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const centroid = path.centroid(d);
        
        // Special positioning for states with external labels
        const externalLabelStates = EXTERNAL_LABEL_STATES;
        if (externalLabelStates.includes(stateName)) {
          // Position labels with specific adjustments for each state
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
            // Default positioning for other external label states
            posX = bounds[0][0] - (isMobile ? 15 : 20);
            posY = (bounds[0][1] + bounds[1][1]) / 2;
          }
          
          return `translate(${posX}, ${posY})`;
        }
        
        // Apply adjustments for normal states (non-external label states)
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
          // Special text anchoring for different positions
          if (stateName === 'mizoram' || stateName === 'lakshadweep' || stateName === 'sikkim' || stateName === 'andhra pradesh' || stateName === 'karnataka' || stateName === 'delhi' || stateName === 'chandigarh' || stateName === 'a & n islands' || stateName === 'andaman and nicobar islands') {
            return "middle"; // Center-aligned for below/above positioning and centered states
          }
          return "start"; // Left-aligned for most external labels
        }
        return "middle";
      })
      .attr("dominant-baseline", "middle")
      .style("font-family", "Arial, Helvetica, sans-serif")
      .style("font-weight", "600")
      .style("pointer-events", "none")
      .each(function(d: GeoJSON.Feature) {
        const text = d3.select(this);
        const stateName = (d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM)?.toLowerCase().trim();
        const value = dataMap.get(stateName);
        const originalName = d.properties.state_name || d.properties.NAME_1 || d.properties.name || d.properties.ST_NM;
        
        // Only show labels if we have data
        if (data.length > 0 && value !== undefined && originalName) {
          // Calculate appropriate font size based on path bounds
          const bounds = path.bounds(d);
          const width = bounds[1][0] - bounds[0][0];
          const height = bounds[1][1] - bounds[0][1];
          const area = width * height;
          let fontSize = Math.sqrt(area) / (isMobile ? 16 : 12);
          fontSize = Math.max(isMobile ? 5 : 7, Math.min(isMobile ? 10 : 14, fontSize));
          
          // Special handling for smaller states - reduce text size
          const smallerStates = ['delhi', 'chandigarh', 'sikkim', 'tripura', 'manipur', 'mizoram', 'nagaland', 'meghalaya', 'puducherry', 'lakshadweep'];
          if (smallerStates.includes(stateName)) {
            fontSize = Math.max(isMobile ? 4 : 6, fontSize * 0.7);
          }
          
          // States that need forced black text (small states with external labels)
          const blackTextStates = BLACK_TEXT_STATES;
          // States with abbreviated names that can use normal color detection
          const abbreviatedStates = ABBREVIATED_STATES;
          let textColor, valueColor;
          if (blackTextStates.includes(stateName)) {
            // Special font sizes for specific states
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
            textColor = "#000000"; // Black text for white background
            valueColor = "#000000";
          } else if (abbreviatedStates.includes(stateName)) {
            // States with abbreviated names - use smaller font size
            if (stateName === 'karnataka') {
              fontSize = isMobile ? 5 : 8; // Standard size for Karnataka
            }
            
            // States with external positioning but automatic color detection
            const backgroundColor = colorScaleFunction ? colorScaleFunction(value) : "#e5e7eb";
            textColor = isColorDark(backgroundColor) ? "#ffffff" : "#1f2937";
            valueColor = textColor;
          } else {
            if (stateName === 'rajasthan') {
              fontSize = Math.max(8, fontSize * 0.7);
            } else if (stateName === 'andhra pradesh') {
              // Andhra Pradesh is abbreviated to "Andhra" - reduce font size to match Telangana
              fontSize = Math.max(isMobile ? 5 : 7, fontSize * 0.8);
            }
            const backgroundColor = colorScaleFunction ? colorScaleFunction(value) : "#e5e7eb";
            textColor = isColorDark(backgroundColor) ? "#ffffff" : "#1f2937";
            valueColor = textColor;
          }
          
          const displayName = stateAbbreviations[stateName] || originalName;
          if (!hideStateNames) {
            // Add state name
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "-0.4em")
              .style("font-size", `${fontSize}px`)
              .style("font-weight", "600")
              .style("fill", textColor)
              .text(displayName);
          }
          if (!hideValues && !hideStateNames) {
            // Add value
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "1.3em")
              .style("font-size", `${fontSize * 0.85}px`)
              .style("font-weight", "700")
              .style("fill", valueColor)
              .text(roundToSignificantDigits(value));
          } else if (hideStateNames && !hideValues) {
            // Only value, centered vertically
            text.append("tspan")
              .attr("x", 0)
              .attr("dy", "0.4em")
              .style("font-size", `${fontSize * 0.95}px`)
              .style("font-weight", "700")
              .style("fill", valueColor)
              .text(roundToSignificantDigits(value));
          }
        }
      });

    // Legend will be handled by separate effect
    } catch (error) {
      // Map rendering failed - component will continue to show current state
    }

  }, [mapData, data, colorScale, invertColors, hideStateNames, hideValues, isMobile, colorBarSettings]);

  // Legend values from data
  useEffect(() => {
    if (data.length > 0) {
      const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
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
  }, [data]);

  // D3 gradient for legend (only for continuous mode)
  useEffect(() => {
    
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    // Always remove existing gradient first
    svg.selectAll('#states-legend-gradient').remove();
    
    // If no data or discrete mode, don't create gradient
    if (data.length === 0 || colorBarSettings?.isDiscrete) {
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
    
    // Color scale - continuous mode only
    const values = data.map(d => d.value).filter(v => !isNaN(v) && isFinite(v));
    const minValue = values.length > 0 ? Math.min(...values) : 0;
    const maxValue = values.length > 0 ? Math.max(...values) : 1;
    const getColorInterpolator = (scale: ColorScale) => {
      const interpolators = {
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
      const color = colorScaleFunction(value);
      gradient.append('stop')
        .attr('offset', `${t * 100}%`)
        .attr('stop-color', color);
    }
  }, [colorScale, invertColors, data, colorBarSettings]);

  // Drag handlers
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
    if (!dragging) return;
    const svgRect = svgRef.current?.getBoundingClientRect();
    if (svgRect) {
      setLegendPosition({
        x: e.clientX - svgRect.left - dragOffset.x,
        y: e.clientY - svgRect.top - dragOffset.y
      });
    }
  }, [dragging, dragOffset]);
  const handleLegendMouseUp = () => setDragging(false);

  // Attach global mousemove/mouseup for drag
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
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentX = isMobile ? 175 : 400;
    const currentY = isMobile ? 35 : 60;
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
    const touch = e.touches[0];
    const svgRect = svgRef.current.getBoundingClientRect();
    const currentX = isMobile ? 175 : 400;
    const currentY = isMobile ? 35 : 60;
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
      <svg
        ref={svgRef}
        className="max-w-full h-auto border rounded-lg"
        width={isMobile ? 350 : MAP_DIMENSIONS.STATES.width}
        height={isMobile ? 350 : MAP_DIMENSIONS.STATES.height}
        style={{ userSelect: 'none' }}
        viewBox={isMobile ? "0 0 350 350" : `0 0 ${MAP_DIMENSIONS.STATES.width} ${MAP_DIMENSIONS.STATES.height}`}
      >
        {/* Legend overlay (React) */}
        {data.length > 0 && (
          <>
            {/* Discrete Legend */}
            {colorBarSettings?.isDiscrete ? (
              <DiscreteLegend
                data={data.map(d => d.value)}
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
              />
            ) : (
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
                  fill="url(#states-legend-gradient)"
                  stroke="#374151"
                  strokeWidth={0.5}
                  rx={3}
                />
                {/* Min value */}
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
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMin(true); }}
                  >
                    {legendMin}
                  </text>
                )}
                {/* Mean value */}
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
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMean(true); }}
                  >
                    {legendMean}
                  </text>
                )}
                {/* Max value */}
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
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 10 : 12, fontWeight: 500, fill: '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingMax(true); }}
                  >
                    {legendMax}
                  </text>
                )}
                {/* Title */}
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
                    style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: isMobile ? 11 : 13, fontWeight: 600, fill: '#374151', cursor: 'pointer' }}
                    onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true); }}
                  >
                    {legendTitle}
                  </text>
                )}
              </g>
            )}
          </>
        )}
        
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
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontSize: isMobile ? 16 : 20,
                fontWeight: 700,
                fill: '#1f2937',
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
      </svg>
      
      {/* Hover Tooltip */}
      {hoveredState && (
        <div className="absolute top-2 left-7 bg-white border border-gray-300 rounded-lg p-3 shadow-lg z-10 pointer-events-none">
          <div className="font-medium">{hoveredState.state}</div>
          {hoveredState.value !== undefined && (
            <div className="text-xs">{roundToSignificantDigits(hoveredState.value)}</div>
          )}
        </div>
      )}
    </div>
  );
});
