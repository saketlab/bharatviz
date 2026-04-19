export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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

  return { r: 0, g: 0, b: 0 };
}

export function isColorDark(color: string): boolean {
  const { r, g, b } = parseColorToRGB(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.6;
}

export function roundToSignificantDigits(num: number, digits: number = 2): string {
  if (num === 0) return '0';

  // Handle integers and simple decimals without scientific notation
  if (Math.abs(num) >= 1) {
    // For numbers >= 1, round to reasonable decimal places
    if (num % 1 === 0 && num < 1e6) {
      // It's a whole number and not too large, return as integer
      return num.toString();
    } else if (num < 1000) {
      // Small numbers, keep up to 2 decimal places
      return parseFloat(num.toFixed(2)).toString();
    } else if (num < 10000) {
      // Thousands, keep up to 1 decimal place
      return parseFloat(num.toFixed(1)).toString();
    } else {
      // Large numbers, round to nearest integer
      return Math.round(num).toString();
    }
  } else {
    // For numbers < 1, use fixed decimal places
    if (Math.abs(num) >= 0.01) {
      return parseFloat(num.toFixed(3)).toString();
    } else {
      return parseFloat(num.toFixed(4)).toString();
    }
  }
}

export function formatLegendValue(num: number): string {
  if (num === 0) return '0';

  if (Math.abs(num) >= 1000000) {
    return (num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1) + 'M';
  } else if (Math.abs(num) >= 1000) {
    return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
  } else if (Math.abs(num) >= 1) {
    return parseFloat(num.toFixed(2)).toString();
  } else {
    return parseFloat(num.toFixed(4)).toString();
  }
}
