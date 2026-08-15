import React, { useState } from 'react';
import { ExternalLink, Download, Hash, Search } from 'lucide-react';
import { CITY_DATASETS } from '@/lib/cityMapConfig';
import cityGistMapping from '@/lib/city-gist-mapping.json';
import pincodeGistMapping from '@/lib/pincode-gist-mapping.json';
import historicalMapping from '@/lib/gist-mapping.json';

interface MapsGalleryProps {
  darkMode?: boolean;
}

interface MapEntry {
  id: string;
  level: string;
  source: string;
  year: number;
  description: string;
  geojsonUrl?: string;
  parquetUrl?: string;
  category: string;
  tab?: string;
  tabParam?: string;
}

const R2 = 'https://geo.bharatviz.org';
const CENSUS = `${R2}/geojsons/census`;
const DIST = `${R2}/geojsons/districts`;
const ADMIN = `${R2}/geojsons/admin`;
const ADMIN_P = `${R2}/geoparquet/admin`;
const WARDS = `${R2}/geojsons/wards`;
const WARDS_P = `${R2}/geoparquet/wards`;
const ELEC = `${R2}/geojsons/electoral`;
const ELEC_P = `${R2}/geoparquet/electoral`;
const ENV = `${R2}/geojsons/environment`;
const ENV_P = `${R2}/geoparquet/environment`;

