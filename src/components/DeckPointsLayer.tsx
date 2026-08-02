/**
 * DeckPointsLayer - WebGL point/heatmap overlay that sits on top of the SVG map.
 *
 * Rendered into a <canvas> that is absolutely positioned to match the SVG
 * container's bounding rect. Uses deck.gl ScatterplotLayer for point mode and
 * HeatmapLayer for heatmap mode. Hover is handled via onHover callbacks and
 * forwarded to the parent via onPointHover.
 */
import React, { useEffect, useRef } from 'react';
import { Deck, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { PickingInfo } from '@deck.gl/core';
import type { PointFeature } from './IndiaDistrictsMap';
import { parseColorToRGB } from '@/lib/colorUtils';

export type PointViewMode = 'points' | 'heatmap';

interface DeckPointsLayerProps {
  points: PointFeature[];
  viewMode: PointViewMode;
  // Bounding box of the SVG map in page coordinates (from getBoundingClientRect)
  mapRect: DOMRect | null;
  // The SVG's geo->viewBox projector and viewBox size, so points use the EXACT same
  // linear projection as the boundary paths (deck's MapView is Mercator and would drift).
  project: ((lng: number, lat: number) => { x: number; y: number }) | null;
  viewBoxWidth: number;
  viewBoxHeight: number;
  pointRadius?: number;  // px radius for ScatterplotLayer (radiusUnits: 'pixels')
  pointOpacity?: number; // 0-1
  darkMode?: boolean;
  onPointHover?: (info: { x: number; y: number; feature: PointFeature } | null) => void;
}

// Cache parsed hex colors - at most 10 distinct CAT_COLORS + fallback
const rgbCache = new Map<string, [number, number, number]>();
function colorToRgb(hex: string): [number, number, number] {
  let cached = rgbCache.get(hex);
  if (!cached) {
    const { r, g, b } = parseColorToRGB(hex);
    cached = [r, g, b];
    rgbCache.set(hex, cached);
  }
  return cached;
}

export const DeckPointsLayer: React.FC<DeckPointsLayerProps> = ({
  points,
  viewMode,
  mapRect,
  project,
  viewBoxWidth,
  viewBoxHeight,
  pointRadius = 2,
  pointOpacity = 0.7,
  darkMode = false,
  onPointHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deckRef = useRef<Deck | null>(null);

  // Initialise Deck once on mount, in a pixel-space orthographic view (no Mercator).
  useEffect(() => {
    if (!canvasRef.current) return;
    deckRef.current = new Deck({
      canvas: canvasRef.current,
      controller: false,
      views: [new OrthographicView({ id: 'ortho' })],
      initialViewState: { target: [0, 0, 0], zoom: 0 },
      layers: [],
    });
    return () => { deckRef.current?.finalize(); deckRef.current = null; };
  }, []);

  // Re-render layers whenever data or view changes
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapRect || !project) return;

    // Project each point through the SVG's own geo->viewBox transform, then scale
    // viewBox -> canvas pixels. Render in CARTESIAN pixel space so points land exactly
    // on the boundary paths regardless of latitude.
    const sx = mapRect.width / viewBoxWidth;
    const sy = mapRect.height / viewBoxHeight;
    const toPixel = (d: PointFeature): [number, number] => {
      const p = project(d.lon, d.lat);
      return [p.x * sx, p.y * sy];
    };
    const viewState = { target: [mapRect.width / 2, mapRect.height / 2, 0], zoom: 0 };

    const opacityByte = Math.round(pointOpacity * 255);

    const layers = viewMode === 'heatmap'
      ? [new HeatmapLayer({
          id: 'heatmap',
          data: points,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: toPixel,
          getWeight: 1,
          radiusPixels: 20,
          intensity: 1,
          threshold: 0.05,
          colorRange: darkMode
            ? [[0,0,80,0],[0,80,200,100],[0,200,100,180],[200,200,0,220],[255,100,0,255],[255,0,0,255]]
            : [[255,255,204,0],[161,218,180,80],[65,182,196,160],[44,127,184,200],[37,52,148,255],[8,29,88,255]],
        })]
      : [new ScatterplotLayer<PointFeature>({
          id: 'points',
          data: points,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: toPixel,
          getRadius: pointRadius,
          radiusUnits: 'pixels',
          radiusMinPixels: 0.5,
          radiusMaxPixels: 3,
          parameters: { depthTest: false },
          getFillColor: (d: PointFeature) => {
            const rgb = colorToRgb(d.color ?? '#ef4444');
            return [...rgb, opacityByte] as [number, number, number, number];
          },
          pickable: true,
          autoHighlight: points.length < 200000,
          highlightColor: [255, 255, 255, 180],
          onHover: (info: PickingInfo) => {
            if (!onPointHover) return;
            if (info.object) {
              onPointHover({ x: info.x, y: info.y, feature: info.object as PointFeature });
            } else {
              onPointHover(null);
            }
          },
          updateTriggers: { getPosition: [mapRect.width, mapRect.height, project], getFillColor: [pointOpacity], getRadius: [pointRadius] },
        })];

    deck.setProps({ viewState, layers });
  }, [points, viewMode, mapRect, project, viewBoxWidth, viewBoxHeight, pointRadius, pointOpacity, darkMode, onPointHover]);

  if (!mapRect) return null;

  return (
    <canvas
      ref={canvasRef}
      width={mapRect.width}
      height={mapRect.height}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: mapRect.width,
        height: mapRect.height,
        pointerEvents: viewMode === 'points' ? 'auto' : 'none',
      }}
    />
  );
};
