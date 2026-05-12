/**
 * Constants for BharatViz application
 */

// State classification constants
export const BLACK_TEXT_STATES = [
  'goa', 'kerala', 'dnhdd', 'nagaland', 'tripura', 'mizoram', 
  'lakshadweep', 'manipur', 'sikkim', 'delhi', 'chandigarh', 
  'puducherry', 'a & n islands', 'andaman and nicobar islands'
];

export const ABBREVIATED_STATES = ['karnataka'];

export const EXTERNAL_LABEL_STATES = [
  'goa', 'kerala', 'dnhdd', 'nagaland', 'tripura', 'mizoram', 
  'lakshadweep', 'manipur', 'sikkim', 'andhra pradesh', 'karnataka', 
  'delhi', 'chandigarh', 'puducherry', 'a & n islands', 'andaman and nicobar islands'
];

// State abbreviations for display
export const STATE_ABBREVIATIONS: { [key: string]: string } = {
  'andhra pradesh': 'Andhra',
  'arunachal pradesh': 'Arunachal',
  'himachal pradesh': 'Himachal',
  'madhya pradesh': 'MP',
  'uttar pradesh': 'UP',
  'west bengal': 'WBengal',
  'tamil nadu': 'TN',
  'jammu & kashmir': 'J&K',
  'telangana': 'Telangana',
  'dadra and nagar haveli': 'D&NH',
  'daman and diu': 'D&D',
  'andaman and nicobar islands': 'A&N Islands',
  'rajasthan': 'Rajasthan',
  'karnataka': 'KA',
  'chandigarh': 'CH'
};

// Map dimensions
export const MAP_DIMENSIONS = {
  STATES: {
    width: 800,
    height: 800,
    scale: 1000
  },
  DISTRICTS: {
    width: 560,
    height: 630,
    scale: 700
  }
};

// Default legend positions
export const DEFAULT_LEGEND_POSITION = {
  STATES: { x: 390, y: 200 },
  DISTRICTS: { x: 390, y: 200 }
};

// File paths
export const DATA_FILES = {
  STATES_GEOJSON: '/India_LGD_states.geojson',
  DISTRICTS_GEOJSON: '/India_LGD_Districts_simplified.geojson',
  PINCODES_GEOJSON: '/India_pincodes_simplified.geojson',
  STATES_DEMO_CSV: '/nfhs5_protein_consumption_eggs.csv',
  DISTRICTS_DEMO_CSV: '/districts_demo.csv'
};

// Default state selections
export const DEFAULT_FALLBACK_STATE = 'Maharashtra';
export const ALL_INDIA_STATE = 'All India';

// Export file names
export const EXPORT_FILENAMES = {
  PNG: 'bharatviz.png',
  SVG: 'bharatviz.svg',
  PDF: 'bharatviz.pdf',
  STATE_TEMPLATE: 'bharatviz-state-template.csv',
  DISTRICT_TEMPLATE: 'bharatviz-district-template.csv'
};
