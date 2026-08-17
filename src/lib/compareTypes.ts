export type DiffClassification = 'unchanged' | 'modified' | 'added' | 'removed' | 'split' | 'merged';

export interface DiffFeature {
  id: string;
  sourceId: string;
  name: string | null;
  stateName: string | null;
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  areaKm2: number;
}

export interface DiffMatch {
  aId: string | null;
  bId: string | null;
  classification: DiffClassification;
  iou: number | null;
  fracOfA: number | null;
  fracOfB: number | null;
  lowConfidence?: boolean;
}

export interface DiffResult {
  sourceA: string;
  sourceB: string;
  matches: DiffMatch[];
  featuresA: Map<string, DiffFeature>;
  featuresB: Map<string, DiffFeature>;
  summary: Record<DiffClassification, number>;
  computeTimeMs: number;
}

export function isHighlighted(diffId: unknown, highlightedId: Set<string> | null | undefined): boolean {
  return typeof diffId === 'string' && !!highlightedId && highlightedId.has(diffId);
}

export function describeMatch(
  diffResult: DiffResult,
  diffId: string,
  matches: DiffMatch[]
): { classification: DiffClassification | null; otherNames: string[] } {
  if (matches.length === 0) return { classification: null, otherNames: [] };
  const otherNames = new Set<string>();
  for (const m of matches) {
    const otherId = m.aId === diffId ? m.bId : m.aId;
    if (!otherId) continue;
    const other = diffResult.featuresA.get(otherId) ?? diffResult.featuresB.get(otherId);
    if (other?.name) otherNames.add(other.name);
  }
  return { classification: matches[0].classification, otherNames: Array.from(otherNames) };
}
