/**
 * Constants for BharatViz Server
 */

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

export const DEFAULT_LEGEND_POSITION = {
  STATES: { x: 390, y: 200 },
  DISTRICTS: { x: 390, y: 200 }
};

export const ALL_INDIA_STATE = 'All India';
