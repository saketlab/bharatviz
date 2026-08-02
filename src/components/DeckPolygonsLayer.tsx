/**
 * WebGL polygon overlay on top of the SVG map. Used for village boundaries
 * (tens of thousands of polygons per state) where SVG <path> would choke.
 * Shares DeckPointsLayer's CARTESIAN-pixel projection so polygons land on the
 * boundary paths. Names show on hover, and as static TextLayer labels when
 * showLabels is set.
 */
import React, { useEffect, useMemo, useRef } from 'react';
import { Deck, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PolygonLayer, TextLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';

export interface PolygonFeature {
  // MultiPolygon shape: list of polygons, each a list of rings, each [lng,lat][].
  polygons: number[][][][];
  name: string | null;
  properties: Record<string, string | number | null>;
}

const FILL_RGB: [number, number, number] = [193, 122, 60];
const FILL_A = Math.round(0.35 * 255);

interface DeckPolygonsLayerProps {
  features: PolygonFeature[];
  mapRect: DOMRect | null;
  project: ((lng: number, lat: number) => { x: number; y: number }) | null;
  viewBoxWidth: number;
  viewBoxHeight: number;
  darkMode?: boolean;
  showLabels?: boolean;
  onPolygonHover?: (info: { x: number; y: number; feature: PolygonFeature } | null) => void;
}

type Datum = { rings: number[][][]; feature: PolygonFeature };
type LabelDatum = { position: [number, number]; text: string };

export const DeckPolygonsLayer: React.FC<DeckPolygonsLayerProps> = ({
  features,
  mapRect,
  project,
  viewBoxWidth,
  viewBoxHeight,
  darkMode = false,
  showLabels = false,
  onPolygonHover,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deckRef = useRef<Deck | null>(null);

  // Hover callback in a ref so parent hover renders don't reproject polygons.
  const hoverRef = useRef(onPolygonHover);
  hoverRef.current = onPolygonHover;

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

  // Reproject only on geometry change; one datum per polygon keeps its rings (outer + holes).
  const width = mapRect?.width ?? 0;
  const height = mapRect?.height ?? 0;
  const data = useMemo<Datum[]>(() => {
    if (!width || !project) return [];
    const sx = width / viewBoxWidth;
    const sy = height / viewBoxHeight;
    const projVertex = ([lng, lat]: number[]): [number, number] => {
      const p = project(lng, lat);
      return [p.x * sx, p.y * sy];
    };
    const out: Datum[] = [];
    for (const f of features) {
      for (const poly of f.polygons) {
        out.push({ rings: poly.map(ring => ring.map(projVertex)), feature: f });
      }
    }
    return out;
  }, [features, width, height, viewBoxWidth, viewBoxHeight, project]);

  // One label per feature, placed on its largest already-projected ring.
  const labels = useMemo<LabelDatum[]>(() => {
    if (!showLabels) return [];
    const best = new Map<PolygonFeature, number[][]>();
    for (const d of data) {
      const ring = d.rings[0];
      if (!d.feature.name || !ring) continue;
      const prev = best.get(d.feature);
      if (!prev || ring.length > prev.length) best.set(d.feature, ring);
    }
    const out: LabelDatum[] = [];
    for (const [feature, ring] of best) {
      let ax = 0, ay = 0;
      for (const [x, y] of ring) { ax += x; ay += y; }
      out.push({ position: [ax / ring.length, ay / ring.length], text: feature.name! });
    }
    return out;
  }, [showLabels, data]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapRect) return;
    const line: [number, number, number] = darkMode ? [220, 190, 150] : [140, 90, 40];

    const layer = new PolygonLayer<Datum>({
      id: 'villages',
      data,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPolygon: (d: Datum) => d.rings,
      filled: true,
      stroked: true,
      getFillColor: [...FILL_RGB, FILL_A] as [number, number, number, number],
      getLineColor: [...line, 200] as [number, number, number, number],
      getLineWidth: 0.5,
      lineWidthUnits: 'pixels',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 90],
      onHover: (info: PickingInfo) => {
        const cb = hoverRef.current;
        if (!cb) return;
        cb(info.object ? { x: info.x, y: info.y, feature: (info.object as Datum).feature } : null);
      },
      updateTriggers: { getLineColor: [darkMode] },
    });

    const textLayer = labels.length
      ? new TextLayer<LabelDatum>({
          id: 'village-labels',
          data: labels,
          coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
          getPosition: (d: LabelDatum) => d.position,
          getText: (d: LabelDatum) => d.text,
          getSize: 9,
          sizeUnits: 'pixels',
          getColor: darkMode ? [235, 225, 210, 230] : [50, 30, 15, 230],
          outlineWidth: 2,
          outlineColor: darkMode ? [20, 15, 10, 200] : [255, 255, 255, 220],
          fontSettings: { sdf: true },
          getTextAnchor: 'middle',
          getAlignmentBaseline: 'center',
          updateTriggers: { getColor: [darkMode] },
        })
      : null;

    deck.setProps({
      viewState: { target: [mapRect.width / 2, mapRect.height / 2, 0], zoom: 0 },
      layers: textLayer ? [layer, textLayer] : [layer],
    });
  }, [data, labels, mapRect, darkMode]);

  if (!mapRect) return null;

  return (
    <canvas
      ref={canvasRef}
      width={mapRect.width}
      height={mapRect.height}
      style={{ position: 'absolute', top: 0, left: 0, width: mapRect.width, height: mapRect.height, pointerEvents: 'auto' }}
    />
  );
};
