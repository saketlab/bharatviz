const R2 = 'https://geo.bharatviz.org';
const STATES_URL = `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`;

export interface GeoDataLayer {
  id: string;
  displayName: string;
  description: string;
  url: string;
  statesUrl: string;
  featureNameProp: string; // property used as the label for each feature
  csvColumns: string[]; // required CSV columns for user data upload
  source: string; // key for citations.ts
}

export const SUB_ADMIN_LAYERS: GeoDataLayer[] = [
  {
    id: 'lgd_subdistricts',
    displayName: 'LGD Subdistricts',
    description: 'Local Government Directory subdistrict boundaries',
    url: `${R2}/geojsons/admin/India-geodata-lgd-subdistricts.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'subdistrict_name',
    csvColumns: ['state_name', 'subdistrict_name', 'value'],
    source: 'LGD',
  },
  {
    id: 'soi_subdistricts',
    displayName: 'SOI Subdistricts',
    description: 'Survey of India subdistrict boundaries',
    url: `${R2}/geojsons/admin/India-geodata-soi-subdistricts.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-soi-states.geojson`,
    featureNameProp: 'subdistrict_name',
    csvColumns: ['state_name', 'subdistrict_name', 'value'],
    source: 'SOI',
  },
  {
    id: 'lgd_blocks',
    displayName: 'LGD Blocks',
    description: 'Local Government Directory block boundaries',
    url: `${R2}/geojsons/admin/India-geodata-lgd-blocks.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'block_name',
    csvColumns: ['state_name', 'block_name', 'value'],
    source: 'LGD',
  },
  {
    id: 'bhuvan_blocks',
    displayName: 'Bhuvan Blocks',
    description: 'NRSC Bhuvan block boundaries',
    url: `${R2}/geojsons/admin/India-geodata-bhuvan-blocks.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-bhuvan-states.geojson`,
    featureNameProp: 'block_name',
    csvColumns: ['state_name', 'block_name', 'value'],
    source: 'BHUVAN',
  },
  {
    id: 'pmgsy_blocks',
    displayName: 'PMGSY Blocks',
    description: 'Pradhan Mantri Gram Sadak Yojana block boundaries',
    url: `${R2}/geojsons/admin/India-geodata-pmgsy-blocks.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'block_name',
    csvColumns: ['state_name', 'block_name', 'value'],
    source: 'LGD',
  },
  {
    id: 'shrug_subdistricts',
    displayName: 'SHRUG Subdistricts (Census 2011)',
    description: 'Census 2011 subdistrict polygons from the SHRUG platform (Asher, Lunt, Matsuura & Novosad)',
    url: `${R2}/geojsons/admin/India-shrug-subdistrict-pc11_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'subdistrict_name',
    csvColumns: ['state_name', 'subdistrict_name', 'value'],
    source: 'SHRUG',
  },
];

export const DEFAULT_SUB_ADMIN_LAYER = SUB_ADMIN_LAYERS[0].id;

export function getSubAdminLayer(id: string): GeoDataLayer {
  return SUB_ADMIN_LAYERS.find(l => l.id === id) ?? SUB_ADMIN_LAYERS[0];
}

// ── Electoral layers ───────────────────────────────────────────────────────────

export const ELECTORAL_LAYERS: GeoDataLayer[] = [
  {
    id: 'lgd_parliament',
    displayName: 'Parliament Constituencies',
    description: 'LGD Lok Sabha parliamentary constituency boundaries',
    url: `${R2}/geojsons/electoral/India-geodata-lgd-parliament.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'constituency_name',
    csvColumns: ['state_name', 'constituency_name', 'value'],
    source: 'LGD',
  },
  {
    id: 'lgd_assembly',
    displayName: 'Assembly Constituencies',
    description: 'LGD Vidhan Sabha assembly constituency boundaries',
    url: `${R2}/geojsons/electoral/India-geodata-lgd-assembly.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'constituency_name',
    csvColumns: ['state_name', 'constituency_name', 'value'],
    source: 'LGD',
  },
  {
    id: 'susewind_parliament_2014',
    displayName: 'Parliament Constituencies (2014, Susewind)',
    description: 'Lok Sabha constituency boundaries as used in the 2014 general election — digitised by Raphael Susewind',
    url: `${R2}/geojsons/electoral/India-susewind-parliament-2014_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'constituency_name',
    csvColumns: ['state_name', 'constituency_name', 'value'],
    source: 'Susewind',
  },
  {
    id: 'susewind_assembly_2014',
    displayName: 'Assembly Constituencies (2014, Susewind)',
    description: 'Vidhan Sabha constituency boundaries as used in elections around 2014 — digitised by Raphael Susewind',
    url: `${R2}/geojsons/electoral/India-susewind-assembly-2014_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'constituency_name',
    csvColumns: ['state_name', 'constituency_name', 'value'],
    source: 'Susewind',
  },
];

