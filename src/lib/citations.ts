/**
 * Citation generation for BharatViz boundary data sources.
 *
 * Each map boundary set has an original source (Census, LGD, DataMeet, etc.).
 * This module produces BibTeX and APA-style citations for that source and
 * for BharatViz itself as the visualization tool.
 */

export interface CitationInfo {
  source: string;
  mapLabel: string;
}

interface CitationOutput {
  bibtex: string;
  apa: string;
}

const currentYear = new Date().getFullYear();

function censusCitation(year: number): CitationOutput {
  return {
    bibtex: `@data{jolad_singh_${year},
  author    = {Jolad, Shivakumar and Singh, Madhav},
  title     = {Indian Census Data Collection, 1901--2026: Digitised Subnational Population and Administrative Datasets},
  year      = {2026},
  publisher = {Harvard Dataverse},
  doi       = {10.7910/DVN/ON8CP8},
  note      = {Census ${year} district boundaries}
}`,
    apa: `Jolad, S., & Singh, M. (2026). Indian Census Data Collection, 1901-2026: Digitised Subnational Population and Administrative Datasets [Census ${year} boundaries]. Harvard Dataverse. https://doi.org/10.7910/DVN/ON8CP8`,
  };
}

const SOURCE_CITATIONS: Record<string, CitationOutput> = {
  'Census 1872': censusCitation(1872),
  'Census 1881': censusCitation(1881),
  'Census 1891': censusCitation(1891),
  'Census 1901': censusCitation(1901),
  'Census 1911': censusCitation(1911),
  'Census 1921': censusCitation(1921),
  'Census 1931': censusCitation(1931),
  'Census 1941': censusCitation(1941),
  'Census 1951': censusCitation(1951),
  'Census 1961': censusCitation(1961),
  'Census 1971': censusCitation(1971),
  'Census 1981': censusCitation(1981),
  'Census 1991': censusCitation(1991),
  'Census 2001': censusCitation(2001),
  'Census 2011': censusCitation(2011),

  LGD: {
    bibtex: `@misc{lgd_india,
  author = {{Ministry of Panchayati Raj, Government of India}},
  title  = {Local Government Directory ({LGD}): Administrative Boundaries},
  year   = {2024},
  url    = {https://lgdirectory.gov.in}
}`,
    apa: 'Ministry of Panchayati Raj, Government of India. (2024). Local Government Directory (LGD): Administrative Boundaries. https://lgdirectory.gov.in',
  },

  SOI: {
    bibtex: `@misc{soi_india,
  author = {{Survey of India}},
  title  = {District Boundaries of India},
  year   = {2020},
  url    = {https://surveyofindia.gov.in}
}`,
    apa: 'Survey of India. (2020). District Boundaries of India. https://surveyofindia.gov.in',
  },

  BHUVAN: {
    bibtex: `@misc{bhuvan_isro,
  author = {{National Remote Sensing Centre (NRSC), ISRO}},
  title  = {Bhuvan: Indian Geo-Platform of {ISRO} -- District Boundaries},
  year   = {2020},
  url    = {https://bhuvan.nrsc.gov.in}
}`,
    apa: 'National Remote Sensing Centre (NRSC), ISRO. (2020). Bhuvan: Indian Geo-Platform of ISRO - District Boundaries. https://bhuvan.nrsc.gov.in',
  },

  'NFHS-5': {
    bibtex: `@misc{nfhs5,
  author = {{International Institute for Population Sciences (IIPS) and ICF}},
  title  = {National Family Health Survey ({NFHS}-5), 2019--21: District Boundaries},
  year   = {2021},
  url    = {https://rchiips.org/nfhs/nfhs5.shtml}
}`,
    apa: 'International Institute for Population Sciences (IIPS) and ICF. (2021). National Family Health Survey (NFHS-5), 2019-21: District Boundaries. https://rchiips.org/nfhs/nfhs5.shtml',
  },
  'NFHS-4': {
    bibtex: `@misc{nfhs4,
  author = {{International Institute for Population Sciences (IIPS) and ICF}},
  title  = {National Family Health Survey ({NFHS}-4), 2015--16: District Boundaries},
  year   = {2017},
  url    = {https://rchiips.org/nfhs/nfhs4.shtml}
}`,
    apa: 'International Institute for Population Sciences (IIPS) and ICF. (2017). National Family Health Survey (NFHS-4), 2015-16: District Boundaries. https://rchiips.org/nfhs/nfhs4.shtml',
  },

  NSSO: {
    bibtex: `@misc{nsso_regions,
  author = {{National Sample Survey Office (NSSO), Ministry of Statistics and Programme Implementation}},
  title  = {NSSO Regions: Regional Boundaries for Survey Sampling},
  year   = {2021}
}`,
    apa: 'National Sample Survey Office (NSSO), Ministry of Statistics and Programme Implementation. (2021). NSSO Regions: Regional Boundaries for Survey Sampling.',
  },

  DataMeet: {
    bibtex: `@misc{datameet,
  author = {{DataMeet Community}},
  title  = {DataMeet: Open City Civic Data},
  year   = {2024},
  url    = {https://datameet.org}
}`,
    apa: 'DataMeet Community. (2024). DataMeet: Open City Civic Data. https://datameet.org',
  },
  'SBM/AMRUT': {
    bibtex: `@misc{sbm_amrut,
  author = {{Ministry of Housing and Urban Affairs, Government of India}},
  title  = {Swachh Bharat Mission / {AMRUT}: City Ward Boundaries},
  year   = {2023},
  url    = {https://sbm.gov.in}
}`,
    apa: 'Ministry of Housing and Urban Affairs, Government of India. (2023). Swachh Bharat Mission / AMRUT: City Ward Boundaries. https://sbm.gov.in',
  },
  'SBM/ramSeraph': {
    bibtex: `@misc{sbm_ramseraph,
  author = {{ramSeraph}},
  title  = {Indian City Ward Boundaries (harmonized from {SBM} data)},
  year   = {2024},
  url    = {https://github.com/ramSeraph/opendata}
}`,
    apa: 'ramSeraph. (2024). Indian City Ward Boundaries (harmonized from SBM data). https://github.com/ramSeraph/opendata',
  },
  'LivingAtlas/ramSeraph': {
    bibtex: `@misc{livingatlas_ramseraph,
  author = {{ramSeraph}},
  title  = {Indian City Ward Boundaries (from {ESRI} Living Atlas India)},
  year   = {2025},
  url    = {https://github.com/ramSeraph/indian_admin_boundaries}
}`,
    apa: 'ramSeraph. (2025). Indian City Ward Boundaries (from ESRI Living Atlas India). https://github.com/ramSeraph/indian_admin_boundaries',
  },
  'WB_AMRUT/ramSeraph': {
    bibtex: `@misc{wb_amrut_ramseraph,
  author = {{ramSeraph}},
  title  = {West Bengal {AMRUT} City Ward Boundaries},
  year   = {2024},
  url    = {https://github.com/ramSeraph/opendata}
}`,
    apa: 'ramSeraph. (2024). West Bengal AMRUT City Ward Boundaries. https://github.com/ramSeraph/opendata',
  },
  GatiShakti: {
    bibtex: `@misc{gatishakti,
  author = {{PM GatiShakti National Master Plan, Government of India}},
  title  = {Spatial Layers: Wildlife Sanctuaries and Eco-sensitive Zones},
  year   = {2024},
  url    = {https://pmgatishakti.gov.in}
}`,
    apa: 'PM GatiShakti National Master Plan, Government of India. (2024). Spatial Layers: Wildlife Sanctuaries and Eco-sensitive Zones. https://pmgatishakti.gov.in',
  },

  FSI: {
    bibtex: `@misc{fsi_india,
  author = {{Forest Survey of India, Ministry of Environment, Forest and Climate Change}},
  title  = {Forest Administrative Boundaries: Circles, Divisions and Ranges},
  year   = {2024},
  url    = {https://fsi.nic.in}
}`,
    apa: 'Forest Survey of India, Ministry of Environment, Forest and Climate Change. (2024). Forest Administrative Boundaries: Circles, Divisions and Ranges. https://fsi.nic.in',
  },

  Susewind: {
    bibtex: `@misc{susewind_2014,
  author = {Susewind, Raphael},
  title  = {Where to Vote: Indian Lok Sabha and Vidhan Sabha Constituency Boundaries (2014)},
  year   = {2014},
  url    = {https://github.com/ramSeraph/indian_admin_boundaries},
  note   = {License: CC BY-NC-SA 4.0. Digitised and harmonised by ramSeraph.}
}`,
    apa: 'Susewind, R. (2014). Where to Vote: Indian Lok Sabha and Vidhan Sabha Constituency Boundaries (2014). https://github.com/ramSeraph/indian_admin_boundaries (License: CC BY-NC-SA 4.0)',
  },

  SHRUG: {
    bibtex: `@article{asher2021,
  author  = {Asher, Sam and Lunt, Tobias and Matsuura, Ryu and Novosad, Paul},
  title   = {Development Research at High Geographic Resolution: An Analysis of Night-Lights, Firms, and Poverty in India Using the SHRUG Open Data Platform},
  journal = {The World Bank Economic Review},
  year    = {2021},
  volume  = {35},
  number  = {4},
  pages   = {845--871},
  doi     = {10.1093/wber/lhab003},
  note    = {Boundary data: CC BY-NC-SA 4.0. Harmonised for BharatViz by ramSeraph (https://github.com/ramSeraph/indian_admin_boundaries).}
}`,
    apa: 'Asher, S., Lunt, T., Matsuura, R., & Novosad, P. (2021). Development Research at High Geographic Resolution: An Analysis of Night-Lights, Firms, and Poverty in India Using the SHRUG Open Data Platform. The World Bank Economic Review, 35(4), 845–871. https://doi.org/10.1093/wber/lhab003 (License: CC BY-NC-SA 4.0)',
  },

  SBM: {
    bibtex: `@misc{sbm_ulbs,
  author = {{Ministry of Housing and Urban Affairs, Government of India}},
  title  = {Swachh Bharat Mission: Urban Local Body Boundaries},
  year   = {2023},
  url    = {https://sbm.gov.in},
  note   = {Boundaries harmonised and published by ramSeraph (https://github.com/ramSeraph/indian_admin_boundaries).}
}`,
    apa: 'Ministry of Housing and Urban Affairs, Government of India. (2023). Swachh Bharat Mission: Urban Local Body Boundaries. https://sbm.gov.in',
  },
  'OpenCity/Oorvani': {
    bibtex: `@misc{opencity_oorvani,
  author = {{OpenCity and Oorvani Foundation}},
  title  = {India City Ward Boundaries},
  year   = {2024},
  url    = {https://opencity.in}
}`,
    apa: 'OpenCity and Oorvani Foundation. (2024). India City Ward Boundaries. https://opencity.in',
  },
  'MCGM/MPCB': {
    bibtex: `@misc{mcgm_mpcb,
  author = {{Municipal Corporation of Greater Mumbai (MCGM) and Maharashtra Pollution Control Board (MPCB)}},
  title  = {Mumbai Ward Boundaries},
  year   = {2023}
}`,
    apa: 'Municipal Corporation of Greater Mumbai (MCGM) and Maharashtra Pollution Control Board (MPCB). (2023). Mumbai Ward Boundaries.',
  },
};

