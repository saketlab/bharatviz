import React, { useState } from 'react';
import { EvolutionMap } from './EvolutionMap';
import { IndiaEvolutionMap } from './IndiaEvolutionMap';

interface HistoricalEvolutionProps {
  darkMode?: boolean;
}

function btnClass(active: boolean, darkMode: boolean) {
  return `px-4 py-1.5 rounded text-sm font-medium transition-colors ${
    active
      ? darkMode ? 'bg-gray-700 text-amber-400' : 'bg-white text-amber-700 shadow-sm'
      : darkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
  }`;
}

export function HistoricalEvolution({ darkMode = false }: HistoricalEvolutionProps) {
  const [view, setView] = useState<'india' | 'bombay'>('india');

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`p-4 sm:p-6 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {view === 'india'
                ? 'India: Administrative Evolution 1951-2024'
                : 'Bombay Presidency: Administrative Evolution 1872-1941'}
            </h2>
            <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
              {view === 'india'
                ? 'District boundaries across eight census decades. Each district is coloured by its 1951 origin — splits, merges, and renames preserve the colour of the parent. Click any district to highlight its lineage.'
                : 'Spatial boundaries of Bombay Presidency across seven census years. Districts are coloured by their 1872 origin. Use the scrubber to move through time.'}
            </p>
          </div>
          <div className={`flex items-center gap-1 p-1 rounded-lg shrink-0 ${darkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
            <button className={btnClass(view === 'india', darkMode)} onClick={() => setView('india')}>India 1951-2024</button>
            <button className={btnClass(view === 'bombay', darkMode)} onClick={() => setView('bombay')}>Bombay 1872-1941</button>
          </div>
        </div>
      </div>

      <div className={`border rounded-lg overflow-hidden ${darkMode ? 'bg-[#0f0f0f] border-[#333]' : 'bg-white border-gray-200'}`}>
        {view === 'india'
          ? <IndiaEvolutionMap darkMode={darkMode} />
          : <EvolutionMap darkMode={darkMode} />}
      </div>

      <div className={`text-xs px-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
        {view === 'india'
          ? 'Sources: GeoJSON boundaries - Census of India. Evolution data - India State and District Evolution Database doi:10.7910/DVN/D1AGUR'
          : 'Sources: GeoJSON boundaries - Jolad et al., Harvard Dataverse. Evolution mapping - India State and District Evolution Database doi:10.7910/DVN/D1AGUR'}
      </div>
    </div>
  );
}