export const DEFAULT_ELECTORAL_LAYER = ELECTORAL_LAYERS[0].id;

export function getElectoralLayer(id: string): GeoDataLayer {
  return ELECTORAL_LAYERS.find(l => l.id === id) ?? ELECTORAL_LAYERS[0];
}

// ── Environment layers ─────────────────────────────────────────────────────────

export const ENVIRONMENT_LAYERS: GeoDataLayer[] = [
  {
    id: 'gs_wildlife',
    displayName: 'Wildlife Sanctuaries',
    description: 'Protected wildlife sanctuaries and national parks',
    url: `${R2}/geojsons/environment/India-geodata-wildlife.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'area_name',
    csvColumns: ['area_name', 'value'],
    source: 'GatiShakti',
  },
  {
    id: 'bm_eco_zones',
    displayName: 'Eco-sensitive Zones',
    description: 'Biological / eco-sensitive zone boundaries',
    url: `${R2}/geojsons/environment/India-geodata-eco-zones.geojson`,
    statesUrl: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`,
    featureNameProp: 'area_name',
    csvColumns: ['area_name', 'value'],
    source: 'GatiShakti',
  },
  {
    id: 'fsi_circles',
    displayName: 'FSI Circles',
    description: 'Forest Survey of India administrative circles (top-level forest administrative unit)',
    url: `${R2}/geojsons/environment/India-fsi-circles_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'circle_name',
    csvColumns: ['state_name', 'circle_name', 'value'],
    source: 'FSI',
  },
  {
    id: 'fsi_divisions',
    displayName: 'FSI Divisions',
    description: 'Forest Survey of India administrative divisions (within circles)',
    url: `${R2}/geojsons/environment/India-fsi-divisions_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'division_name',
    csvColumns: ['state_name', 'division_name', 'value'],
    source: 'FSI',
  },
  {
    id: 'fsi_ranges',
    displayName: 'FSI Ranges',
    description: 'Forest Survey of India administrative ranges (within divisions)',
    url: `${R2}/geojsons/environment/India-fsi-ranges_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'range_name',
    csvColumns: ['state_name', 'range_name', 'value'],
    source: 'FSI',
  },
];

export const DEFAULT_ENVIRONMENT_LAYER = ENVIRONMENT_LAYERS[0].id;

export function getEnvironmentLayer(id: string): GeoDataLayer {
  return ENVIRONMENT_LAYERS.find(l => l.id === id) ?? ENVIRONMENT_LAYERS[0];
}

// ── Urban layers ───────────────────────────────────────────────────────────────

export const URBAN_LAYERS: GeoDataLayer[] = [
  {
    id: 'sbm_ulbs',
    displayName: 'SBM Urban Local Bodies',
    description: 'Urban Local Body (ULB) boundaries from the Swachh Bharat Mission — national coverage (most states)',
    url: `${R2}/geojsons/urban/India-sbm-ulbs_simplified.geojson`,
    statesUrl: STATES_URL,
    featureNameProp: 'ulb_name',
    csvColumns: ['state_name', 'ulb_name', 'value'],
    source: 'SBM',
  },
];

export const DEFAULT_URBAN_LAYER = URBAN_LAYERS[0].id;

export function getUrbanLayer(id: string): GeoDataLayer {
  return URBAN_LAYERS.find(l => l.id === id) ?? URBAN_LAYERS[0];
}
