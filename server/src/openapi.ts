export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'BharatViz API',
    version: '1.0.0',
    description: `API for generating India choropleth maps and querying historical district evolution (1951–2011).

**District Evolution** tracks how district names and boundaries changed across Indian Census years. Districts can split, merge, or be renamed — the API traces these changes forward and backward.

**Map Generation** produces publication-quality choropleth maps at state and district level.`,
    contact: { name: 'BharatViz', url: 'https://bharatviz.org' },
    license: { name: 'MIT' },
  },
  servers: [
    { url: 'https://bharatviz.org', description: 'Production' },
  ],
  tags: [
    { name: 'District Evolution', description: 'Trace how districts changed across census years (1951–2011)' },
    { name: 'Maps', description: 'Generate choropleth maps as PNG / SVG / PDF' },
    { name: 'Pincodes', description: 'Pincode-level maps for 38 Indian states (~19,000 pincodes)' },
  ],
  paths: {
    '/api/v1/district-evolution': {
      get: {
        tags: ['District Evolution'],
        summary: 'Trace a district across census years',
        description: `Returns the district(s) a given district evolved into/from across census years 1951–2011.

Each year maps to an **array** of entries — one per district part. When a district splits, each successor is a separate object. Empty array means the district did not exist that year.

If \`state\` is omitted and the district name is ambiguous, all matching states are returned as separate matches.`,
        parameters: [
          {
            name: 'district',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            description: 'District name (case-insensitive, partial normalization applied)',
            examples: {
              simple: { value: 'Coimbatore', summary: 'Single district' },
              split: { value: '24 - Parganas', summary: 'District that later split' },
            },
          },
          {
            name: 'state',
            in: 'query',
            required: false,
            schema: { type: 'string' },
            description: 'Modern state name to narrow results (case-insensitive)',
            example: 'Tamil Nadu',
          },
          {
            name: 'year',
            in: 'query',
            required: false,
            schema: { type: 'integer', enum: [1951, 1961, 1971, 1981, 1991, 2001, 2011] },
            description: 'Return only this census year\'s entry instead of the full chain',
            example: 1981,
          },
          {
            name: 'geojson',
            in: 'query',
            required: false,
            schema: { type: 'boolean' },
            description: 'Attach GeoJSON boundary polygons (WGS84) for each year',
            example: true,
          },
        ],
        responses: {
          '200': {
            description: 'Evolution data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'object',
                      properties: {
                        district: { type: 'string' },
                        state: { type: 'string' },
                      },
                    },
                    matches: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          modern_state: { type: 'string', description: 'Modern state name from the mapping table' },
                          evolution: {
                            type: 'object',
                            description: 'Map of census year → array of district entries. Empty array if the district did not exist that year.',
                            additionalProperties: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  state: { type: 'string' },
                                  district: { type: 'string' },
                                  geojson: {
                                    description: 'GeoJSON FeatureCollection for this district (only present when geojson=true)',
                                    oneOf: [{ type: 'object' }, { type: 'null' }],
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                examples: {
                  coimbatore: {
                    summary: 'Coimbatore — splits into Periyar, Erode, Tiruppur over time',
                    value: {
                      query: { district: 'Coimbatore', state: 'Tamil Nadu' },
                      matches: [{
                        modern_state: 'Tamil Nadu',
                        evolution: {
                          '1951': [{ state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '1961': [{ state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '1971': [{ state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '1981': [{ state: 'Tamil Nadu', district: 'Periyar' }, { state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '1991': [{ state: 'Tamil Nadu', district: 'Periyar' }, { state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '2001': [{ state: 'Tamil Nadu', district: 'Erode' }, { state: 'Tamil Nadu', district: 'Coimbatore' }],
                          '2011': [{ state: 'Tamil Nadu', district: 'Erode' }, { state: 'Tamil Nadu', district: 'Tiruppur' }, { state: 'Tamil Nadu', district: 'Coimbatore' }],
                        },
                      }],
                    },
                  },
                  parganas: {
                    summary: '24 Parganas — renamed and split',
                    value: {
                      query: { district: '24 - Parganas', state: 'West Bengal' },
                      matches: [{
                        modern_state: 'West Bengal',
                        evolution: {
                          '1951': [{ state: 'West Bengal', district: '24 - Parganas' }],
                          '1961': [],
                          '1971': [{ state: 'West Bengal', district: 'Twenty Four Parganas' }],
                          '1981': [],
                          '1991': [{ state: 'West Bengal', district: 'North Twenty Four Parganas' }, { state: 'West Bengal', district: 'South Twenty Four Parganas' }],
                          '2001': [{ state: 'West Bengal', district: 'North Twenty Four Parganas' }, { state: 'West Bengal', district: 'South Twenty Four Parganas' }],
                          '2011': [{ state: 'West Bengal', district: 'North Twenty Four Parganas' }, { state: 'West Bengal', district: 'South Twenty Four Parganas' }],
                        },
                      }],
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Bad request — missing district or invalid year',
            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } },
          },
        },
      },
    },
    '/api/v1/district-evolution/data.csv': {
      get: {
        tags: ['District Evolution'],
        summary: 'Download deduplicated transition table',
        description: 'Returns the full deduplicated district transition mapping as CSV (3,636 rows, 1951–2011). Columns: `source_district, dest_district, source_year, dest_year, filter_state`.',
        responses: {
          '200': {
            description: 'CSV file',
            content: { 'text/csv': { schema: { type: 'string', format: 'binary' } } },
          },
        },
      },
    },
    '/api/v1/states/map': {
      post: {
        tags: ['Maps'],
        summary: 'Generate state-level choropleth map',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: {
                    type: 'array',
                    items: { type: 'object', properties: { state: { type: 'string' }, value: { type: 'number' } }, required: ['state', 'value'] },
                    description: 'State-value pairs',
                  },
                  mapType: { type: 'string', enum: ['1872','1881','1891','1901','1911','1921','1931','1941','1951','1961','1971','1981','1991','2001','2011','LGD','BHUVAN','SOI','NFHS5','NFHS4','NSSO'], default: 'LGD' },
                  colorScale: { type: 'string', default: 'spectral', enum: ['spectral','rdylbu','rdylgn','brbg','piyg','puor','blues','greens','reds','oranges','purples','viridis','plasma','inferno','magma'] },
                  invertColors: { type: 'boolean', default: false },
                  hideStateNames: { type: 'boolean', default: false },
                  hideValues: { type: 'boolean', default: false },
                  mainTitle: { type: 'string', default: 'BharatViz' },
                  legendTitle: { type: 'string', default: 'Values' },
                  formats: { type: 'array', items: { type: 'string', enum: ['png','svg','pdf'] }, default: ['png'] },
                },
              },
              example: {
                data: [{ state: 'Maharashtra', value: 75.8 }, { state: 'Karnataka', value: 85.5 }],
                colorScale: 'spectral',
                legendTitle: '% literacy',
                formats: ['png'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Map image(s) as base64-encoded JSON or binary depending on format' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/api/v1/districts/map': {
      post: {
        tags: ['Maps'],
        summary: 'Generate all-India district choropleth map',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data'],
                properties: {
                  data: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: { state: { type: 'string' }, district: { type: 'string' }, value: { type: 'number' } },
                      required: ['state', 'district', 'value'],
                    },
                  },
                  mapType: { type: 'string', enum: ['1872','1881','1891','1901','1911','1921','1931','1941','1951','1961','1971','1981','1991','2001','2011','LGD','BHUVAN','SOI','NFHS5','NFHS4','NSSO'], default: 'LGD' },
                  colorScale: { type: 'string', default: 'spectral' },
                  invertColors: { type: 'boolean', default: false },
                  hideValues: { type: 'boolean', default: false },
                  showStateBoundaries: { type: 'boolean', default: true },
                  mainTitle: { type: 'string', default: 'BharatViz' },
                  legendTitle: { type: 'string', default: 'Values' },
                  formats: { type: 'array', items: { type: 'string', enum: ['png','svg','pdf'] }, default: ['png'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Map image(s)' },
          '400': { description: 'Validation error' },
        },
      },
    },
    '/api/v1/pincodes/states': {
      get: {
        tags: ['Pincodes'],
        summary: 'List states with pincode data',
        description: 'Returns all 38 Indian states and union territories that have pincode boundary data available.',
        responses: {
          '200': {
            description: 'List of state names',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, states: { type: 'array', items: { type: 'string' } } } } } },
          },
        },
      },
    },
    '/api/v1/pincodes/states/{state}/pincodes': {
      get: {
        tags: ['Pincodes'],
        summary: 'List pincodes for a state',
        description: 'Returns all pincodes for a given state with post office name and district.',
        parameters: [
          { name: 'state', in: 'path', required: true, schema: { type: 'string' }, description: 'State name (case-insensitive)', example: 'Delhi' },
        ],
        responses: {
          '200': {
            description: 'List of pincodes',
            content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, state: { type: 'string' }, count: { type: 'number' }, pincodes: { type: 'array', items: { type: 'object', properties: { pincode: { type: 'string' }, office_name: { type: 'string' }, district: { type: 'string' } } } } } } } },
          },
          '404': { description: 'State not found' },
        },
      },
    },
    '/api/v1/pincodes/map': {
      post: {
        tags: ['Pincodes'],
        summary: 'Generate pincode-level choropleth map',
        description: 'Renders a pincode-level choropleth map for a single Indian state. Pincode matching is exact (6-digit string).',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data', 'state'],
                properties: {
                  data: { type: 'array', items: { type: 'object', properties: { pincode: { type: 'string' }, value: { type: 'number' } }, required: ['pincode', 'value'] } },
                  state: { type: 'string', description: 'State name (required)' },
                  colorScale: { type: 'string', default: 'spectral' },
                  invertColors: { type: 'boolean', default: false },
                  hidePincodeLabels: { type: 'boolean', default: true },
                  hideValues: { type: 'boolean', default: true },
                  mainTitle: { type: 'string', default: 'BharatViz' },
                  legendTitle: { type: 'string', default: 'Values' },
                  darkMode: { type: 'boolean', default: false },
                  formats: { type: 'array', items: { type: 'string', enum: ['png', 'svg', 'pdf'] }, default: ['png'] },
                },
              },
              example: {
                data: [{ pincode: '110001', value: 45.2 }, { pincode: '110002', value: 38.5 }],
                state: 'Delhi',
                colorScale: 'viridis',
                legendTitle: 'Score',
              },
            },
          },
        },
        responses: {
          '200': { description: 'Map image(s) as base64-encoded JSON' },
          '400': { description: 'Validation error' },
          '404': { description: 'State not found' },
        },
      },
    },
    '/api/v1/districts/state-districts/map': {
      post: {
        tags: ['Maps'],
        summary: 'Generate single-state district choropleth map',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['data', 'state'],
                properties: {
                  data: { type: 'array', items: { type: 'object', properties: { state: { type: 'string' }, district: { type: 'string' }, value: { type: 'number' } } } },
                  state: { type: 'string', description: 'Which state to display' },
                  mapType: { type: 'string', enum: ['1872','1881','1891','1901','1911','1921','1931','1941','1951','1961','1971','1981','1991','2001','2011','LGD','BHUVAN','SOI','NFHS5','NFHS4','NSSO'], default: 'LGD' },
                  colorScale: { type: 'string', default: 'spectral' },
                  formats: { type: 'array', items: { type: 'string', enum: ['png','svg','pdf'] }, default: ['png'] },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Map image(s)' },
        },
      },
    },
  },
};
