import React, { useState } from 'react';
import { Download, Search, ChevronDown } from 'lucide-react';

const R2 = 'https://geo.bharatviz.org';

interface HealthLayer {
  id: string;
  displayName: string;
  source: string;
  year: number;
  rows: string;
  description: string;
  parquetUrl: string;
  fields: string;
  mcpId: string;
}

const HEALTH_LAYERS: HealthLayer[] = [
  {
    id: 'nhp-health-facilities',
    displayName: 'NHP Health Facilities 2025',
    source: 'National Health Portal / data.gov.in (GODL)',
    year: 2025,
    rows: '166,462',
    description: 'SubCentres, PHCs, CHCs, hospitals, and clinics from the National Institute of Health and Family Welfare via data.gov.in.',
    fields: 'health_facility_name, facility_type, state_name, district_name, taluka_name, block_name, address, pincode',
    parquetUrl: `${R2}/geoparquet/health/nhp_health_facilities_2025.parquet`,
    mcpId: 'nhp-health-facilities',
  },
  {
    id: 'nhp-hospital-directory',
    displayName: 'NHP Hospital Directory 2025',
    source: 'National Health Portal (GODL)',
    year: 2025,
    rows: '10,843',
    description: 'Hospitals with beds, specialties, accreditation status, and staff counts from the National Health Portal.',
    fields: 'Hospital_Name, Hospital_Category, Hospital_Care_Type, Specialties, Facilities, Accreditation, Total_Num_Beds, Number_Doctor, Emergency_Services, State, District, Pincode',
    parquetUrl: `${R2}/geoparquet/health/nhp_hospital_directory_2025.parquet`,
    mcpId: 'nhp-hospital-directory',
  },
  {
    id: 'nhp-blood-banks',
    displayName: 'NHP Blood Banks 2015',
    source: 'National Health Portal (GODL)',
    year: 2015,
    rows: '897',
    description: 'Blood banks with component availability, blood groups, service hours, and contact details.',
    fields: 'h_name, category, state, district, city, blood_component, blood_group, service_time, contact',
    parquetUrl: `${R2}/geoparquet/health/nhp_blood_banks_2015.parquet`,
    mcpId: 'nhp-blood-banks',
  },
  {
    id: 'anganwadis-icds',
    displayName: 'Anganwadis (ICDS) 2024',
    source: 'GatiShakti / Ministry of Women and Child Development (GODL)',
    year: 2024,
    rows: '~1,400,000',
    description: 'ICDS Anganwadi centres - the primary early childhood nutrition and care network.',
    fields: 'id, geometry',
    parquetUrl: `${R2}/geoparquet/health/anganwadis_icds_2024.parquet`,
    mcpId: 'anganwadis-icds',
  },
  {
    id: 'bharatmaps-health-centers',
    displayName: 'BharatMaps Health Centers',
    source: 'BharatMaps / Government of India',
    year: 2024,
    rows: '-',
    description: 'Health centres from the BharatMaps portal. Independent coverage useful for cross-checking NHP data.',
    fields: 'name, type, geometry',
    parquetUrl: `${R2}/geoparquet/health/bharatmaps_health_centers.parquet`,
    mcpId: 'bharatmaps-health-centers',
  },
  {
    id: 'bhuvan-sisdp-anganwadis',
    displayName: 'Bhuvan SISDP Anganwadis',
    source: 'ISRO Bhuvan SISDP (GODL)',
    year: 2024,
    rows: '-',
    description: 'Anganwadi centres from ISRO Bhuvan SISDP portal. A separate source for coverage comparison with GatiShakti ICDS.',
    fields: 'name, geometry',
    parquetUrl: `${R2}/geoparquet/health/bhuvan_sisdp_anganwadis.parquet`,
    mcpId: 'bhuvan-sisdp-anganwadis',
  },
  {
    id: 'gatishakti-child-care',
    displayName: 'GatiShakti Child Care Institutes',
    source: 'GatiShakti / MoWCD (GODL)',
    year: 2024,
    rows: '-',
    description: 'Government-run creches and child development centres from GatiShakti.',
    fields: 'name, type, geometry',
    parquetUrl: `${R2}/geoparquet/health/gatishakti_child_care_institutes.parquet`,
    mcpId: 'gatishakti-child-care',
  },
  {
    id: 'ncog-soi-dispensaries',
    displayName: 'SOI NCOG Dispensaries',
    source: 'Survey of India NCOG (GODL)',
    year: 2024,
    rows: '-',
    description: 'Dispensaries from the Survey of India NCOG dataset.',
    fields: 'name, type, state, district, geometry',
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_dispensaries.parquet`,
    mcpId: 'ncog-soi-dispensaries',
  },
  {
    id: 'ncog-soi-hospitals',
    displayName: 'SOI NCOG Hospitals',
    source: 'Survey of India NCOG (GODL)',
    year: 2024,
    rows: '-',
    description: 'Hospitals from the Survey of India NCOG dataset.',
    fields: 'name, type, state, district, geometry',
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_hospitals.parquet`,
    mcpId: 'ncog-soi-hospitals',
  },
  {
    id: 'livingatlas-health-facilities',
    displayName: 'Living Atlas Health Facilities',
    source: 'Esri Living Atlas',
    year: 2024,
    rows: '-',
    description: 'Health facilities from the Esri Living Atlas, aggregating multiple open government sources.',
    fields: 'name, type, source, geometry',
    parquetUrl: `${R2}/geoparquet/health/livingatlas_health_facilities.parquet`,
    mcpId: 'livingatlas-health-facilities',
  },
  {
    id: 'hotosm-health-facilities',
    displayName: 'HOTOSM Health Facilities (OpenStreetMap)',
    source: 'HOTOSM / OpenStreetMap (ODbL)',
    year: 2026,
    rows: '142,629',
    description: 'Hospitals, clinics, pharmacies, dentists, and health posts from OpenStreetMap. Updated monthly.',
    fields: 'name, amenity, healthcare, healthcare_speciality, operator_type, capacity_persons, addr_city, adm1_name, adm2_name',
    parquetUrl: `${R2}/geoparquet/facilities/hotosm_ind_health_facilities.parquet`,
    mcpId: 'hotosm-health-facilities',
  },
];

