/// <reference lib="webworker" />
import { computeDistrictDiff } from './districtDiff';
import type { DiffFeature, DiffResult } from './compareTypes';

export interface DiffRequest {
  featuresA: DiffFeature[];
  featuresB: DiffFeature[];
  sourceAId: string;
  sourceBId: string;
}

self.onmessage = (e: MessageEvent<DiffRequest>) => {
  const { featuresA, featuresB, sourceAId, sourceBId } = e.data;
  const result: DiffResult = computeDistrictDiff(featuresA, featuresB, sourceAId, sourceBId);
  (self as unknown as Worker).postMessage(result);
};
