/**
 * Core district-boundary diff engine: matches districts between two boundary
 * sources by polygon intersection-over-union (no source shares a common ID
 * or consistent naming, so geometry is the primary match signal - names are
 * only used to build state groups and as a display label).
 *
 * Pure, no React/DOM - runs on the main thread or inside a Web Worker.
 */
import { feature, featureCollection } from '@turf/helpers';
import turfArea from '@turf/area';
import turfBbox from '@turf/bbox';
import turfIntersect from '@turf/intersect';
import turfSimplify from '@turf/simplify';
import type { BBox } from 'geojson';
import type { DiffClassification, DiffFeature, DiffMatch, DiffResult } from './compareTypes';
import type { GeoJSONFeatureLike } from './geojsonToPolygonFeature';

// Un-simplified admin-layer files (e.g. LGD subdistricts, electoral
// constituencies) can carry 5,000-8,000+ vertices per feature - turf.intersect
// slows down substantially with vertex count (measured: ~150ms/call on an
// 8,000-vertex electoral constituency vs ~3-16ms on a typical ~1,000-vertex
// district), and that cost multiplies across every candidate pair. Simplify
// only geometries above this threshold so lighter layers (most districts,
// environment, urban) skip the extra pass entirely; verified against live
// LGD vs SOI data that this tolerance doesn't change any classification.
const SIMPLIFY_VERTEX_THRESHOLD = 1500;
const SIMPLIFY_TOLERANCE = 0.0001;

function countVertices(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  const polys = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
  let n = 0;
  for (const poly of polys) for (const ring of poly) n += ring.length;
  return n;
}

function maybeSimplify(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (countVertices(geometry) < SIMPLIFY_VERTEX_THRESHOLD) return geometry;
  try {
    return turfSimplify(feature(geometry), { tolerance: SIMPLIFY_TOLERANCE, highQuality: false }).geometry;
  } catch {
    // @turf/simplify throws on rings that collapse below 4 points at this
    // tolerance (small islands/slivers in a MultiPolygon) - one degenerate
    // ring shouldn't crash the whole diff, so fall back to the original.
    return geometry;
  }
}

// unchangedIoU=0.90 (not 0.98) because independently-digitized sources never
// hit near-perfect IoU even for the same real-world district - coastline and
// simplification noise caps it well below 1.0. Calibrated against live LGD
// vs SOI data: max observed IoU nationwide is 0.994, median is 0.963, and
// 0.90 captures ~82% of matched pairs as "the same district" while still
// leaving room for genuinely redrawn boundaries below that line.
export const DIFF_THRESHOLDS = {
  unchangedIoU: 0.90,
  modifiedIoUMin: 0.30,
  splitMergeFrac: 0.15,
} as const;

