import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFile } from 'fs/promises';
import { StatesMapRenderer } from './services/mapRenderer.js';
import { DistrictsMapRenderer } from './services/districtsMapRenderer.js';
import { PincodeMapRenderer } from './services/pincodeMapRenderer.js';
import { CityMapRenderer } from './services/cityMapRenderer.js';
import type { ColorScale } from './types/index.js';
import { ExportService } from './services/exportService.js';
import { queryEvolution, getDistrictGeoJSON, getDistrictNames, ensureLoaded as ensureEvolutionLoaded } from './services/districtEvolutionService.js';
import type { FeatureCollection, Feature, Geometry } from 'geojson';
import { LRUCache } from './utils/lruCache.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface MapEntry {
  id: string;
  file: string;
  level: 'states' | 'districts' | 'regions' | 'points';
  source: string;
  year: number;
  description: string;
  statesFile?: string;
  featureNameProp?: string;
  parquetUrl?: string;
  aggregatedByDistrictUrl?: string;
}

const R2 = 'https://geo.bharatviz.org';
const CENSUS = `${R2}/geojsons/census`;
const DIST = `${R2}/geojsons/districts`;

export const MAP_REGISTRY: Record<string, MapEntry> = {
  'census-1872-states': { id: 'census-1872-states', file: `${CENSUS}/India-1872-states.geojson`, level: 'states', source: 'Census 1872', year: 1872, description: 'State boundaries from the 1872 Census of India' },
  'census-1872-districts': { id: 'census-1872-districts', file: `${CENSUS}/India-1872-districts.geojson`, level: 'districts', source: 'Census 1872', year: 1872, description: 'District boundaries from the 1872 Census of India', statesFile: `${CENSUS}/India-1872-states.geojson` },
  'census-1881-states': { id: 'census-1881-states', file: `${CENSUS}/India-1881-states.geojson`, level: 'states', source: 'Census 1881', year: 1881, description: 'State boundaries from the 1881 Census of India' },
  'census-1881-districts': { id: 'census-1881-districts', file: `${CENSUS}/India-1881-districts.geojson`, level: 'districts', source: 'Census 1881', year: 1881, description: 'District boundaries from the 1881 Census of India', statesFile: `${CENSUS}/India-1881-states.geojson` },
  'census-1891-states': { id: 'census-1891-states', file: `${CENSUS}/India-1891-states.geojson`, level: 'states', source: 'Census 1891', year: 1891, description: 'State boundaries from the 1891 Census of India' },
  'census-1891-districts': { id: 'census-1891-districts', file: `${CENSUS}/India-1891-districts.geojson`, level: 'districts', source: 'Census 1891', year: 1891, description: 'District boundaries from the 1891 Census of India', statesFile: `${CENSUS}/India-1891-states.geojson` },
  'census-1901-states': { id: 'census-1901-states', file: `${CENSUS}/India-1901-states.geojson`, level: 'states', source: 'Census 1901', year: 1901, description: 'State boundaries from the 1901 Census of India' },
  'census-1901-districts': { id: 'census-1901-districts', file: `${CENSUS}/India-1901-districts.geojson`, level: 'districts', source: 'Census 1901', year: 1901, description: 'District boundaries from the 1901 Census of India', statesFile: `${CENSUS}/India-1901-states.geojson` },
  'census-1911-states': { id: 'census-1911-states', file: `${CENSUS}/India-1911-states.geojson`, level: 'states', source: 'Census 1911', year: 1911, description: 'State boundaries from the 1911 Census of India' },
  'census-1911-districts': { id: 'census-1911-districts', file: `${CENSUS}/India-1911-districts.geojson`, level: 'districts', source: 'Census 1911', year: 1911, description: 'District boundaries from the 1911 Census of India', statesFile: `${CENSUS}/India-1911-states.geojson` },
  'census-1921-states': { id: 'census-1921-states', file: `${CENSUS}/India-1921-states.geojson`, level: 'states', source: 'Census 1921', year: 1921, description: 'State boundaries from the 1921 Census of India' },
  'census-1921-districts': { id: 'census-1921-districts', file: `${CENSUS}/India-1921-districts.geojson`, level: 'districts', source: 'Census 1921', year: 1921, description: 'District boundaries from the 1921 Census of India', statesFile: `${CENSUS}/India-1921-states.geojson` },
  'census-1931-states': { id: 'census-1931-states', file: `${CENSUS}/India-1931-states.geojson`, level: 'states', source: 'Census 1931', year: 1931, description: 'State boundaries from the 1931 Census of India' },
  'census-1931-districts': { id: 'census-1931-districts', file: `${CENSUS}/India-1931-districts.geojson`, level: 'districts', source: 'Census 1931', year: 1931, description: 'District boundaries from the 1931 Census of India', statesFile: `${CENSUS}/India-1931-states.geojson` },
  'census-1941-states': { id: 'census-1941-states', file: `${CENSUS}/India-1941-states.geojson`, level: 'states', source: 'Census 1941', year: 1941, description: 'State boundaries from the 1941 Census of India' },
  'census-1941-districts': { id: 'census-1941-districts', file: `${CENSUS}/India-1941-districts.geojson`, level: 'districts', source: 'Census 1941', year: 1941, description: 'District boundaries from the 1941 Census of India', statesFile: `${CENSUS}/India-1941-states.geojson` },
  'census-1951-states': { id: 'census-1951-states', file: `${CENSUS}/India-1951-states.geojson`, level: 'states', source: 'Census 1951', year: 1951, description: 'State boundaries from the 1951 Census of India' },
  'census-1951-districts': { id: 'census-1951-districts', file: `${CENSUS}/India-1951-districts.geojson`, level: 'districts', source: 'Census 1951', year: 1951, description: 'District boundaries from the 1951 Census of India', statesFile: `${CENSUS}/India-1951-states.geojson` },
  'census-1961-states': { id: 'census-1961-states', file: `${CENSUS}/India-1961-states.geojson`, level: 'states', source: 'Census 1961', year: 1961, description: 'State boundaries from the 1961 Census of India' },
  'census-1961-districts': { id: 'census-1961-districts', file: `${CENSUS}/India-1961-districts.geojson`, level: 'districts', source: 'Census 1961', year: 1961, description: 'District boundaries from the 1961 Census of India', statesFile: `${CENSUS}/India-1961-states.geojson` },
  'census-1971-states': { id: 'census-1971-states', file: `${CENSUS}/India-1971-states.geojson`, level: 'states', source: 'Census 1971', year: 1971, description: 'State boundaries from the 1971 Census of India' },
  'census-1971-districts': { id: 'census-1971-districts', file: `${CENSUS}/India-1971-districts.geojson`, level: 'districts', source: 'Census 1971', year: 1971, description: 'District boundaries from the 1971 Census of India', statesFile: `${CENSUS}/India-1971-states.geojson` },
  'census-1981-states': { id: 'census-1981-states', file: `${CENSUS}/India-1981-states.geojson`, level: 'states', source: 'Census 1981', year: 1981, description: 'State boundaries from the 1981 Census of India' },
  'census-1981-districts': { id: 'census-1981-districts', file: `${CENSUS}/India-1981-districts.geojson`, level: 'districts', source: 'Census 1981', year: 1981, description: 'District boundaries from the 1981 Census of India', statesFile: `${CENSUS}/India-1981-states.geojson` },
  'census-1991-states': { id: 'census-1991-states', file: `${CENSUS}/India-1991-states.geojson`, level: 'states', source: 'Census 1991', year: 1991, description: 'State boundaries from the 1991 Census of India' },
  'census-1991-districts': { id: 'census-1991-districts', file: `${CENSUS}/India-1991-districts.geojson`, level: 'districts', source: 'Census 1991', year: 1991, description: 'District boundaries from the 1991 Census of India', statesFile: `${CENSUS}/India-1991-states.geojson` },
  'census-2001-states': { id: 'census-2001-states', file: `${CENSUS}/India-2001-states.geojson`, level: 'states', source: 'Census 2001', year: 2001, description: 'State boundaries from the 2001 Census of India' },
  'census-2001-districts': { id: 'census-2001-districts', file: `${CENSUS}/India-2001-districts.geojson`, level: 'districts', source: 'Census 2001', year: 2001, description: 'District boundaries from the 2001 Census of India', statesFile: `${CENSUS}/India-2001-states.geojson` },
  'census-2011-states': { id: 'census-2011-states', file: `${CENSUS}/India-2011-states.geojson`, level: 'states', source: 'Census 2011', year: 2011, description: 'State boundaries from the 2011 Census of India' },
  'census-2011-districts': { id: 'census-2011-districts', file: `${CENSUS}/India-2011-districts.geojson`, level: 'districts', source: 'Census 2011', year: 2011, description: 'District boundaries from the 2011 Census of India', statesFile: `${CENSUS}/India-2011-states.geojson` },
  'census-2011-enriched': {
    id: 'census-2011-enriched',
    file: `${R2}/geojsons/census2011/india_census2011_districts.geojson`,
    parquetUrl: `${R2}/geoparquet/census2011/india_census2011_districts.parquet`,
    level: 'districts',
    source: 'Census 2011 (Office of the Registrar General & Census Commissioner, India)',
    year: 2011,
    description: 'Census 2011 district boundaries enriched with demographic data. Fields: population, sc_population, sc_pct, st_population, st_pct, literate, literacy_pct, shannon_diversity, effective_languages, num_languages, top_lang_1..5 + top_lang_1..5_pct, and lang_<Language>_l1_pct + lang_<Language>_l2_pct for all 122 scheduled/major languages. 640 districts. SC/ST/literacy from official Census tables; language data from Census C-16 mother tongue returns.',
    featureNameProp: 'district_name',
    statesFile: `${CENSUS}/India-2011-states.geojson`,
  },

  'lgd-states': { id: 'lgd-states', file: `${DIST}/India_LGD_states.geojson`, level: 'states', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official state boundaries from the Local Government Directory' },
  'lgd-districts': { id: 'lgd-districts', file: `${DIST}/India_LGD_districts.geojson`, level: 'districts', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official district boundaries from the Local Government Directory', statesFile: `${DIST}/India_LGD_states.geojson` },

  'nfhs4-states': { id: 'nfhs4-states', file: `${DIST}/India_NFHS4_states_simplified.geojson`, level: 'states', source: 'NFHS-4 (2015-16)', year: 2016, description: 'State boundaries from NFHS-4 survey (2015-16)' },
  'nfhs4-districts': { id: 'nfhs4-districts', file: `${DIST}/India_NFHS4_districts_simplified.geojson`, level: 'districts', source: 'NFHS-4 (2015-16)', year: 2016, description: 'District boundaries from NFHS-4 survey (2015-16)', statesFile: `${DIST}/India_NFHS4_states_simplified.geojson` },
  'nfhs5-states': { id: 'nfhs5-states', file: `${DIST}/India_NFHS5_states_simplified.geojson`, level: 'states', source: 'NFHS-5 (2019-21)', year: 2021, description: 'State boundaries from NFHS-5 survey (2019-21)' },
  'nfhs5-districts': { id: 'nfhs5-districts', file: `${DIST}/India_NFHS5_districts_simplified.geojson`, level: 'districts', source: 'NFHS-5 (2019-21)', year: 2021, description: 'District boundaries from NFHS-5 survey (2019-21)', statesFile: `${DIST}/India_NFHS5_states_simplified.geojson` },

  'soi-states': { id: 'soi-states', file: `${DIST}/India-soi-states.geojson`, level: 'states', source: 'Survey of India', year: 2020, description: 'State boundaries from the Survey of India' },
  'soi-districts': { id: 'soi-districts', file: `${DIST}/India-soi-districts.geojson`, level: 'districts', source: 'Survey of India', year: 2020, description: 'District boundaries from the Survey of India', statesFile: `${DIST}/India-soi-states.geojson` },

  'bhuvan-states': { id: 'bhuvan-states', file: `${DIST}/India-bhuvan-states.geojson`, level: 'states', source: 'ISRO Bhuvan', year: 2020, description: 'State boundaries from ISRO Bhuvan satellite data' },
  'bhuvan-districts': { id: 'bhuvan-districts', file: `${DIST}/India-bhuvan-districts.geojson`, level: 'districts', source: 'ISRO Bhuvan', year: 2020, description: 'District boundaries from ISRO Bhuvan satellite data', statesFile: `${DIST}/India-bhuvan-states.geojson` },

  'nsso-regions': { id: 'nsso-regions', file: `${DIST}/India_NFHS5_NSSO_regions_boundaries.geojson`, level: 'regions', source: 'NSSO', year: 2021, description: 'NSSO regional boundaries based on NFHS-5', featureNameProp: 'nss_region' },

  'lgd-subdistricts': { id: 'lgd-subdistricts', file: `${R2}/geojsons/admin/India-geodata-lgd-subdistricts.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'LGD subdistrict (tehsil/taluka) boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'subdistrict_name' },
  'soi-subdistricts': { id: 'soi-subdistricts', file: `${R2}/geojsons/admin/India-geodata-soi-subdistricts.geojson`, level: 'districts', source: 'Survey of India', year: 2020, description: 'Survey of India subdistrict boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-soi-states.geojson`, featureNameProp: 'subdistrict_name' },
  'lgd-blocks': { id: 'lgd-blocks', file: `${R2}/geojsons/admin/India-geodata-lgd-blocks.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'LGD block-level boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'block_name' },
  'bhuvan-blocks': { id: 'bhuvan-blocks', file: `${R2}/geojsons/admin/India-geodata-bhuvan-blocks.geojson`, level: 'districts', source: 'ISRO Bhuvan', year: 2020, description: 'NRSC Bhuvan block-level boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-bhuvan-states.geojson`, featureNameProp: 'block_name' },
  'pmgsy-blocks': { id: 'pmgsy-blocks', file: `${R2}/geojsons/admin/India-geodata-pmgsy-blocks.geojson`, level: 'districts', source: 'PMGSY', year: 2024, description: 'PMGSY (Pradhan Mantri Gram Sadak Yojana) block boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'block_name' },
  'shrug-subdistricts': { id: 'shrug-subdistricts', file: `${R2}/geojsons/admin/India-shrug-subdistrict-pc11_simplified.geojson`, level: 'districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 subdistrict polygons from the SHRUG platform (Asher, Lunt, Matsuura & Novosad). License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'subdistrict_name' },

  'lgd-parliament': { id: 'lgd-parliament', file: `${R2}/geojsons/electoral/India-geodata-lgd-parliament.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'Lok Sabha parliamentary constituency boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'lgd-assembly': { id: 'lgd-assembly', file: `${R2}/geojsons/electoral/India-geodata-lgd-assembly.geojson`, level: 'districts', source: 'LGD', year: 2024, description: 'Vidhan Sabha assembly constituency boundaries', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'susewind-parliament-2014': { id: 'susewind-parliament-2014', file: `${R2}/geojsons/electoral/India-susewind-parliament-2014_simplified.geojson`, level: 'districts', source: 'Susewind (2014)', year: 2014, description: 'Lok Sabha constituency boundaries as used in the 2014 general election, digitised by Raphael Susewind. License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },
  'susewind-assembly-2014': { id: 'susewind-assembly-2014', file: `${R2}/geojsons/electoral/India-susewind-assembly-2014_simplified.geojson`, level: 'districts', source: 'Susewind (2014)', year: 2014, description: 'Vidhan Sabha constituency boundaries as used in elections around 2014, digitised by Raphael Susewind. License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'constituency_name' },

  'shrug-districts': { id: 'shrug-districts', file: `${R2}/geojsons/districts/India-shrug-district-pc11_simplified.geojson`, level: 'districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 district polygons from the SHRUG platform (Asher, Lunt, Matsuura & Novosad). License: CC BY-NC-SA 4.0.', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson` },

  'shrug-census': {
    id: 'shrug-census', level: 'districts', source: 'SHRUG 2.1 / Census of India', year: 2011,
    file: `${R2}/geoparquet/shrug/shrug_districts_census.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_census.parquet`,
    featureNameProp: 'district_name',
    description: 'Population Census abstracts for 1991, 2001, 2011 aggregated to 641 PC11 districts. ' +
      'Covers: total/male/female population, SC count & share, ST count & share, literacy count & share, ' +
      'main/marginal/non-workers, worker categories (cultivators, agricultural labourers, household industry, ' +
      'manufacturing, trade, transport, other). Prefixes: pca91__, pca01__, pca11__, vd91__, vd01__, vd11__, ' +
      'td91__, td01__, td11__. License: CC BY-NC-SA 4.0.',
  },
  'shrug-economic': {
    id: 'shrug-economic', level: 'districts', source: 'SHRUG 2.1 / Economic Census of India', year: 2013,
    file: `${R2}/geoparquet/shrug/shrug_districts_economic.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_economic.parquet`,
    featureNameProp: 'district_name',
    description: 'Economic Census 1990, 1998, 2005, 2013 aggregated to 641 PC11 districts. ' +
      'Covers: total employment, female/male employment, hired vs own-account workers, ' +
      'government vs private vs informal sector, firm counts by size (20+/50+/100+ employees), ' +
      'SC/ST employment, manufacturing vs services split, employment by 45 industry codes (SHRIC). ' +
      'Prefixes: ec90__, ec98__, ec05__, ec13__. License: CC BY-NC-SA 4.0.',
  },
  'shrug-secc': {
    id: 'shrug-secc', level: 'districts', source: 'SHRUG 2.1 / SECC 2011-12', year: 2012,
    file: `${R2}/geoparquet/shrug/shrug_districts_secc.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_secc.parquet`,
    featureNameProp: 'district_name',
    description: 'Socio-Economic and Caste Census (SECC) 2011-12 rural household data aggregated to 641 PC11 districts. ' +
      'Covers: SC share, ST share, disability share, education levels (primary/secondary/graduate), ' +
      'housing type (kachha/pucca), income sources (cultivation/manual labour/domestic work/begging/enterprise), ' +
      'land ownership, age pyramids (5-year bands). ' +
      'Prefixes: secc-mord-rural__, secc-cons-rural__, secc-cons-urban__. License: CC BY-NC-SA 4.0.',
  },
  'shrug-environment': {
    id: 'shrug-environment', level: 'districts', source: 'SHRUG 2.1 / Remote sensing', year: 2020,
    file: `${R2}/geoparquet/shrug/shrug_districts_environment.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_environment.parquet`,
    featureNameProp: 'district_name',
    description: 'Environmental and geographic indicators averaged to 641 PC11 districts. ' +
      'Covers: Surface PM2.5 concentration (1998–2020, mean/min/max), ' +
      'Vegetation Continuous Fields / forest cover (2001–2020), ' +
      'Elevation from SRTM (mean, median, std, percentiles), ' +
      'Terrain Ruggedness Index, ' +
      'DMSP night lights 1992–2013 (mean/total/calibrated), ' +
      'VIIRS annual night lights 2012–2021 (mean/sum). ' +
      'Key columns: pm25__pm25_mean, vcf__vcf_mean, elevation__elevation_mean, ' +
      'dmsp__dmsp_mean_light, viirs-annual__viirs_annual_mean, rugged__tri_mean. License: CC BY-NC-SA 4.0.',
  },
  'shrug-facebook': {
    id: 'shrug-facebook', level: 'districts', source: 'SHRUG 2.1 / Meta / Facebook', year: 2021,
    file: `${R2}/geoparquet/shrug/shrug_districts_facebook.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_facebook.parquet`,
    featureNameProp: 'district_name',
    description: 'Facebook / Meta 2021 population and wealth estimates aggregated to 641 PC11 districts. ' +
      'Covers: Facebook population estimates (facebook-pop__facebook_pop_sum), ' +
      'Relative Wealth Index — RWI (facebook-rwi__facebook_mean_rwi, min, max). ' +
      'RWI is a continuous index where higher = wealthier; derived from Facebook connectivity and satellite data. ' +
      'License: CC BY-NC-SA 4.0.',
  },
  'shrug-roads': {
    id: 'shrug-roads', level: 'districts', source: 'SHRUG 2.1 / PMGSY', year: 2020,
    file: `${R2}/geoparquet/shrug/shrug_districts_roads.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_roads.parquet`,
    featureNameProp: 'district_name',
    description: 'PMGSY (Pradhan Mantri Gram Sadak Yojana) rural road construction aggregated to 641 PC11 districts. ' +
      'Covers: new road length and upgrades (km), construction cost, sanction year for new roads and upgrades. ' +
      'Key columns: pmgsy__road_length_new, pmgsy__road_length_upg, pmgsy__road_cost_new. License: CC BY-NC-SA 4.0.',
  },
  'shrug-all': {
    id: 'shrug-all', level: 'districts', source: 'SHRUG 2.1 (Pakora)', year: 2021,
    file: `${R2}/geoparquet/shrug/shrug_districts_all.parquet`,
    parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_all.parquet`,
    featureNameProp: 'district_name',
    description: 'All SHRUG modules joined into a single wide table for 641 PC11 districts (1,919 columns). ' +
      'Combines census, economic census, SECC, environment, Facebook wealth/population, and PMGSY roads. ' +
      'Use shrug-census / shrug-economic / shrug-secc / shrug-environment / shrug-facebook / shrug-roads ' +
      'for faster, focused queries. License: CC BY-NC-SA 4.0.',
  },

  'gs-wildlife': { id: 'gs-wildlife', file: `${R2}/geojsons/environment/India-geodata-wildlife.geojson`, level: 'regions', source: 'GatiShakti', year: 2024, description: 'Protected wildlife sanctuaries and national parks', featureNameProp: 'area_name' },
  'bm-eco-zones': { id: 'bm-eco-zones', file: `${R2}/geojsons/environment/India-geodata-eco-zones.geojson`, level: 'regions', source: 'GatiShakti', year: 2024, description: 'Biological / eco-sensitive zone boundaries', featureNameProp: 'area_name' },
  'fsi-circles': { id: 'fsi-circles', file: `${R2}/geojsons/environment/India-fsi-circles_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative circles — top-level forest administrative unit', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'circle_name' },
  'fsi-divisions': { id: 'fsi-divisions', file: `${R2}/geojsons/environment/India-fsi-divisions_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative divisions, within circles', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'division_name' },
  'fsi-ranges': { id: 'fsi-ranges', file: `${R2}/geojsons/environment/India-fsi-ranges_simplified.geojson`, level: 'regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative ranges, within divisions', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'range_name' },

  'sbm-ulbs': { id: 'sbm-ulbs', file: `${R2}/geojsons/urban/India-sbm-ulbs_simplified.geojson`, level: 'districts', source: 'SBM', year: 2024, description: 'Urban Local Body boundaries from the Swachh Bharat Mission — national coverage (most states)', statesFile: `${R2}/geojsons/admin/India-geodata-lgd-states.geojson`, featureNameProp: 'ulb_name' },

  'nhp-health-facilities': {
    id: 'nhp-health-facilities',
    file: `${R2}/geoparquet/health/nhp_health_facilities_2025.parquet`,
    parquetUrl: `${R2}/geoparquet/health/nhp_health_facilities_2025.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/nhp_health_facilities_per_district.parquet`,
    level: 'points',
    source: 'National Health Portal / NIN / data.gov.in (GODL)',
    year: 2025,
    featureNameProp: 'health_facility_name',
    description: '166,462 health facilities from the National Institute of Health and Family Welfare / ' +
      'National Health Portal via data.gov.in (2025). License: Government Open Data License India (GODL). ' +
      'Attribution: National Health Portal, nhp.gov.in; data.gov.in. ' +
      'Fields: health_facility_name, facility_type (SubCentre/PHC/CHC/Hospital/etc.), ' +
      'state_name, district_name, taluka_name, block_name, address, pincode. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (630 districts).',
  },
  'nhp-hospital-directory': {
    id: 'nhp-hospital-directory',
    file: `${R2}/geoparquet/health/nhp_hospital_directory_2025.parquet`,
    parquetUrl: `${R2}/geoparquet/health/nhp_hospital_directory_2025.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/nhp_hospital_directory_per_district.parquet`,
    level: 'points',
    source: 'National Health Portal / data.gov.in (GODL)',
    year: 2025,
    featureNameProp: 'Hospital_Name',
    description: '10,843 hospitals from the National Health Portal hospital directory (2025). ' +
      'License: Government Open Data License India (GODL). Attribution: National Health Portal, nhp.gov.in. ' +
      'Fields: Hospital_Name, Hospital_Category, Hospital_Care_Type, Specialties, Facilities, ' +
      'Accreditation, Total_Num_Beds, Number_Doctor, Emergency_Services, State, District, Pincode. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (304 districts).',
  },
  'nhp-blood-banks': {
    id: 'nhp-blood-banks',
    file: `${R2}/geoparquet/health/nhp_blood_banks_2015.parquet`,
    parquetUrl: `${R2}/geoparquet/health/nhp_blood_banks_2015.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/nhp_blood_banks_per_district.parquet`,
    level: 'points',
    source: 'National Health Portal / data.gov.in (GODL)',
    year: 2015,
    featureNameProp: 'h_name',
    description: '897 blood banks from the National Health Portal (2015). ' +
      'License: Government Open Data License India (GODL). Attribution: National Health Portal, nhp.gov.in. ' +
      'Fields: h_name, category, state, district, city, blood_component, blood_group, service_time, contact. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (498 districts).',
  },
  'anganwadis-icds': {
    id: 'anganwadis-icds',
    file: `${R2}/geoparquet/health/anganwadis_icds_2024.parquet`,
    parquetUrl: `${R2}/geoparquet/health/anganwadis_icds_2024.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/anganwadis_per_district.parquet`,
    level: 'points',
    source: 'GatiShakti / Ministry of Women and Child Development',
    year: 2024,
    featureNameProp: 'awc_name',
    description: '1,224,038 ICDS Anganwadi centres from GatiShakti / Ministry of Women and Child Development (2024). ' +
      'Too large for direct browser rendering — use aggregatedByDistrictUrl for choropleth (615 districts, 713k centres with LGD codes). ' +
      'Fields: awc_name, awc_code, district_1 (district), stname (state), dtcode_lg (LGD district code), stcode_lg (LGD state code), latitude, longitude.',
  },

  'bharatmaps-health-centers': {
    id: 'bharatmaps-health-centers',
    file: `${R2}/geoparquet/health/bharatmaps_health_centers.parquet`,
    parquetUrl: `${R2}/geoparquet/health/bharatmaps_health_centers.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/bharatmaps_health_centers_per_district.parquet`,
    level: 'points',
    source: 'BharatMaps (Government of India)',
    year: 2024,
    featureNameProp: 'facility_n',
    description: '147,957 health centres from the BharatMaps government portal. ' +
      'Fields: facility_n (name), facility_t (type), dtname (district), stname (state), stcode11, dtcode11. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (542 districts).',
  },
  'gatishakti-child-care': {
    id: 'gatishakti-child-care',
    file: `${R2}/geoparquet/health/gatishakti_child_care_institutes.parquet`,
    parquetUrl: `${R2}/geoparquet/health/gatishakti_child_care_institutes.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/gatishakti_child_care_per_district.parquet`,
    level: 'points',
    source: 'GatiShakti / MoWCD (GODL)',
    year: 2024,
    featureNameProp: 'name',
    description: '4,125 government-run creches and child development centres from GatiShakti portal (Ministry of Women and Child Development). ' +
      'Fields: state, district, stateid, districtid, latitude, longitude, postal_address1/2/3. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (572 districts).',
  },
  'ncog-soi-dispensaries': {
    id: 'ncog-soi-dispensaries',
    file: `${R2}/geoparquet/health/ncog_soi_dispensaries.parquet`,
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_dispensaries.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/ncog_soi_dispensaries_per_district.parquet`,
    level: 'points',
    source: 'Survey of India NCOG (GODL)',
    year: 2024,
    featureNameProp: 'loc_name',
    description: '34,330 dispensaries from the Survey of India NCOG dataset. ' +
      'Fields: loc_name, type, addl_info, lon, lat. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (731 districts).',
  },
  'ncog-soi-hospitals': {
    id: 'ncog-soi-hospitals',
    file: `${R2}/geoparquet/health/ncog_soi_hospitals.parquet`,
    parquetUrl: `${R2}/geoparquet/health/ncog_soi_hospitals.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/ncog_soi_hospitals_per_district.parquet`,
    level: 'points',
    source: 'Survey of India NCOG (GODL)',
    year: 2024,
    featureNameProp: 'name',
    description: '13,932 hospitals from the Survey of India NCOG dataset. ' +
      'Fields: name, loc_name, type, addl_info, lon, lat. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (745 districts).',
  },
  'livingatlas-health-facilities': {
    id: 'livingatlas-health-facilities',
    file: `${R2}/geoparquet/health/livingatlas_health_facilities.parquet`,
    parquetUrl: `${R2}/geoparquet/health/livingatlas_health_facilities.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/livingatlas_health_facilities_per_district.parquet`,
    level: 'points',
    source: 'Esri Living Atlas',
    year: 2024,
    featureNameProp: 'facilityname',
    description: '227,091 health facilities across India from the Esri Living Atlas, aggregating multiple open government sources. ' +
      'Fields: facilityname, facilitytype, district, state, subdistrict, address, posatalcode. ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (734 districts).',
  },

  'hotosm-health-facilities': {
    id: 'hotosm-health-facilities',
    file: `${R2}/geojsons/facilities/hotosm_ind_health_facilities.geojson`,
    parquetUrl: `${R2}/geoparquet/facilities/hotosm_ind_health_facilities.parquet`,
    aggregatedByDistrictUrl: `${R2}/geoparquet/health/aggregated/hotosm_health_facilities_per_district.parquet`,
    level: 'points',
    source: 'HOTOSM / OpenStreetMap',
    year: 2026,
    description: '142,629 health facilities across India (hospitals, clinics, pharmacies, dentists, health posts) from OpenStreetMap via Humanitarian Data Exchange. Updated monthly. ' +
      'Fields: name, amenity, healthcare, healthcare_speciality, operator_type, capacity_persons, addr_city, adm1_name (state), adm2_name (district). ' +
      'Pre-aggregated district counts available via aggregatedByDistrictUrl (695 districts).',
    featureNameProp: 'name',
  },
  'airports': {
    id: 'airports',
    file: `${R2}/geojsons/points/india_airports.geojson`,
    parquetUrl: `${R2}/geoparquet/points/india_airports.parquet`,
    level: 'points',
    source: 'OurAirports (Public Domain)',
    year: 2026,
    description: '649 airports and airfields in India including large, medium, small airports and heliports. Fields: name, type (large_airport/medium_airport/small_airport/heliport), iata_code, icao_code, municipality, state, elevation_ft, scheduled_service.',
    featureNameProp: 'name',
  },
  'dams': {
    id: 'dams',
    file: `${R2}/geojsons/points/india_dams.geojson`,
    parquetUrl: `${R2}/geoparquet/points/india_dams.parquet`,
    level: 'points',
    source: 'OpenStreetMap (ODbL)',
    year: 2026,
    description: 'Dams and barrages across India from OpenStreetMap. Fields: name, waterway, man_made, operator, height, osm_id.',
    featureNameProp: 'name',
  },
  'water-bodies': {
    id: 'water-bodies',
    file: `${R2}/geojsons/points/india_water_bodies.geojson`,
    parquetUrl: `${R2}/geoparquet/points/india_water_bodies.parquet`,
    level: 'points',
    source: 'OpenStreetMap (ODbL)',
    year: 2026,
    description: 'Lakes, reservoirs, ponds and other natural water bodies across India from OpenStreetMap. Polygon centroids stored as points. Fields: name, water (lake/reservoir/river/pond), natural, osm_id.',
    featureNameProp: 'name',
  },
  'pincodes-centroids': {
    id: 'pincodes-centroids',
    file: `${R2}/geojsons/points/india_pincodes_centroids.geojson`,
    parquetUrl: `${R2}/geoparquet/points/india_pincodes_centroids.parquet`,
    level: 'points',
    source: 'BharatViz (derived from pincode boundaries)',
    year: 2026,
    description: '63,864 pincode centroids derived from pincode boundary polygons. Used for proximity queries (e.g. "pincodes near 400071"). Fields: pincode, office_name, district, state.',
    featureNameProp: 'pincode',
  },
};

/** GeoJSON cache to avoid reloading large files */
const geojsonCache = new LRUCache<string, FeatureCollection>(50);

const WARMUP_LAYERS = [
  'census-2011-enriched',
  'shrug-census',
  'shrug-secc',
  'shrug-economic',
  'shrug-environment',
  'shrug-facebook',
  'shrug-roads',
  'nhp-health-facilities',
  'nhp-hospital-directory',
  'bharatmaps-health-centers',
  'livingatlas-health-facilities',
  'hotosm-health-facilities',
];

export async function warmCache(): Promise<void> {
  for (const id of WARMUP_LAYERS) {
    const entry = MAP_REGISTRY[id];
    if (!entry) continue;
    try {
      await loadGeoJSON(entry.file);
      console.log(`[warmup] cached ${id}`);
    } catch (e) {
      console.warn(`[warmup] failed to cache ${id}:`, (e as Error).message);
    }
  }
}

async function loadGeoJSON(url: string): Promise<FeatureCollection> {
  if (geojsonCache.has(url)) return geojsonCache.get(url)!;
  let data: FeatureCollection;
  if (url.endsWith('.parquet')) {
    data = await loadParquetAsGeoJSON(url);
  } else {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch GeoJSON from ${url}: ${response.status}`);
    data = await response.json() as FeatureCollection;
  }
  geojsonCache.set(url, data);
  return data;
}

async function loadParquetAsGeoJSON(url: string): Promise<FeatureCollection> {
  const { asyncBufferFromUrl, parquetReadObjects } = await import('hyparquet');
  const { compressors } = await import('hyparquet-compressors');
  const file = await asyncBufferFromUrl({ url });
  const rows = await parquetReadObjects({ file, compressors }) as Array<Record<string, unknown>>;
  // hyparquet returns int64 as BigInt, which JSON.stringify can't serialize; coerce to
  // Number, or string above MAX_SAFE_INTEGER to avoid silent precision loss.
  const normalize = (v: unknown): unknown =>
    typeof v === 'bigint'
      ? (v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString())
      : v;
  const features: Feature[] = rows.map(row => {
    const { geometry, ...rawProps } = row;
    const properties: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(rawProps)) properties[k] = normalize(val);
    return {
      type: 'Feature',
      geometry: geometry as Geometry,
      properties,
    };
  });
  return { type: 'FeatureCollection', features };
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Test whether [lng, lat] is inside a GeoJSON geometry (Polygon or MultiPolygon). */
function pointInGeometry(lng: number, lat: number, geometry: { type: string; coordinates: unknown }): boolean {
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as number[][][];
    if (!pointInRing(lng, lat, rings[0])) return false;
    for (let i = 1; i < rings.length; i++) {
      if (pointInRing(lng, lat, rings[i])) return false;
    }
    return true;
  }
  if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as number[][][][]) {
      if (!pointInRing(lng, lat, polygon[0])) continue;
      let inHole = false;
      for (let i = 1; i < polygon.length; i++) {
        if (pointInRing(lng, lat, polygon[i])) { inHole = true; break; }
      }
      if (!inHole) return true;
    }
  }
  return false;
}

/** Find the first feature in a FeatureCollection whose polygon contains [lat, lng]. */
function findContainingFeature(fc: FeatureCollection, lat: number, lng: number) {
  for (const feature of fc.features) {
    if (!feature.geometry) continue;
    if (pointInGeometry(lng, lat, feature.geometry as { type: string; coordinates: unknown })) {
      return feature;
    }
  }
  return null;
}

/** Levenshtein distance between two strings (two-row optimization) */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/** Find the best fuzzy match for `input` among `candidates`. Returns null if no good match. */
function fuzzyMatchName(input: string, candidates: string[]): string | null {
  const norm = input.toLowerCase().trim();
  const normalized = candidates.map(c => c.toLowerCase().trim());

  const exactIdx = normalized.indexOf(norm);
  if (exactIdx !== -1) return candidates[exactIdx];

  const maxDist = Math.max(1, Math.floor(norm.length * 0.3));
  let bestMatch: string | null = null;
  let bestDist = Infinity;
  for (let i = 0; i < normalized.length; i++) {
    const dist = levenshtein(norm, normalized[i]);
    if (dist <= maxDist && dist < bestDist) {
      bestDist = dist;
      bestMatch = candidates[i];
    }
  }
  return bestMatch;
}

export class McpMapService {
  private exportService = new ExportService();
  private pincodeRenderer = new PincodeMapRenderer();
  private cityRenderer = new CityMapRenderer();

  private async formatOutput(
    svgString: string,
    outputFormat: 'png' | 'svg' | 'both' = 'png',
  ): Promise<{ svg?: string; png?: string }> {
    const result: { svg?: string; png?: string } = {};
    if (outputFormat === 'svg' || outputFormat === 'both') result.svg = svgString;
    if (outputFormat === 'png' || outputFormat === 'both') result.png = await this.exportService.svgToPNG(svgString);
    return result;
  }

  private static categoryForId(id: string): string {
    if (id.startsWith('census-')) return 'admin';
    if (id.startsWith('lgd-parliament') || id.startsWith('lgd-assembly') || id.startsWith('susewind-')) return 'electoral';
    if (id.startsWith('lgd-') || id.startsWith('soi-') || id.startsWith('bhuvan-') || id.startsWith('pmgsy-') || id.startsWith('shrug-')) return 'admin';
    if (id.startsWith('nfhs') || id.startsWith('nsso-')) return 'survey';
    if (id.startsWith('gs-') || id.startsWith('bm-') || id.startsWith('fsi-')) return 'environment';
    if (id.startsWith('sbm-')) return 'urban';
    if (id === 'airports' || id === 'dams' || id === 'water-bodies' || id.startsWith('pincodes-')) return 'points';
    if (id.startsWith('nhp-') || id === 'anganwadis-icds' || id.startsWith('bharatmaps-') || id.startsWith('bhuvan-sisdp') || id.startsWith('gatishakti-child') || id.startsWith('ncog-') || id.startsWith('livingatlas-') || id.startsWith('hotosm-')) return 'health';
    return 'other';
  }

  /** List all available maps with metadata */
  async listMaps(): Promise<Array<MapEntry & { featureCount: number; category: string }>> {
    const results = [];
    for (const entry of Object.values(MAP_REGISTRY)) {
      const category = McpMapService.categoryForId(entry.id);
      try {
        let featureCount = 0;
        if (entry.file.endsWith('.parquet')) {
          // Read only the parquet footer (cheap) to get row count
          const { asyncBufferFromUrl, parquetMetadataAsync } = await import('hyparquet');
          const file = await asyncBufferFromUrl({ url: entry.file });
          const meta = await parquetMetadataAsync(file);
          featureCount = Number(meta.num_rows);
        } else {
          const data = await loadGeoJSON(entry.file);
          featureCount = data.features.length;
        }
        results.push({ ...entry, category, featureCount });
      } catch {
        results.push({ ...entry, category, featureCount: 0 });
      }
    }
    return results;
  }

  /** List available maps grouped by category, without fetching GeoJSON */
  listCategories(): Record<string, Array<Pick<MapEntry, 'id' | 'level' | 'source' | 'year' | 'description' | 'aggregatedByDistrictUrl'>>> {
    const out: Record<string, Array<Pick<MapEntry, 'id' | 'level' | 'source' | 'year' | 'description' | 'aggregatedByDistrictUrl'>>> = {};
    for (const entry of Object.values(MAP_REGISTRY)) {
      const cat = McpMapService.categoryForId(entry.id);
      if (!out[cat]) out[cat] = [];
      out[cat].push({ id: entry.id, level: entry.level, source: entry.source, year: entry.year, description: entry.description, aggregatedByDistrictUrl: entry.aggregatedByDistrictUrl });
    }
    return out;
  }

  /** List state names for a given map */
  async listStates(mapId: string): Promise<string[]> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);

    const data = await loadGeoJSON(entry.file);
    const states = new Set<string>();
    for (const feature of data.features) {
      const name = String(feature.properties?.state_name || '').trim();
      if (name) states.add(name);
    }
    return Array.from(states).sort();
  }

  /** List districts for a given map, optionally filtered by state */
  async listDistricts(mapId: string, state?: string): Promise<Array<{ state: string; district: string }>> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);
    if (entry.level === 'states') throw new Error(`Map ${mapId} is a state-level map. Use a district-level map ID instead.`);

    const nameProp = entry.featureNameProp || 'district_name';
    const data = await loadGeoJSON(entry.file);
    const results: Array<{ state: string; district: string }> = [];
    for (const feature of data.features) {
      const stateName = String(feature.properties?.state_name || '').trim();
      const districtName = String(feature.properties?.[nameProp] || '').trim();
      if (!districtName) continue;
      if (state && stateName.toLowerCase() !== state.toLowerCase()) continue;
      results.push({ state: stateName, district: districtName });
    }
    return results.sort((a, b) => a.state.localeCompare(b.state) || a.district.localeCompare(b.district));
  }

  /** Generate CSV template for a given map */
  async getCsvTemplate(mapId: string): Promise<string> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}. Use list_available_maps to see valid IDs.`);

    if (entry.level === 'states') {
      const states = await this.listStates(mapId);
      const lines = ['state,value'];
      for (const state of states) {
        lines.push(`${state},`);
      }
      return lines.join('\n');
    } else {
      const nameProp = entry.featureNameProp || 'district_name';
      const districts = await this.listDistricts(mapId);
      const hasState = districts.some(d => d.state);
      const lines = [hasState ? `state,${nameProp},value` : `${nameProp},value`];
      for (const d of districts) {
        lines.push(hasState ? `${d.state},${d.district},` : `${d.district},`);
      }
      return lines.join('\n');
    }
  }

  /** Render a state-level map */
  async renderStatesMap(options: {
    data: Array<{ state: string; value: number }>;
    mapId?: string;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideStateNames?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const mapId = options.mapId || 'lgd-states';
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}`);
    if (entry.level !== 'states') throw new Error(`Map ${mapId} is not a state-level map.`);

    const renderer = new StatesMapRenderer();
    await renderer.loadGeoJSONFromPath(entry.file);

    // Fuzzy-match user-provided state names to GeoJSON names
    const geojsonStates = await this.listStates(mapId);
    const resolvedData = options.data.map(d => {
      const matched = fuzzyMatchName(d.state, geojsonStates);
      return { state: matched || d.state, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideStateNames: options.hideStateNames ?? false,
      hideValues: options.hideValues ?? false,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  /** Render a district-level map */
  async renderDistrictsMap(options: {
    data: Array<{ state: string; district: string; value: number }>;
    mapId?: string;
    state?: string;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideDistrictNames?: boolean;
    hideValues?: boolean;
    showStateBoundaries?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const mapId = options.mapId || 'lgd-districts';
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: ${mapId}`);
    if (entry.level === 'states') throw new Error(`Map ${mapId} is a state-level map. Use a district-level map ID.`);

    const renderer = new DistrictsMapRenderer();
    await renderer.loadGeoJSONFromPaths(entry.file, entry.statesFile);

    // Fuzzy-match user-provided names to GeoJSON names
    const allDistricts = await this.listDistricts(mapId);
    const geojsonStates = [...new Set(allDistricts.map(d => d.state).filter(Boolean))];
    const isStateless = geojsonStates.length === 0; // layers like eco-zones have no state_name
    const allFeatureNames = isStateless ? allDistricts.map(d => d.district) : [];
    const districtsByState = new Map<string, string[]>();
    if (!isStateless) {
      for (const d of allDistricts) {
        const key = d.state.toLowerCase().trim();
        if (!districtsByState.has(key)) districtsByState.set(key, []);
        districtsByState.get(key)!.push(d.district);
      }
    }

    const resolvedData = options.data.map(d => {
      if (isStateless) {
        const matchedDistrict = fuzzyMatchName(d.district, allFeatureNames) || d.district;
        return { state: '', district: matchedDistrict, value: d.value };
      }
      const matchedState = fuzzyMatchName(d.state, geojsonStates) || d.state;
      const stateDistricts = districtsByState.get(matchedState.toLowerCase().trim()) || [];
      const matchedDistrict = fuzzyMatchName(d.district, stateDistricts) || d.district;
      return { state: matchedState, district: matchedDistrict, value: d.value };
    });

    const svgString = await renderer.renderMap({
      data: resolvedData.map(d => ({ state: d.state, district: d.district, value: d.value })),
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideDistrictNames: options.hideDistrictNames ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      showStateBoundaries: options.showStateBoundaries ?? true,
      state: options.state ? (fuzzyMatchName(options.state, geojsonStates) || options.state) : undefined,
      darkMode: options.darkMode ?? false,
      formats: ['svg'],
      featureNameProp: entry.featureNameProp || 'district_name',
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  /** Load showcase demo URLs JSON */
  private async loadDemoUrls(): Promise<Record<string, { url: string; title: string }>> {
    const jsonPath = join(__dirname, '../../src/lib/showcase-demo-urls.json');
    const raw = await readFile(jsonPath, 'utf-8');
    return JSON.parse(raw);
  }

  /** List all available showcase demo datasets */
  async listDemos(level?: 'states' | 'districts'): Promise<Array<{ id: string; title: string; level: string; url: string }>> {
    const demos = await this.loadDemoUrls();
    return Object.entries(demos)
      .filter(([key]) => !level || key.startsWith(level + '_'))
      .map(([key, { url, title }]) => ({
        id: key,
        title,
        level: key.startsWith('districts_') ? 'districts' : 'states',
        url,
      }));
  }

  /** Generate a shareable BharatViz URL for a given demo */
  async getDemoUrl(demoId: string, baseUrl?: string): Promise<{ shareableUrl: string; title: string; csvUrl: string }> {
    const demos = await this.loadDemoUrls();
    const demo = demos[demoId];
    if (!demo) {
      const available = Object.keys(demos).join(', ');
      throw new Error(`Unknown demo ID: "${demoId}". Available: ${available}`);
    }
    const base = (baseUrl || 'https://bharatviz.com').replace(/\/$/, '');
    const params = new URLSearchParams();
    params.set('dataUrl', demo.url);
    params.set('title', demo.title);
    return {
      shareableUrl: `${base}/?${params.toString()}`,
      title: demo.title,
      csvUrl: demo.url,
    };
  }

  // ── Pincode Tools ──────────────────────────────────────────────────────

  listPincodeStates(): string[] {
    return this.pincodeRenderer.getAvailableStates();
  }

  /**
   * Build a point→{district,state} locator from lgd-districts, optionally scoped to one
   * state so the per-point polygon test only scans that state's districts. The district
   * attribution is polygon-derived (the pincode layer's own district field is blank/dirty).
   */
  private async buildDistrictLocator(state?: string): Promise<(lon: number, lat: number) => { district: string; state: string }> {
    const data = await loadGeoJSON(MAP_REGISTRY['lgd-districts'].file);
    let feats = data.features.filter(f => f.geometry);
    if (state && state.trim() && state.toLowerCase() !== 'all india') {
      const lv = state.toLowerCase().trim();
      const scoped = feats.filter(f => String(f.properties?.state_name ?? '').toLowerCase().trim() === lv);
      if (scoped.length) feats = scoped;
    }
    return (lon: number, lat: number) => {
      for (const f of feats) {
        if (pointInGeometry(lon, lat, f.geometry as { type: string; coordinates: unknown })) {
          return {
            district: String(f.properties?.district_name ?? ''),
            state: String(f.properties?.state_name ?? ''),
          };
        }
      }
      return { district: '', state: '' };
    };
  }

  // When scoped, sources from pincodes-centroids and derives district/state by
  // point-in-polygon (the layer's own district field is blank). `district` filter is an
  // EXACT match on the derived name. Unscoped stays on the cheap coordinate-free path.
  async listPincodes(
    state?: string,
    district?: string,
  ): Promise<Array<{ pincode: string; office_name: string; district: string; state?: string; lat?: number; lon?: number }>> {
    const scoped = Boolean((state && state.trim() && state.toLowerCase() !== 'all india') || (district && district.trim()));
    if (!scoped) {
      return this.pincodeRenderer.listPincodes(state);
    }

    const data = await loadGeoJSON(MAP_REGISTRY['pincodes-centroids'].file);
    const locate = await this.buildDistrictLocator(state);
    const wantDistrict = district?.toLowerCase().trim();

    const rows: Array<{ pincode: string; office_name: string; district: string; state: string; lat: number; lon: number }> = [];
    for (const f of data.features) {
      const props = f.properties || {};
      const pincode = String(props.pincode ?? '').trim();
      if (!pincode) continue;
      const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
      if (!c) continue;
      const ds = locate(c[0], c[1]);
      if (state && state.toLowerCase() !== 'all india' && ds.state &&
          ds.state.toLowerCase().trim() !== state.toLowerCase().trim()) continue;
      if (wantDistrict && ds.district.toLowerCase().trim() !== wantDistrict) continue;
      rows.push({ pincode, office_name: String(props.office_name ?? '').trim(), district: ds.district, state: ds.state, lat: c[1], lon: c[0] });
    }
    return rows.sort((a, b) => a.pincode.localeCompare(b.pincode));
  }

  async renderPincodesMap(options: {
    data: Array<{ pincode: string; value: number }>;
    state?: string;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hidePincodeLabels?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const svgString = await this.pincodeRenderer.renderMap({
      data: options.data,
      state: options.state,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hidePincodeLabels: options.hidePincodeLabels ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  // ── City/Ward Tools ────────────────────────────────────────────────────

  private citiesManifestCache: Array<{ id: string; displayName: string; state: string; type: string; featureCount: number }> | null = null;

  async listCities(): Promise<Array<{ id: string; displayName: string; state: string; type: string; featureCount: number }>> {
    if (!this.citiesManifestCache) {
      const manifestPath = join(__dirname, '../../public/city-datasets-manifest.json');
      const raw = await readFile(manifestPath, 'utf-8');
      this.citiesManifestCache = JSON.parse(raw);
    }
    return this.citiesManifestCache!;
  }

  async listWards(cityId: string): Promise<string[]> {
    return this.cityRenderer.listWards(cityId);
  }

  async renderCityMap(options: {
    cityId: string;
    data: Array<{ ward: string; value: number }>;
    colorScale?: string;
    title?: string;
    legendTitle?: string;
    darkMode?: boolean;
    invertColors?: boolean;
    hideWardNames?: boolean;
    hideValues?: boolean;
    outputFormat?: 'png' | 'svg' | 'both';
  }): Promise<{ svg?: string; png?: string }> {
    const svgString = await this.cityRenderer.renderMap({
      cityId: options.cityId,
      data: options.data,
      colorScale: (options.colorScale as ColorScale) || 'spectral',
      invertColors: options.invertColors ?? false,
      hideWardNames: options.hideWardNames ?? true,
      hideValues: options.hideValues ?? true,
      mainTitle: options.title || 'BharatViz',
      legendTitle: options.legendTitle || 'Values',
      darkMode: options.darkMode ?? false,
    });

    return this.formatOutput(svgString, options.outputFormat);
  }

  getLayerDetail(mapId: string): { mapId: string; geojsonUrl: string; parquetUrl?: string; description: string; source: string; year: number; level: string } {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: "${mapId}". Use list_available_maps to see valid IDs.`);
    const parquetUrl = entry.parquetUrl ?? (
      entry.file.includes('/geojsons/')
        ? entry.file.replace('/geojsons/', '/geoparquet/').replaceAll('.geojson', '.parquet')
        : undefined
    );
    return {
      mapId: entry.id,
      geojsonUrl: entry.file,
      parquetUrl,
      description: entry.description,
      source: entry.source,
      year: entry.year,
      level: entry.level,
    };
  }

  private haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private ringAreaKm2(ring: number[][]): number {
    const R = 6371;
    let area = 0;
    const n = ring.length;
    for (let i = 0; i < n; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[(i + 1) % n];
      area += (lon2 - lon1) * Math.PI / 180 * (2 + Math.sin(lat1 * Math.PI / 180) + Math.sin(lat2 * Math.PI / 180));
    }
    return Math.abs(area * R * R / 2);
  }

  /** Compute area in km² for a GeoJSON Polygon or MultiPolygon feature. */
  private featureAreaKm2(geometry: { type: string; coordinates: unknown }): number {
    if (geometry.type === 'Polygon') {
      const rings = geometry.coordinates as number[][][];
      let area = this.ringAreaKm2(rings[0]);
      for (let i = 1; i < rings.length; i++) area -= this.ringAreaKm2(rings[i]);
      return area;
    }
    if (geometry.type === 'MultiPolygon') {
      let total = 0;
      for (const polygon of geometry.coordinates as number[][][][]) {
        let area = this.ringAreaKm2(polygon[0]);
        for (let i = 1; i < polygon.length; i++) area -= this.ringAreaKm2(polygon[i]);
        total += area;
      }
      return total;
    }
    return 0;
  }

  private featureCentroid(geometry: { type: string; coordinates: unknown }): [number, number] | null {
    if (geometry.type === 'Point') {
      const [lon, lat] = geometry.coordinates as number[];
      return [lon, lat];
    }
    if (geometry.type === 'Polygon') {
      const ring = (geometry.coordinates as number[][][])[0];
      const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      return [lon, lat];
    }
    if (geometry.type === 'MultiPolygon') {
      const polys = geometry.coordinates as number[][][][];
      if (!polys.length || !polys[0]?.length) return null;
      // Use the largest outer ring (by vertex count) as a proxy for the main body
      const ring = polys.reduce((best, p) => p[0].length > best.length ? p[0] : best, polys[0][0]);
      const lon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
      const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
      return [lon, lat];
    }
    return null;
  }

  async nearby(options: {
    lat?: number;
    lon?: number;
    pincode?: string;
    radiusKm: number;
    mapIds: string[];
    limit?: number;
    properties?: string[];
    filters?: Record<string, string>;
    terse?: boolean;
  }): Promise<{
    center: { lat: number; lon: number; pincode?: string };
    layers: Array<{ mapId: string; features: Array<Record<string, string | number>> }>;
  }> {
    const limit = Math.max(1, Math.min(options.limit ?? 20, 200));

    // Resolve the search center: explicit lat/lon, or a pincode centroid.
    let lat = options.lat;
    let lon = options.lon;
    if ((lat == null || lon == null) && options.pincode) {
      const c = await this.pincodeCentroid(options.pincode);
      if (!c) throw new Error(`Unknown pincode: "${options.pincode}"`);
      lat = c.lat; lon = c.lon;
    }
    if (lat == null || lon == null) throw new Error('Provide either lat+lon or pincode as the center.');

    // Verbose OSM admin-code/duplicate-name boilerplate to drop when terse (the default).
    const TERSE_DROP = /^(adm\d_pcode|adm0_name|adm0_pcode|name_latin|name_en|name_hi|osm_id|source)$/;
    const terse = options.terse !== false && !options.properties?.length;

    const layers: Array<{ mapId: string; features: Array<Record<string, string | number>> }> = [];

    for (const mapId of options.mapIds) {
      const entry = MAP_REGISTRY[mapId];
      if (!entry) { layers.push({ mapId, features: [] }); continue; }
      let data: FeatureCollection;
      try { data = await loadGeoJSON(entry.file); } catch { layers.push({ mapId, features: [] }); continue; }

      const candidates = options.filters
        ? this.applyFilters(data.features, options.filters)
        : data.features;

      const hits: Array<{ dist: number; props: Record<string, string | number>; dedupKey: string }> = [];
      for (const feature of candidates) {
        if (!feature.geometry) continue;
        const centroid = this.featureCentroid(feature.geometry as { type: string; coordinates: unknown });
        if (!centroid) continue;
        const [fLon, fLat] = centroid;
        const dist = this.haversine(lat, lon, fLat, fLon);
        if (dist > options.radiusKm) continue;

        const raw = feature.properties || {};
        const props: Record<string, string | number> = { _distance_km: Math.round(dist * 10) / 10 };
        const keys = options.properties?.length ? options.properties : Object.keys(raw);
        for (const k of keys) {
          if (raw[k] == null || raw[k] === '') continue;
          if (terse && TERSE_DROP.test(k)) continue;
          props[k] = raw[k] as string | number;
        }
        // Dedup the OSM double-node records: same name at (nearly) the same place.
        const name = String(raw.name ?? raw.office_name ?? raw.pincode ?? '').toLowerCase().trim();
        const dedupKey = `${name}|${fLon.toFixed(3)},${fLat.toFixed(3)}`;
        hits.push({ dist, props, dedupKey });
      }

      hits.sort((a, b) => a.dist - b.dist);
      const seen = new Set<string>();
      const deduped: Array<Record<string, string | number>> = [];
      for (const h of hits) {
        if (h.dedupKey && seen.has(h.dedupKey)) continue;
        seen.add(h.dedupKey);
        deduped.push(h.props);
        if (deduped.length >= limit) break;
      }

      // Pincode results ship district/state blank — derive them per returned row.
      if (mapId === 'pincodes-centroids') {
        for (const p of deduped) {
          if ((!p.district || p.district === '') && p.pincode) {
            const c = await this.pincodeCentroid(String(p.pincode));
            if (c) {
              const ds = await this.districtStateAt(c.lat, c.lon);
              p.district = ds.district;
              p.state = ds.state;
            }
          }
        }
      }

      layers.push({ mapId, features: deduped });
    }

    return { center: { lat, lon, ...(options.pincode ? { pincode: options.pincode } : {}) }, layers };
  }

  async getArea(options: {
    mapId: string;
    name?: string;
    populationProperty?: string;
    limit?: number;
  }): Promise<Array<{ name: string; area_km2: number; population?: number; density_per_km2?: number; properties: Record<string, string> }>> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}". Use list_available_maps.`);
    const data = await loadGeoJSON(entry.file);
    const nameProp = entry.featureNameProp || 'district_name';
    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));

    let features = data.features.filter(f => f.geometry);

    if (options.name) {
      const names = features.map(f => String(f.properties?.[nameProp] || ''));
      const matched = fuzzyMatchName(options.name, names);
      if (!matched) return [];
      features = features.filter(f => String(f.properties?.[nameProp] || '') === matched);
    }

    return features.slice(0, limit).map(f => {
      const area = this.featureAreaKm2(f.geometry as { type: string; coordinates: unknown });
      const props: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.properties || {})) if (v != null) props[k] = String(v);
      const result: { name: string; area_km2: number; population?: number; density_per_km2?: number; properties: Record<string, string> } = {
        name: String(f.properties?.[nameProp] || ''),
        area_km2: Math.round(area * 10) / 10,
        properties: props,
      };
      if (options.populationProperty) {
        const pop = parseFloat(String(f.properties?.[options.populationProperty] || ''));
        if (!isNaN(pop) && area > 0) {
          result.population = pop;
          result.density_per_km2 = Math.round(pop / area);
        }
      }
      return result;
    });
  }

  /**
   * Centroid (lat/lon) of any feature in any layer — district, constituency, ward,
   * pincode, point, polygon. Look up by fuzzy `name` (on the layer's featureNameProp)
   * and/or `filters`. Returns one row per matched feature.
   */
  async centroid(options: {
    mapId: string;
    name?: string;
    filters?: Record<string, string>;
    limit?: number;
  }): Promise<Array<{ name: string; lat: number; lon: number; properties: Record<string, string> }>> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}". Use list_available_maps.`);
    const data = await loadGeoJSON(entry.file);
    const nameProp = entry.featureNameProp || 'district_name';
    const limit = Math.max(1, Math.min(options.limit ?? 50, 500));

    let features = data.features.filter(f => f.geometry);
    if (options.filters) features = this.applyFilters(features, options.filters);
    if (options.name) {
      const names = features.map(f => String(f.properties?.[nameProp] || ''));
      const matched = fuzzyMatchName(options.name, names);
      if (!matched) return [];
      features = features.filter(f => String(f.properties?.[nameProp] || '') === matched);
    }

    const out: Array<{ name: string; lat: number; lon: number; properties: Record<string, string> }> = [];
    for (const f of features.slice(0, limit)) {
      const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
      if (!c) continue;
      const props: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.properties || {})) if (v != null && v !== '') props[k] = String(v);
      out.push({ name: String(f.properties?.[nameProp] || ''), lat: c[1], lon: c[0], properties: props });
    }
    return out;
  }

  async spatialJoin(options: {
    boundaryMapId: string;
    boundaryFilter: Record<string, string>;
    targetMapId: string;
    targetFilters?: Record<string, string>;
    limit?: number;
    properties?: string[];
  }): Promise<{
    boundary: Record<string, string> | null;
    boundaryArea_km2?: number;
    boundaryCount?: number;
    total: number;
    results: Array<Record<string, string>>;
  }> {
    const boundaryEntry = MAP_REGISTRY[options.boundaryMapId];
    if (!boundaryEntry) throw new Error(`Unknown boundaryMapId: "${options.boundaryMapId}"`);
    const targetEntry = MAP_REGISTRY[options.targetMapId];
    if (!targetEntry) throw new Error(`Unknown targetMapId: "${options.targetMapId}"`);

    const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));

    const boundaryData = await loadGeoJSON(boundaryEntry.file);
    let boundaryFeatures = boundaryData.features;
    const hasFilter = Object.keys(options.boundaryFilter).length > 0;
    if (hasFilter) {
      for (const [key, value] of Object.entries(options.boundaryFilter)) {
        const lv = value.toLowerCase();
        boundaryFeatures = boundaryFeatures.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
      if (boundaryFeatures.length === 0) {
        return { boundary: null, total: 0, results: [] };
      }
    }

    const targetData = await loadGeoJSON(targetEntry.file);
    let targetFeatures = targetData.features;
    if (options.targetFilters) {
      for (const [key, value] of Object.entries(options.targetFilters)) {
        const lv = value.toLowerCase();
        targetFeatures = targetFeatures.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
    }

    if (hasFilter) {
      // Union targets across ALL matched boundary features so that ambiguous filters
      // (e.g. district_name:"north" matching dozens of districts) don't silently
      // discard everything except the first match.
      let totalMatched = 0;
      const matched: Array<Record<string, string>> = [];

      for (const boundaryFeature of boundaryFeatures) {
        if (!boundaryFeature.geometry) continue;
        const boundaryGeom = boundaryFeature.geometry as { type: string; coordinates: unknown };

        for (const feature of targetFeatures) {
          if (!feature.geometry) continue;
          const geom = feature.geometry as { type: string; coordinates: unknown };

          let testLon: number, testLat: number;
          if (geom.type === 'Point') {
            [testLon, testLat] = geom.coordinates as number[];
          } else {
            const c = this.featureCentroid(geom);
            if (!c) continue;
            [testLon, testLat] = c;
          }

          if (!pointInGeometry(testLon, testLat, boundaryGeom)) continue;

          totalMatched++;
          if (matched.length < limit) {
            const raw = feature.properties || {};
            const props: Record<string, string> = {};
            const keys = options.properties?.length ? options.properties : Object.keys(raw);
            for (const k of keys) if (raw[k] != null) props[k] = String(raw[k]);
            matched.push(props);
          }
        }
      }

      // Use the first matched boundary's properties/area for the envelope fields.
      const firstGeom = boundaryFeatures.find(f => f.geometry)?.geometry as { type: string; coordinates: unknown } | undefined;
      const boundaryProps: Record<string, string> = {};
      for (const [k, v] of Object.entries(boundaryFeatures[0].properties || {})) {
        if (v != null) boundaryProps[k] = String(v);
      }
      const boundaryArea = firstGeom && (firstGeom.type === 'Polygon' || firstGeom.type === 'MultiPolygon')
        ? Math.round(this.featureAreaKm2(firstGeom) * 10) / 10
        : undefined;
      return {
        boundary: boundaryProps,
        ...(boundaryArea !== undefined ? { boundaryArea_km2: boundaryArea } : {}),
        ...(boundaryFeatures.length > 1 ? { boundaryCount: boundaryFeatures.length } : {}),
        total: totalMatched,
        results: matched,
      };
    }

    // No filter: locate semantics — return the first boundary that contains any target.
    for (const boundaryFeature of boundaryFeatures) {
      if (!boundaryFeature.geometry) continue;
      const boundaryGeom = boundaryFeature.geometry as { type: string; coordinates: unknown };

      let totalMatched = 0;
      const matched: Array<Record<string, string>> = [];

      for (const feature of targetFeatures) {
        if (!feature.geometry) continue;
        const geom = feature.geometry as { type: string; coordinates: unknown };

        let testLon: number, testLat: number;
        if (geom.type === 'Point') {
          [testLon, testLat] = geom.coordinates as number[];
        } else {
          const c = this.featureCentroid(geom);
          if (!c) continue;
          [testLon, testLat] = c;
        }

        if (!pointInGeometry(testLon, testLat, boundaryGeom)) continue;

        totalMatched++;
        if (matched.length < limit) {
          const raw = feature.properties || {};
          const props: Record<string, string> = {};
          const keys = options.properties?.length ? options.properties : Object.keys(raw);
          for (const k of keys) if (raw[k] != null) props[k] = String(raw[k]);
          matched.push(props);
        }
      }

      if (totalMatched > 0) {
        const boundaryProps: Record<string, string> = {};
        for (const [k, v] of Object.entries(boundaryFeature.properties || {})) {
          if (v != null) boundaryProps[k] = String(v);
        }
        const boundaryArea = (boundaryGeom.type === 'Polygon' || boundaryGeom.type === 'MultiPolygon')
          ? Math.round(this.featureAreaKm2(boundaryGeom) * 10) / 10
          : undefined;
        return {
          boundary: boundaryProps,
          ...(boundaryArea !== undefined ? { boundaryArea_km2: boundaryArea } : {}),
          total: totalMatched,
          results: matched,
        };
      }
    }

    return { boundary: null, total: 0, results: [] };
  }

  async locate(lat: number, lon: number, mapIds?: string[]): Promise<Array<{ mapId: string; match: Record<string, string> | null; error?: string; }>> {
    const useDefault = !Array.isArray(mapIds) || mapIds.length === 0;
    // Default to state+district only — point-in-polygon against the large subdistrict/block
    // GeoJSONs on every call is slow and drop-prone; request those explicitly when needed.
    const targets = useDefault
      ? ['lgd-states', 'lgd-districts']
      : mapIds;

    const results: Array<{ mapId: string; match: Record<string, string> | null; error?: string }> = [];

    for (const mapId of targets) {
      const entry = MAP_REGISTRY[mapId];
      if (!entry) {
        results.push({ mapId, match: null, error: `Unknown map ID: "${mapId}"` });
        continue;
      }
      let data: FeatureCollection;
      try {
        data = await loadGeoJSON(entry.file);
      } catch {
        results.push({ mapId, match: null });
        continue;
      }

      const hit = findContainingFeature(data, lat, lon);
      if (hit) {
        // Return all non-null string/number properties
        const props: Record<string, string> = {};
        for (const [k, v] of Object.entries(hit.properties || {})) {
          if (v !== null && v !== undefined && v !== '') props[k] = String(v);
        }
        results.push({ mapId, match: props });
      } else {
        results.push({ mapId, match: null });
      }
    }

    return results;
  }

  /** Look up a pincode's [lon, lat] centroid from the pincodes-centroids layer. */
  async pincodeCentroid(pincode: string): Promise<{ lat: number; lon: number } | null> {
    const data = await loadGeoJSON(MAP_REGISTRY['pincodes-centroids'].file);
    const target = String(pincode).trim();
    for (const f of data.features) {
      if (String(f.properties?.pincode ?? '').trim() === target) {
        const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
        if (c) return { lon: c[0], lat: c[1] };
      }
    }
    return null;
  }

  /** Resolve a pincode to its coordinates + office name + derived district/state, in one call. */
  async resolvePincode(pincode: string): Promise<{
    pincode: string; lat: number; lon: number; office_name: string; district: string; state: string;
  } | null> {
    const data = await loadGeoJSON(MAP_REGISTRY['pincodes-centroids'].file);
    const target = String(pincode).trim();
    for (const f of data.features) {
      if (String(f.properties?.pincode ?? '').trim() !== target) continue;
      const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
      if (!c) return null;
      const ds = await this.districtStateAt(c[1], c[0]);
      return {
        pincode: target,
        lat: c[1],
        lon: c[0],
        office_name: String(f.properties?.office_name ?? ''),
        district: ds.district,
        state: ds.state,
      };
    }
    return null;
  }

  /**
   * Resolve district + state for a lat/lon via point-in-polygon against LGD districts.
   * The pincode centroid layer ships these blank, so we derive them on demand.
   */
  private async districtStateAt(lat: number, lon: number): Promise<{ district: string; state: string }> {
    try {
      const data = await loadGeoJSON(MAP_REGISTRY['lgd-districts'].file);
      const hit = findContainingFeature(data, lat, lon);
      if (hit) {
        return {
          district: String(hit.properties?.district_name ?? ''),
          state: String(hit.properties?.state_name ?? ''),
        };
      }
    } catch { /* fall through */ }
    return { district: '', state: '' };
  }

  /**
   * Query any registered map layer: filter by property values and optionally
   * aggregate (count features per value of a groupBy property).
   */
  async queryLayer(options: {
    mapId: string;
    filters?: Record<string, string>;
    groupBy?: string;
    limit?: number;
    properties?: string[];
  }): Promise<{ total: number; results: Array<Record<string, string>>; grouped?: Record<string, number> }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}". Use list_available_maps to see valid IDs.`);

    const data = await loadGeoJSON(entry.file);
    const limit = Math.max(1, Math.min(options.limit ?? 100, 1000));

    let features = data.features;

    // Apply filters (case-insensitive substring match)
    if (options.filters) {
      for (const [key, value] of Object.entries(options.filters)) {
        const lv = value.toLowerCase();
        features = features.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
    }

    const total = features.length;

    // Grouping
    let grouped: Record<string, number> | undefined;
    if (options.groupBy) {
      grouped = {};
      for (const f of features) {
        const key = String(f.properties?.[options.groupBy] ?? '(none)');
        grouped[key] = (grouped[key] ?? 0) + 1;
      }
    }

    // Select properties to return
    const slice = features.slice(0, limit);
    const results = slice.map(f => {
      const props = f.properties || {};
      if (options.properties && options.properties.length > 0) {
        const out: Record<string, string> = {};
        for (const p of options.properties) if (props[p] != null) out[p] = String(props[p]);
        return out;
      }
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(props)) {
        if (v !== null && v !== undefined) out[k] = String(v);
      }
      return out;
    });

    return { total, results, ...(grouped ? { grouped } : {}) };
  }

  // ── District Evolution Tools ───────────────────────────────────────────

  async listHistoricalDistrictNames(): Promise<Array<{ district: string; state: string }>> {
    await ensureEvolutionLoaded();
    return getDistrictNames();
  }

  async traceDistrictEvolution(params: {
    district: string;
    state?: string;
    year?: number;
    includeGeojson?: boolean;
  }) {
    const result = await queryEvolution({
      district: params.district,
      state: params.state,
      year: params.year,
    });

    if (!params.includeGeojson) return result;

    const enriched = {
      ...result,
      matches: await Promise.all(result.matches.map(async (match) => {
        const evolution: Record<string, Array<{ state: string; district: string; geojson?: object | null }>> = {};
        for (const [yearStr, entries] of Object.entries(match.evolution)) {
          const year = parseInt(yearStr, 10);
          evolution[yearStr] = await Promise.all(
            entries.map(async (entry) => ({
              ...entry,
              geojson: await getDistrictGeoJSON({ district: entry.district, state: entry.state, year }),
            }))
          );
        }
        return { ...match, evolution };
      })),
    };

    return enriched;
  }

  // ── Analytics Tools ────────────────────────────────────────────────────────

  /** Extract numeric values for a column across features, skipping nulls. */
  private extractNumeric(
    features: Array<{ properties: Record<string, unknown> | null }>,
    column: string,
  ): number[] {
    const out: number[] = [];
    for (const f of features) {
      const v = f.properties?.[column];
      if (v !== null && v !== undefined && v !== '') {
        const n = Number(v);
        if (isFinite(n)) out.push(n);
      }
    }
    return out;
  }

  private computeStats(vals: number[]): {
    count: number; min: number; max: number; mean: number;
    median: number; p10: number; p25: number; p75: number; p90: number;
    stddev: number; sum: number;
  } | null {
    if (!vals.length) return null;
    const sorted = [...vals].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((s, v) => s + v, 0);
    const mean = sum / n;
    const variance = sorted.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
    const pct = (p: number) => {
      const idx = p * (n - 1);
      const lo = Math.floor(idx), hi = Math.ceil(idx);
      return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
    };
    return {
      count: n, min: sorted[0], max: sorted[n - 1],
      mean: Math.round(mean * 10000) / 10000,
      median: Math.round(pct(0.5) * 10000) / 10000,
      p10: Math.round(pct(0.1) * 10000) / 10000,
      p25: Math.round(pct(0.25) * 10000) / 10000,
      p75: Math.round(pct(0.75) * 10000) / 10000,
      p90: Math.round(pct(0.9) * 10000) / 10000,
      stddev: Math.round(Math.sqrt(variance) * 10000) / 10000,
      sum: Math.round(sum * 100) / 100,
    };
  }

  /** Apply string + optional numeric filters to a feature list. */
  private applyFilters(
    features: ReturnType<FeatureCollection['features']['filter']>,
    filters?: Record<string, string>,
    numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>,
  ) {
    let out = features;
    if (filters) {
      for (const [key, value] of Object.entries(filters)) {
        const lv = value.toLowerCase();
        out = out.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
    }
    if (numericFilters) {
      for (const nf of numericFilters) {
        out = out.filter(f => {
          const v = Number(f.properties?.[nf.column]);
          if (!isFinite(v)) return false;
          if (nf.gt  !== undefined && !(v >  nf.gt))  return false;
          if (nf.gte !== undefined && !(v >= nf.gte)) return false;
          if (nf.lt  !== undefined && !(v <  nf.lt))  return false;
          if (nf.lte !== undefined && !(v <= nf.lte)) return false;
          return true;
        });
      }
    }
    return out;
  }

  /** Describe the schema of any registered layer: numeric columns with ranges, categorical columns with unique-value counts. */
  async layerSchema(mapId: string): Promise<{
    featureCount: number;
    numeric: Array<{ column: string; nonNull: number; min: number; max: number; mean: number }>;
    categorical: Array<{ column: string; uniqueValues: number; sample: string[] }>;
    textId: string[];
  }> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: "${mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const features = data.features;
    if (!features.length) return { featureCount: 0, numeric: [], categorical: [], textId: [] };

    // Detect column types from first non-null value across all features
    const allKeys = new Set<string>();
    for (const f of features) for (const k of Object.keys(f.properties || {})) allKeys.add(k);

    const numeric: Array<{ column: string; nonNull: number; min: number; max: number; mean: number }> = [];
    const categorical: Array<{ column: string; uniqueValues: number; sample: string[] }> = [];
    const textId: string[] = [];

    for (const col of allKeys) {
      // Detect type from first non-null value in the column
      let firstNonNull: unknown = undefined;
      for (const f of features) {
        const v = f.properties?.[col];
        if (v !== null && v !== undefined && v !== '') { firstNonNull = v; break; }
      }
      const isNumericCol = typeof firstNonNull === 'number' ||
        (typeof firstNonNull === 'string' && firstNonNull !== '' && isFinite(Number(firstNonNull)));

      if (isNumericCol) {
        const vals = this.extractNumeric(features, col);
        const s = this.computeStats(vals)!;
        numeric.push({ column: col, nonNull: vals.length, min: s.min, max: s.max, mean: s.mean });
      } else {
        // Categorical or free-text identifier
        const uniq = new Set<string>();
        for (const f of features) {
          const v = f.properties?.[col];
          if (v !== null && v !== undefined) uniq.add(String(v));
        }
        if (uniq.size <= 60) {
          categorical.push({ column: col, uniqueValues: uniq.size, sample: [...uniq].slice(0, 8) });
        } else {
          textId.push(col);
        }
      }
    }

    numeric.sort((a, b) => a.column.localeCompare(b.column));
    categorical.sort((a, b) => a.column.localeCompare(b.column));
    textId.sort();

    return { featureCount: features.length, numeric, categorical, textId };
  }

  /** Compute descriptive statistics for numeric columns, with optional groupBy. */
  async summarizeLayer(options: {
    mapId: string;
    columns: string[];
    groupBy?: string;
    filters?: Record<string, string>;
    numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>;
  }): Promise<{
    featureCount: number;
    columns: Record<string, ReturnType<McpMapService['computeStats']>>;
    groups?: Record<string, Record<string, ReturnType<McpMapService['computeStats']>>>;
  }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}"`);
    const data = await loadGeoJSON(entry.file);
    let features = this.applyFilters(data.features, options.filters, options.numericFilters);

    // Resolve "*" to all numeric columns
    let cols = options.columns;
    if (cols.length === 1 && cols[0] === '*') {
      const allKeys = new Set<string>();
      for (const f of features) for (const k of Object.keys(f.properties || {})) allKeys.add(k);
      cols = [];
      for (const col of allKeys) {
        const vals = this.extractNumeric(features, col);
        if (vals.length > 0) cols.push(col);
      }
    }

    const columnStats: Record<string, ReturnType<McpMapService['computeStats']>> = {};
    for (const col of cols) {
      columnStats[col] = this.computeStats(this.extractNumeric(features, col));
    }

    if (!options.groupBy) {
      return { featureCount: features.length, columns: columnStats };
    }

    // Group by categorical column
    const buckets = new Map<string, typeof features>();
    for (const f of features) {
      const key = String(f.properties?.[options.groupBy] ?? '(none)');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(f);
    }

    const groups: Record<string, Record<string, ReturnType<McpMapService['computeStats']>>> = {};
    for (const [group, gFeatures] of buckets) {
      groups[group] = {};
      for (const col of cols) {
        groups[group][col] = this.computeStats(this.extractNumeric(gFeatures, col));
      }
    }

    return { featureCount: features.length, columns: columnStats, groups };
  }

  /** Sort features by a numeric column and return the top/bottom N. */
  async rankFeatures(options: {
    mapId: string;
    column: string;
    order: 'asc' | 'desc';
    limit?: number;
    filters?: Record<string, string>;
    numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>;
    properties?: string[];
  }): Promise<{ total: number; column: string; order: string; results: Array<Record<string, string | number>> }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const features = this.applyFilters(data.features, options.filters, options.numericFilters);
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100));

    // Only rank features with a valid numeric value for the column
    const ranked = features
      .map(f => ({ f, v: Number(f.properties?.[options.column]) }))
      .filter(({ v }) => isFinite(v))
      .sort((a, b) => options.order === 'asc' ? a.v - b.v : b.v - a.v);

    const results = ranked.slice(0, limit).map(({ f, v }, i) => {
      const raw = f.properties || {};
      const keys = options.properties?.length ? options.properties : Object.keys(raw);
      const out: Record<string, string | number> = { _rank: i + 1, [options.column]: v };
      for (const k of keys) {
        if (k !== options.column && raw[k] != null) out[k] = raw[k] as string | number;
      }
      return out;
    });

    return { total: ranked.length, column: options.column, order: options.order, results };
  }

  // Joins another layer's column onto the primary layer per district: SHRUG layers
  // key on pc11_district_id, census/LGD on normalized state+district names.
  private static joinNorm(s: unknown): string {
    return String(s ?? '').trim().toLowerCase()
      .replace(/\s*&\s*/g, ' and ').replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
  }

  private async buildJoinLookup(mapId: string, column: string): Promise<{
    byPc11: Map<number, number>;
    byStateDistrict: Map<string, number>;
    byDistrict: Map<string, number>;        // district-only, present only when unambiguous
  }> {
    const entry = MAP_REGISTRY[mapId];
    if (!entry) throw new Error(`Unknown map ID: "${mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const norm = McpMapService.joinNorm;
    const byPc11 = new Map<number, number>();
    const byStateDistrict = new Map<string, number>();
    const districtCounts = new Map<string, number>();
    const byDistrict = new Map<string, number>();
    for (const f of data.features) {
      const p = f.properties || {};
      const v = Number(p[column]);
      if (!isFinite(v)) continue;
      if (p.pc11_district_id != null) byPc11.set(Number(p.pc11_district_id), v);
      const dn = norm(p.district_name);
      const sn = norm(p.state_name);
      if (dn && sn) byStateDistrict.set(`${sn}|${dn}`, v);
      if (dn) {
        districtCounts.set(dn, (districtCounts.get(dn) ?? 0) + 1);
        byDistrict.set(dn, v);
      }
    }
    // drop ambiguous district-only keys so we never join the wrong district
    for (const [dn, count] of districtCounts) if (count > 1) byDistrict.delete(dn);
    return { byPc11, byStateDistrict, byDistrict };
  }

  private joinValue(
    lookup: { byPc11: Map<number, number>; byStateDistrict: Map<string, number>; byDistrict: Map<string, number> },
    props: Record<string, unknown>,
  ): number | undefined {
    const norm = McpMapService.joinNorm;
    if (props.pc11_district_id != null) {
      const v = lookup.byPc11.get(Number(props.pc11_district_id));
      if (v !== undefined) return v;
    }
    const dn = norm(props.district_name);
    const sn = norm(props.state_name);
    if (dn && sn) {
      const v = lookup.byStateDistrict.get(`${sn}|${dn}`);
      if (v !== undefined) return v;
    }
    // one side lacks state_name (e.g. SHRUG layers) — fall back to unambiguous district name
    if (dn) return lookup.byDistrict.get(dn);
    return undefined;
  }

  /** Pearson and Spearman correlation between two numeric columns. */
  async correlate(options: {
    mapId: string;
    x: string;
    y: string;
    yMapId?: string;
    filters?: Record<string, string>;
    numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>;
    groupBy?: string;
    sampleRows?: number;
    labelProperty?: string;
  }): Promise<{
    n: number; x: string; y: string;
    pearson_r: number; spearman_r: number;
    x_mean: number; y_mean: number; x_stddev: number; y_stddev: number;
    scatter?: Array<{ x: number; y: number; label?: string }>;
    groups?: Array<{ group: string; n: number; pearson_r: number; spearman_r: number }>;
  }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const features = this.applyFilters(data.features, options.filters, options.numericFilters);

    const pearsonAndSpearman = (pairs: Array<[number, number]>) => {
      if (pairs.length < 2) return { pearson_r: NaN, spearman_r: NaN };
      const n = pairs.length;
      const xs = pairs.map(p => p[0]);
      const ys = pairs.map(p => p[1]);
      const meanX = xs.reduce((s, v) => s + v, 0) / n;
      const meanY = ys.reduce((s, v) => s + v, 0) / n;
      let num = 0, dX = 0, dY = 0;
      for (let i = 0; i < n; i++) {
        num += (xs[i] - meanX) * (ys[i] - meanY);
        dX  += (xs[i] - meanX) ** 2;
        dY  += (ys[i] - meanY) ** 2;
      }
      const pearson_r = (dX === 0 || dY === 0) ? NaN : Math.round(num / Math.sqrt(dX * dY) * 10000) / 10000;
      // Spearman: rank transform then Pearson
      const rank = (arr: number[]) => {
        const indexed = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
        const ranks = new Array(n);
        for (let i = 0; i < n; ) {
          let j = i;
          while (j < n && indexed[j].v === indexed[i].v) j++;
          const avg = (i + j - 1) / 2 + 1;
          for (let k = i; k < j; k++) ranks[indexed[k].i] = avg;
          i = j;
        }
        return ranks;
      };
      const rx = rank(xs), ry = rank(ys);
      let rNum = 0, rDX = 0, rDY = 0;
      const rmX = (n + 1) / 2, rmY = (n + 1) / 2;
      for (let i = 0; i < n; i++) {
        rNum += (rx[i] - rmX) * (ry[i] - rmY);
        rDX  += (rx[i] - rmX) ** 2;
        rDY  += (ry[i] - rmY) ** 2;
      }
      const spearman_r = (rDX === 0 || rDY === 0) ? NaN : Math.round(rNum / Math.sqrt(rDX * rDY) * 10000) / 10000;
      return { pearson_r, spearman_r };
    };

    const yLookup = options.yMapId && options.yMapId !== options.mapId
      ? await this.buildJoinLookup(options.yMapId, options.y)
      : null;

    // Collect valid pairs
    const pairs: Array<[number, number]> = [];
    const labels: string[] = [];
    const groupKeys: string[] = [];
    for (const f of features) {
      const xv = Number(f.properties?.[options.x]);
      const yv = yLookup
        ? this.joinValue(yLookup, f.properties || {})
        : Number(f.properties?.[options.y]);
      if (!isFinite(xv) || yv === undefined || !isFinite(yv)) continue;
      pairs.push([xv, yv as number]);
      if (options.labelProperty) labels.push(String(f.properties?.[options.labelProperty] ?? ''));
      if (options.groupBy) groupKeys.push(String(f.properties?.[options.groupBy] ?? '(none)'));
    }

    if (!pairs.length) {
      // n=0 reads as "no correlation" — surface the real cause instead (usually a column
      // that lives in another layer; the fix is yMapId for a cross-layer join).
      const hasX = features.some(f => isFinite(Number(f.properties?.[options.x])));
      const ySource = options.yMapId && options.yMapId !== options.mapId ? options.yMapId : options.mapId;
      const hasY = yLookup
        ? features.some(f => this.joinValue(yLookup, f.properties || {}) !== undefined)
        : features.some(f => isFinite(Number(f.properties?.[options.y])));
      if (!hasX) throw new Error(`Column "${options.x}" not found (or non-numeric) in "${options.mapId}". Check the column name with layer_schema.`);
      if (!hasY) throw new Error(`Column "${options.y}" not found (or non-numeric) in "${ySource}". If it lives in a different layer, pass yMapId (e.g. yMapId="census-2011-enriched", y="literacy_pct").`);
      throw new Error(`No district matched between "${options.mapId}" and "${ySource}" for the cross-layer join.`);
    }

    const { pearson_r, spearman_r } = pearsonAndSpearman(pairs);
    const xs = pairs.map(p => p[0]);
    const ys = pairs.map(p => p[1]);
    const xStats = this.computeStats(xs)!;
    const yStats = this.computeStats(ys)!;

    const result: ReturnType<McpMapService['correlate']> extends Promise<infer T> ? T : never = {
      n: pairs.length, x: options.x, y: options.y,
      pearson_r, spearman_r,
      x_mean: xStats.mean, y_mean: yStats.mean,
      x_stddev: xStats.stddev, y_stddev: yStats.stddev,
    };

    if (options.sampleRows && options.sampleRows > 0) {
      const step = Math.max(1, Math.floor(pairs.length / options.sampleRows));
      result.scatter = pairs
        .filter((_, i) => i % step === 0)
        .slice(0, options.sampleRows)
        .map((p, i) => ({
          x: p[0], y: p[1],
          ...(options.labelProperty ? { label: labels[i * step] } : {}),
        }));
    }

    if (options.groupBy) {
      const groupMap = new Map<string, Array<[number, number]>>();
      for (let i = 0; i < pairs.length; i++) {
        const g = groupKeys[i];
        if (!groupMap.has(g)) groupMap.set(g, []);
        groupMap.get(g)!.push(pairs[i]);
      }
      result.groups = [];
      for (const [group, gPairs] of groupMap) {
        const { pearson_r: pr, spearman_r: sr } = pearsonAndSpearman(gPairs);
        result.groups.push({ group, n: gPairs.length, pearson_r: pr, spearman_r: sr });
      }
      result.groups.sort((a, b) => a.group.localeCompare(b.group));
    }

    return result;
  }

  /** Compare named groups of features on one or more numeric columns. */
  async compareGroups(options: {
    mapId: string;
    groups: Array<{
      label: string;
      filters?: Record<string, string>;
      numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>;
    }>;
    columns: string[];
    stats?: Array<'mean' | 'median' | 'min' | 'max' | 'count' | 'sum' | 'p10' | 'p90'>;
  }): Promise<{
    columns: string[];
    stats: string[];
    groups: Array<{
      label: string;
      featureCount: number;
      values: Record<string, Record<string, number | null>>;
    }>;
  }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const statKeys = options.stats ?? ['count', 'mean', 'median', 'min', 'max'];

    const groupResults = options.groups.map(g => {
      const features = this.applyFilters(data.features, g.filters, g.numericFilters);
      const values: Record<string, Record<string, number | null>> = {};
      for (const col of options.columns) {
        const vals = this.extractNumeric(features, col);
        const s = this.computeStats(vals);
        values[col] = {};
        for (const sk of statKeys) {
          if (sk === 'count') values[col][sk] = vals.length;
          else if (!s) values[col][sk] = null;
          else values[col][sk] = (s as Record<string, number>)[sk] ?? null;
        }
      }
      return { label: g.label, featureCount: features.length, values };
    });

    return { columns: options.columns, stats: statKeys, groups: groupResults };
  }

  /**
   * Aggregate features from a target layer into boundary polygons.
   * Returns count, and optionally sum/mean of numeric columns, per boundary feature.
   * Use this for: health facilities per district, pincodes per constituency, etc.
   */
  async aggregateByBoundary(options: {
    boundaryMapId: string;
    boundaryFilters?: Record<string, string>;
    targetMapId: string;
    targetFilters?: Record<string, string>;
    aggColumns?: Array<{ column: string; stat: 'count' | 'sum' | 'mean' | 'min' | 'max' }>;
    boundaryNameProp?: string;
    limit?: number;
  }): Promise<{
    boundaryCount: number;
    results: Array<Record<string, string | number>>;
  }> {
    const boundaryEntry = MAP_REGISTRY[options.boundaryMapId];
    if (!boundaryEntry) throw new Error(`Unknown boundaryMapId: "${options.boundaryMapId}"`);
    const targetEntry = MAP_REGISTRY[options.targetMapId];
    if (!targetEntry) throw new Error(`Unknown targetMapId: "${options.targetMapId}"`);

    const limit = Math.max(1, Math.min(options.limit ?? 500, 2000));

    const boundaryData = await loadGeoJSON(boundaryEntry.file);
    let boundaryFeatures = boundaryData.features.filter(f => f.geometry);
    if (options.boundaryFilters) {
      for (const [key, value] of Object.entries(options.boundaryFilters)) {
        const lv = value.toLowerCase();
        boundaryFeatures = boundaryFeatures.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
    }

    const targetData = await loadGeoJSON(targetEntry.file);
    let targetFeatures = targetData.features.filter(f => f.geometry);
    if (options.targetFilters) {
      for (const [key, value] of Object.entries(options.targetFilters)) {
        const lv = value.toLowerCase();
        targetFeatures = targetFeatures.filter(f => {
          const pv = String(f.properties?.[key] ?? '').toLowerCase();
          return pv === lv || pv.includes(lv);
        });
      }
    }

    const nameProp = options.boundaryNameProp ?? boundaryEntry.featureNameProp ?? 'district_name';
    const aggCols = options.aggColumns ?? [];
    const totalBoundaryCount = boundaryFeatures.length;

    // Guard against cartesian blowup: > 50M point-in-polygon tests is too slow for a synchronous request.
    const ops = boundaryFeatures.length * targetFeatures.length;
    if (ops > 50_000_000) {
      throw new Error(
        `aggregateByBoundary would require ~${Math.round(ops / 1e6)}M point-in-polygon tests ` +
        `(${boundaryFeatures.length} boundaries × ${targetFeatures.length} target features). ` +
        `Reduce scope: filter boundaries by state (boundaryFilters={"state_name":"..."}) ` +
        `or filter target features (targetFilters) before running.`
      );
    }

    const results: Array<Record<string, string | number>> = [];

    // Process ALL boundaries to get correct global ranking, then slice to limit.
    for (const boundary of boundaryFeatures) {
      const boundaryGeom = boundary.geometry as { type: string; coordinates: unknown };
      const bucketProps: Record<string, number[]> = {};
      for (const { column } of aggCols) bucketProps[column] = [];
      let count = 0;

      for (const target of targetFeatures) {
        const geom = target.geometry as { type: string; coordinates: unknown };
        if (!geom?.type) continue;
        let testLon: number, testLat: number;
        if (geom.type === 'Point') {
          [testLon, testLat] = geom.coordinates as number[];
        } else {
          const c = this.featureCentroid(geom);
          if (!c) continue;
          [testLon, testLat] = c;
        }
        if (!pointInGeometry(testLon, testLat, boundaryGeom)) continue;
        count++;
        for (const { column } of aggCols) {
          const v = Number(target.properties?.[column]);
          if (isFinite(v)) bucketProps[column].push(v);
        }
      }

      const row: Record<string, string | number> = {
        _boundary_name: String(boundary.properties?.[nameProp] ?? ''),
        _count: count,
      };
      if (boundary.properties?.state_name) row._state = String(boundary.properties.state_name);

      for (const { column, stat } of aggCols) {
        const vals = bucketProps[column];
        if (!vals.length) { row[`${column}_${stat}`] = 0; continue; }
        if (stat === 'count') row[`${column}_count`] = vals.length;
        else if (stat === 'sum') row[`${column}_sum`] = Math.round(vals.reduce((s, v) => s + v, 0) * 100) / 100;
        else if (stat === 'mean') row[`${column}_mean`] = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length * 10000) / 10000;
        else if (stat === 'min') {
          let m = vals[0];
          for (let i = 1; i < vals.length; i++) if (vals[i] < m) m = vals[i];
          row[`${column}_min`] = m;
        } else if (stat === 'max') {
          let m = vals[0];
          for (let i = 1; i < vals.length; i++) if (vals[i] > m) m = vals[i];
          row[`${column}_max`] = m;
        }
      }

      results.push(row);
    }

    results.sort((a, b) => (b._count as number) - (a._count as number));
    return { boundaryCount: totalBoundaryCount, results: results.slice(0, limit) };
  }

  // Per-source nearest-target distance, within-radius flag, and count of targets within
  // radiusKm — the buffer counterpart to aggregate_by_boundary's point-in-polygon counting.
  async proximityCoverage(options: {
    sourceMapId: string;
    sourceFilters?: Record<string, string>;
    targetMapId: string;
    targetFilters?: Record<string, string>;
    radiusKm: number;
    limit?: number;
    properties?: string[];
  }): Promise<{
    summary: { source_total: number; covered_count: number; covered_pct: number; radiusKm: number };
    results: Array<Record<string, string | number | boolean>>;
  }> {
    const srcEntry = MAP_REGISTRY[options.sourceMapId];
    if (!srcEntry) throw new Error(`Unknown sourceMapId: "${options.sourceMapId}"`);
    const tgtEntry = MAP_REGISTRY[options.targetMapId];
    if (!tgtEntry) throw new Error(`Unknown targetMapId: "${options.targetMapId}"`);
    const limit = Math.max(1, Math.min(options.limit ?? 1000, 5000));

    const hasSourceFilter = options.sourceFilters && Object.keys(options.sourceFilters).length > 0;
    if (!hasSourceFilter) {
      throw new Error(
        'proximity_coverage requires sourceFilters to scope the source set (e.g. {"district":"Pune"} or {"state_name":"Kerala"}) ' +
        'to avoid an all-India cartesian blow-up.',
      );
    }

    // Source features. For the pincode centroid layer (district/state blank), derive
    // district/state per feature so sourceFilters like {"district":"Pune"} work.
    const srcData = await loadGeoJSON(srcEntry.file);
    const srcNameProp = srcEntry.featureNameProp || 'pincode';
    const wantsDerivedDistrict = options.sourceMapId === 'pincodes-centroids'
      && options.sourceFilters
      && Object.keys(options.sourceFilters).some(k => k === 'district' || k === 'state');

    let locate: ((lon: number, lat: number) => { district: string; state: string }) | null = null;
    if (wantsDerivedDistrict) {
      locate = await this.buildDistrictLocator(options.sourceFilters?.state);
    }

    type Src = { name: string; lon: number; lat: number; props: Record<string, string> };
    const sources: Src[] = [];
    for (const f of srcData.features) {
      if (!f.geometry) continue;
      const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
      if (!c) continue;
      const props: Record<string, string> = {};
      for (const [k, v] of Object.entries(f.properties || {})) if (v != null && v !== '') props[k] = String(v);
      if (locate) { const ds = locate(c[0], c[1]); props.district = ds.district; props.state = ds.state; }
      sources.push({ name: String(props[srcNameProp] ?? ''), lon: c[0], lat: c[1], props });
    }

    const filteredSources = this.filterRows(sources, options.sourceFilters);
    if (!filteredSources.length) {
      return { summary: { source_total: 0, covered_count: 0, covered_pct: 0, radiusKm: options.radiusKm }, results: [] };
    }

    // Targets: filter, dedup OSM double-nodes, and bbox-prefilter to the source extent + radius.
    const tgtData = await loadGeoJSON(tgtEntry.file);
    const tgtNameProp = tgtEntry.featureNameProp || 'name';
    let tgtFeatures = this.applyFilters(tgtData.features.filter(f => f.geometry), options.targetFilters);

    const minLat = Math.min(...filteredSources.map(s => s.lat));
    const maxLat = Math.max(...filteredSources.map(s => s.lat));
    const minLon = Math.min(...filteredSources.map(s => s.lon));
    const maxLon = Math.max(...filteredSources.map(s => s.lon));
    const latPad = options.radiusKm / 111;
    const lonPad = options.radiusKm / (111 * Math.cos((minLat + maxLat) / 2 * Math.PI / 180) || 1);

    const seen = new Set<string>();
    const targets: Array<{ name: string; lon: number; lat: number }> = [];
    for (const f of tgtFeatures) {
      const c = this.featureCentroid(f.geometry as { type: string; coordinates: unknown });
      if (!c) continue;
      const [lon, lat] = c;
      if (lat < minLat - latPad || lat > maxLat + latPad || lon < minLon - lonPad || lon > maxLon + lonPad) continue;
      const name = String(f.properties?.[tgtNameProp] ?? f.properties?.name ?? '').toLowerCase().trim();
      const key = `${name}|${lon.toFixed(3)},${lat.toFixed(3)}`;
      if (name && seen.has(key)) continue;
      seen.add(key);
      targets.push({ name: String(f.properties?.[tgtNameProp] ?? f.properties?.name ?? ''), lon, lat });
    }

    let covered = 0;
    const results: Array<Record<string, string | number | boolean>> = [];
    for (const s of filteredSources.slice(0, limit)) {
      let nearestDist = Infinity;
      let nearestName = '';
      let within = 0;
      for (const t of targets) {
        const d = this.haversine(s.lat, s.lon, t.lat, t.lon);
        if (d < nearestDist) { nearestDist = d; nearestName = t.name; }
        if (d <= options.radiusKm) within++;
      }
      const isCovered = nearestDist <= options.radiusKm;
      if (isCovered) covered++;
      const row: Record<string, string | number | boolean> = {
        [srcNameProp]: s.name,
        lat: Math.round(s.lat * 1e5) / 1e5,
        lon: Math.round(s.lon * 1e5) / 1e5,
        nearest_target_name: nearestName,
        nearest_distance_km: nearestDist === Infinity ? -1 : Math.round(nearestDist * 10) / 10,
        within_radius: isCovered,
        targets_within_radius: within,
      };
      if (options.properties?.length) {
        for (const k of options.properties) if (s.props[k] != null) row[k] = s.props[k];
      }
      results.push(row);
    }

    const total = filteredSources.length;
    return {
      summary: {
        source_total: total,
        covered_count: covered,
        covered_pct: total ? Math.round((covered / total) * 1000) / 10 : 0,
        radiusKm: options.radiusKm,
      },
      results,
    };
  }

  /** Case-insensitive (exact-or-substring) filter over plain {name,...,props} rows. */
  private filterRows<T extends { props: Record<string, string> }>(rows: T[], filters?: Record<string, string>): T[] {
    if (!filters) return rows;
    let out = rows;
    for (const [key, value] of Object.entries(filters)) {
      const lv = value.toLowerCase().trim();
      out = out.filter(r => {
        const pv = String(r.props[key] ?? '').toLowerCase().trim();
        return pv === lv || pv.includes(lv);
      });
    }
    return out;
  }

  /**
   * Join numeric columns from two map layers on matching feature names.
   * Returns one row per feature in the base layer, with columns from both.
   * Use this for cross-layer analysis: SHRUG roads + NFHS-5 outcomes, etc.
   */
  async joinLayers(options: {
    baseMapId: string;
    joinMapId: string;
    baseNameProp?: string;
    joinNameProp?: string;
    baseColumns?: string[];
    joinColumns?: string[];
    baseFilters?: Record<string, string>;
    joinFilters?: Record<string, string>;
    matchOn?: 'district_name' | 'state_name';
    limit?: number;
  }): Promise<{
    joined: number;
    unmatched_base: number;
    results: Array<Record<string, string | number>>;
  }> {
    const baseEntry = MAP_REGISTRY[options.baseMapId];
    if (!baseEntry) throw new Error(`Unknown baseMapId: "${options.baseMapId}"`);
    const joinEntry = MAP_REGISTRY[options.joinMapId];
    if (!joinEntry) throw new Error(`Unknown joinMapId: "${options.joinMapId}"`);

    const limit = Math.max(1, Math.min(options.limit ?? 1000, 5000));

    const baseData = await loadGeoJSON(baseEntry.file);
    const joinData = await loadGeoJSON(joinEntry.file);

    let baseFeatures = baseData.features;
    if (options.baseFilters) {
      for (const [key, value] of Object.entries(options.baseFilters)) {
        const lv = value.toLowerCase();
        baseFeatures = baseFeatures.filter(f => String(f.properties?.[key] ?? '').toLowerCase().includes(lv));
      }
    }

    let joinFeatures = joinData.features;
    if (options.joinFilters) {
      for (const [key, value] of Object.entries(options.joinFilters)) {
        const lv = value.toLowerCase();
        joinFeatures = joinFeatures.filter(f => String(f.properties?.[key] ?? '').toLowerCase().includes(lv));
      }
    }

    const matchOn = options.matchOn ?? 'district_name';
    const baseNameProp = options.baseNameProp ?? baseEntry.featureNameProp ?? matchOn;
    const joinNameProp = options.joinNameProp ?? joinEntry.featureNameProp ?? matchOn;

    // Build join index: normalised name → feature (prefer state-scoped key when available)
    const joinIndex = new Map<string, typeof joinData.features[0]>();
    for (const f of joinFeatures) {
      const name = String(f.properties?.[joinNameProp] ?? '').toLowerCase().trim();
      const state = String(f.properties?.state_name ?? '').toLowerCase().trim();
      if (state) joinIndex.set(`${state}::${name}`, f);
      if (!joinIndex.has(name)) joinIndex.set(name, f);
    }

    const resolveJoinColumns = (f: typeof joinData.features[0]): string[] => {
      if (options.joinColumns?.length) return options.joinColumns;
      return Object.keys(f.properties || {}).filter(k => {
        const v = f.properties?.[k];
        return typeof v === 'number' || (typeof v === 'string' && v !== '' && isFinite(Number(v)));
      });
    };

    const results: Array<Record<string, string | number>> = [];
    let joined = 0;
    let unmatched_base = 0;

    for (const base of baseFeatures.slice(0, limit)) {
      const baseName = String(base.properties?.[baseNameProp] ?? '').toLowerCase().trim();
      const baseState = String(base.properties?.state_name ?? '').toLowerCase().trim();

      const joinFeature = joinIndex.get(`${baseState}::${baseName}`) ?? joinIndex.get(baseName);

      const row: Record<string, string | number> = {};

      // Base columns
      const baseCols = options.baseColumns?.length
        ? options.baseColumns
        : Object.keys(base.properties || {});
      for (const k of baseCols) {
        if (base.properties?.[k] != null) row[`base__${k}`] = base.properties[k] as string | number;
      }

      if (joinFeature) {
        joined++;
        const joinCols = resolveJoinColumns(joinFeature);
        for (const k of joinCols) {
          if (joinFeature.properties?.[k] != null) row[`join__${k}`] = joinFeature.properties[k] as string | number;
        }
        results.push(row);
      } else {
        unmatched_base++;
        results.push(row);
      }
    }

    return { joined, unmatched_base, results };
  }

  /** Find K features most similar to a reference feature by Z-score normalized Euclidean distance. */
  async findSimilar(options: {
    mapId: string;
    referenceName: string;
    referenceState?: string;
    columns: string[];
    k?: number;
    filters?: Record<string, string>;
    numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }>;
    secondaryMapId?: string;
    secondaryColumns?: string[];
  }): Promise<{
    reference: { name: string; state?: string; values: Record<string, number> };
    similar: Array<{ rank: number; name: string; state?: string; distance: number; values: Record<string, number>; secondary?: Record<string, number> }>;
  }> {
    const entry = MAP_REGISTRY[options.mapId];
    if (!entry) throw new Error(`Unknown map ID: "${options.mapId}"`);
    const data = await loadGeoJSON(entry.file);
    const k = Math.max(1, Math.min(options.k ?? 10, 100));

    const nameProp = entry.featureNameProp ?? 'name';
    const stateProp = 'state_name';

    // Find reference feature — use index so we can exclude by position, not identity,
    // which handles layers with duplicate feature names (OSM points, electoral layers).
    const nameLower = options.referenceName.toLowerCase();
    let refIndex = -1;
    for (let i = 0; i < data.features.length; i++) {
      const f = data.features[i];
      const n = String(f.properties?.[nameProp] ?? '').toLowerCase();
      if (n !== nameLower && !n.includes(nameLower)) continue;
      if (options.referenceState) {
        const s = String(f.properties?.[stateProp] ?? '').toLowerCase();
        if (!s.includes(options.referenceState.toLowerCase())) continue;
      }
      refIndex = i;
      break;
    }
    if (refIndex === -1) throw new Error(`Feature "${options.referenceName}" not found in map "${options.mapId}"`);
    const refFeature = data.features[refIndex];

    // Compute per-column mean+stddev for Z-score normalization
    const allFeatures = this.applyFilters(data.features, options.filters, options.numericFilters);
    const colStats: Record<string, { mean: number; stddev: number }> = {};
    for (const col of options.columns) {
      const s = this.computeStats(this.extractNumeric(allFeatures, col));
      colStats[col] = s ? { mean: s.mean, stddev: s.stddev } : { mean: 0, stddev: 1 };
    }

    const zScore = (col: string, v: number) => {
      const { mean, stddev } = colStats[col];
      return stddev === 0 ? 0 : (v - mean) / stddev;
    };

    const getVec = (f: (typeof data.features)[0]): Record<string, number> | null => {
      const vals: Record<string, number> = {};
      for (const col of options.columns) {
        const v = Number(f.properties?.[col]);
        if (!isFinite(v)) return null;
        vals[col] = v;
      }
      return vals;
    };

    const refVals = getVec(refFeature);
    if (!refVals) throw new Error(`Reference feature "${options.referenceName}" has missing values for requested columns`);

    const refZ = options.columns.map(col => zScore(col, refVals[col]));

    // Score all other features — exclude by original index to handle duplicate names.
    const allFeaturesWithIdx = allFeatures.map(f => ({ f, origIdx: data.features.indexOf(f) }));
    const scored: Array<{ f: (typeof data.features)[0]; dist: number; vals: Record<string, number> }> = [];
    for (const { f, origIdx } of allFeaturesWithIdx) {
      if (origIdx === refIndex) continue;
      const vals = getVec(f);
      if (!vals) continue;
      const fZ = options.columns.map(col => zScore(col, vals[col]));
      const dist = Math.sqrt(fZ.reduce((s, z, i) => s + (z - refZ[i]) ** 2, 0));
      scored.push({ f, dist, vals });
    }
    scored.sort((a, b) => a.dist - b.dist);

    let secondaryIndex: Map<string, Record<string, number>> | null = null;
    if (options.secondaryMapId) {
      const secEntry = MAP_REGISTRY[options.secondaryMapId];
      if (!secEntry) throw new Error(`Unknown secondaryMapId: "${options.secondaryMapId}"`);
      const secData = await loadGeoJSON(secEntry.file);
      const secNameProp = secEntry.featureNameProp ?? 'district_name';
      secondaryIndex = new Map();
      for (const f of secData.features) {
        const secName = String(f.properties?.[secNameProp] ?? '').toLowerCase().trim();
        const secState = String(f.properties?.state_name ?? '').toLowerCase().trim();
        const secCols = options.secondaryColumns?.length
          ? options.secondaryColumns
          : Object.keys(f.properties || {}).filter(k => {
              const v = f.properties?.[k];
              return typeof v === 'number' || (typeof v === 'string' && v !== '' && isFinite(Number(v)));
            });
        const vals: Record<string, number> = {};
        for (const c of secCols) {
          const v = Number(f.properties?.[c]);
          if (isFinite(v)) vals[c] = v;
        }
        if (secState) secondaryIndex.set(`${secState}::${secName}`, vals);
        if (!secondaryIndex.has(secName)) secondaryIndex.set(secName, vals);
      }
    }

    return {
      reference: {
        name: String(refFeature.properties?.[nameProp] ?? ''),
        ...(refFeature.properties?.[stateProp] ? { state: String(refFeature.properties[stateProp]) } : {}),
        values: refVals,
      },
      similar: scored.slice(0, k).map(({ f, dist, vals }, i) => {
        const featName = String(f.properties?.[nameProp] ?? '').toLowerCase().trim();
        const featState = String(f.properties?.[stateProp] ?? '').toLowerCase().trim();
        const secondary = secondaryIndex
          ? (secondaryIndex.get(`${featState}::${featName}`) ?? secondaryIndex.get(featName))
          : undefined;
        return {
          rank: i + 1,
          name: String(f.properties?.[nameProp] ?? ''),
          ...(f.properties?.[stateProp] ? { state: String(f.properties[stateProp]) } : {}),
          distance: Math.round(dist * 10000) / 10000,
          values: vals,
          ...(secondary ? { secondary } : {}),
        };
      }),
    };
  }

  /**
   * Load city ward GeoJSON into memory so analytics tools can reach it.
   * City IDs come from listCities(); they live at the same R2 path the cityRenderer uses.
   */
  private async loadCityAsGeoJSON(cityId: string): Promise<FeatureCollection> {
    const cities = await this.listCities();
    const city = cities.find(c => c.id === cityId);
    if (!city) throw new Error(`Unknown city ID: "${cityId}". Use list_cities to see valid IDs.`);
    const url = `https://geo.bharatviz.org/geojsons/cities/${cityId}.geojson`;
    return loadGeoJSON(url);
  }

  /**
   * Run analytics (layer_schema / summarize / rank / correlate / find_similar) on a city ward layer.
   * Loads the city GeoJSON into the shared cache so subsequent calls are fast.
   */
  async cityLayerSchema(cityId: string) {
    const data = await this.loadCityAsGeoJSON(cityId);
    const features = data.features;
    if (!features.length) return { featureCount: 0, numeric: [], categorical: [], textId: [] };

    const allKeys = new Set<string>();
    for (const f of features) for (const k of Object.keys(f.properties || {})) allKeys.add(k);

    const numeric: Array<{ column: string; nonNull: number; min: number; max: number; mean: number }> = [];
    const categorical: Array<{ column: string; uniqueValues: number; sample: string[] }> = [];
    const textId: string[] = [];

    for (const col of allKeys) {
      let firstNonNull: unknown;
      for (const f of features) {
        const v = f.properties?.[col];
        if (v !== null && v !== undefined && v !== '') { firstNonNull = v; break; }
      }
      const isNum = typeof firstNonNull === 'number' ||
        (typeof firstNonNull === 'string' && firstNonNull !== '' && isFinite(Number(firstNonNull)));
      if (isNum) {
        const vals = this.extractNumeric(features, col);
        const s = this.computeStats(vals)!;
        numeric.push({ column: col, nonNull: vals.length, min: s.min, max: s.max, mean: s.mean });
      } else {
        const uniq = new Set<string>();
        for (const f of features) {
          const v = f.properties?.[col];
          if (v != null) uniq.add(String(v));
        }
        if (uniq.size <= 60) categorical.push({ column: col, uniqueValues: uniq.size, sample: [...uniq].slice(0, 8) });
        else textId.push(col);
      }
    }
    numeric.sort((a, b) => a.column.localeCompare(b.column));
    categorical.sort((a, b) => a.column.localeCompare(b.column));
    return { featureCount: features.length, numeric, categorical, textId };
  }

  async summarizeCityLayer(cityId: string, options: {
    columns: string[];
    groupBy?: string;
    filters?: Record<string, string>;
  }) {
    const data = await this.loadCityAsGeoJSON(cityId);
    let features = this.applyFilters(data.features, options.filters);

    let cols = options.columns;
    if (cols.length === 1 && cols[0] === '*') {
      const allKeys = new Set<string>();
      for (const f of features) for (const k of Object.keys(f.properties || {})) allKeys.add(k);
      cols = [];
      for (const col of allKeys) {
        if (this.extractNumeric(features, col).length > 0) cols.push(col);
      }
    }

    const columnStats: Record<string, ReturnType<McpMapService['computeStats']>> = {};
    for (const col of cols) columnStats[col] = this.computeStats(this.extractNumeric(features, col));

    if (!options.groupBy) return { featureCount: features.length, columns: columnStats };

    const buckets = new Map<string, typeof features>();
    for (const f of features) {
      const key = String(f.properties?.[options.groupBy] ?? '(none)');
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(f);
    }
    const groups: Record<string, Record<string, ReturnType<McpMapService['computeStats']>>> = {};
    for (const [group, gFeatures] of buckets) {
      groups[group] = {};
      for (const col of cols) groups[group][col] = this.computeStats(this.extractNumeric(gFeatures, col));
    }
    return { featureCount: features.length, columns: columnStats, groups };
  }

  async rankCityFeatures(cityId: string, options: {
    column: string;
    order: 'asc' | 'desc';
    limit?: number;
    filters?: Record<string, string>;
    properties?: string[];
  }) {
    const data = await this.loadCityAsGeoJSON(cityId);
    const features = this.applyFilters(data.features, options.filters);
    const limit = Math.max(1, Math.min(options.limit ?? 10, 100));

    const ranked = features
      .map(f => ({ f, v: Number(f.properties?.[options.column]) }))
      .filter(({ v }) => isFinite(v))
      .sort((a, b) => options.order === 'asc' ? a.v - b.v : b.v - a.v);

    const results = ranked.slice(0, limit).map(({ f, v }, i) => {
      const raw = f.properties || {};
      const keys = options.properties?.length ? options.properties : Object.keys(raw);
      const out: Record<string, string | number> = { _rank: i + 1, [options.column]: v };
      for (const k of keys) if (k !== options.column && raw[k] != null) out[k] = raw[k] as string | number;
      return out;
    });
    return { total: ranked.length, column: options.column, order: options.order, results };
  }
}
