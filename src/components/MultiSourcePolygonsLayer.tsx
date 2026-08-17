// Renders 2-3 boundary sources (or diff classification buckets) as distinct-colored
// PolygonLayers in one shared Deck instance. Adapted from DeckPolygonsLayer's
// projection/reprojection math (villages use that component unmodified; this is Compare-tab-only).
import React, { useEffect, useMemo, useRef } from 'react';
import { Deck, OrthographicView, COORDINATE_SYSTEM } from '@deck.gl/core';
import { PolygonLayer } from '@deck.gl/layers';
import type { PickingInfo } from '@deck.gl/core';
import type { PolygonFeature } from './DeckPolygonsLayer';

export type RGBA = [number, number, number, number];

export interface SourceLayerSpec {
  id: string;
  features: PolygonFeature[];
  fillColor: RGBA;
  lineColor: RGBA;
  getFillColor?: (f: PolygonFeature) => RGBA;
  getLineColor?: (f: PolygonFeature) => RGBA;
}

interface MultiSourcePolygonsLayerProps {
  layers: SourceLayerSpec[];
  mapRect: DOMRect | null;
  project: ((lng: number, lat: number) => { x: number; y: number }) | null;
  viewBoxWidth: number;
  viewBoxHeight: number;
  highlightedId?: string | null;
  onPolygonHover?: (info: { x: number; y: number; sourceId: string; feature: PolygonFeature } | null) => void;
  onPolygonClick?: (info: { sourceId: string; feature: PolygonFeature }) => void;
}

type Datum = { rings: number[][][]; feature: PolygonFeature };

export const MultiSourcePolygonsLayer: React.FC<MultiSourcePolygonsLayerProps> = ({
  layers,
  mapRect,
  project,
  viewBoxWidth,
  viewBoxHeight,
  highlightedId,
  onPolygonHover,
  onPolygonClick,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const deckRef = useRef<Deck | null>(null);

  const hoverRef = useRef(onPolygonHover);
  hoverRef.current = onPolygonHover;
  const clickRef = useRef(onPolygonClick);
  clickRef.current = onPolygonClick;

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

  const width = mapRect?.width ?? 0;
  const height = mapRect?.height ?? 0;

  const layerData = useMemo<{ spec: SourceLayerSpec; data: Datum[] }[]>(() => {
    if (!width || !project) return layers.map(spec => ({ spec, data: [] }));
    const sx = width / viewBoxWidth;
    const sy = height / viewBoxHeight;
    const projVertex = ([lng, lat]: number[]): [number, number] => {
      const p = project(lng, lat);
      return [p.x * sx, p.y * sy];
    };
    return layers.map(spec => {
      const data: Datum[] = [];
      for (const f of spec.features) {
        for (const poly of f.polygons) {
          data.push({ rings: poly.map(ring => ring.map(projVertex)), feature: f });
        }
      }
      return { spec, data };
    });
  }, [layers, width, height, viewBoxWidth, viewBoxHeight, project]);

  useEffect(() => {
    const deck = deckRef.current;
    if (!deck || !mapRect) return;

    const glLayers = layerData.map(({ spec, data }) => new PolygonLayer<Datum>({
      id: spec.id,
      data,
      coordinateSystem: COORDINATE_SYSTEM.CARTESIAN,
      getPolygon: (d: Datum) => d.rings,
      filled: true,
      stroked: true,
      getFillColor: spec.getFillColor
        ? (d: Datum) => spec.getFillColor!(d.feature)
        : spec.fillColor,
      getLineColor: (d: Datum) => {
        if (highlightedId && d.feature.properties.__diffId === highlightedId) return [255, 255, 255, 255];
        return spec.getLineColor ? spec.getLineColor(d.feature) : spec.lineColor;
      },
      getLineWidth: (d: Datum) =>
        highlightedId && d.feature.properties.__diffId === highlightedId ? 2.5 : 0.75,
      lineWidthUnits: 'pixels',
      pickable: true,
      autoHighlight: true,
      highlightColor: [255, 255, 255, 90],
      onHover: (info: PickingInfo) => {
        const cb = hoverRef.current;
        if (!cb) return;
        cb(info.object ? { x: info.x, y: info.y, sourceId: spec.id, feature: (info.object as Datum).feature } : null);
      },
      onClick: (info: PickingInfo) => {
        const cb = clickRef.current;
        if (!cb || !info.object) return;
        cb({ sourceId: spec.id, feature: (info.object as Datum).feature });
      },
      updateTriggers: {
        getFillColor: [spec.fillColor, spec.getFillColor],
        getLineColor: [highlightedId, spec.lineColor, spec.getLineColor],
        getLineWidth: [highlightedId],
      },
    }));

    deck.setProps({
      width: mapRect.width,
      height: mapRect.height,
      viewState: { target: [mapRect.width / 2, mapRect.height / 2, 0], zoom: 0 },
      layers: glLayers,
    });
  }, [layerData, mapRect, highlightedId]);

  // Canvas always mounts (even before mapRect is known) so the deck-construction
  // effect's ref is populated on first render - an early `return null` here would
  // unmount the canvas until mapRect resolves, and since that effect has an empty
  // dependency array it never gets a second chance to attach once the canvas appears.
  return (
    <canvas
      ref={canvasRef}
      width={mapRect?.width ?? 0}
      height={mapRect?.height ?? 0}
      style={{ position: 'absolute', top: 0, left: 0, width: mapRect?.width ?? 0, height: mapRect?.height ?? 0, pointerEvents: 'auto' }}
    />
  );
};