const BHARATVIZ_BIBTEX = `@software{bharatviz,
  author = {{Choudhary, Saket}},
  title  = {BharatViz: Interactive Choropleth Maps of India},
  year   = {${currentYear}},
  url    = {https://bharatviz.org}
}`;

const BHARATVIZ_APA = `Choudhary, S. (${currentYear}). BharatViz: Interactive Choropleth Maps of India. https://bharatviz.org`;

const DISTRICT_SOURCE_KEYS: Record<string, string> = {
  '1872': 'Census 1872',
  '1881': 'Census 1881',
  '1891': 'Census 1891',
  '1901': 'Census 1901',
  '1911': 'Census 1911',
  '1921': 'Census 1921',
  '1931': 'Census 1931',
  '1941': 'Census 1941',
  '1951': 'Census 1951',
  '1961': 'Census 1961',
  '1971': 'Census 1971',
  '1981': 'Census 1981',
  '1991': 'Census 1991',
  '2001': 'Census 2001',
  '2011': 'Census 2011',
  LGD: 'LGD',
  BHUVAN: 'BHUVAN',
  SOI: 'SOI',
  NFHS5: 'NFHS-5',
  NFHS4: 'NFHS-4',
  NSSO: 'NSSO',
  SHRUG: 'SHRUG',
};