const ALL_MAPS: MapEntry[] = [
  // Census boundaries
  ...([1872,1881,1891,1901,1911,1921,1931,1941,1951,1961,1971,1981,1991,2001,2011] as const).flatMap(yr => [
    { id: `census-${yr}-states`, level: 'States', source: `Census ${yr}`, year: yr, description: `State boundaries from the ${yr} Census of India`, geojsonUrl: `${CENSUS}/India-${yr}-states.geojson`, parquetUrl: `${R2}/geoparquet/census/India-${yr}-states.parquet`, category: 'Census', tab: 'states', tabParam: `mapType=census-${yr}-states` },
    { id: `census-${yr}-districts`, level: 'Districts', source: `Census ${yr}`, year: yr, description: `District boundaries from the ${yr} Census of India`, geojsonUrl: `${CENSUS}/India-${yr}-districts.geojson`, parquetUrl: `${R2}/geoparquet/census/India-${yr}-districts.parquet`, category: 'Census', tab: 'districts', tabParam: `mapType=census-${yr}-districts` },
  ]),
  // Census 2011 enriched
  { id: 'census-2011-enriched', level: 'Districts', source: 'Census 2011 (enriched)', year: 2011, description: 'Census 2011 district boundaries with 267 demographic columns: population, SC/ST%, literacy, language diversity, and per-language speaker shares.', geojsonUrl: `${R2}/geojsons/census2011/india_census2011_districts.geojson`, parquetUrl: `${R2}/geoparquet/census2011/india_census2011_districts.parquet`, category: 'Census', tab: 'census' },
  // LGD
  { id: 'lgd-states', level: 'States', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official state boundaries from the Local Government Directory', geojsonUrl: `${DIST}/India_LGD_states.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_LGD_states.parquet`, category: 'Official', tab: 'states' },
  { id: 'lgd-districts', level: 'Districts', source: 'LGD (Latest Official)', year: 2024, description: 'Latest official district boundaries from the Local Government Directory', geojsonUrl: `${DIST}/India_LGD_districts.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_LGD_districts.parquet`, category: 'Official', tab: 'districts' },
  // NFHS
  { id: 'nfhs4-states', level: 'States', source: 'NFHS-4 (2015-16)', year: 2016, description: 'State boundaries from NFHS-4 survey', geojsonUrl: `${DIST}/India_NFHS4_states_simplified.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_NFHS4_states_simplified.parquet`, category: 'Survey', tab: 'states' },
  { id: 'nfhs4-districts', level: 'Districts', source: 'NFHS-4 (2015-16)', year: 2016, description: 'District boundaries from NFHS-4 survey', geojsonUrl: `${DIST}/India_NFHS4_districts_simplified.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_NFHS4_districts_simplified.parquet`, category: 'Survey', tab: 'districts' },
  { id: 'nfhs5-states', level: 'States', source: 'NFHS-5 (2019-21)', year: 2021, description: 'State boundaries from NFHS-5 survey', geojsonUrl: `${DIST}/India_NFHS5_states_simplified.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_NFHS5_states_simplified.parquet`, category: 'Survey', tab: 'states' },
  { id: 'nfhs5-districts', level: 'Districts', source: 'NFHS-5 (2019-21)', year: 2021, description: 'District boundaries from NFHS-5 survey', geojsonUrl: `${DIST}/India_NFHS5_districts_simplified.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_NFHS5_districts_simplified.parquet`, category: 'Survey', tab: 'districts' },
  // SOI
  { id: 'soi-states', level: 'States', source: 'Survey of India', year: 2020, description: 'State boundaries from the Survey of India', geojsonUrl: `${DIST}/India-soi-states.geojson`, parquetUrl: `${R2}/geoparquet/districts/India-soi-states.parquet`, category: 'Official', tab: 'states' },
  { id: 'soi-districts', level: 'Districts', source: 'Survey of India', year: 2020, description: 'District boundaries from the Survey of India', geojsonUrl: `${DIST}/India-soi-districts.geojson`, parquetUrl: `${R2}/geoparquet/districts/India-soi-districts.parquet`, category: 'Official', tab: 'districts' },
  // Bhuvan
  { id: 'bhuvan-states', level: 'States', source: 'ISRO Bhuvan', year: 2020, description: 'State boundaries from ISRO Bhuvan satellite data', geojsonUrl: `${DIST}/India-bhuvan-states.geojson`, parquetUrl: `${R2}/geoparquet/districts/India-bhuvan-states.parquet`, category: 'Official', tab: 'states' },
  { id: 'bhuvan-districts', level: 'Districts', source: 'ISRO Bhuvan', year: 2020, description: 'District boundaries from ISRO Bhuvan satellite data', geojsonUrl: `${DIST}/India-bhuvan-districts.geojson`, parquetUrl: `${R2}/geoparquet/districts/India-bhuvan-districts.parquet`, category: 'Official', tab: 'districts' },
  // NSSO
  { id: 'nsso-regions', level: 'Regions', source: 'NSSO', year: 2021, description: 'NSSO regional boundaries based on NFHS-5', geojsonUrl: `${DIST}/India_NFHS5_NSSO_regions_boundaries.geojson`, parquetUrl: `${R2}/geoparquet/districts/India_NFHS5_NSSO_regions_boundaries.parquet`, category: 'Survey', tab: 'regions' },
  // SHRUG districts
  { id: 'shrug-districts', level: 'Districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 district polygons from the SHRUG platform. CC BY-NC-SA 4.0.', geojsonUrl: `${DIST}/India-shrug-district-pc11_simplified.geojson`, category: 'Survey', tab: 'districts' },
  // Sub-admin
  { id: 'lgd-subdistricts', level: 'Sub-districts', source: 'LGD', year: 2024, description: 'LGD subdistrict (tehsil/taluka) boundaries', geojsonUrl: `${ADMIN}/India-geodata-lgd-subdistricts.geojson`, parquetUrl: `${ADMIN_P}/India-geodata-lgd-subdistricts.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'soi-subdistricts', level: 'Sub-districts', source: 'Survey of India', year: 2020, description: 'Survey of India subdistrict boundaries', geojsonUrl: `${ADMIN}/India-geodata-soi-subdistricts.geojson`, parquetUrl: `${ADMIN_P}/India-geodata-soi-subdistricts.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'shrug-subdistricts', level: 'Sub-districts', source: 'SHRUG (Census 2011)', year: 2011, description: 'Census 2011 subdistrict polygons from the SHRUG platform. CC BY-NC-SA 4.0.', geojsonUrl: `${ADMIN}/India-shrug-subdistrict-pc11_simplified.geojson`, parquetUrl: `${ADMIN_P}/India-shrug-subdistrict-pc11_simplified.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'lgd-blocks', level: 'Blocks', source: 'LGD', year: 2024, description: 'LGD block-level boundaries', geojsonUrl: `${ADMIN}/India-geodata-lgd-blocks.geojson`, parquetUrl: `${ADMIN_P}/India-geodata-lgd-blocks.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'bhuvan-blocks', level: 'Blocks', source: 'ISRO Bhuvan', year: 2020, description: 'NRSC Bhuvan block-level boundaries', geojsonUrl: `${ADMIN}/India-geodata-bhuvan-blocks.geojson`, parquetUrl: `${ADMIN_P}/India-geodata-bhuvan-blocks.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  { id: 'pmgsy-blocks', level: 'Blocks', source: 'PMGSY', year: 2024, description: 'PMGSY block boundaries', geojsonUrl: `${ADMIN}/India-geodata-pmgsy-blocks.geojson`, parquetUrl: `${ADMIN_P}/India-geodata-pmgsy-blocks.parquet`, category: 'Sub-admin', tab: 'sub-admin' },
  // Electoral
  { id: 'lgd-parliament', level: 'Constituencies', source: 'LGD', year: 2024, description: 'Lok Sabha parliamentary constituency boundaries', geojsonUrl: `${ELEC}/India-geodata-lgd-parliament.geojson`, parquetUrl: `${ELEC_P}/India-geodata-lgd-parliament.parquet`, category: 'Electoral', tab: 'electoral' },
  { id: 'lgd-assembly', level: 'Constituencies', source: 'LGD', year: 2024, description: 'Vidhan Sabha assembly constituency boundaries', geojsonUrl: `${ELEC}/India-geodata-lgd-assembly.geojson`, parquetUrl: `${ELEC_P}/India-geodata-lgd-assembly.parquet`, category: 'Electoral', tab: 'electoral' },
  { id: 'susewind-parliament-2014', level: 'Constituencies', source: 'Susewind (2014)', year: 2014, description: 'Lok Sabha constituency boundaries (2014 election). CC BY-NC-SA 4.0.', geojsonUrl: `${ELEC}/India-susewind-parliament-2014_simplified.geojson`, parquetUrl: `${ELEC_P}/India-susewind-parliament-2014_simplified.parquet`, category: 'Electoral', tab: 'electoral' },
  { id: 'susewind-assembly-2014', level: 'Constituencies', source: 'Susewind (2014)', year: 2014, description: 'Vidhan Sabha constituency boundaries (~2014). CC BY-NC-SA 4.0.', geojsonUrl: `${ELEC}/India-susewind-assembly-2014_simplified.geojson`, parquetUrl: `${ELEC_P}/India-susewind-assembly-2014_simplified.parquet`, category: 'Electoral', tab: 'electoral' },
  // Environment
  { id: 'gs-wildlife', level: 'Regions', source: 'GatiShakti', year: 2024, description: 'Protected wildlife sanctuaries and national parks', geojsonUrl: `${ENV}/India-geodata-wildlife.geojson`, parquetUrl: `${ENV_P}/India-geodata-wildlife.parquet`, category: 'Environment', tab: 'environment' },
  { id: 'bm-eco-zones', level: 'Regions', source: 'GatiShakti', year: 2024, description: 'Biological / eco-sensitive zone boundaries', geojsonUrl: `${ENV}/India-geodata-eco-zones.geojson`, parquetUrl: `${ENV_P}/India-geodata-eco-zones.parquet`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-circles', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative circles', geojsonUrl: `${ENV}/India-fsi-circles_simplified.geojson`, parquetUrl: `${ENV_P}/India-fsi-circles_simplified.parquet`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-divisions', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative divisions', geojsonUrl: `${ENV}/India-fsi-divisions_simplified.geojson`, parquetUrl: `${ENV_P}/India-fsi-divisions_simplified.parquet`, category: 'Environment', tab: 'environment' },
  { id: 'fsi-ranges', level: 'Regions', source: 'FSI', year: 2024, description: 'Forest Survey of India administrative ranges', geojsonUrl: `${ENV}/India-fsi-ranges_simplified.geojson`, parquetUrl: `${ENV_P}/India-fsi-ranges_simplified.parquet`, category: 'Environment', tab: 'environment' },
  // Urban - SBM ULBs
  { id: 'sbm-ulbs', level: 'Urban Local Bodies', source: 'SBM', year: 2024, description: 'Urban Local Body boundaries from the Swachh Bharat Mission', geojsonUrl: `${R2}/geojsons/urban/India-sbm-ulbs_simplified.geojson`, parquetUrl: `${R2}/geoparquet/urban/India-sbm-ulbs_simplified.parquet`, category: 'Urban', tab: 'urban' },
  // City wards
  { id: 'wards-bengaluru-gba', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'Greater Bengaluru Area ward boundaries', geojsonUrl: `${WARDS}/India-geodata-wards-bengaluru-gba.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-bengaluru-gba.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-bengaluru-bbmp-2022', level: 'Wards', source: 'GatiShakti', year: 2022, description: 'BBMP ward boundaries (2022 delimitation)', geojsonUrl: `${WARDS}/India-geodata-wards-bengaluru-bbmp2022.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-bengaluru-bbmp2022.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-mumbai', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'MCGM ward boundaries for Mumbai', geojsonUrl: `${WARDS}/India-geodata-wards-mumbai.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-mumbai.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-mumbai-electoral-2017', level: 'Wards', source: 'GatiShakti', year: 2017, description: 'Mumbai electoral ward boundaries (2017)', geojsonUrl: `${WARDS}/India-geodata-wards-mumbai-electoral2017.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-mumbai-electoral2017.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-chennai', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'Chennai Corporation ward boundaries', geojsonUrl: `${WARDS}/India-geodata-wards-chennai.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-chennai.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-hyderabad', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'GHMC ward boundaries for Hyderabad', geojsonUrl: `${WARDS}/India-geodata-wards-hyderabad.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-hyderabad.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-kolkata', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'KMC ward boundaries for Kolkata', geojsonUrl: `${WARDS}/India-geodata-wards-kolkata.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-kolkata.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-pune', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'PMC ward boundaries for Pune', geojsonUrl: `${WARDS}/India-geodata-wards-pune.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-pune.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-ahmedabad', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'AMC ward boundaries for Ahmedabad', geojsonUrl: `${WARDS}/India-geodata-wards-ahmedabad.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-ahmedabad.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-jaipur', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'JMC ward boundaries for Jaipur', geojsonUrl: `${WARDS}/India-geodata-wards-jaipur.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-jaipur.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-gurugram', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'MCG ward boundaries for Gurugram', geojsonUrl: `${WARDS}/India-geodata-wards-gurugram.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-gurugram.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-kochi', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'Kochi Corporation ward boundaries', geojsonUrl: `${WARDS}/India-geodata-wards-kochi.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-kochi.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-bhubaneswar', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'BMC ward boundaries for Bhubaneswar', geojsonUrl: `${WARDS}/India-geodata-wards-bhubaneswar.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-bhubaneswar.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-vizag', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'GVMC ward boundaries for Visakhapatnam', geojsonUrl: `${WARDS}/India-geodata-wards-vizag.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-vizag.parquet`, category: 'Urban', tab: 'cities' },
  { id: 'wards-thane', level: 'Wards', source: 'GatiShakti', year: 2024, description: 'TMC ward boundaries for Thane', geojsonUrl: `${WARDS}/India-geodata-wards-thane.geojson`, parquetUrl: `${WARDS_P}/India-geodata-wards-thane.parquet`, category: 'Urban', tab: 'cities' },
  // Points
  { id: 'hotosm-health-facilities', level: 'Points', source: 'HOTOSM / OpenStreetMap', year: 2026, description: '142,629 health facilities across India from OpenStreetMap', geojsonUrl: `${R2}/geojsons/facilities/hotosm_ind_health_facilities.geojson`, parquetUrl: `${R2}/geoparquet/facilities/hotosm_ind_health_facilities.parquet`, category: 'Points', tab: 'districts' },
  { id: 'airports', level: 'Points', source: 'OurAirports (Public Domain)', year: 2026, description: '649 airports and airfields in India', geojsonUrl: `${R2}/geojsons/points/india_airports.geojson`, parquetUrl: `${R2}/geoparquet/points/india_airports.parquet`, category: 'Points', tab: 'districts' },
  { id: 'dams', level: 'Points', source: 'OpenStreetMap (ODbL)', year: 2026, description: 'Dams and barrages across India', geojsonUrl: `${R2}/geojsons/points/india_dams.geojson`, parquetUrl: `${R2}/geoparquet/points/india_dams.parquet`, category: 'Points', tab: 'districts' },
  { id: 'water-bodies', level: 'Points', source: 'OpenStreetMap (ODbL)', year: 2026, description: 'Lakes, reservoirs, ponds and other natural water bodies', geojsonUrl: `${R2}/geojsons/points/india_water_bodies.geojson`, parquetUrl: `${R2}/geoparquet/points/india_water_bodies.parquet`, category: 'Points', tab: 'districts' },
  { id: 'pincodes-centroids', level: 'Points', source: 'BharatViz', year: 2026, description: '63,864 pincode centroids for proximity queries', geojsonUrl: `${R2}/geojsons/points/india_pincodes_centroids.geojson`, parquetUrl: `${R2}/geoparquet/points/india_pincodes_centroids.parquet`, category: 'Points', tab: 'pincodes' },
  // SHRUG thematic district parquets (CC BY-NC-SA 4.0 - Development Data Lab)
  { id: 'shrug-census', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2011, description: 'Census 1991-2011 counts at PC11 district level: population, literacy, SC/ST shares, language diversity, worker status (1,209 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_census.parquet`, category: 'SHRUG' },
  { id: 'shrug-economic', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2013, description: 'Economic Census 1990-2013 firm counts, employment, and sector composition at district level (539 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_economic.parquet`, category: 'SHRUG' },
  { id: 'shrug-secc', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2011, description: 'SECC 2011 rural household consumption, deprivation indicators, and urban estimates at district level (122 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_secc.parquet`, category: 'SHRUG' },
  { id: 'shrug-environment', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2020, description: 'PM2.5 concentration, vegetation cover fraction, elevation, terrain ruggedness, DMSP and VIIRS night-lights at district level (41 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_environment.parquet`, category: 'SHRUG' },
  { id: 'shrug-facebook', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2019, description: 'Facebook population estimates and Relative Wealth Index (RWI) at district level (14 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_facebook.parquet`, category: 'SHRUG' },
  { id: 'shrug-roads', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2019, description: 'PMGSY rural road construction and connectivity metrics at district level (14 columns). CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_roads.parquet`, category: 'SHRUG' },
  { id: 'shrug-all', level: 'Districts', source: 'SHRUG 2.1 (DDL)', year: 2020, description: 'All SHRUG modules joined: Census, Economic Census, SECC, Environment, Facebook, Roads - 1,919 columns at PC11 district level. CC BY-NC-SA 4.0.', parquetUrl: `${R2}/geoparquet/shrug/shrug_districts_all.parquet`, category: 'SHRUG' },
  // NHP health facilities (GODL - Government Open Data License India)
  { id: 'nhp-health-facilities', level: 'Points', source: 'NHP / NIN / data.gov.in (GODL)', year: 2025, description: '166,462 health facilities: SubCentres, PHCs, CHCs, hospitals. Fields: facility_type, state, district, taluka, block, address, pincode.', parquetUrl: `${R2}/geoparquet/health/nhp_health_facilities_2025.parquet`, category: 'Health', tab: 'districts' },
  { id: 'nhp-hospital-directory', level: 'Points', source: 'National Health Portal (GODL)', year: 2025, description: '10,843 hospitals with beds, specialties, accreditation, doctor count, care type, and facilities. Fields: Hospital_Name, Specialties, Total_Num_Beds, Number_Doctor, Accreditation.', parquetUrl: `${R2}/geoparquet/health/nhp_hospital_directory_2025.parquet`, category: 'Health', tab: 'districts' },
  { id: 'nhp-blood-banks', level: 'Points', source: 'National Health Portal (GODL)', year: 2015, description: '897 blood banks with category, blood components available, blood groups, service hours, and contact details.', parquetUrl: `${R2}/geoparquet/health/nhp_blood_banks_2015.parquet`, category: 'Health', tab: 'districts' },
  { id: 'anganwadis-icds', level: 'Points', source: 'GatiShakti / MoWCD (GODL)', year: 2024, description: '~1.4 million ICDS Anganwadi centres from the Ministry of Women and Child Development via GatiShakti.', parquetUrl: `${R2}/geoparquet/health/anganwadis_icds_2024.parquet`, category: 'Health', tab: 'districts' },
  { id: 'bharatmaps-health-centers', level: 'Points', source: 'BharatMaps (Govt of India)', year: 2024, description: 'Health centres from the BharatMaps government portal. Independent coverage - useful for cross-verification with NHP data.', parquetUrl: `${R2}/geoparquet/health/bharatmaps_health_centers.parquet`, category: 'Health', tab: 'districts' },
  { id: 'bhuvan-sisdp-anganwadis', level: 'Points', source: 'ISRO Bhuvan SISDP (GODL)', year: 2024, description: 'Anganwadi centres from ISRO Bhuvan SISDP portal - separate source from GatiShakti ICDS, useful for coverage comparison.', parquetUrl: `${R2}/geoparquet/health/bhuvan_sisdp_anganwadis.parquet`, category: 'Health', tab: 'districts' },
  { id: 'gatishakti-child-care', level: 'Points', source: 'GatiShakti / MoWCD (GODL)', year: 2024, description: 'Government-run creches and child development centres from GatiShakti (Ministry of Women and Child Development).', parquetUrl: `${R2}/geoparquet/health/gatishakti_child_care_institutes.parquet`, category: 'Health', tab: 'districts' },
  { id: 'ncog-soi-dispensaries', level: 'Points', source: 'Survey of India NCOG (GODL)', year: 2024, description: 'Dispensaries from the Survey of India NCOG dataset.', parquetUrl: `${R2}/geoparquet/health/ncog_soi_dispensaries.parquet`, category: 'Health', tab: 'districts' },
  { id: 'ncog-soi-hospitals', level: 'Points', source: 'Survey of India NCOG (GODL)', year: 2024, description: 'Hospitals from the Survey of India NCOG dataset.', parquetUrl: `${R2}/geoparquet/health/ncog_soi_hospitals.parquet`, category: 'Health', tab: 'districts' },
  { id: 'livingatlas-health-facilities', level: 'Points', source: 'Esri Living Atlas', year: 2024, description: 'Health facilities across India from the Esri Living Atlas, aggregating multiple open government sources.', parquetUrl: `${R2}/geoparquet/health/livingatlas_health_facilities.parquet`, category: 'Health', tab: 'districts' },
];

// Mirrors the geojsons/ -> geoparquet/ layout produced by scripts/19, 20, and 37.
const parquetUrl = (geojsonUrl: string): string =>
  geojsonUrl.replace('/geojsons/', '/geoparquet/').replace(/\.geojson$/, '.parquet');

// City ward geojsons, keyed by dataset id -> R2 geojson URL (post gist-to-R2 migration).
const cityGistUrls = cityGistMapping as Record<string, string>;
const CITY_ENTRIES: MapEntry[] = CITY_DATASETS
  .filter(ds => cityGistUrls[ds.id])
  .map(ds => ({
    id: `city-${ds.id}`,
    level: ds.type === 'wards' ? 'Wards' : ds.type === 'zones' ? 'Zones' : 'Boundary',
    source: ds.source,
    year: 2024,
    description: `${ds.displayName} (${ds.state}) — ${ds.label}, ${ds.featureCount} features`,
    geojsonUrl: cityGistUrls[ds.id],
    parquetUrl: parquetUrl(cityGistUrls[ds.id]),
    category: 'Cities',
    tab: 'cities',
  }));

// Pincode boundaries, per state.
const pincodeUrls = pincodeGistMapping as Record<string, string>;
const PINCODE_ENTRIES: MapEntry[] = Object.entries(pincodeUrls).map(([state, url]) => ({
  id: `pincode-${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
  level: 'Pincodes',
  source: 'BharatViz',
  year: 2024,
  description: `Pincode boundaries for ${state}`,
  geojsonUrl: url,
  parquetUrl: parquetUrl(url),
  category: 'Pincodes',
  tab: 'pincodes',
}));

// Historical district evolution, per year/tag and state.
const historicalUrls = historicalMapping as Record<string, Record<string, string>>;
const HISTORICAL_ENTRIES: MapEntry[] = Object.entries(historicalUrls).flatMap(([year, states]) =>
  Object.entries(states).map(([state, url]) => ({
    id: `historical-${year}-${state.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    level: 'Districts',
    source: /^\d+$/.test(year) ? `Census ${year}` : year,
    year: /^\d+$/.test(year) ? Number(year) : 0,
    description: `${state} district boundaries (${year})`,
    geojsonUrl: url,
    parquetUrl: parquetUrl(url),
    category: 'Historical',
    tab: 'districts',
  }))
);

ALL_MAPS.push(...CITY_ENTRIES, ...PINCODE_ENTRIES, ...HISTORICAL_ENTRIES);

const CATEGORIES = ['All', 'Census', 'Official', 'Survey', 'Sub-admin', 'Electoral', 'Environment', 'Urban', 'Points', 'SHRUG', 'Health', 'Cities', 'Pincodes', 'Historical'];

const categoryColors: Record<string, string> = {
  Census: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  Official: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  Survey: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300',
  'Sub-admin': 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
  Electoral: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
  Environment: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  Urban: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  Points: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  SHRUG: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  Health: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  Cities: 'bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
  Pincodes: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300',
  Historical: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
};

function viewInBharatViz(map: MapEntry): string | null {
  if (!map.tab) return null;
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

  // These three categories add ~3400 rows total (one per city/state/year) — excluded from the
  // "All" view and rendered a page at a time so the table stays fast by default.
  const BULK_CATEGORIES = ['Cities', 'Pincodes', 'Historical'];
  const PAGE_SIZE = 200;

  const [activeCategory, setActiveCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = ALL_MAPS.filter(m => {
    const q = query.toLowerCase();
    const matchQ = !q || m.id.includes(q) || m.source.toLowerCase().includes(q) || m.description.toLowerCase().includes(q) || String(m.year).includes(q) || m.level.toLowerCase().includes(q);
    if (!matchQ) return false;
    if (activeCategory === 'All') return q ? true : !BULK_CATEGORIES.includes(m.category);
    return m.category === activeCategory;
  });

  const visible = filtered.slice(0, visibleCount);

  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat);
    setVisibleCount(PAGE_SIZE);
  };
  const handleQueryChange = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div>
        <h2 id="maps-gallery" className={`text-2xl ${headingClass} mb-2 flex items-center gap-3 group`}>
          Maps Gallery
          <SectionAnchor id="maps-gallery" />
        </h2>
        <p className={`${textClass} text-lg`}>
          {ALL_MAPS.length} layers available in BharatViz - boundary sets, SHRUG socioeconomic data,
          city/pincode/historical boundaries, and health facility point layers. Download as GeoJSON or GeoParquet.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(28,8%,50%)]" />
          <input
            type="text"
            placeholder="Search maps..."
            value={query}
            onChange={e => handleQueryChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-md bg-white border-[hsl(35,18%,84%)] text-[hsl(28,20%,14%)] placeholder-[hsl(28,8%,56%)] dark:bg-[hsl(25,8%,12%)] dark:border-[hsl(25,8%,18%)] dark:text-[hsl(35,12%,90%)] dark:placeholder-[hsl(30,6%,40%)] focus:outline-none focus:ring-2 focus:ring-[hsl(28,55%,48%)]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
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

      <p className={`text-sm ${textClass}`}>
        {filtered.length} layer{filtered.length !== 1 ? 's' : ''}
        {activeCategory === 'All' && !query && ' (Cities, Pincodes, Historical filtered by default — pick a category or search to include them)'}
      </p>

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
            {visible.map(m => (
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
                    {viewInBharatViz(m) && (
                      <a
                        href={viewInBharatViz(m)!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)] hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        Open in BharatViz
                      </a>
                    )}
                    {m.geojsonUrl && (
                      <a
                        href={m.geojsonUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[hsl(28,8%,44%)] dark:text-[hsl(30,8%,58%)] hover:underline"
                      >
                        <Download className="h-3 w-3 flex-shrink-0" />
                        GeoJSON
                      </a>
                    )}
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

      {visibleCount < filtered.length && (
        <div className="flex justify-center">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-4 py-2 rounded-md text-sm font-medium bg-[hsl(35,18%,94%)] text-[hsl(28,20%,30%)] hover:bg-[hsl(35,18%,88%)] dark:bg-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,65%)] dark:hover:bg-[hsl(25,8%,18%)] transition-colors"
          >
            Show {Math.min(PAGE_SIZE, filtered.length - visibleCount)} more (of {filtered.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
};

export default MapsGallery;
