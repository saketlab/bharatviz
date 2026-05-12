import * as d3 from 'd3';
import { ColorScale, ColorBarSettings } from '@/components/ColorMapChooser';

export interface DiscreteColorInfo {
  binIndex: number;
  color: string;
  minValue: number;
  maxValue: number;
  displayMinValue: number;
  displayMaxValue: number;
  isFirstBin: boolean;
  isLastBin: boolean;
}

function analyzeDataPrecision(values: number[]): {
  isInteger: boolean;
  minGap: number;
  precision: number;
} {
  if (values.length === 0) {
    return { isInteger: true, minGap: 1, precision: 0 };
  }

  const isInteger = values.every(v => Number.isInteger(v));

  if (isInteger) {
    return { isInteger: true, minGap: 1, precision: 0 };
  }

  let maxDecimalPlaces = 0;
  for (const value of values) {
    const str = value.toString();
    const decimalIndex = str.indexOf('.');
    if (decimalIndex !== -1) {
      maxDecimalPlaces = Math.max(maxDecimalPlaces, str.length - decimalIndex - 1);
    }
  }

  const minGap = Math.pow(10, -maxDecimalPlaces);

  return {
    isInteger: false,
    minGap,
    precision: maxDecimalPlaces
  };
}

export function createDiscreteBins(
  values: number[],
  colorBarSettings: ColorBarSettings
): { boundaries: number[]; binCount: number; dataAnalysis: ReturnType<typeof analyzeDataPrecision> } {
  if (values.length === 0) {
    return {
      boundaries: [0, 1],
      binCount: 1,
      dataAnalysis: { isInteger: true, minGap: 1, precision: 0 }
    };
  }

  const dataAnalysis = analyzeDataPrecision(values);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (minValue === maxValue) {
    return {
      boundaries: [minValue, minValue],
      binCount: 1,
      dataAnalysis
    };
  }

  if (colorBarSettings.useCustomBoundaries && colorBarSettings.customBoundaries.length >= 2) {
    const sortedBoundaries = [...colorBarSettings.customBoundaries].sort((a, b) => a - b);

    if (sortedBoundaries[0] > minValue) {
      sortedBoundaries.unshift(minValue);
    }
    if (sortedBoundaries[sortedBoundaries.length - 1] < maxValue) {
      sortedBoundaries.push(maxValue);
    }

    return {
      boundaries: sortedBoundaries,
      binCount: sortedBoundaries.length - 1,
      dataAnalysis
    };
  }

  const binCount = colorBarSettings.binCount;
  const boundaries: number[] = [];

  for (let i = 0; i <= binCount; i++) {
    boundaries.push(minValue + (i / binCount) * (maxValue - minValue));
  }

  return { boundaries, binCount, dataAnalysis };
}

export function getDiscreteColorInfo(
  value: number,
  boundaries: number[],
  colorScale: ColorScale,
  invertColors: boolean = false,
  dataAnalysis?: ReturnType<typeof analyzeDataPrecision>
): DiscreteColorInfo {
  let binIndex = 0;
  for (let i = 1; i < boundaries.length; i++) {
    if (value <= boundaries[i]) {
      binIndex = i - 1;
      break;
    }
  }

  if (binIndex === boundaries.length - 1) {
    binIndex = boundaries.length - 2;
  }

  const binCount = boundaries.length - 1;

  let color: string;
  if (colorScale === 'aqi') {
    const binMidpoint = (boundaries[binIndex] + boundaries[binIndex + 1]) / 2;
    color = invertColors ? getD3ColorInterpolator(colorScale)(1 - (binMidpoint / 500)) : getAQIColor(binMidpoint);
  } else {
    let t = (binIndex + 0.5) / binCount;
    if (invertColors) {
      t = 1 - t;
    }
    color = getD3ColorInterpolator(colorScale)(t);
  }

  const minValue = boundaries[binIndex];
  const maxValue = boundaries[binIndex + 1];
  const isFirstBin = binIndex === 0;
  const isLastBin = binIndex === boundaries.length - 2;

  let displayMinValue = minValue;
  const displayMaxValue = maxValue;

  if (dataAnalysis && !isFirstBin) {
    if (dataAnalysis.isInteger) {
      displayMinValue = minValue + 1;
    } else {
      displayMinValue = minValue + dataAnalysis.minGap;
    }
  }

  return {
    binIndex,
    color,
    minValue,
    maxValue,
    displayMinValue,
    displayMaxValue,
    isFirstBin,
    isLastBin
  };
}

