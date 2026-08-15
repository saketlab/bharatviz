import React, { useMemo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { DiffResult, DiffClassification } from '@/lib/compareTypes';

const legendFor = (nameA: string, nameB: string): { cls: DiffClassification; label: string; swatch: string; hint: string }[] => [
  { cls: 'unchanged', label: 'Unchanged', swatch: 'bg-green-500', hint: `Same boundary in ${nameA} and ${nameB}.` },
  { cls: 'modified', label: 'Modified', swatch: 'bg-orange-500', hint: 'Same district, boundary redrawn.' },
  { cls: 'split', label: 'Split', swatch: 'bg-purple-500', hint: `One district in ${nameA} covers several districts in ${nameB}.` },
  { cls: 'merged', label: 'Merged', swatch: 'bg-purple-500', hint: `Several districts in ${nameA} were combined into one district in ${nameB}.` },
  { cls: 'added', label: 'Added', swatch: 'bg-blue-500', hint: `Only exists in ${nameB}.` },
  { cls: 'removed', label: 'Removed', swatch: 'bg-red-500', hint: `Only exists in ${nameA}.` },
];

const FILTERABLE: DiffClassification[] = ['modified', 'split', 'merged', 'added', 'removed'];

interface CompareResultsPanelProps {
  diffResult: DiffResult | null;
  loading: boolean;
  selectedFeatureId: string | null;
  onSelectFeature: (id: string | null) => void;
  nameA: string;
  nameB: string;
}

export const CompareResultsPanel: React.FC<CompareResultsPanelProps> = ({
  diffResult,
  loading,
  selectedFeatureId,
  onSelectFeature,
  nameA,
  nameB,
}) => {
  const LEGEND = useMemo(() => legendFor(nameA, nameB), [nameA, nameB]);
  const [filter, setFilter] = useState<DiffClassification | 'all'>('all');

  const rows = useMemo(() => {
    if (!diffResult) return [];
    return diffResult.matches
      .filter(m => m.classification !== 'unchanged')
      .filter(m => filter === 'all' || m.classification === filter)
      .map(m => {
        const a = m.aId ? diffResult.featuresA.get(m.aId) : null;
        const b = m.bId ? diffResult.featuresB.get(m.bId) : null;
        return {
          // Pair, not either id alone: split/merged features share an aId or bId across rows.
          rowKey: `${m.aId ?? '-'}|${m.bId ?? '-'}`,
          selectId: m.bId ?? m.aId!,
          name: b?.name ?? a?.name ?? 'Unnamed',
          stateName: b?.stateName ?? a?.stateName ?? '—',
          classification: m.classification,
          iou: m.iou,
          lowConfidence: m.lowConfidence,
        };
      })
      .sort((x, y) => (x.iou ?? 0) - (y.iou ?? 0));
  }, [diffResult, filter]);

  if (loading) {
    return (
      <div className="mt-4 flex items-center gap-2.5 text-sm text-muted-foreground">
        <span
          className="h-4 w-4 rounded-full border-2 border-[hsl(28,40%,86%)] border-t-[hsl(28,62%,48%)] motion-safe:animate-spin dark:border-[hsl(28,18%,28%)] dark:border-t-[hsl(28,55%,52%)]"
          style={{ animationDuration: '0.7s' }}
        />
        Comparing every district polygon between the two sources. This runs in
        the background and can take a few minutes for nationwide boundaries.
      </div>
    );
  }

  if (!diffResult) return null;

  return (
    <div className="mt-4">
      <p className="text-xs text-muted-foreground mb-2">
        Comparing <span className="font-medium text-foreground">{nameA}</span> (baseline) against{' '}
        <span className="font-medium text-foreground">{nameB}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {LEGEND.map(({ cls, label, swatch, hint }) => (
          <button
            key={cls}
            onClick={() => setFilter(filter === cls ? 'all' : cls)}
            title={hint}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs border transition-colors ${
              filter === cls
                ? 'border-[hsl(28,62%,48%)] bg-[hsl(28,62%,48%)]/10'
                : 'border-transparent hover:bg-accent'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${swatch}`} />
            <span>{label}</span>
            <span className="text-muted-foreground">{diffResult.summary[cls]}</span>
          </button>
        ))}
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="text-xs text-muted-foreground underline">
            clear
          </button>
        )}
      </div>

      {(filter === 'split' || filter === 'merged') && (
        <p className="text-xs text-muted-foreground mb-2">
          {filter === 'split'
            ? `Split: one district in ${nameA} covers several districts in ${nameB} (e.g. an old district later divided).`
            : `Merged: several districts in ${nameA} were combined into one district in ${nameB}.`}
        </p>
      )}

      <div className="text-xs text-muted-foreground mb-2">
        {diffResult.summary.unchanged} unchanged districts not shown below · computed in{' '}
        {(diffResult.computeTimeMs / 1000).toFixed(1)}s
      </div>

      <div className="max-h-80 overflow-y-auto rounded-md border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-[hsl(38,30%,98%)] dark:bg-[hsl(25,8%,11%)] text-xs text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">District</th>
              <th className="text-left font-medium px-3 py-2">State</th>
              <th className="text-left font-medium px-3 py-2">Change</th>
              <th className="text-right font-medium px-3 py-2">Overlap</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">
                  No {filter !== 'all' ? filter : 'changed'} districts found.
                </td>
              </tr>
            )}
            {rows.map(row => (
              <tr
                key={row.rowKey}
                onClick={() => onSelectFeature(row.selectId === selectedFeatureId ? null : row.selectId)}
                className={`cursor-pointer border-t border-[hsl(35,18%,92%)] dark:border-[hsl(25,8%,14%)] hover:bg-accent ${
                  row.selectId === selectedFeatureId ? 'bg-accent' : ''
                }`}
              >
                <td className="px-3 py-1.5">{row.name}</td>
                <td className="px-3 py-1.5 text-muted-foreground">{row.stateName}</td>
                <td className="px-3 py-1.5">
                  <Badge variant="outline" className="capitalize text-xs">
                    {row.classification}
                    {row.lowConfidence ? ' (low conf.)' : ''}
                  </Badge>
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums text-muted-foreground">
                  {row.iou != null ? `${(row.iou * 100).toFixed(0)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