interface HealthPanelProps {
  darkMode?: boolean;
}

export const HealthPanel: React.FC<HealthPanelProps> = ({ darkMode }) => {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';
  const cardClass = 'border rounded-lg bg-card border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const badgeClass = 'inline-block px-2 py-0.5 rounded text-xs font-mono bg-[hsl(28,42%,94%)] text-[hsl(28,48%,30%)] dark:bg-[hsl(28,20%,14%)] dark:text-[hsl(28,55%,62%)]';

  const filtered = HEALTH_LAYERS.filter(l => {
    const q = query.toLowerCase();
    return !q || l.displayName.toLowerCase().includes(q) || l.description.toLowerCase().includes(q) || l.source.toLowerCase().includes(q) || l.fields.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className={`text-sm font-semibold mb-1 ${headingClass}`}>Health Facility Datasets</h3>
        <p className={`text-xs ${textClass}`}>
          Point datasets for all major government health facility registries. Download as GeoParquet for use in Python, R, or DuckDB.
          Use the MCP server to run per-district aggregations with an AI assistant.
        </p>
      </div>

      {/* MCP usage hint */}
      <div className={`${cardClass} p-4`}>
        <p className="text-xs font-semibold uppercase tracking-wide mb-2 text-[hsl(28,10%,50%)] dark:text-[hsl(30,6%,40%)]">Choropleth from point data via MCP</p>
        <pre className="text-xs font-mono bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)] p-3 rounded overflow-x-auto">{`# Count NHP health facilities per district, render choropleth
aggregate_by_boundary(
  boundaryMapId = "lgd-districts",
  boundaryFilters = {"state_name": "Maharashtra"},
  targetMapId = "nhp-health-facilities"
)
# Then pass the _count column to render_districts_map`}</pre>
        <p className={`text-xs mt-2 ${textClass}`}>
          Ask any MCP-connected AI assistant to run this for you.
          The <span className="font-mono">aggregate_by_boundary</span> tool counts facilities per district and returns values ready for choropleth rendering.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(28,8%,50%)]" />
        <input
          type="text"
          placeholder="Search datasets..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-[hsl(38,22%,99%)] border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)] placeholder-[hsl(28,8%,56%)] dark:bg-[hsl(25,8%,11%)] dark:border-[hsl(25,8%,16%)] dark:text-[hsl(35,10%,82%)] dark:placeholder-[hsl(28,8%,36%)] focus:outline-none focus:ring-2 focus:ring-[hsl(28,62%,48%)] focus:border-transparent"
        />
      </div>

      {/* Dataset cards */}
      <div className="space-y-2">
        {filtered.map(layer => (
          <div key={layer.id} className={`${cardClass} overflow-hidden`}>
            <button
              className="w-full text-left px-4 py-3 flex items-start justify-between gap-3 hover:bg-[hsl(35,14%,97%)] dark:hover:bg-[hsl(25,8%,11%)] transition-colors"
              onClick={() => setExpanded(expanded === layer.id ? null : layer.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-medium ${headingClass}`}>{layer.displayName}</span>
                  <span className={badgeClass}>{layer.year}</span>
                  {layer.rows !== '-' && (
                    <span className="text-xs text-[hsl(28,8%,52%)] dark:text-[hsl(30,8%,50%)]">{layer.rows} rows</span>
                  )}
                </div>
                <p className={`text-xs mt-0.5 truncate ${textClass}`}>{layer.source}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0 mt-0.5">
                <a
                  href={layer.parquetUrl}
                  download
                  onClick={e => e.stopPropagation()}
                  title="Download GeoParquet"
                  className="p-1.5 rounded hover:bg-[hsl(35,14%,92%)] dark:hover:bg-[hsl(25,8%,16%)] transition-colors text-[hsl(28,8%,44%)] hover:text-[hsl(28,48%,36%)] dark:text-[hsl(30,8%,52%)] dark:hover:text-[hsl(28,55%,62%)]"
                >
                  <Download className="h-4 w-4" />
                </a>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 transition-transform duration-200 ${expanded === layer.id ? 'rotate-180' : ''} text-muted-foreground dark:text-[hsl(30,8%,50%)]`}
                />
              </div>
            </button>

            {expanded === layer.id && (
              <div className="px-4 pb-4 border-t border-[hsl(35,18%,88%)] dark:border-[hsl(25,8%,14%)] pt-3 space-y-3">
                <p className={`text-xs ${textClass}`}>{layer.description}</p>
                <div>
                  <p className="text-xs font-semibold text-[hsl(28,20%,35%)] dark:text-[hsl(35,10%,72%)] mb-1">Fields</p>
                  <p className="text-xs font-mono text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,55%)] break-all">{layer.fields}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={layer.parquetUrl}
                    download
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[hsl(28,42%,94%)] text-[hsl(28,48%,30%)] hover:bg-[hsl(28,42%,88%)] dark:bg-[hsl(28,20%,14%)] dark:text-[hsl(28,55%,62%)] dark:hover:bg-[hsl(28,20%,18%)] transition-colors"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Download GeoParquet
                  </a>
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono rounded-md bg-[hsl(25,8%,94%)] text-[hsl(28,8%,35%)] dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,65%)]">
                    MCP: <span className="font-semibold">{layer.mcpId}</span>
                  </div>
                </div>
                <div className={`text-xs ${textClass}`}>
                  <span className="font-medium">Python: </span>
                  <code className="font-mono text-[hsl(28,48%,36%)] dark:text-[hsl(28,55%,62%)]">
                    {`import geopandas as gpd; df = gpd.read_parquet("${layer.parquetUrl}")`}
                  </code>
                </div>
                <div className={`text-xs ${textClass}`}>
                  <span className="font-medium">R: </span>
                  <code className="font-mono text-[hsl(28,48%,36%)] dark:text-[hsl(28,55%,62%)]">
                    {`sfarrow::st_read_parquet("${layer.parquetUrl}")`}
                  </code>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className={`text-sm ${textClass}`}>No datasets match "{query}".</p>
      )}
    </div>
  );
};