export function getColorForValue(
  value: number | undefined,
  values: number[],
  colorScale: ColorScale,
  invertColors: boolean = false,
  colorBarSettings?: ColorBarSettings
): string {
  if (value === undefined) return 'white';

  if (isNaN(value)) {
    return '#d1d5db';
  }

  if (values.length === 0) {
    return 'white';
  }

  if (colorScale === 'aqi') {
    return invertColors ? getD3ColorInterpolator(colorScale)(1 - (value / 500)) : getAQIColor(value);
  }

  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);

  if (minValue === maxValue) {
    return getD3ColorInterpolator(colorScale)(0.5);
  }

  if (colorBarSettings?.isDiscrete) {
    const { boundaries, dataAnalysis } = createDiscreteBins(values, colorBarSettings);
    const colorInfo = getDiscreteColorInfo(value, boundaries, colorScale, invertColors, dataAnalysis);
    return colorInfo.color;
  }

  let normalizedValue = (value - minValue) / (maxValue - minValue);
  if (invertColors) {
    normalizedValue = 1 - normalizedValue;
  }

  return getD3ColorInterpolator(colorScale)(normalizedValue);
}

export function getAQIColor(value: number): string {
  if (value <= 50) return '#10b981';
  if (value <= 100) return '#84cc16';
  if (value <= 200) return '#eab308';
  if (value <= 300) return '#f97316';
  if (value <= 400) return '#ef4444';
  return '#991b1b';
}

export function getD3ColorInterpolator(scale: ColorScale) {
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
    spectral: (t: number) => d3.interpolateSpectral(1 - t),
    brbg: d3.interpolateBrBG,
    piyg: d3.interpolatePiYG,
    puor: d3.interpolatePuOr
  };

  return interpolators[scale] || d3.interpolateBlues;
}

export function createColorMapper(
  values: number[],
  colorScale: ColorScale,
  invertColors: boolean = false,
  colorBarSettings?: ColorBarSettings
): (value: number | undefined) => string {
  if (values.length === 0) {
    return () => 'white';
  }

  const interpolator = getD3ColorInterpolator(colorScale);

  if (colorScale === 'aqi') {
    const fn = invertColors
      ? (v: number) => interpolator(1 - (v / 500))
      : (v: number) => getAQIColor(v);
    return (value) => {
      if (value === undefined) return 'white';
      if (isNaN(value)) return '#d1d5db';
      return fn(value);
    };
  }

  let minValue = values[0], maxValue = values[0];
  for (let i = 1; i < values.length; i++) {
    if (values[i] < minValue) minValue = values[i];
    if (values[i] > maxValue) maxValue = values[i];
  }

  if (minValue === maxValue) {
    const midColor = interpolator(0.5);
    return (value) => {
      if (value === undefined) return 'white';
      if (isNaN(value)) return '#d1d5db';
      return midColor;
    };
  }

  if (colorBarSettings?.isDiscrete) {
    const { boundaries, dataAnalysis } = createDiscreteBins(values, colorBarSettings);
    return (value) => {
      if (value === undefined) return 'white';
      if (isNaN(value)) return '#d1d5db';
      return getDiscreteColorInfo(value, boundaries, colorScale, invertColors, dataAnalysis).color;
    };
  }

  const range = maxValue - minValue;
  return (value) => {
    if (value === undefined) return 'white';
    if (isNaN(value)) return '#d1d5db';
    let t = (value - minValue) / range;
    if (invertColors) t = 1 - t;
    return interpolator(t);
  };
}

export function getDiscreteLegendStops(
  values: number[],
  colorScale: ColorScale,
  invertColors: boolean,
  colorBarSettings: ColorBarSettings
): Array<{ offset: string; color: string; value: number }> {
  if (!colorBarSettings.isDiscrete) {
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const stops = [];
    const numStops = 10;

    for (let i = 0; i <= numStops; i++) {
      const t = i / numStops;
      const value = minValue + t * (maxValue - minValue);
      let color: string;
      if (colorScale === 'aqi') {
        color = invertColors ? getD3ColorInterpolator(colorScale)(1 - (value / 500)) : getAQIColor(value);
      } else {
        const colorT = invertColors ? 1 - t : t;
        color = getD3ColorInterpolator(colorScale)(colorT);
      }
      stops.push({
        offset: `${t * 100}%`,
        color,
        value
      });
    }

    return stops;
  }

  const { boundaries, binCount, dataAnalysis } = createDiscreteBins(values, colorBarSettings);
  const stops = [];

  for (let i = 0; i < binCount; i++) {
    const binMidpoint = (boundaries[i] + boundaries[i + 1]) / 2;
    let color: string;
    if (colorScale === 'aqi') {
      color = invertColors ? getD3ColorInterpolator(colorScale)(1 - (binMidpoint / 500)) : getAQIColor(binMidpoint);
    } else {
      let t = (i + 0.5) / binCount;
      if (invertColors) {
        t = 1 - t;
      }
      color = getD3ColorInterpolator(colorScale)(t);
    }
    const startOffset = (i / binCount) * 100;
    const endOffset = ((i + 1) / binCount) * 100;

    let displayMin = boundaries[i];
    const displayMax = boundaries[i + 1];

    if (i > 0) {
      if (dataAnalysis.isInteger) {
        displayMin = boundaries[i] + 1;
      } else {
        displayMin = boundaries[i] + dataAnalysis.minGap;
      }
    }
    
    stops.push({
      offset: `${startOffset}%`,
      color,
      value: displayMin
    });

    stops.push({
      offset: `${endOffset}%`,
      color,
      value: displayMax
    });
  }
  
  return stops;
}