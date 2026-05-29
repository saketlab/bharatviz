/**
 * DeckPointsLayer — WebGL point/heatmap overlay that sits on top of the SVG map.
 *
 * Rendered into a <canvas> that is absolutely positioned to match the SVG
 * container's bounding rect. Uses deck.gl ScatterplotLayer for point mode and
 * HeatmapLayer for heatmap mode. Hover is handled via onHover callbacks and
 * forwarded to the parent via onPointHover.
 */
import React, { useEffect, useRef } from 'react';
import { Deck } from '@deck.gl/core';
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
  // Geographic extent the SVG is rendering — used to build the orthographic view
  bounds: { minLng: number; maxLng: number; minLat: number; maxLat: number } | null;
  pointRadius?: number;  // px radius for ScatterplotLayer (radiusUnits: 'pixels')
  pointOpacity?: number; // 0–1
  darkMode?: boolean;
  onPointHover?: (info: { x: number; y: number; feature: PointFeature } | null) => void;
}

// Cache parsed hex colors — at most 10 distinct CAT_COLORS + fallback
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
  bounds,
  pointRadius = 2,
  pointOpacity = 0.7,
  darkMode = false,
  onPointHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deckRef = useRef<Deck | null>(null);

  // Initialise Deck once on mount
  useEffect(() => {
    if (!canvasRef.current) return;
    deckRef.current = new Deck({
      canvas: canvasRef.current,
      controller: false,
      initialViewState: { longitude: 82, latitude: 22, zoom: 4, pitch: 0, bearing: 0 },
      layers: [],
    });
    return () => { deckRef.current?.finalize(); deckRef.current = null; };
  }, []);

  // Re-render layers whenever data or view changes
  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapRect || !bounds) return;

    // Build view state matching IndiaDistrictsMap's linear projection.
    // deck.gl MapView: at zoom z, px/° = 256*2^z/360. We want projW px per geoW °.
    const w = mapRect.width;
    const h = mapRect.height;
    const geoW = bounds.maxLng - bounds.minLng;
    const geoH = bounds.maxLat - bounds.minLat;
    const geoAspect = geoW / geoH;
    const projW = (w / h) > geoAspect ? h * geoAspect : w;
    const zoom = Math.log2((projW / geoW) * 360 / 256);
    const viewState = {
      longitude: (bounds.minLng + bounds.maxLng) / 2,
      latitude: (bounds.minLat + bounds.maxLat) / 2,
      zoom, pitch: 0, bearing: 0,
    };

    const opacityByte = Math.round(pointOpacity * 255);

    const layers = viewMode === 'heatmap'
      ? [new HeatmapLayer({
          id: 'heatmap',
          data: points,
          getPosition: (d: PointFeature) => [d.lon, d.lat],
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
          getPosition: (d: PointFeature) => [d.lon, d.lat],
          getRadius: pointRadius,
          radiusUnits: 'pixels',
          getFillColor: (d: PointFeature) => {
            const rgb = colorToRgb(d.color ?? '#ef4444');
            return [...rgb, opacityByte] as [number, number, number, number];
          },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 180],
          onHover: (info: PickingInfo) => {
            if (!onPointHover) return;
            if (info.object) {
              onPointHover({ x: info.x, y: info.y, feature: info.object as PointFeature });
            } else {
              onPointHover(null);
            }
          },
          updateTriggers: { getFillColor: [pointOpacity], getRadius: [pointRadius] },
        })];

    deck.setProps({ viewState, layers });
  }, [points, viewMode, mapRect, bounds, pointRadius, pointOpacity, darkMode, onPointHover]);

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
