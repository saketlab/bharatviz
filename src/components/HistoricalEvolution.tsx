import React, { useState } from 'react';
import { EvolutionMap } from './EvolutionMap';
import { IndiaEvolutionMap } from './IndiaEvolutionMap';
import { useDarkMode } from '@/hooks/useDarkMode';

const VIEWS = [
  { id: 'india',      label: 'India 1951–2024' },
  { id: 'india1872',  label: 'India 1872–1941' },
  { id: 'bombay',     label: 'Bombay 1872–1941' },
] as const;

type View = typeof VIEWS[number]['id'];

const DESCRIPTIONS: Record<View, string> = {
  india:      'District boundaries across eight census decades. Colours trace each district to its 1951 origin — splits, merges, and renames preserve the parent\'s colour.',
  india1872:  'All-India district boundaries across eight census decades under British colonial administration. Colours trace each district to its 1872 origin.',
  bombay:     'Spatial boundaries of Bombay Presidency across seven census years. Colours trace each district to its 1872 origin.',
};

const SOURCES: Record<View, string> = {
  india:      'GeoJSON: Census of India. Evolution data: India State and District Evolution Database doi:10.7910/DVN/D1AGUR',
  india1872:  'GeoJSON: Jolad et al., Harvard Dataverse. Evolution data: India State and District Evolution Database doi:10.7910/DVN/D1AGUR',
  bombay:     'GeoJSON: Jolad et al., Harvard Dataverse. Evolution data: India State and District Evolution Database doi:10.7910/DVN/D1AGUR',
};

const INDIA_1872_GEOJSON_YEAR: Record<number, number> = {
  1872: 1872, 1881: 1881, 1891: 1891, 1901: 1901,
  1911: 1911, 1921: 1921, 1931: 1931, 1941: 1941,
};

export function HistoricalEvolution({ darkMode: _darkMode }: { darkMode?: boolean } = {}) {
  const { dark: darkMode } = useDarkMode();
  const [view, setView] = useState<View>('india');

  return (
    <div className="space-y-0">
      <div className="border rounded-t-lg px-4 pt-4 pb-3 bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold leading-tight text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
              Administrative Evolution
            </h2>
            <p className="mt-1 text-xs leading-relaxed max-w-prose text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,55%)]">
              {DESCRIPTIONS[view]}
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 rounded-lg self-start shrink-0 bg-[hsl(35,20%,93%)] dark:bg-[hsl(25,8%,12%)]">
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(28,62%,48%)] focus-visible:ring-offset-1 ${
                  view === v.id
                    ? 'bg-white text-amber-700 shadow-sm dark:bg-[hsl(25,8%,18%)] dark:text-[hsl(28,55%,58%)]'
                    : 'text-[hsl(28,8%,44%)] hover:text-[hsl(28,20%,22%)] dark:text-[hsl(30,8%,50%)] dark:hover:text-[hsl(35,10%,75%)]'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="border-x border-b rounded-b-lg overflow-hidden bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,5%)] dark:border-[hsl(25,8%,14%)]">
        {view === 'india' && <IndiaEvolutionMap darkMode={darkMode} />}
        {view === 'india1872' && (
          <IndiaEvolutionMap
            darkMode={darkMode}
            evolutionFile="/evolution-data/india_evolution_1872_1941.json"
            geojsonYearMap={INDIA_1872_GEOJSON_YEAR}
            originYear={1872}
          />
        )}
        {view === 'bombay' && <EvolutionMap darkMode={darkMode} />}
      </div>

      <p className="pt-2 text-[10px] text-[hsl(28,8%,60%)] dark:text-[hsl(30,8%,40%)]">
        {SOURCES[view]}
      </p>
    </div>
  );
}
