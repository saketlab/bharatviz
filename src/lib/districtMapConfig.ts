const R2 = 'https://geo.bharatviz.org';
const CENSUS = `${R2}/geojsons/census`;
const DISTRICTS = `${R2}/geojsons/districts`;

export interface DistrictMapConfig {
  id: string;
  name: string;
  displayName: string;
  geojsonPath: string;
  states: string;
  templateCsvPath: string;
  demoDataPath: string;
  googleSheetLink: string;
  description?: string;
}

/**
 * Available district map types
 *
 * To add a new map type:
 * 1. Add a new entry to this object
 * 2. Ensure the GeoJSON file exists in the public/ directory
 * 3. Create corresponding template CSV file (optional)
 * 4. Add Google Sheets template link (optional)
 */
export const DISTRICT_MAP_TYPES: Record<string, DistrictMapConfig> = {
  // Historical Census Data - 1872-1931 (Jolad, Shivakumar et al., Harvard Dataverse)
  '1872': {
    id: '1872',
    name: '1872',
    displayName: 'Census 1872',
    geojsonPath: `${CENSUS}/India-1872-districts.geojson`,
    states: `${CENSUS}/India-1872-states.geojson`,
    templateCsvPath: '/bharatviz-India-1872-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1GmnCpliHd7AMatNT6x-G4p1fguceryo9hOvxpVcMkF0/edit?usp=sharing',
    description: '1872 Census district boundaries'
  },
  '1881': {
    id: '1881',
    name: '1881',
    displayName: 'Census 1881',
    geojsonPath: `${CENSUS}/India-1881-districts.geojson`,
    states: `${CENSUS}/India-1881-states.geojson`,
    templateCsvPath: '/bharatviz-India-1881-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1pLc4qD3mQ5tcJOzeHx7TgPR2TrJDWV5TT3XPucmlRqg/edit?usp=sharing',
    description: '1881 Census district boundaries'
  },
  '1891': {
    id: '1891',
    name: '1891',
    displayName: 'Census 1891',
    geojsonPath: `${CENSUS}/India-1891-districts.geojson`,
    states: `${CENSUS}/India-1891-states.geojson`,
    templateCsvPath: '/bharatviz-India-1891-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1T_q1d-QIPDH6S7LegGTh0oNde7DhhXdVVxzQrIndQl8/edit?usp=sharing',
    description: '1891 Census district boundaries'
  },
  '1901': {
    id: '1901',
    name: '1901',
    displayName: 'Census 1901',
    geojsonPath: `${CENSUS}/India-1901-districts.geojson`,
    states: `${CENSUS}/India-1901-states.geojson`,
    templateCsvPath: '/bharatviz-India-1901-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/138z1KmFdAnbJ1Zw8SV9ZDTC5ZSZARF8K1f_f61H8oNU/edit?usp=sharing',
    description: '1901 Census district boundaries'
  },
  '1911': {
    id: '1911',
    name: '1911',
    displayName: 'Census 1911',
    geojsonPath: `${CENSUS}/India-1911-districts.geojson`,
    states: `${CENSUS}/India-1911-states.geojson`,
    templateCsvPath: '/bharatviz-India-1911-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1JG7U8XYQsKp1DqWXCMBPqB9wppNflUyMutTfd1CeQbw/edit?usp=sharing',
    description: '1911 Census district boundaries'
  },
  '1921': {
    id: '1921',
    name: '1921',
    displayName: 'Census 1921',
    geojsonPath: `${CENSUS}/India-1921-districts.geojson`,
    states: `${CENSUS}/India-1921-states.geojson`,
    templateCsvPath: '/bharatviz-India-1921-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1YvGeJfQ7QdI4DiGHxd_6h3E67Wft8WMkZpuuq4PhcyQ/edit?usp=sharing',
    description: '1921 Census district boundaries'
  },
  '1931': {
    id: '1931',
    name: '1931',
    displayName: 'Census 1931',
    geojsonPath: `${CENSUS}/India-1931-districts.geojson`,
    states: `${CENSUS}/India-1931-states.geojson`,
    templateCsvPath: '/bharatviz-India-1931-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1rCUvEcGAuolriVvwZyHr7bxQ8WnnVcanI9GoH1HNrb4/edit?usp=sharing',
    description: '1931 Census district boundaries'
  },

  // Historical Census Data - 1941-2011
  '1941': {
    id: '1941',
    name: '1941',
    displayName: 'Census 1941',
    geojsonPath: `${CENSUS}/India-1941-districts.geojson`,
    states: `${CENSUS}/India-1941-states.geojson`,
    templateCsvPath: '/bharatviz-India-1941-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1IbYD6Jar-OsOj_Fv_DzccmjD7EXp4jXxB8mb-hO7kdg/edit?usp=sharing',
    description: '1941 Census district boundaries - Pre-independence India'
  },
  '1951': {
    id: '1951',
    name: '1951',
    displayName: 'Census 1951',
    geojsonPath: `${CENSUS}/India-1951-districts.geojson`,
    states: `${CENSUS}/India-1951-states.geojson`,
    templateCsvPath: '/bharatviz-India-1951-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/11PIHVyjUaVcMFGVM_6Vul5OipdZBoFVdXVsGnic1yig/edit?usp=sharing',
    description: '1951 Census district boundaries - First Census of independent India'
  },
  '1961': {
    id: '1961',
    name: '1961',
    displayName: 'Census 1961',
    geojsonPath: `${CENSUS}/India-1961-districts.geojson`,
    states: `${CENSUS}/India-1961-states.geojson`,
    templateCsvPath: '/bharatviz-India-1961-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1N39YT8SlZdumAysINgvdPvoAA2Y-Ux1-00TXXnSLK1E/edit?usp=sharing',
    description: '1961 Census district boundaries'
  },
  '1971': {
    id: '1971',
    name: '1971',
    displayName: 'Census 1971',
    geojsonPath: `${CENSUS}/India-1971-districts.geojson`,
    states: `${CENSUS}/India-1971-states.geojson`,
    templateCsvPath: '/bharatviz-India-1971-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1pZs-9-vfIhhTSJ6tQnjdKlFRxboJyPOsz9w_H8oT280/edit?usp=sharing',
    description: '1971 Census district boundaries'
  },
  '1981': {
    id: '1981',
    name: '1981',
    displayName: 'Census 1981',
    geojsonPath: `${CENSUS}/India-1981-districts.geojson`,
    states: `${CENSUS}/India-1981-states.geojson`,
    templateCsvPath: '/bharatviz-India-1981-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1R0_5WOMIqt4I4CTQsDKLZMO92B-hg_u5vDnH9rZmuGc/edit?usp=sharing',
    description: '1981 Census district boundaries'
  },
  '1991': {
    id: '1991',
    name: '1991',
    displayName: 'Census 1991',
    geojsonPath: `${CENSUS}/India-1991-districts.geojson`,
    states: `${CENSUS}/India-1991-states.geojson`,
    templateCsvPath: '/bharatviz-India-1991-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1W9f1qAe9yCGi9S5yBk8oYw07xENJRq1IFBQn_4GsM2A/edit?usp=sharing',
    description: '1991 Census district boundaries'
  },
  '2011': {
    id: '2011',
    name: '2011',
    displayName: 'Census 2011',
    geojsonPath: `${CENSUS}/India-2011-districts.geojson`,
    states: `${CENSUS}/India-2011-states.geojson`,
    templateCsvPath: '/bharatviz-India-2011-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1MSk8z_EeoYslsSsiFc8E0U-WIgUfrB_bBccilQ1w-o4/edit?usp=sharing',
    description: '2011 Census district boundaries - Current administrative boundaries'
  },
  '2001': {
    id: '2001',
    name: '2001',
    displayName: 'Census 2001',
    geojsonPath: `${CENSUS}/India-2001-districts.geojson`,
    states: `${CENSUS}/India-2001-states.geojson`,
    templateCsvPath: '/bharatviz-India-2001-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/16R9_SYFUSECOxvY22Va-itATZ4kNjDxZd_7BicnF8MA/edit?usp=sharing',
    description: '2001 Census district boundaries'
  },

  // Current Reference Data
  LGD: {
    id: 'LGD',
    name: 'LGD',
    displayName: 'LGD',
    geojsonPath: `${DISTRICTS}/India_LGD_districts.geojson`,
    states: `${DISTRICTS}/India_LGD_states.geojson`,
    templateCsvPath: '/bharatviz-lgd-district-template.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1mxE70Qrf0ij3z--4alVbmKEfAIftH3N1wqMWYPNQk7Q/edit?usp=sharing',
    description: 'Local Government Directory (LGD) district boundaries'
  },
  BHUVAN: {
    id: 'BHUVAN',
    name: 'BHUVAN',
    displayName: 'Bhuvan',
    geojsonPath: `${DISTRICTS}/India-bhuvan-districts.geojson`,
    states: `${DISTRICTS}/India-bhuvan-states.geojson`,
    templateCsvPath: '/India-bhuvan-districts.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1mxE70Qrf0ij3z--4alVbmKEfAIftH3N1wqMWYPNQk7Q/edit?usp=sharing',
    description: 'Bhuvan district boundaries from NRSC'
  },
  SOI: {
    id: 'SOI',
    name: 'SOI',
    displayName: 'Survey of India',
    geojsonPath: `${DISTRICTS}/India-soi-districts.geojson`,
    states: `${DISTRICTS}/India-soi-states.geojson`,
    templateCsvPath: '/India-soi-districts.csv',
    demoDataPath: '/districts_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1mxE70Qrf0ij3z--4alVbmKEfAIftH3N1wqMWYPNQk7Q/edit?usp=sharing',
    description: 'Survey of India official district boundaries'
  },
  NFHS5: {
    id: 'NFHS5',
    name: 'NFHS5',
    displayName: 'NFHS-5',
    geojsonPath: `${DISTRICTS}/India_NFHS5_districts_simplified.geojson`,
    /*states: `${DISTRICTS}/India_NFHS5_states_simplified.geojson`,*/
    states: `${DISTRICTS}/India_LGD_states.geojson`,
    templateCsvPath: '/bharatviz-NFHS5-district-template.csv',
    demoDataPath: '/nfhs5_blood_sugar_levels.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1xUOwqgpvp4hkO-e3-ENvSaqWsu0JGb6i_vUncklWotk/edit?usp=sharing',
    description: 'NFHS-5 survey district boundaries'
  },
  NFHS4: {
    id: 'NFHS4',
    name: 'NFHS4',
    displayName: 'NFHS-4',
    geojsonPath: `${DISTRICTS}/India_NFHS4_districts_simplified.geojson`,
    states: `${DISTRICTS}/India_NFHS4_states_simplified.geojson`,
    templateCsvPath: '/bharatviz-NFHS4-district-template.csv',
    demoDataPath: '/nfhs4_blood_sugar_levels.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1kiVltD6zV7N500r6sgAMaubrFGLSUNd1DxXlGcnnuls/edit?usp=sharing',
    description: 'NFHS-4 survey district boundaries'
  },

  // NSSO Regions
  NSSO: {
    id: 'NSSO',
    name: 'NSSO',
    displayName: 'NSSO Regions',
    geojsonPath: `${DISTRICTS}/India_NFHS5_NSSO_regions_boundaries.geojson`,
    states: `${DISTRICTS}/India_LGD_states.geojson`,
    templateCsvPath: '/bharatviz-nsso-regions-template.csv',
    demoDataPath: '/nsso_regions_demo.csv',
    googleSheetLink: 'https://docs.google.com/spreadsheets/d/1example/edit?usp=sharing',
    description: 'NSSO (National Sample Survey Organization) regions - Regional boundaries for survey sampling'
  }
};

/**
 * Default district map type to use when the app loads
 */
export const DEFAULT_DISTRICT_MAP_TYPE = 'LGD';

/**
 * Get list of all available district map types
 */
export const getDistrictMapTypesList = (): DistrictMapConfig[] => {
  return Object.values(DISTRICT_MAP_TYPES);
};

/**
 * Get config for a specific district map type
 */
export const getDistrictMapConfig = (typeId: string): DistrictMapConfig => {
  return DISTRICT_MAP_TYPES[typeId] || DISTRICT_MAP_TYPES[DEFAULT_DISTRICT_MAP_TYPE];
};
