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
