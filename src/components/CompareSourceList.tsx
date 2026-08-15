import React, { useState } from 'react';
import type { SourceFeatureList } from '@/lib/useSourceFeatureLists';

interface CompareSourceListProps {
  lists: Record<string, SourceFeatureList>;
  sourceIds: string[];
}

export const CompareSourceList: React.FC<CompareSourceListProps> = ({ lists, sourceIds }) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = activeId ?? sourceIds[0] ?? null;
  const activeList = active ? lists[active] : null;

  if (sourceIds.length === 0) return null;

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        {sourceIds.map(id => {
          const list = lists[id];
          return (
            <button
              key={id}
              onClick={() => setActiveId(id)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                active === id
                  ? 'border-[hsl(28,62%,48%)] bg-[hsl(28,62%,48%)]/10 font-medium'
                  : 'border-input hover:bg-accent text-muted-foreground'
              }`}
            >
              {list?.entry.displayName ?? id}
              {list && !list.loading && !list.error && <span className="ml-1 text-muted-foreground">({list.names.length})</span>}
            </button>
          );
        })}
      </div>

      {activeList?.loading && (
        <p className="text-xs text-muted-foreground">Loading…</p>
      )}
      {activeList?.error && (
        <p className="text-xs text-destructive">{activeList.error}</p>
      )}
      {activeList && !activeList.loading && !activeList.error && (
        <>
          <p className="text-xs text-muted-foreground mb-2">
            {activeList.names.length} feature{activeList.names.length === 1 ? '' : 's'} in {activeList.entry.displayName}
          </p>
          <div className="max-h-64 overflow-y-auto rounded-md border border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)]">
            {activeList.names.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">No features found.</p>
            ) : (
              <ul className="text-sm divide-y divide-[hsl(35,18%,92%)] dark:divide-[hsl(25,8%,14%)]">
                {activeList.names.map((name, i) => (
                  <li key={`${name}-${i}`} className="px-3 py-1.5">{name}</li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
};