export function normalizeStateName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeDistrictName(s: string | null | undefined): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\bdist\.?\b/g, '')
    .replace(/\bdistrict\b/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildDiffFeatures(
  geojson: { features: GeoJSONFeatureLike[] },
  sourceId: string,
  nameProp: string,
  stateProp: string
): DiffFeature[] {
  return geojson.features.map((f, index) => {
    const stateName = (f.properties[stateProp] as string | undefined) ?? null;
    const name = (f.properties[nameProp] as string | undefined) ?? null;
    const stateNorm = normalizeStateName(stateName);
    const geometry = maybeSimplify(f.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon);
    return {
      id: `${sourceId}:${stateNorm}:${index}`,
      sourceId,
      name,
      stateName,
      geometry,
      areaKm2: turfArea(geometry as GeoJSON.Geometry) / 1_000_000,
    };
  });
}

export function groupByState(features: DiffFeature[]): Map<string, DiffFeature[]> {
  const groups = new Map<string, DiffFeature[]>();
  for (const f of features) {
    const key = normalizeStateName(f.stateName);
    const list = groups.get(key);
    if (list) list.push(f);
    else groups.set(key, [f]);
  }
  return groups;
}

function bboxOf(f: DiffFeature): BBox {
  return turfBbox(f.geometry);
}

export function bboxOverlap(a: BBox, b: BBox): boolean {
  return a[0] <= b[2] && b[0] <= a[2] && a[1] <= b[3] && b[1] <= a[3];
}

interface OverlapEntry {
  other: DiffFeature;
  interArea: number;
  iou: number;
  fracOfSelf: number;
  fracOfOther: number;
}

function findOverlaps(from: DiffFeature, candidates: DiffFeature[]): OverlapEntry[] {
  const fromBbox = bboxOf(from);
  const fromGeom = feature(from.geometry);
  const out: OverlapEntry[] = [];
  for (const other of candidates) {
    if (!bboxOverlap(fromBbox, bboxOf(other))) continue;
    const fc = featureCollection([fromGeom, feature(other.geometry)]);
    const inter = turfIntersect(fc);
    if (!inter) continue;
    const interArea = turfArea(inter) / 1_000_000;
    if (interArea <= 0) continue;
    const union = from.areaKm2 + other.areaKm2 - interArea;
    out.push({
      other,
      interArea,
      iou: union > 0 ? interArea / union : 0,
      fracOfSelf: from.areaKm2 > 0 ? interArea / from.areaKm2 : 0,
      fracOfOther: other.areaKm2 > 0 ? interArea / other.areaKm2 : 0,
    });
  }
  out.sort((x, y) => y.interArea - x.interArea);
  return out;
}

/** One-directional match: for each `from` feature, the `to` features it meaningfully overlaps. */
export function matchOneDirection(
  from: DiffFeature[],
  to: DiffFeature[]
): Map<string, OverlapEntry[]> {
  const result = new Map<string, OverlapEntry[]>();
  const byState = groupByState(to);
  // whole-country fallback candidates for features whose state has no group match
  for (const f of from) {
    const stateKey = normalizeStateName(f.stateName);
    let candidates = byState.get(stateKey);
    if (!candidates || candidates.length === 0) {
      candidates = to; // fallback: state renamed/split, search everything
    }
    const overlaps = findOverlaps(f, candidates).filter(
      o => o.fracOfSelf >= DIFF_THRESHOLDS.splitMergeFrac
    );
    result.set(f.id, overlaps);
  }
  return result;
}

export function classifyPair(
  aOverlaps: OverlapEntry[],
  isPartOfMerge: boolean
): { classification: DiffClassification; iou: number | null; lowConfidence?: boolean } {
  if (aOverlaps.length === 0) return { classification: 'removed', iou: null };
  if (aOverlaps.length > 1) return { classification: 'split', iou: null };
  if (isPartOfMerge) return { classification: 'merged', iou: aOverlaps[0].iou };
  const iou = aOverlaps[0].iou;
  if (iou >= DIFF_THRESHOLDS.unchangedIoU) return { classification: 'unchanged', iou };
  if (iou >= DIFF_THRESHOLDS.modifiedIoUMin) return { classification: 'modified', iou };
  return { classification: 'modified', iou, lowConfidence: true };
}

export function computeDistrictDiff(
  featuresA: DiffFeature[],
  featuresB: DiffFeature[],
  sourceAId: string,
  sourceBId: string
): DiffResult {
  const start = performance.now();

  const aToB = matchOneDirection(featuresA, featuresB);
  const bToA = matchOneDirection(featuresB, featuresA);

  const matches: DiffMatch[] = [];
  const summary: Record<DiffClassification, number> = {
    unchanged: 0, modified: 0, added: 0, removed: 0, split: 0, merged: 0,
  };
  const matchedBIds = new Set<string>();

  for (const a of featuresA) {
    const overlaps = aToB.get(a.id) ?? [];
    const bestB = overlaps[0]?.other;
    const isPartOfMerge = overlaps.length === 1 && (bToA.get(bestB!.id)?.length ?? 0) > 1;
    const { classification, iou, lowConfidence } = classifyPair(overlaps, isPartOfMerge);

    for (const o of overlaps) matchedBIds.add(o.other.id);
    summary[classification]++;

    if (classification === 'split') {
      // One row per B piece, not just the largest, so every piece is
      // individually classifiable and hoverable - a row that only points at
      // the best match leaves the smaller pieces with no match at all, and
      // they'd fall back to "unchanged" purely because nothing claimed them.
      for (const o of overlaps) {
        matches.push({
          aId: a.id,
          bId: o.other.id,
          classification,
          iou: o.iou,
          fracOfA: o.fracOfSelf,
          fracOfB: o.fracOfOther,
          lowConfidence,
        });
      }
    } else {
      matches.push({
        aId: a.id,
        bId: bestB?.id ?? null,
        classification,
        iou,
        fracOfA: overlaps[0]?.fracOfSelf ?? null,
        fracOfB: overlaps[0]?.fracOfOther ?? null,
        lowConfidence,
      });
    }
  }

  for (const b of featuresB) {
    if (matchedBIds.has(b.id)) continue;
    summary.added++;
    matches.push({ aId: null, bId: b.id, classification: 'added', iou: null, fracOfA: null, fracOfB: null });
  }

  return {
    sourceA: sourceAId,
    sourceB: sourceBId,
    matches,
    featuresA: new Map(featuresA.map(f => [f.id, f])),
    featuresB: new Map(featuresB.map(f => [f.id, f])),
    summary,
    computeTimeMs: performance.now() - start,
  };
}
