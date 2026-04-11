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
    { url: 'https://bharatviz.saketlab.org', description: 'Production' },
    { url: 'http://localhost:3001', description: 'Local development' },
  ],
  tags: [
    { name: 'District Evolution', description: 'Trace how districts changed across census years (1951–2011)' },
    { name: 'Maps', description: 'Generate choropleth maps as PNG / SVG / PDF' },
  ],
  paths: {
    '/api/v1/district-evolution': {
      get: {
        tags: ['District Evolution'],
        summary: 'Trace a district across census years',
        description: `Returns the name(s) a district had in each census year from 1951 to 2011.

When a district **splits**, multiple successor names are joined with \` / \` (e.g. \`"North Twenty Four Parganas / South Twenty Four Parganas"\`).

When a district **merges**, the backward trace returns the predecessor name(s).

If \`state\` is omitted and the district name is ambiguous, all matching states are returned.`,
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
                            description: 'Map of census year → district name(s). Null if the district did not exist that year.',
                            additionalProperties: {
                              oneOf: [
                                {
                                  type: 'object',
                                  properties: {
                                    state: { type: 'string' },
                                    district: { type: 'string', description: 'District name, or "A / B / C" for splits' },
                                  },
                                },
                                { type: 'null' },
                              ],
                            },
                          },
                        },
                      },
                    },
                  },
                },
                examples: {
                  coimbatore: {
                    summary: 'Coimbatore — name stable, boundary splits',
                    value: {
                      query: { district: 'Coimbatore', state: 'Tamil Nadu' },
                      matches: [{
                        modern_state: 'Tamil Nadu',
                        evolution: {
                          '1951': { state: 'Tamil Nadu', district: 'Coimbatore' },
                          '1961': { state: 'Tamil Nadu', district: 'Coimbatore' },
                          '1971': { state: 'Tamil Nadu', district: 'Coimbatore' },
                          '1981': { state: 'Tamil Nadu', district: 'Periyar / Coimbatore' },
                          '1991': { state: 'Tamil Nadu', district: 'Periyar / Coimbatore' },
                          '2001': { state: 'Tamil Nadu', district: 'Erode / Coimbatore' },
                          '2011': { state: 'Tamil Nadu', district: 'Erode / Tiruppur / Coimbatore' },
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
                          '1951': { state: 'West Bengal', district: '24 - Parganas' },
                          '1971': { state: 'West Bengal', district: 'Twenty Four Parganas' },
                          '1991': { state: 'West Bengal', district: 'North Twenty Four Parganas / South Twenty Four Parganas' },
                          '2011': { state: 'West Bengal', district: 'North Twenty Four Parganas / South Twenty Four Parganas' },
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
                  mapType: { type: 'string', enum: ['LGD', 'NFHS5', 'NFHS4'], default: 'LGD' },
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
                  mapType: { type: 'string', enum: ['LGD', 'NFHS5', 'NFHS4'], default: 'LGD' },
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
