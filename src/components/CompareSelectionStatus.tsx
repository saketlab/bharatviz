import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { describeMatch, type DiffResult, type DiffClassification } from '@/lib/compareTypes';

interface CompareSelectionStatusProps {
  diffResult: DiffResult | null;
  loading: boolean;
  selectedFeatureId: string | null;
  nameA: string;
  nameB: string;
}

const VERB: Record<DiffClassification, string> = {
  unchanged: 'Unchanged',
  modified: 'Boundary modified',
  split: 'Split',
  merged: 'Merged',
  added: 'Added',
  removed: 'Removed',
};

export const CompareSelectionStatus: React.FC<CompareSelectionStatusProps> = ({
  diffResult, loading, selectedFeatureId, nameA, nameB,
}) => {
  const info = useMemo(() => {
    if (!diffResult || !selectedFeatureId) return null;
    const matches = diffResult.matches.filter(m => m.aId === selectedFeatureId || m.bId === selectedFeatureId);
    const { classification, otherNames } = describeMatch(diffResult, selectedFeatureId, matches);
    if (!classification) return null;
    const self = diffResult.featuresA.get(selectedFeatureId) ?? diffResult.featuresB.get(selectedFeatureId);
    return { name: self?.name ?? 'Unnamed', classification, otherNames };
  }, [diffResult, selectedFeatureId]);

  if (loading) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Comparing boundaries between {nameA} and {nameB} in the background…
      </p>
    );
  }

  if (!selectedFeatureId) {
    return (
      <p className="mt-3 text-xs text-muted-foreground">
        Click a region in either map to highlight it in both and see if it split or merged.
      </p>
    );
  }

  if (!info) return null;

  const otherLabel =
    info.classification === 'split' ? 'Split into: ' :
    info.classification === 'merged' ? 'Merged from: ' :
    info.classification === 'modified' || info.classification === 'unchanged' ? 'Matches: ' :
    null;

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
      <span className="font-medium">{info.name}</span>
      <Badge variant="outline" className="capitalize text-xs">{VERB[info.classification]}</Badge>
      {info.classification === 'removed' && (
        <span className="text-muted-foreground">Not present in {nameB}</span>
      )}
      {info.classification === 'added' && (
        <span className="text-muted-foreground">Not present in {nameA}</span>
      )}
      {otherLabel && info.otherNames.length > 0 && (
        <span className="text-muted-foreground">{otherLabel}{info.otherNames.join(', ')}</span>
      )}
    </div>
  );
};
