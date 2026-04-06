import React from 'react';
import { EvolutionMap } from './EvolutionMap';

interface HistoricalEvolutionProps {
  darkMode?: boolean;
}

export function HistoricalEvolution({ darkMode = false }: HistoricalEvolutionProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className={`p-4 sm:p-6 border rounded-lg ${darkMode ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-200'}`}>
        <h2 className={`text-xl sm:text-2xl font-bold mb-2 ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Bombay Presidency: Administrative Evolution 1872-1941
        </h2>
        <p className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Spatial boundaries of Bombay Presidency across seven census years.
          Districts are coloured by their 1872 origin; the same district keeps the same colour
          even as it is renamed, split, or merged. Use the scrubber to move through time.
        </p>
      </div>

      <div className={`border rounded-lg overflow-hidden ${darkMode ? 'bg-[#0f0f0f] border-[#333]' : 'bg-white border-gray-200'}`}>
        <EvolutionMap darkMode={darkMode} />
      </div>

      <div className={`text-xs px-2 ${darkMode ? 'text-gray-600' : 'text-gray-400'}`}>
        Sources: GeoJSON boundaries — Jolad et al., Harvard Dataverse. Evolution mapping — India State and District Evolution Database doi:10.7910/DVN/D1AGUR
      </div>
    </div>
  );
}
