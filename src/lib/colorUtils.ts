export type BoundaryColor = 'auto' | 'white' | 'dark';

export function parseColorToRGB(color: string): { r: number; g: number; b: number } {
  if (color.startsWith('#')) {
    const hex = color.slice(1);
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16)
    };
  }
  
  if (color.startsWith('rgb')) {
    const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) {
      return {
        r: parseInt(match[1]),
        g: parseInt(match[2]),
        b: parseInt(match[3])
      };
    }
  }

  if (color.startsWith('hsl')) {
    const match = color.match(/hsl\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*\)/);
    if (match) {
      const h = parseFloat(match[1]) / 360;
      const s = parseFloat(match[2]) / 100;
      const l = parseFloat(match[3]) / 100;
      if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
      }
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      const hue = (t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      return {
        r: Math.round(hue(h + 1 / 3) * 255),
        g: Math.round(hue(h) * 255),
        b: Math.round(hue(h - 1 / 3) * 255)
      };
    }
  }

  const NAMED: Record<string, { r: number; g: number; b: number }> = {
    white: { r: 255, g: 255, b: 255 },
    black: { r: 0, g: 0, b: 0 },
  };
  if (NAMED[color]) return NAMED[color];

  return { r: 0, g: 0, b: 0 };
}

export function isColorDark(color: string): boolean {
  const { r, g, b } = parseColorToRGB(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
}

export function resolveBoundaryStroke(boundaryColor: BoundaryColor, fillColor: string, darkMode: boolean): string {
  if (boundaryColor === 'white') return '#ffffff';
  if (boundaryColor === 'dark') return '#0f172a';
  return fillColor === 'white' || fillColor === '#1a1a1a' || !isColorDark(fillColor)
    ? (darkMode ? '#ffffff' : '#0f172a')
    : '#ffffff';
}

export function roundToSignificantDigits(num: number, digits: number = 2): string {
  if (isNaN(num) || !isFinite(num)) return '';
  if (num === 0) return '0';
  
  if (Math.abs(num) >= 1) {
    if (num % 1 === 0 && num < 1e6) {
      return num.toString();
    } else if (num < 1000) {
      return parseFloat(num.toFixed(2)).toString();
    } else if (num < 10000) {
      return parseFloat(num.toFixed(1)).toString();
    } else {
      return Math.round(num).toString();
    }
  } else {
    if (Math.abs(num) >= 0.01) {
      return parseFloat(num.toFixed(3)).toString();
    } else {
      return parseFloat(num.toFixed(4)).toString();
    }
  }
}

export function formatLegendValue(num: number, precision?: number): string {
  if (num === 0) return '0';

  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
  } else if (Math.abs(num) >= 1) {
    // For discrete bins with custom precision, respect it exactly (including 0 for integers)
    const decimals = precision !== undefined ? precision : 2;
    return parseFloat(num.toFixed(decimals)).toString();
  } else {
    const decimals = precision !== undefined ? precision : 4;
    return parseFloat(num.toFixed(decimals)).toString();
  }
}