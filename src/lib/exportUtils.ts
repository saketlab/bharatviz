/**
 * Shared SVG-to-canvas rendering utilities for export and clipboard operations.
 */

interface RenderOptions {
  width: number;
  height: number;
  dpi?: number;
  backgroundColor?: string;
}

/**
 * Renders an SVG element onto a canvas at the given scale.
 * Handles SVG serialization and blob URL lifecycle.
 */
export function svgToCanvas(
  svg: SVGSVGElement,
  options: RenderOptions
): Promise<HTMLCanvasElement> {
  const { width, height, dpi = 96, backgroundColor = 'white' } = options;
  const scale = dpi / 96;

  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) return Promise.reject(new Error('Could not get canvas context'));

  canvas.width = width * scale;
  canvas.height = height * scale;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(svgBlob);

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);
      ctx.scale(scale, scale);
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas);
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Failed to load SVG as image'));
    };

    img.src = blobUrl;
  });
}

/**
 * Renders an SVG element to a high-DPI canvas blob (PNG).
 */
export function svgToHighDpiBlob(
  svg: SVGSVGElement,
  options: RenderOptions
): Promise<Blob> {
  const { dpi = 300 } = options;
  return svgToCanvas(svg, { ...options, dpi }).then(canvas => new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob returned null'));
    });
  }));
}