export interface StructuredCitation {
  source: { apa: string; bibtex: string } | null;
  tool: { apa: string; bibtex: string };
}

export function getCitationStructured(info: CitationInfo): StructuredCitation {
  const sourceCitation = SOURCE_CITATIONS[info.source] ?? null;
  return {
    source: sourceCitation ? { apa: sourceCitation.apa, bibtex: sourceCitation.bibtex } : null,
    tool: { apa: BHARATVIZ_APA, bibtex: BHARATVIZ_BIBTEX },
  };
}

export function getCitation(info: CitationInfo): string {
  const { source, tool } = getCitationStructured(info);

  const lines: string[] = [`=== Citation for: ${info.mapLabel} ===\n`];

  if (source) {
    lines.push('--- Boundary Data Source (APA) ---');
    lines.push(source.apa);
    lines.push('');
    lines.push('--- Boundary Data Source (BibTeX) ---');
    lines.push(source.bibtex);
  }

  lines.push('');
  lines.push('--- Visualization Tool (APA) ---');
  lines.push(tool.apa);
  lines.push('');
  lines.push('--- Visualization Tool (BibTeX) ---');
  lines.push(tool.bibtex);

  return lines.join('\n');
}

export const STATES_CITATION: CitationInfo = { source: 'LGD', mapLabel: 'India States (LGD Boundaries)' };

export const NSSO_CITATION: CitationInfo = { source: 'NSSO', mapLabel: 'NSSO Regions' };

export function getDistrictsCitationInfo(mapTypeId: string, displayName?: string): CitationInfo {
  const key = DISTRICT_SOURCE_KEYS[mapTypeId] || 'LGD';
  return {
    source: key,
    mapLabel: displayName || `India Districts (${key})`,
  };
}

export function getCityCitationInfo(dataset: { displayName: string; label: string; source: string }): CitationInfo {
  return {
    source: dataset.source,
    mapLabel: `${dataset.displayName} - ${dataset.label}`,
  };
}
