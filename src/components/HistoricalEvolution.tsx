import React, { useState } from 'react';
import { EvolutionMap } from './EvolutionMap';
import { IndiaEvolutionMap } from './IndiaEvolutionMap';

interface HistoricalEvolutionProps {
  darkMode?: boolean;
}

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

export function HistoricalEvolution({ darkMode = false }: HistoricalEvolutionProps) {
  const [view, setView] = useState<View>('india');

  return (
    <div className="space-y-0">
      <div className={`border rounded-t-lg px-4 pt-4 pb-3 ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
          <div>
            <h2 className={`text-lg font-bold leading-tight ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              Administrative Evolution
            </h2>
            <p className={`mt-1 text-xs leading-relaxed max-w-prose ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
              {DESCRIPTIONS[view]}
            </p>
          </div>
          <div className={`flex items-center gap-1 p-1 rounded-lg self-start shrink-0 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            {VIEWS.map(v => (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  view === v.id
                    ? darkMode ? 'bg-gray-700 text-amber-400' : 'bg-white text-amber-700 shadow-sm'
                    : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`border-x border-b rounded-b-lg overflow-hidden ${darkMode ? 'bg-[#0f0f0f] border-[#333]' : 'bg-white border-gray-200'}`}>
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

      <p className={`pt-2 text-[10px] ${darkMode ? 'text-gray-700' : 'text-gray-400'}`}>
        {SOURCES[view]}
      </p>
    </div>
  );
}
