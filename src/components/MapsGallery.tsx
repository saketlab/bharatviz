import React, { useState } from 'react';
import { ExternalLink, Download, Hash, Search } from 'lucide-react';

interface MapsGalleryProps {
  darkMode?: boolean;
}

interface MapEntry {
  id: string;
  level: string;
  source: string;
  year: number;
  description: string;
  geojsonUrl: string;
  parquetUrl?: string;
  category: string;
  tab: string;
  tabParam?: string;
}

const R2 = 'https://geo.bharatviz.org';
const CENSUS = `${R2}/geojsons/census`;
const DIST = `${R2}/geojsons/districts`;

const ALL_MAPS: MapEntry[] = [
  // Census boundaries
  ...([1872,1881,1891,1901,1911,1921,1931,1941,1951,1961,1971,1981,1991,2001,2011] as const).flatMap(yr => [
    { id: `census-${yr}-states`, level: 'States', source: `Census ${yr}`, year: yr, description: `State boundaries from the ${yr} Census of India`, geojsonUrl: `${CENSUS}/India-${yr}-states.geojson`, category: 'Census', tab: 'states', tabParam: `mapType=census-${yr}-states` },
    { id: `census-${yr}-districts`, level: 'Districts', source: `Census ${yr}`, year: yr, description: `District boundaries from the ${yr} Census of India`, geojsonUrl: `${CENSUS}/India-${yr}-districts.geojson`, category: 'Census', tab: 'districts', tabParam: `mapType=census-${yr}-districts` },
  ]),
  // Census 2011 enriched
  { id: 'census-2011-enriched', level: 'Districts', source: 'Census 2011 (enriched)', year: 2011, description: 'Census 2011 district boundaries with 267 demographic columns: population, SC/ST%, literacy, language diversity, and per-language speaker shares.', geojsonUrl: `${R2}/geojsons/census2011/india_census2011_districts.geojson`, parquetUrl: `${R2}/geoparquet/census2011/india_census2011_districts.parquet`, category: 'Census', tab: 'census' },
  // LGD
  { id: 'lgd-states', level: 'States', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official state boundaries from the Local Government Directory', geojsonUrl: `${DIST}/India_LGD_states.geojson`, category: 'Official', tab: 'states' },
  { id: 'lgd-districts', level: 'Districts', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official district boundaries from the Local Government Directory', geojsonUrl: `${DIST}/India_LGD_districts.geojson`, category: 'Official', tab: 'districts' },
  // NFHS
  { id: 'nfhs4-states', level: 'States', source: 'NFHS-4 (2015-16)', year: 2016, description: 'State boundaries from NFHS-4 survey', geojsonUrl: `${DIST}/India_NFHS4_states_simplified.geojson`, category: 'Survey', tab: 'states' },
  { id: 'nfhs4-districts', level: 'Districts', source: 'NFHS-4 (2015-16)', year: 2016, description: 'District boundaries from NFHS-4 survey', geojsonUrl: `${DIST}/India_NFHS4_districts_simplified.geojson`, category: 'Survey', tab: 'districts' },
  { id: 'nfhs5-states', level: 'States', source: 'NFHS-5 (2019-21)', year: 2021, description: 'State boundaries from NFHS-5 survey', geojsonUrl: `${DIST}/India_NFHS5_states_simplified.geojson`, category: 'Survey', tab: 'states' },
  { id: 'nfhs5-districts', level: 'Districts', source: 'NFHS-5 (2019-21)', year: 2021, description: 'District boundaries from NFHS-5 survey', geojsonUrl: `${DIST}/India_NFHS5_districts_simplified.geojson`, category: 'Survey', tab: 'districts' },
  // SOI
  { id: 'soi-states', level: 'States', source: 'Survey of India', year: 2020, description: 'State boundaries from the Survey of India', geojsonUrl: `${DIST}/India-soi-states.geojson`, category: 'Official', tab: 'states' },
  { id: 'soi-districts', level: 'Districts', source: 'Survey of India', year: 2020, description: 'District boundaries from the Survey of India', geojsonUrl: `${DIST}/India-soi-districts.geojson`, category: 'Official', tab: 'districts' },
  // Bhuvan
  { id: 'bhuvan-states', level: 'States', source: 'ISRO Bhuvan', year: 2020, description: 'State boundaries from ISRO Bhuvan satellite data', geojsonUrl: `${DIST}/India-bhuvan-states.geojson`, category: 'Official', tab: 'states' },
  { id: 'bhuvan-districts', level: 'Districts', source: 'ISRO Bhuvan', year: 2020, description: 'District boundaries from ISRO Bhuvan satellite data', geojsonUrl: `${DIST}/India-bhuvan-districts.geojson`, category: 'Official', tab: 'districts' },
  // NSSO
  { id: 'nsso-regions', level: 'Regions', source: 'NSSO', year: 2021, description: 'NSSO regional boundaries based on NFHS-5', geojsonUrl: `${DIST}/India_NFHS5_NSSO_regions_boundaries.geojson`, category: 'Survey', tab: 'regions' },
  // Sub-admin
  { id: 'lgd-subdistricts', level: 'Sub-districts', source: 'LGD', year: 2024, description: 'LGD subdistrict (tehsil/taluka) boundaries', geojsonUrl: `${R2}/geojsons/admin/India-geodata-lgd-subdistricts.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'soi-subdistricts', level: 'Sub-districts', source: 'Survey of India', year: 2020, description: 'Survey of India subdistrict boundaries', geojsonUrl: `${R2}/geojsons/admin/India-geodata-soi-subdistricts.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'lgd-blocks', level: 'Blocks', source: 'LGD', year: 2024, description: 'LGD block-level boundaries', geojsonUrl: `${R2}/geojsons/admin/India-geodata-lgd-blocks.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'bhuvan-blocks', level: 'Blocks', source: 'ISRO Bhuvan', year: 2020, description: 'NRSC Bhuvan block-level boundaries', geojsonUrl: `${R2}/geojsons/admin/India-geodata-bhuvan-blocks.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'pmgsy-blocks', level: 'Blocks', source: 'PMGSY', year: 2024, description: 'PMGSY block boundaries', geojsonUrl: `${R2}/geojsons/admin/India-geodata-pmgsy-blocks.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'shrug-subdistricts', level: 'Sub-districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 subdistrict polygons from the SHRUG platform. CC BY-NC-SA 4.0.', geojsonUrl: `${R2}/geojsons/admin/India-shrug-subdistrict-pc11_simplified.geojson`, category: 'Sub-admin', tab: 'sub-admin' },
  // Electoral
  { id: 'lgd-parliament', level: 'Constituencies', source: 'LGD', year: 2024, description: 'Lok Sabha parliamentary constituency boundaries', geojsonUrl: `${R2}/geojsons/electoral/India-geodata-lgd-parliament.geojson`, category: 'Electoral', tab: 'electoral' },
  { id: 'lgd-assembly', level: 'Constituencies', source: 'LGD', year: 2024, description: 'Vidhan Sabha assembly constituency boundaries', geojsonUrl: `${R2}/geojsons/electoral/India-geodata-lgd-assembly.geojson`, category: 'Electoral', tab: 'electoral' },
  { id: 'susewind-parliament-2014', level: 'Constituencies', source: 'Susewind (2014)', year: 2014, description: 'Lok Sabha constituency boundaries (2014 election). CC BY-NC-SA 4.0.', geojsonUrl: `${R2}/geojsons/electoral/India-susewind-parliament-2014_simplified.geojson`, category: 'Electoral', tab: 'electoral' },
  { id: 'susewind-assembly-2014', level: 'Constituencies', source: 'Susewind (2014)', year: 2014, description: 'Vidhan Sabha constituency boundaries (~2014). CC BY-NC-SA 4.0.', geojsonUrl: `${R2}/geojsons/electoral/India-susewind-assembly-2014_simplified.geojson`, category: 'Electoral', tab: 'electoral' },
  // SHRUG districts
  { id: 'shrug-districts', level: 'Districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 district polygons from the SHRUG platform. CC BY-NC-SA 4.0.', geojsonUrl: `${R2}/geojsons/districts/India-shrug-district-pc11_simplified.geojson`, category: 'Survey', tab: 'districts' },
  // Environment
  { id: 'gs-wildlife', level: 'Regions', source: 'GatiShakti', year: 2024, description: 'Protected wildlife sanctuaries and national parks', geojsonUrl: `${R2}/geojsons/environment/India-geodata-wildlife.geojson`, category: 'Environment', tab: 'environment' },
  { id: 'bm-eco-zones', level: 'Regions', source: 'GatiShakti', year: 2024, description: 'Biological / eco-sensitive zone boundaries', geojsonUrl: `${R2}/geojsons/environment/India-geodata-eco-zones.geojson`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-circles', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative circles', geojsonUrl: `${R2}/geojsons/environment/India-fsi-circles_simplified.geojson`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-divisions', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative divisions', geojsonUrl: `${R2}/geojsons/environment/India-fsi-divisions_simplified.geojson`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-ranges', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative ranges', geojsonUrl: `${R2}/geojsons/environment/India-fsi-ranges_simplified.geojson`, category: 'Environment', tab: 'environment' },
  // Urban
  { id: 'sbm-ulbs', level: 'Urban', source: 'SBM', year: 2024, description: 'Urban Local Body boundaries from the Swachh Bharat Mission', geojsonUrl: `${R2}/geojsons/urban/India-sbm-ulbs_simplified.geojson`, category: 'Urban', tab: 'urban' },
  // Points
  { id: 'hotosm-health-facilities', level: 'Points', source: 'HOTOSM / OpenStreetMap', year: 2026, description: '142,629 health facilities across India from OpenStreetMap', geojsonUrl: `${R2}/geojsons/facilities/hotosm_ind_health_facilities.geojson`, parquetUrl: `${R2}/geoparquet/facilities/hotosm_ind_health_facilities.parquet`, category: 'Points', tab: 'districts' },
  { id: 'airports', level: 'Points', source: 'OurAirports (Public Domain)', year: 2026, description: '649 airports and airfields in India', geojsonUrl: `${R2}/geojsons/points/india_airports.geojson`, parquetUrl: `${R2}/geoparquet/points/india_airports.parquet`, category: 'Points', tab: 'districts' },
  { id: 'dams', level: 'Points', source: 'OpenStreetMap (ODbL)', year: 2026, description: 'Dams and barrages across India', geojsonUrl: `${R2}/geojsons/points/india_dams.geojson`, parquetUrl: `${R2}/geoparquet/points/india_dams.parquet`, category: 'Points', tab: 'districts' },
  { id: 'water-bodies', level: 'Points', source: 'OpenStreetMap (ODbL)', year: 2026, description: 'Lakes, reservoirs, ponds and other natural water bodies', geojsonUrl: `${R2}/geojsons/points/india_water_bodies.geojson`, parquetUrl: `${R2}/geoparquet/points/india_water_bodies.parquet`, category: 'Points', tab: 'districts' },
  { id: 'pincodes-centroids', level: 'Points', source: 'BharatViz', year: 2026, description: '63,864 pincode centroids for proximity queries', geojsonUrl: `${R2}/geojsons/points/india_pincodes_centroids.geojson`, parquetUrl: `${R2}/geoparquet/points/india_pincodes_centroids.parquet`, category: 'Points', tab: 'pincodes' },
];

const CATEGORIES = ['All', 'Census', 'Official', 'Survey', 'Sub-admin', 'Electoral', 'Environment', 'Urban', 'Points'];

const categoryColors: Record<string, string> = {
  Census: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Official: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Survey: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Sub-admin': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  Electoral: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Environment: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Urban: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Points: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
};

function viewInBharatViz(map: MapEntry): string {
  const base = `https://bharatviz.org/${map.tab}`;
  if (map.tabParam) return `${base}?${map.tabParam}`;
  return base;
}

const SectionAnchor: React.FC<{ id: string }> = ({ id }) => (
  <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-50 hover:!opacity-100 text-inherit transition-opacity" aria-hidden>
    <Hash className="h-4 w-4 inline" />
  </a>
);

const MapsGallery: React.FC<MapsGalleryProps> = () => {
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const tableHeaderClass = 'text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]';
  const tableCellClass = 'p-3 text-sm border-[hsl(35,18%,84%)] text-[hsl(28,8%,40%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,58%)]';

  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');

  const filtered = ALL_MAPS.filter(m => {
    const matchCat = activeCategory === 'All' || m.category === activeCategory;
    const q = query.toLowerCase();
    const matchQ = !q || m.id.includes(q) || m.source.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || String(m.year).includes(q) || m.level.toLowerCase().includes(q);
    return matchCat && matchQ;
  });

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h2 id="maps-gallery" className={`text-2xl ${headingClass} mb-2 flex items-center gap-3 group`}>
          Maps Gallery
          <SectionAnchor id="maps-gallery" />
        </h2>
        <p className={`${textClass} text-lg`}>
          All {ALL_MAPS.length} boundary layers available in BharatViz. Each layer can be opened
          directly in the map viewer or downloaded as GeoJSON / GeoParquet.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(28,8%,50%)]" />
          <input
            type="text"
            placeholder="Search maps…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)] placeholder-[hsl(28,8%,56%)] dark:bg-[hsl(25,8%,12%)] dark:border-[hsl(25,8%,18%)] dark:text-[hsl(35,12%,90%)] dark:placeholder-[hsl(30,6%,40%)] focus:outline-none focus:ring-2 focus:ring-[hsl(28,55%,48%)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeCategory === cat
                  ? 'bg-[hsl(28,62%,48%)] text-white'
                  : 'bg-[hsl(35,18%,94%)] text-[hsl(28,20%,30%)] hover:bg-[hsl(35,18%,88%)] dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,65%)] dark:hover:bg-[hsl(25,8%,18%)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <p className={`text-sm ${textClass}`}>{filtered.length} layer{filtered.length !== 1 ? 's' : ''}</p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
          <thead>
            <tr>
              <th className={`${tableHeaderClass} border`}>Map ID</th>
              <th className={`${tableHeaderClass} border`}>Level</th>
              <th className={`${tableHeaderClass} border`}>Source</th>
              <th className={`${tableHeaderClass} border hidden sm:table-cell`}>Year</th>
              <th className={`${tableHeaderClass} border hidden md:table-cell`}>Description</th>
              <th className={`${tableHeaderClass} border`}>Links</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => (
              <tr key={m.id} className="hover:bg-[hsl(35,14%,97%)] dark:hover:bg-[hsl(25,8%,11%)] transition-colors">
                <td className={`${tableCellClass} border`}>
                  <div className="flex flex-col gap-1">
                    <code className="text-xs font-mono text-[hsl(28,20%,18%)] dark:text-[hsl(35,10%,80%)]">{m.id}</code>
                    <span className={`text-xs px-1.5 py-0.5 rounded w-fit ${categoryColors[m.category] ?? ''}`}>{m.category}</span>
                  </div>
                </td>
                <td className={`${tableCellClass} border text-xs`}>{m.level}</td>
                <td className={`${tableCellClass} border text-xs`}>{m.source}</td>
                <td className={`${tableCellClass} border text-xs hidden sm:table-cell`}>{m.year}</td>
                <td className={`${tableCellClass} border text-xs hidden md:table-cell max-w-xs`}>{m.description}</td>
                <td className={`${tableCellClass} border`}>
                  <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <a
                      href={viewInBharatViz(m)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)] hover:underline"
                    >
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      Open in BharatViz
                    </a>
                    <a
                      href={m.geojsonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,58%)] hover:underline"
                    >
                      <Download className="h-3 w-3 flex-shrink-0" />
                      GeoJSON
                    </a>
                    {m.parquetUrl && (
                      <a
                        href={m.parquetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,58%)] hover:underline"
                      >
                        <Download className="h-3 w-3 flex-shrink-0" />
                        GeoParquet
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default MapsGallery;
