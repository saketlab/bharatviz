/**
 * Shared MCP tool definitions and handlers.
 *
 * Used by both the stdio entry point (mcp.ts) and the HTTP transport (index.ts).
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { McpMapService } from './mcpMapService.js';
import { ColorScales } from './types/index.js';
import { ALL_INDIA_STATE } from './utils/constants.js';

const COLOR_SCALES = [...ColorScales];

const mapService = new McpMapService();

function mapResultToContent(result: { svg?: string; png?: string }) {
  const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
  if (result.png) content.push({ type: 'image', data: result.png, mimeType: 'image/png' });
  if (result.svg) content.push({ type: 'text', text: result.svg });
  return { content };
}

/**
 * Creates a new MCP Server instance with all BharatViz tools registered.
 */
export function createMcpServer(): Server {
  const server = new Server(
    { name: 'bharatviz', version: '1.0.0' },
    {
      capabilities: { tools: {} },
      instructions:
        'India geospatial data, socioeconomic analytics, and map rendering for 641 districts.\n\n' +
        'DATA LAYERS:\n' +
        '- Census 2011 enriched (mapId: census-2011-enriched) - 640 districts, clean column names: ' +
        '  literacy_pct, literate, sc_pct, st_pct, population, shannon_diversity, effective_languages, ' +
        '  language share for 120+ languages (lang_Hindi_l1_pct, lang_Bengali_l1_pct, etc.)\n' +
        '- Census 2011 demographics via SHRUG (mapId: shrug-census) - prefixed columns for 1991/2001/2011: ' +
        '  pca11__lit_total, pca11__sc_share, pca11__st_share, pca11__tot_p, worker categories\n' +
        '- SECC 2012 rural poverty (mapId: shrug-secc) - education, housing, income sources, deprivation\n' +
        '- Economic Census 1990-2013 (mapId: shrug-economic) - employment, firm counts, sector breakdown\n' +
        '- Environment (mapId: shrug-environment) - PM2.5, NDVI, nightlights, elevation, rainfall\n' +
        '- Wealth index (mapId: shrug-facebook) - Meta Relative Wealth Index (RWI) per district\n' +
        '- Rural roads (mapId: shrug-roads) - PMGSY road construction length and cost\n' +
        '- Health facilities: 10 point datasets (hospitals, blood banks, anganwadis 1.2M, PHCs)\n' +
        '- Villages (mapId: villages-soi-points) - 576,430 Survey of India village points, the finest ' +
        '  admin level available; fields village_name, state_name, district, subdivision, LGD codes\n' +
        '- 60+ boundary sets: Census 1872-2011, LGD, SOI, Bhuvan, blocks, subdistricts, constituencies\n\n' +
        'TOOLS:\n' +
        '- rank_features: rank districts by any column (literacy_pct, sc_pct, pm25__pm25_mean, RWI)\n' +
        '- correlate: Pearson/Spearman between two columns across districts or states\n' +
        '- summarize_layer: statistics grouped by state or region\n' +
        '- render_map: choropleth PNG/SVG for any district-level dataset\n' +
        '- spatial queries: facility counts per district/block, point-in-boundary\n' +
        '- trace_district_evolution: boundary changes across Census years\n\n' +
        'For literacy questions use census-2011-enriched (literacy_pct). ' +
        'For multi-census trends use shrug-census (pca91__/pca01__/pca11__ prefixes). ' +
        'Start with layer_schema("census-2011-enriched") to see all columns.',
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_available_maps',
          description:
            'Lists all available India map layers - boundaries AND data layers. Returns metadata for each layer ' +
            'including the map ID (used in all other tools), data source, year, level (states/districts/regions/points), ' +
            'and number of features.\n\n' +
            'KEY DATA LAYERS FOR ANALYTICS (use mapId with rank_features / correlate / summarize_layer):\n' +
            '- census-2011-enriched - Best for literacy/language/SC/ST queries. Clean columns: literacy_pct, ' +
            'literate, sc_pct, st_pct, population, shannon_diversity, lang_Hindi_l1_pct, etc. 640 districts.\n' +
            '- shrug-census   - Census 1991/2001/2011 demographics with prefixed columns: pca11__lit_total, ' +
            'pca11__sc_share, pca11__st_share, pca11__tot_p, worker categories. Use for multi-decade trends.\n' +
            '- shrug-secc     - SECC 2012 rural poverty: education, housing, income sources, land ownership.\n' +
            '- shrug-economic - Economic Census 1990-2013: employment, firm counts, sector breakdown.\n' +
            '- shrug-environment - PM2.5, NDVI, nightlights, elevation, rainfall by district.\n' +
            '- shrug-facebook - Meta Relative Wealth Index (RWI) per district.\n' +
            '- shrug-roads    - PMGSY rural road construction length and cost.\n' +
            'BOUNDARY SETS: Census years 1872-2011, LGD, NFHS-4, NFHS-5, Survey of India, ISRO Bhuvan, NSSO regions, ' +
            'PMGSY blocks, Lok Sabha/Vidhan Sabha constituencies, wildlife sanctuaries, eco-sensitive zones.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'list_states',
          description:
            'Lists all state and union territory names available in a given map boundary set. ' +
            'Use this to discover the exact state names to use when providing data for map rendering. ' +
            'State names are case-insensitive when passed to render tools.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'Map boundary ID (e.g. "lgd-states", "census-2011-states"). Use list_available_maps to see all IDs.',
              },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'list_districts',
          description:
            'Lists all districts available in a given district-level map boundary set. ' +
            'Returns {state, district} pairs. Optionally filter by state name. ' +
            'Use this to discover exact district names for rendering district-level maps.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'District-level map boundary ID (e.g. "lgd-districts", "census-2011-districts").',
              },
              state: {
                type: 'string',
                description: 'Optional state name to filter districts (case-insensitive).',
              },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'render_states_map',
          description:
            'Renders a choropleth map of India at the state level. Provide an array of {state, value} data ' +
            'points and the tool will generate a high-quality 300 DPI PNG map image. Supports 17 color scales ' +
            '(spectral, viridis, plasma, blues, reds, etc.), dark mode, customizable titles, and multiple ' +
            'boundary sets (1941-2011 census, LGD, NFHS, SOI, Bhuvan). State names are case-insensitive.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    state: { type: 'string', description: 'State or UT name (e.g. "Maharashtra", "Kerala")' },
                    value: { type: 'number', description: 'Numeric value for this state' },
                  },
                  required: ['state', 'value'],
                },
                minItems: 1,
                description: 'Array of {state, value} data points to visualize on the map.',
              },
              mapId: {
                type: 'string',
                description: 'Map boundary ID. Default: "lgd-states". Use list_available_maps to see all options.',
              },
              colorScale: {
                type: 'string',
                enum: COLOR_SCALES,
                description: 'Color scale. Default: "spectral". Options: spectral, viridis, plasma, blues, reds, greens, oranges, purples, pinks, inferno, magma, rdylbu, rdylgn, brbg, piyg, puor, aqi.',
              },
              title: { type: 'string', description: 'Main title displayed on the map. Default: "BharatViz".' },
              legendTitle: { type: 'string', description: 'Legend title. Default: "Values".' },
              darkMode: { type: 'boolean', description: 'Use dark background. Default: false.' },
              invertColors: { type: 'boolean', description: 'Invert the color scale direction. Default: false.' },
              hideStateNames: { type: 'boolean', description: 'Hide state name labels. Default: false.' },
              hideValues: { type: 'boolean', description: 'Hide value labels on states. Default: false.' },
              outputFormat: {
                type: 'string',
                enum: ['png', 'svg', 'both'],
                description: 'Output format. Default: "png" (inline image). SVG is large (~300 KB+) and will not render inline - request it only for vector editing; "both" for both.',
              },
            },
            required: ['data'],
          },
        },
        {
          name: 'render_districts_map',
          description:
            'Renders a choropleth map of India at the district or sub-district level. Provide an array of ' +
            '{state, district, value} data points. Can render all-India districts or zoom into a single state. ' +
            'Supports 17 color scales, dark mode, state boundary overlays, and multiple boundary sets including ' +
            'districts (lgd-districts, census-*-districts), subdistricts (lgd-subdistricts, soi-subdistricts), ' +
            'blocks (lgd-blocks, bhuvan-blocks, pmgsy-blocks), and constituencies (lgd-parliament, lgd-assembly). ' +
            'Default output is 300 DPI PNG.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    state: { type: 'string', description: 'State name (omit for stateless layers like eco-zones)' },
                    district: { type: 'string', description: 'Feature name (district, subdistrict, block, constituency, or area name depending on mapId)' },
                    value: { type: 'number', description: 'Numeric value for this feature' },
                  },
                  required: ['district', 'value'],
                },
                minItems: 1,
                description: 'Array of {state, district, value} data points. For stateless layers (gs-wildlife, bm-eco-zones) omit state and use the area name as district.',
              },
              mapId: {
                type: 'string',
                description: 'Map boundary ID. Default: "lgd-districts". Also supports subdistricts (lgd-subdistricts, soi-subdistricts), blocks (lgd-blocks, bhuvan-blocks, pmgsy-blocks), constituencies (lgd-parliament, lgd-assembly). Use list_available_maps to see all options.',
              },
              state: {
                type: 'string',
                description: 'If provided, zooms into this single state showing only its districts.',
              },
              colorScale: {
                type: 'string',
                enum: COLOR_SCALES,
                description: 'Color scale. Default: "spectral".',
              },
              title: { type: 'string', description: 'Main title. Default: "BharatViz".' },
              legendTitle: { type: 'string', description: 'Legend title. Default: "Values".' },
              darkMode: { type: 'boolean', description: 'Dark background. Default: false.' },
              invertColors: { type: 'boolean', description: 'Invert color scale. Default: false.' },
              hideDistrictNames: { type: 'boolean', description: 'Hide district labels. Default: true (labels are dense).' },
              hideValues: { type: 'boolean', description: 'Hide value labels. Default: true.' },
              showStateBoundaries: { type: 'boolean', description: 'Show state boundary overlay lines. Default: true.' },
              outputFormat: {
                type: 'string',
                enum: ['png', 'svg', 'both'],
                description: 'Output format. Default: "png" (inline image). SVG is large (~300 KB+) and will not render inline - request it only for vector editing.',
              },
            },
            required: ['data'],
          },
        },
        {
          name: 'get_csv_template',
          description:
            'Returns a CSV template for a given map boundary set. The template includes all entity names ' +
            '(states or districts) pre-filled with empty value columns. Use this to understand what names ' +
            'the map expects, then fill in values and pass to render tools.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'Map boundary ID (e.g. "lgd-states", "lgd-districts"). Use list_available_maps to see options.',
              },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'list_demos',
          description:
            'Lists all available showcase demo datasets (NFHS-5 health indicators and IHME AMR estimates). ' +
            'Returns demo IDs, titles, level (states/districts), and CSV URLs. ' +
            'Use get_demo_url to generate a shareable BharatViz link for any demo.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              level: {
                type: 'string',
                enum: ['states', 'districts'],
                description: 'Optional filter by level. Omit to see all demos.',
              },
            },
          },
        },
        {
          name: 'get_demo_url',
          description:
            'Generates a shareable BharatViz URL for a given demo dataset. ' +
            'The URL loads the demo data directly in the browser with the correct title. ' +
            'Use list_demos first to see available demo IDs.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              demoId: {
                type: 'string',
                description: 'Demo ID from list_demos (e.g. "states_01_csection_rate", "districts_01_child_stunting", "states_26_ihme_amr").',
              },
              baseUrl: {
                type: 'string',
                description: 'Base URL for BharatViz. Default: "https://bharatviz.com".',
              },
            },
            required: ['demoId'],
          },
        },

        // Pincode Tools
        {
          name: 'list_pincode_states',
          description:
            'Lists all 38 Indian states and union territories that have pincode boundary data. ' +
            'Use the returned state names with list_pincodes and render_pincodes_map.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'pincode_centroid',
          description:
            'Resolve a single pincode to its centroid coordinates plus the district and state it falls in. ' +
            'One call replaces the list_pincodes -> find -> locate triangulation. ' +
            'Returns { pincode, lat, lon, office_name, district, state }. ' +
            'Pair with nearby (which also accepts a pincode directly) for "facilities near pincode X" queries.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              pincode: { type: 'string', description: 'The 6-digit pincode, e.g. "400071".' },
            },
            required: ['pincode'],
          },
        },
        {
          name: 'list_pincodes',
          description:
            'Lists pincodes (postal codes) for a given Indian state, district, or all of India. ' +
            'When scoped by state or district, every row includes lat/lon and a polygon-derived ' +
            'district/state (computed by point-in-polygon against district boundaries - cleaner than ' +
            'the post-office table, which mislabels some neighbouring-district pincodes). ' +
            'The district filter is an EXACT match on that polygon-derived name. ' +
            'Defaults to all-India (no coordinates, for size) when state and district are omitted.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              state: {
                type: 'string',
                description: 'State name (e.g. "Maharashtra", "Delhi"). Default: "All India". Case-insensitive.',
              },
              district: {
                type: 'string',
                description: 'District name for an exact, polygon-derived match (e.g. "Pune"). Scopes results to that district and attaches lat/lon. Pair with state for fastest lookup.',
              },
            },
          },
        },
        {
          name: 'render_pincodes_map',
          description:
            'Renders a pincode-level choropleth map of India. Defaults to all-India view using simplified boundaries. ' +
            'Optionally specify a state for detailed per-state rendering. ' +
            'Supports 17 color scales, dark mode, and PNG/SVG output. ' +
            'Pincode matching is exact (6-digit string).',
          inputSchema: {
            type: 'object' as const,
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    pincode: { type: 'string', description: '6-digit pincode (e.g. "110001")' },
                    value: { type: 'number', description: 'Numeric value for this pincode' },
                  },
                  required: ['pincode', 'value'],
                },
                minItems: 1,
                description: 'Array of {pincode, value} data points.',
              },
              state: {
                type: 'string',
                description: 'State name. Default: "All India" (simplified boundaries). Use list_pincode_states to see options.',
              },
              colorScale: {
                type: 'string',
                enum: COLOR_SCALES,
                description: 'Color scale. Default: "spectral".',
              },
              title: { type: 'string', description: 'Map title. Default: "BharatViz".' },
              legendTitle: { type: 'string', description: 'Legend title. Default: "Values".' },
              darkMode: { type: 'boolean', description: 'Dark background. Default: false.' },
              invertColors: { type: 'boolean', description: 'Invert color scale. Default: false.' },
              hidePincodeLabels: { type: 'boolean', description: 'Hide pincode labels. Default: true.' },
              hideValues: { type: 'boolean', description: 'Hide value labels. Default: true.' },
              outputFormat: {
                type: 'string',
                enum: ['png', 'svg', 'both'],
                description: 'Output format. Default: "png" (inline image). SVG is large (~300 KB+) and will not render inline - request it only for vector editing.',
              },
            },
            required: ['data'],
          },
        },

        // City/Ward Tools
        {
          name: 'list_cities',
          description:
            'Lists all available Indian cities with ward/zone boundary data. ' +
            'Returns city ID, display name, state, boundary type, and feature count. ' +
            '3005 city datasets available across India.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        {
          name: 'list_wards',
          description:
            'Lists all ward names for a given city. Use the cityId from list_cities.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              cityId: {
                type: 'string',
                description: 'City ID from list_cities (e.g. "mumbai_admin_wards").',
              },
            },
            required: ['cityId'],
          },
        },
        {
          name: 'render_city_map',
          description:
            'Renders a ward-level choropleth map for an Indian city. ' +
            'Provide a cityId and array of {ward, value} data. ' +
            'Supports 17 color scales, dark mode, and PNG/SVG output.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              cityId: {
                type: 'string',
                description: 'City ID from list_cities.',
              },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    ward: { type: 'string', description: 'Ward name' },
                    value: { type: 'number', description: 'Numeric value' },
                  },
                  required: ['ward', 'value'],
                },
                minItems: 1,
                description: 'Array of {ward, value} data points.',
              },
              colorScale: { type: 'string', enum: COLOR_SCALES, description: 'Color scale. Default: "spectral".' },
              title: { type: 'string', description: 'Map title. Default: "BharatViz".' },
              legendTitle: { type: 'string', description: 'Legend title. Default: "Values".' },
              darkMode: { type: 'boolean', description: 'Dark background. Default: false.' },
              invertColors: { type: 'boolean', description: 'Invert color scale. Default: false.' },
              hideWardNames: { type: 'boolean', description: 'Hide ward labels. Default: true.' },
              hideValues: { type: 'boolean', description: 'Hide value labels. Default: true.' },
              outputFormat: { type: 'string', enum: ['png', 'svg', 'both'], description: 'Output format. Default: "png" (inline image). SVG is large (~300 KB+) and will not render inline - request it only for vector editing.' },
            },
            required: ['cityId', 'data'],
          },
        },

        {
          name: 'locate',
          description:
            'Point-in-polygon lookup: given a latitude and longitude, returns the containing ' +
            'administrative unit(s) from one or more BharatViz map layers. ' +
            'By default checks state + district only (fast). Subdistrict, block, constituency, etc. ' +
            'are opt-in via mapIds because those layers are large. ' +
            'Returns all feature properties for each matched layer.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              lat: { type: 'number', description: 'Latitude (decimal degrees, e.g. 28.6139)' },
              lon: { type: 'number', description: 'Longitude (decimal degrees, e.g. 77.2090)' },
              mapIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'Map IDs to test against. Default: ["lgd-states","lgd-districts"]. Add "lgd-subdistricts"/"lgd-blocks"/constituencies explicitly when you need finer units (they are large). Use list_available_maps to see all options.',
              },
            },
            required: ['lat', 'lon'],
          },
        },
        {
          name: 'query_layer',
          description:
            'Filter and aggregate features in any registered BharatViz map layer. ' +
            'Returns matching feature properties (up to 1000 rows). ' +
            'Use filters to narrow by any property value (case-insensitive substring match). ' +
            'Use groupBy to count features per value of a property (e.g. count districts per state). ' +
            'Use properties to select only specific columns in the output. ' +
            'Example: count hospitals per state in the HOTOSM health facilities layer.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'Map layer ID to query. Use list_available_maps to see all options.',
              },
              filters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Property filters as {propertyName: value}. Matches if the feature\'s property contains the value (case-insensitive). E.g. {"state_name": "Maharashtra", "amenity": "hospital"}.',
              },
              groupBy: {
                type: 'string',
                description: 'Property name to group and count by. Returns a {value: count} summary in addition to individual results.',
              },
              properties: {
                type: 'array',
                items: { type: 'string' },
                description: 'List of property names to include in results. Omit to return all properties.',
              },
              limit: {
                type: 'number',
                description: 'Maximum number of individual feature rows to return (default: 100, max: 1000).',
              },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'spatial_join',
          description:
            'Spatial join: find all features from a TARGET layer that fall inside a boundary ' +
            'selected from a BOUNDARY layer. This is the tool for cross-map queries.\n\n' +
            'Examples:\n' +
            '- "Which hospitals are near pincode 400071?" -> there is no pincode polygon layer, so use nearby(pincode="400071", mapIds=["hotosm-health-facilities"], filters={"amenity":"hospital"}) for a radius search, or proximity_coverage for many pincodes at once.\n' +
            '- "Which parliamentary constituency does pincode 400071 belong to?" -> boundaryMapId="lgd-parliament", boundaryFilter={}, targetMapId="pincodes-centroids", targetFilters={"pincode":"400071"} (finds which constituency contains the pincode centroid)\n' +
            '- "Airports in Karnataka" -> boundaryMapId="lgd-states", boundaryFilter={"state_name":"Karnataka"}, targetMapId="airports"\n' +
            '- "Dams in Hubballi district" -> boundaryMapId="lgd-districts", boundaryFilter={"district_name":"Dharwad"}, targetMapId="dams"\n' +
            '- "Water bodies in Kodagu" -> boundaryMapId="lgd-districts", boundaryFilter={"district_name":"Kodagu"}, targetMapId="water-bodies"\n\n' +
            'For constituency lookups, flip the join: use the constituency polygons as the boundary ' +
            'and the pincode centroid as the target. boundaryFilter can be left empty {} to test all boundaries - ' +
            'the first one containing the target will be returned. Better: use locate tool for single-point lookups.\n\n' +
            'boundaryFilter uses case-insensitive substring matching on any property.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              boundaryMapId: {
                type: 'string',
                description: 'Map ID for the boundary layer (any polygon layer). E.g. "lgd-districts", "lgd-states", "lgd-parliament", "gs-wildlife". Note: there is no pincode polygon layer - "pincodes-centroids" is point-based, use it as a target, not a boundary.',
              },
              boundaryFilter: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Property filter to select the boundary feature(s). E.g. {"pincode":"400071"} or {"district_name":"Pune"} or {"state_name":"Karnataka"}. Use {} to match all boundaries (only useful with a targeted targetFilter).',
              },
              targetMapId: {
                type: 'string',
                description: 'Map ID for the target layer whose features will be tested for containment. Works with any layer: point datasets (airports, dams, hotosm-health-facilities, pincodes-centroids, water-bodies, villages-soi-points) or polygon layers (districts, constituencies, etc.).',
              },
              targetFilters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Optional property filters on target features before spatial testing. E.g. {"amenity":"hospital"} or {"type":"large_airport"}.',
              },
              properties: {
                type: 'array',
                items: { type: 'string' },
                description: 'Property names to include in results. Omit for all properties.',
              },
              limit: {
                type: 'number',
                description: 'Max results to return (default 100, max 1000).',
              },
            },
            required: ['boundaryMapId', 'boundaryFilter', 'targetMapId'],
          },
        },
        {
          name: 'nearby',
          description:
            'Find features within a given radius (km) of a center point, across one or more map layers. ' +
            'Center the search on a lat/lon OR pass a pincode directly (its centroid is resolved server-side). ' +
            'Works with point layers (airports, dams, health facilities, water bodies, pincodes-centroids) and polygon layers (uses polygon centroids). ' +
            'Results are sorted by distance, deduped (OSM ships each facility as two near-coincident nodes), and trimmed of admin-code boilerplate by default. ' +
            'Use filters to constrain server-side BEFORE the limit applies - e.g. filters={"amenity":"hospital"} so limit=10 returns 10 hospitals, not 10 mixed clinics/pharmacies. ' +
            'Examples: nearby(pincode="400071", mapIds=["hotosm-health-facilities"], filters={"amenity":"hospital"}, limit=10); ' +
            '"dams within 50 km of Hubballi"; "pincodes near 400071". ' +
            'Available point layers: airports, dams, water-bodies, hotosm-health-facilities, pincodes-centroids, villages-soi-points.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              lat: { type: 'number', description: 'Centre latitude (decimal degrees). Provide lat+lon, or use pincode instead.' },
              lon: { type: 'number', description: 'Centre longitude (decimal degrees). Provide lat+lon, or use pincode instead.' },
              pincode: { type: 'string', description: 'Centre on this pincode\'s centroid instead of lat/lon. E.g. "400071".' },
              radiusKm: { type: 'number', description: 'Search radius in kilometres.' },
              mapIds: {
                type: 'array',
                items: { type: 'string' },
                description: 'One or more map layer IDs to search. E.g. ["hotosm-health-facilities"], ["dams","water-bodies"]. Use list_available_maps to discover IDs.',
              },
              filters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Server-side property filters applied before the radius/limit. E.g. {"amenity":"hospital"}. Case-insensitive substring match.',
              },
              limit: { type: 'number', description: 'Max results per layer after dedup (default 20, max 200).' },
              properties: {
                type: 'array',
                items: { type: 'string' },
                description: 'Property names to include. Omit for a terse default (admin-code/duplicate-name fields dropped).',
              },
              terse: { type: 'boolean', description: 'Drop verbose admin-code boilerplate (adm*_pcode, name_latin, etc.). Default true.' },
            },
            required: ['radiusKm', 'mapIds'],
          },
        },
        {
          name: 'centroid',
          description:
            'Centroid (lat/lon) of any feature in any layer - district, state, constituency, ward, pincode, point, or polygon. ' +
            'Look up by fuzzy name (matched against the layer\'s name property) and/or property filters. ' +
            'Examples: centroid(mapId="lgd-districts", name="Pune"); centroid(mapId="lgd-parliament", name="Chennai South"); ' +
            'centroid(mapId="pincodes-centroids", filters={"pincode":"400071"}). ' +
            'For pincodes specifically, pincode_centroid also fills in district/state. Returns one row per matched feature.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID. Use list_available_maps to discover IDs.' },
              name: { type: 'string', description: 'Optional feature name (fuzzy match on the layer\'s name property). Omit to get centroids for all/filtered features.' },
              filters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Optional property filters, e.g. {"pincode":"400071"} or {"state_name":"Kerala"}. Case-insensitive substring match.',
              },
              limit: { type: 'number', description: 'Max features to return (default 50, max 500).' },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'get_area',
          description:
            'Compute area in km2 for one or more features in a polygon map layer. ' +
            'Optionally compute population density if the layer has a population column. ' +
            'Use this for questions like "what is the area of Bangalore district?", ' +
            '"how many km2 is Rajasthan?", "population density of all Kerala districts". ' +
            'Works with any polygon layer: districts, states, subdistricts, constituencies, wildlife sanctuaries, eco-zones, etc.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'Polygon map layer ID (e.g. "lgd-districts", "lgd-states", "gs-wildlife"). Use list_available_maps.',
              },
              name: {
                type: 'string',
                description: 'Optional feature name to look up (fuzzy match). Omit to get areas for all features.',
              },
              populationProperty: {
                type: 'string',
                description: 'Optional property name holding population count. When provided, also returns population density (people/km2).',
              },
              limit: { type: 'number', description: 'Max features to return (default 50, max 500).' },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'get_layer_detail',
          description:
            'Returns the raw data download URL(s) for any registered BharatViz map layer. ' +
            'Provides both the GeoJSON URL and the GeoParquet URL hosted on the BharatViz CDN (geo.bharatviz.org). ' +
            'GeoParquet is recommended for analytical queries in DuckDB, pandas, or Arrow - it is 5-10x smaller ' +
            'and columnar reads are dramatically faster. GeoJSON is better for direct browser/GIS tool use. ' +
            'The HOTOSM health facilities layer (hotosm-health-facilities) is also available in both formats.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: {
                type: 'string',
                description: 'Map layer ID. Use list_available_maps to see all options.',
              },
            },
            required: ['mapId'],
          },
        },

        // District Evolution Tools
        {
          name: 'trace_district_evolution',
          description:
            'Traces how a district\'s administrative boundaries evolved across Census years (1951-2011). ' +
            'Shows splits, merges, and renames. For example, "Coimbatore" split into multiple districts over time. ' +
            'Optionally includes GeoJSON boundary polygons for each year.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              district: {
                type: 'string',
                description: 'District name to trace (case-insensitive).',
              },
              state: {
                type: 'string',
                description: 'Optional state name to narrow results.',
              },
              year: {
                type: 'number',
                enum: [1951, 1961, 1971, 1981, 1991, 2001, 2011],
                description: 'Optional: return only this census year.',
              },
              includeGeojson: {
                type: 'boolean',
                description: 'Include GeoJSON boundary polygons. Default: false.',
              },
            },
            required: ['district'],
          },
        },
        {
          name: 'list_historical_district_names',
          description:
            'Lists all district names that appear in the Census transition data (1951-2011). ' +
            'Returns {district, state} pairs. Useful for discovering exact names to use with trace_district_evolution.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
        // Analytics
        {
          name: 'layer_schema',
          description:
            'Describes the schema of any registered BharatViz map layer: which columns are numeric ' +
            '(with min/max/mean), which are categorical (with unique-value count and sample), and ' +
            'which are free-text identifiers. Call this before summarize_layer, rank_features, ' +
            'correlate, compare_groups, or find_similar to discover exact column names.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID. Use list_available_maps to see all options.' },
            },
            required: ['mapId'],
          },
        },
        {
          name: 'summarize_layer',
          description:
            'Compute descriptive statistics (count, min, max, mean, median, p10, p25, p75, p90, stddev, sum) ' +
            'for one or more numeric columns in any registered map layer. ' +
            'Use groupBy to break down stats by a categorical column (e.g. state_name). ' +
            'Use columns:["*"] to summarize all numeric columns at once. ' +
            'Examples: "Mean literacy rate per state" -> mapId="census-2011-enriched", columns=["literacy_pct"], groupBy="state_name". ' +
            '"Distribution of SC% across all districts" -> mapId="census-2011-enriched", columns=["sc_pct"]. ' +
            '"Sum of population by state" -> mapId="census-2011-enriched", columns=["population"], groupBy="state_name".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID.' },
              columns: {
                type: 'array', items: { type: 'string' },
                description: 'Numeric column names to summarize. Pass ["*"] for all numeric columns.',
              },
              groupBy: { type: 'string', description: 'Categorical column to group by (e.g. "state_name").' },
              filters: {
                type: 'object', additionalProperties: { type: 'string' },
                description: 'String property filters (case-insensitive substring). E.g. {"state_name":"Bihar"}.',
              },
              numericFilters: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string' },
                    gt: { type: 'number' }, gte: { type: 'number' },
                    lt: { type: 'number' }, lte: { type: 'number' },
                  },
                  required: ['column'],
                },
                description: 'Numeric range filters. E.g. [{column:"st_pct", gte:40}] for tribal-majority districts.',
              },
            },
            required: ['mapId', 'columns'],
          },
        },
        {
          name: 'rank_features',
          description:
            'Sort features in any map layer by a numeric column and return the top or bottom N. ' +
            'Use filters to restrict to a state or other subset. ' +
            'Examples: ' +
            '"20 districts with lowest literacy" -> mapId="census-2011-enriched", column="literacy_pct", order="asc". ' +
            '"Top 20 ST-majority districts" -> mapId="census-2011-enriched", column="st_pct", order="desc". ' +
            '"Most Hindi-speaking districts" -> mapId="census-2011-enriched", column="lang_Hindi_l1_pct", order="desc". ' +
            '"Airports by elevation" -> mapId="airports", column="elevation_ft", order="desc". ' +
            '"Lowest literacy in Bihar" -> mapId="census-2011-enriched", column="literacy_pct", order="asc", filters={"state_name":"Bihar"}.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID.' },
              column: { type: 'string', description: 'Numeric column to rank by.' },
              order: { type: 'string', enum: ['asc', 'desc'], description: '"asc" for lowest first, "desc" for highest first.' },
              limit: { type: 'number', description: 'Number of results to return (default 10, max 100).' },
              filters: { type: 'object', additionalProperties: { type: 'string' }, description: 'String property filters.' },
              numericFilters: {
                type: 'array',
                items: { type: 'object', properties: { column: { type: 'string' }, gt: { type: 'number' }, gte: { type: 'number' }, lt: { type: 'number' }, lte: { type: 'number' } }, required: ['column'] },
                description: 'Numeric range filters.',
              },
              properties: { type: 'array', items: { type: 'string' }, description: 'Properties to include in output (default: all).' },
            },
            required: ['mapId', 'column', 'order'],
          },
        },
        {
          name: 'correlate',
          description:
            'Compute Pearson and Spearman correlation between two numeric columns across features. ' +
            'Use groupBy to compute correlation separately per group (e.g. per state). ' +
            'Use sampleRows to get scatter-plot data points. ' +
            'Examples: ' +
            '"Correlation between SC% and literacy" -> mapId="census-2011-enriched", x="sc_pct", y="literacy_pct". ' +
            '"State-level SC% vs literacy" -> same mapId, groupBy="state_name". ' +
            '"Language diversity vs literacy" -> mapId="census-2011-enriched", x="shannon_diversity", y="literacy_pct". ' +
            'CROSS-LAYER: set yMapId to pull y from a different district layer, joined per district (on pc11_district_id, ' +
            'else state+district name). E.g. "Does Meta wealth index predict literacy?" -> mapId="shrug-facebook", ' +
            'x="facebook-rwi__facebook_mean_rwi", yMapId="census-2011-enriched", y="literacy_pct".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID (provides X, and the districts iterated over).' },
              x: { type: 'string', description: 'First numeric column (X axis), from mapId.' },
              y: { type: 'string', description: 'Second numeric column (Y axis), from yMapId if set, else mapId.' },
              yMapId: { type: 'string', description: 'Optional: pull Y from this layer instead, joined per district. Enables cross-layer correlation (e.g. wealth in shrug-facebook vs literacy in census-2011-enriched).' },
              filters: { type: 'object', additionalProperties: { type: 'string' }, description: 'String property filters.' },
              numericFilters: {
                type: 'array',
                items: { type: 'object', properties: { column: { type: 'string' }, gt: { type: 'number' }, gte: { type: 'number' }, lt: { type: 'number' }, lte: { type: 'number' } }, required: ['column'] },
              },
              groupBy: { type: 'string', description: 'Compute correlation separately for each value of this column.' },
              sampleRows: { type: 'number', description: 'Return up to N scatter pairs for plotting (default: none).' },
              labelProperty: { type: 'string', description: 'Property to use as point label in scatter output (e.g. "district_name").' },
            },
            required: ['mapId', 'x', 'y'],
          },
        },
        {
          name: 'compare_groups',
          description:
            'Compare named groups of features side-by-side on numeric columns. ' +
            'Each group is defined by string and/or numeric filters. ' +
            'Returns a table of stats per group per column. ' +
            'Examples: "BIMARU vs South Indian states on literacy and SC%", ' +
            '"Tribal districts (ST%>40) vs rest on all demographic axes", ' +
            '"Urban vs rural literacy gap".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID.' },
              groups: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    label: { type: 'string', description: 'Group name for display.' },
                    filters: { type: 'object', additionalProperties: { type: 'string' }, description: 'String property filters.' },
                    numericFilters: {
                      type: 'array',
                      items: { type: 'object', properties: { column: { type: 'string' }, gt: { type: 'number' }, gte: { type: 'number' }, lt: { type: 'number' }, lte: { type: 'number' } }, required: ['column'] },
                    },
                  },
                  required: ['label'],
                },
                description: 'List of groups to compare.',
              },
              columns: { type: 'array', items: { type: 'string' }, description: 'Numeric columns to compare across groups.' },
              stats: {
                type: 'array',
                items: { type: 'string', enum: ['mean', 'median', 'min', 'max', 'count', 'sum', 'p10', 'p90'] },
                description: 'Which statistics to compute (default: count, mean, median, min, max).',
              },
            },
            required: ['mapId', 'groups', 'columns'],
          },
        },
        {
          name: 'find_similar',
          description:
            'Find the K features most similar to a reference feature using Z-score normalized ' +
            'Euclidean distance across a multi-column metric vector. ' +
            'Essential for identifying epidemiological comparators or policy-matched districts. ' +
            'Pass secondaryMapId to look up those similar districts in a second layer (e.g. find districts ' +
            'demographically similar to Nandurbar, then show their NFHS-5 health outcomes).\n\n' +
            'Examples:\n' +
            '- "10 districts demographically similar to Nandurbar (high ST, low literacy)": mapId="census-2011-enriched"\n' +
            '- "Districts like Washim on demography - show their NFHS-5 outcomes": mapId="census-2011-enriched", secondaryMapId="nfhs5-districts"\n' +
            '- "SHRUG districts similar to Sitamarhi on poverty proxy - show road access": mapId="shrug-secc", secondaryMapId="shrug-roads"',
          inputSchema: {
            type: 'object' as const,
            properties: {
              mapId: { type: 'string', description: 'Map layer ID for the similarity search.' },
              referenceName: { type: 'string', description: 'Name of the reference feature (value of the layer\'s featureNameProp).' },
              referenceState: { type: 'string', description: 'State name to disambiguate when the district name is not unique.' },
              columns: { type: 'array', items: { type: 'string' }, description: 'Numeric columns forming the similarity metric vector.' },
              k: { type: 'number', description: 'Number of similar features to return (default 10, max 100).' },
              filters: { type: 'object', additionalProperties: { type: 'string' }, description: 'Restrict the candidate pool before searching.' },
              numericFilters: {
                type: 'array',
                items: { type: 'object', properties: { column: { type: 'string' }, gt: { type: 'number' }, gte: { type: 'number' }, lt: { type: 'number' }, lte: { type: 'number' } }, required: ['column'] },
              },
              secondaryMapId: {
                type: 'string',
                description: 'Optional second map layer. For each similar feature, its columns from this layer are included in the result under "secondary". Use to cross-reference: find similar districts on demography, show their health outcomes.',
              },
              secondaryColumns: {
                type: 'array', items: { type: 'string' },
                description: 'Specific columns to pull from secondaryMapId (default: all numeric columns).',
              },
            },
            required: ['mapId', 'referenceName', 'columns'],
          },
        },
        {
          name: 'aggregate_by_boundary',
          description:
            'Count (and optionally sum/mean/min/max) target-layer features inside each boundary polygon. ' +
            'The essential tool for facility-per-district counts, pincode density by constituency, hospital beds per block, etc.\n\n' +
            'PRE-AGGREGATED SHORTCUT: All health/facility point layers have a pre-computed per-district count parquet ' +
            '(aggregatedByDistrictUrl in list_available_maps output). For all-India district counts, load that URL directly ' +
            'instead of running aggregate_by_boundary - it is instant (~10KB vs 85MB). ' +
            'Use aggregate_by_boundary when you need: a different boundary level (state/block/constituency), ' +
            'additional aggregated columns (sum of beds, etc.), or filters.\n\n' +
            'Examples:\n' +
            '- Health facilities per district: boundaryMapId="lgd-districts", targetMapId="nhp-health-facilities"\n' +
            '- Hospitals per state with total beds: boundaryMapId="lgd-states", targetMapId="nhp-hospital-directory", aggColumns=[{column:"Total_Num_Beds",stat:"sum"},{column:"Number_Doctor",stat:"sum"}]\n' +
            '- Anganwadis per block: boundaryMapId="lgd-blocks", targetMapId="anganwadis-icds"\n' +
            '- Airports per state: boundaryMapId="lgd-states", targetMapId="airports"\n' +
            '- Dams per district in Rajasthan: boundaryMapId="lgd-districts", targetMapId="dams", boundaryFilters={"state_name":"Rajasthan"}\n\n' +
            'Result rows are sorted by count descending. ' +
            'For large point layers (anganwadis 1.4M, nhp-health-facilities 166k), filter boundaries to a single state first using boundaryFilters - all-India queries will be rejected to prevent timeout.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              boundaryMapId: {
                type: 'string',
                description: 'Polygon layer to aggregate into (any district/state/block/constituency layer). Use list_available_maps.',
              },
              boundaryFilters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Optional string filters on boundary features. E.g. {"state_name":"Bihar"} to aggregate only Bihar districts.',
              },
              targetMapId: {
                type: 'string',
                description: 'Layer whose features will be counted/aggregated inside each boundary.',
              },
              targetFilters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Optional filters on target features before aggregation. E.g. {"facility_type":"PHC"} or {"amenity":"hospital"}.',
              },
              aggColumns: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    column: { type: 'string', description: 'Numeric column in the target layer.' },
                    stat: { type: 'string', enum: ['count', 'sum', 'mean', 'min', 'max'], description: 'Aggregation function.' },
                  },
                  required: ['column', 'stat'],
                },
                description: 'Optional numeric columns to aggregate beyond the default _count. E.g. total beds per district.',
              },
              boundaryNameProp: {
                type: 'string',
                description: 'Property to use as the boundary name in results. Defaults to the boundary layer\'s featureNameProp.',
              },
              limit: {
                type: 'number',
                description: 'Max results to return after ranking (default 500, max 2000). All boundaries matching boundaryFilters are still counted for correct ranking.',
              },
            },
            required: ['boundaryMapId', 'targetMapId'],
          },
        },
        {
          name: 'proximity_coverage',
          description:
            'Bulk nearest-distance + within-radius coverage: for EACH source feature, returns the nearest ' +
            'target feature, its distance (km), whether it is within radiusKm, and how many targets fall ' +
            'within radiusKm (a density metric). This is the buffer / "within N km" counterpart to ' +
            'aggregate_by_boundary (which counts features strictly INSIDE a polygon) - keep both.\n\n' +
            'Canonical use: "which pincodes in Pune district are within 5 km of a hospital, and map density":\n' +
            'proximity_coverage(sourceMapId="pincodes-centroids", sourceFilters={"district":"Pune"}, ' +
            'targetMapId="hotosm-health-facilities", targetFilters={"amenity":"hospital"}, radiusKm=5).\n' +
            'Feed the result straight into render_pincodes_map: use targets_within_radius as the value (density), ' +
            'or within_radius as a 0/1 coverage map.\n\n' +
            'For source=pincodes-centroids, district/state are polygon-derived so sourceFilters={"district":"..."} works. ' +
            'Targets are deduped (OSM ships double-nodes) and bbox-prefiltered to the source extent. ' +
            'sourceFilters is REQUIRED (scope to a district/state) to avoid an all-India blow-up.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              sourceMapId: { type: 'string', description: 'Features to measure FROM, e.g. "pincodes-centroids". Use list_available_maps.' },
              sourceFilters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'REQUIRED. Scope the source subset, e.g. {"district":"Pune"} or {"state_name":"Kerala"}. For pincodes-centroids, district/state are polygon-derived.',
              },
              targetMapId: { type: 'string', description: 'Features to measure TO, e.g. "hotosm-health-facilities".' },
              targetFilters: {
                type: 'object',
                additionalProperties: { type: 'string' },
                description: 'Optional filters on target features, e.g. {"amenity":"hospital"}.',
              },
              radiusKm: { type: 'number', description: 'Coverage threshold in km, e.g. 5.' },
              limit: { type: 'number', description: 'Max source rows returned (default 1000, max 5000).' },
              properties: {
                type: 'array',
                items: { type: 'string' },
                description: 'Source properties to echo back. Omit for terse output (name/id + computed fields).',
              },
            },
            required: ['sourceMapId', 'targetMapId', 'radiusKm'],
          },
        },
        {
          name: 'join_layers',
          description:
            'Join numeric columns from two map layers by matching feature names. ' +
            'Returns one row per base-layer feature with columns from both layers prefixed base__ and join__. ' +
            'This is the tool for cross-layer analytics: e.g. SHRUG road density + census literacy, or NFHS-5 outcomes + census demography.\n\n' +
            'Examples:\n' +
            '- SHRUG roads + census literacy: baseMapId="shrug-roads", joinMapId="census-2011-enriched"\n' +
            '- Facebook wealth index + SECC deprivation: baseMapId="shrug-facebook", joinMapId="shrug-secc"\n' +
            '- PM2.5 pollution + literacy: baseMapId="shrug-environment", joinMapId="census-2011-enriched", baseColumns=["pm25__pm25_mean"], joinColumns=["literacy_pct","sc_pct"]\n' +
            '- State-level join: baseMapId="lgd-states", joinMapId="nfhs5-states", matchOn="state_name"\n\n' +
            'Matching is state-scoped by default (district_name). For state-level layers pass matchOn="state_name".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              baseMapId: {
                type: 'string',
                description: 'Primary map layer. Each feature appears once in the output.',
              },
              joinMapId: {
                type: 'string',
                description: 'Layer to join columns from.',
              },
              matchOn: {
                type: 'string',
                enum: ['district_name', 'state_name'],
                description: 'Property name to join on. Use "state_name" for state-level layers, "district_name" (default) for district/sub-district layers.',
              },
              baseNameProp: {
                type: 'string',
                description: 'Override the join key property in the base layer (overrides matchOn).',
              },
              joinNameProp: {
                type: 'string',
                description: 'Override the join key property in the join layer (overrides matchOn).',
              },
              baseColumns: {
                type: 'array', items: { type: 'string' },
                description: 'Base-layer columns to include (default: all numeric columns).',
              },
              joinColumns: {
                type: 'array', items: { type: 'string' },
                description: 'Join-layer columns to include (default: all numeric columns).',
              },
              baseFilters: {
                type: 'object', additionalProperties: { type: 'string' },
                description: 'String filters on base features. E.g. {"state_name":"Kerala"}.',
              },
              joinFilters: {
                type: 'object', additionalProperties: { type: 'string' },
                description: 'String filters on join features.',
              },
              limit: {
                type: 'number',
                description: 'Max rows to return (default 1000, max 5000).',
              },
            },
            required: ['baseMapId', 'joinMapId'],
          },
        },
        {
          name: 'city_layer_schema',
          description:
            'Describes the schema (columns, types, ranges) of a city ward dataset. ' +
            'Works like layer_schema but for city/ward layers from list_cities. ' +
            'Call this before summarize_city_layer or rank_city_features to discover column names.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              cityId: { type: 'string', description: 'City dataset ID from list_cities (e.g. "mumbai_admin_wards").' },
            },
            required: ['cityId'],
          },
        },
        {
          name: 'summarize_city_layer',
          description:
            'Compute descriptive statistics for numeric columns in a city ward dataset. ' +
            'Use columns:["*"] to summarize all numeric columns. Supports groupBy and string filters. ' +
            'Examples: "Mean population per ward in Bengaluru", "Literacy distribution across Mumbai wards".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              cityId: { type: 'string', description: 'City dataset ID from list_cities.' },
              columns: {
                type: 'array', items: { type: 'string' },
                description: 'Numeric column names. Pass ["*"] for all numeric columns.',
              },
              groupBy: { type: 'string', description: 'Categorical column to group by.' },
              filters: {
                type: 'object', additionalProperties: { type: 'string' },
                description: 'String property filters.',
              },
            },
            required: ['cityId', 'columns'],
          },
        },
        {
          name: 'rank_city_features',
          description:
            'Sort ward features in a city dataset by a numeric column and return the top or bottom N. ' +
            'Examples: "10 wards with lowest literacy in Mumbai", "Top 5 wards by area in Bengaluru".',
          inputSchema: {
            type: 'object' as const,
            properties: {
              cityId: { type: 'string', description: 'City dataset ID from list_cities.' },
              column: { type: 'string', description: 'Numeric column to rank by.' },
              order: { type: 'string', enum: ['asc', 'desc'], description: '"asc" for lowest first, "desc" for highest first.' },
              limit: { type: 'number', description: 'Number of results (default 10, max 100).' },
              filters: { type: 'object', additionalProperties: { type: 'string' }, description: 'String property filters.' },
              properties: { type: 'array', items: { type: 'string' }, description: 'Properties to include in output.' },
            },
            required: ['cityId', 'column', 'order'],
          },
        },
        {
          name: 'list_categories',
          description:
            'Lists all available BharatViz map layers grouped by category. ' +
            'Categories: admin (Census 1872-2011 boundaries, LGD, SOI, Bhuvan, blocks, subdistricts; ' +
            'SHRUG data layers: shrug-census/shrug-secc/shrug-economic/shrug-environment/shrug-roads/shrug-facebook), ' +
            'electoral (Lok Sabha, Vidhan Sabha constituencies), ' +
            'survey (NFHS-4, NFHS-5, NSSO regions), ' +
            'environment (wildlife sanctuaries, eco-sensitive zones, FSI forests), ' +
            'urban (SBM urban local bodies), ' +
            'health (NHP facilities, hospital directory, blood banks, anganwadis, BharatMaps, GatiShakti, SOI, Living Atlas, HOTOSM), ' +
            'points (airports, dams, water bodies, pincodes, villages). ' +
            'SHRUG layers carry Census/economic/SECC data columns queryable via rank_features/correlate/summarize_layer - ' +
            'e.g. literacy: shrug-census pca11__lit_total; SC share: pca11__sc_share. ' +
            'Each entry includes id, level, source, year, description, and aggregatedByDistrictUrl ' +
            '(pre-computed per-district count parquet - available for all health/facility layers). ' +
            'Faster than list_available_maps - does not fetch GeoJSON.',
          inputSchema: {
            type: 'object' as const,
            properties: {},
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'list_available_maps': {
          const maps = await mapService.listMaps();
          return {
            content: [{ type: 'text', text: JSON.stringify(maps, null, 2) }],
          };
        }

        // Analytics handlers
        case 'layer_schema': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const result = await mapService.layerSchema(mapId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'summarize_layer': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const columns = (Array.isArray(args?.columns) && (args.columns as string[]).length > 0) ? args.columns as string[] : ['*'];
          const result = await mapService.summarizeLayer({
            mapId,
            columns,
            groupBy: args?.groupBy as string | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            numericFilters: args?.numericFilters as Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }> | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'rank_features': {
          const mapId = args?.mapId as string;
          const column = args?.column as string;
          const orderRaw = args?.order as string;
          if (orderRaw !== undefined && orderRaw !== 'asc' && orderRaw !== 'desc')
            throw new Error(`order must be "asc" or "desc", got "${orderRaw}"`);
          const order: 'asc' | 'desc' = (orderRaw as 'asc' | 'desc') ?? 'desc';
          if (!mapId || !column) throw new Error('mapId and column are required');
          const result = await mapService.rankFeatures({
            mapId, column, order,
            limit: args?.limit as number | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            numericFilters: args?.numericFilters as Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }> | undefined,
            properties: Array.isArray(args?.properties) ? args.properties as string[] : undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'correlate': {
          const mapId = args?.mapId as string;
          const x = args?.x as string;
          const y = args?.y as string;
          if (!mapId || !x || !y) throw new Error('mapId, x, and y are required');
          const result = await mapService.correlate({
            mapId, x, y,
            yMapId: args?.yMapId as string | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            numericFilters: args?.numericFilters as Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }> | undefined,
            groupBy: args?.groupBy as string | undefined,
            sampleRows: args?.sampleRows as number | undefined,
            labelProperty: args?.labelProperty as string | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'compare_groups': {
          const mapId = args?.mapId as string;
          const groups = args?.groups as Array<{ label: string; filters?: Record<string, string>; numericFilters?: Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }> }>;
          const columns = Array.isArray(args?.columns) ? args.columns as string[] : [];
          if (!mapId || !groups?.length || !columns.length) throw new Error('mapId, groups, and columns are required');
          const result = await mapService.compareGroups({
            mapId, groups, columns,
            stats: args?.stats as Array<'mean' | 'median' | 'min' | 'max' | 'count' | 'sum' | 'p10' | 'p90'> | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'find_similar': {
          const mapId = args?.mapId as string;
          const referenceName = args?.referenceName as string;
          const columns = Array.isArray(args?.columns) ? args.columns as string[] : [];
          if (!mapId || !referenceName || !columns.length) throw new Error('mapId, referenceName, and columns are required');
          const result = await mapService.findSimilar({
            mapId, referenceName, columns,
            referenceState: args?.referenceState as string | undefined,
            k: args?.k as number | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            numericFilters: args?.numericFilters as Array<{ column: string; gt?: number; gte?: number; lt?: number; lte?: number }> | undefined,
            secondaryMapId: args?.secondaryMapId as string | undefined,
            secondaryColumns: Array.isArray(args?.secondaryColumns) ? args.secondaryColumns as string[] : undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'aggregate_by_boundary': {
          const boundaryMapId = args?.boundaryMapId as string;
          const targetMapId = args?.targetMapId as string;
          if (!boundaryMapId || !targetMapId) throw new Error('boundaryMapId and targetMapId are required');
          const result = await mapService.aggregateByBoundary({
            boundaryMapId,
            boundaryFilters: args?.boundaryFilters as Record<string, string> | undefined,
            targetMapId,
            targetFilters: args?.targetFilters as Record<string, string> | undefined,
            aggColumns: args?.aggColumns as Array<{ column: string; stat: 'count' | 'sum' | 'mean' | 'min' | 'max' }> | undefined,
            boundaryNameProp: args?.boundaryNameProp as string | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'proximity_coverage': {
          const sourceMapId = args?.sourceMapId as string;
          const targetMapId = args?.targetMapId as string;
          const radiusKm = args?.radiusKm as number;
          if (!sourceMapId || !targetMapId || radiusKm == null)
            throw new Error('sourceMapId, targetMapId, and radiusKm are required');
          const result = await mapService.proximityCoverage({
            sourceMapId,
            sourceFilters: args?.sourceFilters as Record<string, string> | undefined,
            targetMapId,
            targetFilters: args?.targetFilters as Record<string, string> | undefined,
            radiusKm,
            limit: args?.limit as number | undefined,
            properties: args?.properties as string[] | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'join_layers': {
          const baseMapId = args?.baseMapId as string;
          const joinMapId = args?.joinMapId as string;
          if (!baseMapId || !joinMapId) throw new Error('baseMapId and joinMapId are required');
          const result = await mapService.joinLayers({
            baseMapId, joinMapId,
            matchOn: args?.matchOn as 'district_name' | 'state_name' | undefined,
            baseNameProp: args?.baseNameProp as string | undefined,
            joinNameProp: args?.joinNameProp as string | undefined,
            baseColumns: Array.isArray(args?.baseColumns) ? args.baseColumns as string[] : undefined,
            joinColumns: Array.isArray(args?.joinColumns) ? args.joinColumns as string[] : undefined,
            baseFilters: args?.baseFilters as Record<string, string> | undefined,
            joinFilters: args?.joinFilters as Record<string, string> | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'city_layer_schema': {
          const cityId = args?.cityId as string;
          if (!cityId) throw new Error('cityId is required');
          const result = await mapService.cityLayerSchema(cityId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'summarize_city_layer': {
          const cityId = args?.cityId as string;
          const columns = Array.isArray(args?.columns) ? args.columns as string[] : ['*'];
          if (!cityId) throw new Error('cityId is required');
          const result = await mapService.summarizeCityLayer(cityId, {
            columns,
            groupBy: args?.groupBy as string | undefined,
            filters: args?.filters as Record<string, string> | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'rank_city_features': {
          const cityId = args?.cityId as string;
          const column = args?.column as string;
          const order = (args?.order as 'asc' | 'desc') ?? 'desc';
          if (!cityId || !column) throw new Error('cityId and column are required');
          const result = await mapService.rankCityFeatures(cityId, {
            column, order,
            limit: args?.limit as number | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            properties: Array.isArray(args?.properties) ? args.properties as string[] : undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'list_categories': {
          const categories = mapService.listCategories();
          return {
            content: [{ type: 'text', text: JSON.stringify(categories, null, 2) }],
          };
        }

        case 'list_states': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const states = await mapService.listStates(mapId);
          return {
            content: [{ type: 'text', text: JSON.stringify(states, null, 2) }],
          };
        }

        case 'list_districts': {
          const mapId = args?.mapId as string;
          const state = args?.state as string | undefined;
          if (!mapId) throw new Error('mapId is required');
          const districts = await mapService.listDistricts(mapId, state);
          return {
            content: [{ type: 'text', text: JSON.stringify(districts, null, 2) }],
          };
        }

        case 'render_states_map': {
          const data = args?.data as Array<{ state: string; value: number }>;
          if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('data is required and must be a non-empty array of {state, value} objects');
          }

          const result = await mapService.renderStatesMap({
            data,
            mapId: args?.mapId as string | undefined,
            colorScale: args?.colorScale as string | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hideStateNames: args?.hideStateNames as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          return mapResultToContent(result);
        }

        case 'render_districts_map': {
          const data = args?.data as Array<{ state: string; district: string; value: number }>;
          if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('data is required and must be a non-empty array of {state, district, value} objects');
          }

          const result = await mapService.renderDistrictsMap({
            data,
            mapId: args?.mapId as string | undefined,
            state: args?.state as string | undefined,
            colorScale: args?.colorScale as string | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hideDistrictNames: args?.hideDistrictNames as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            showStateBoundaries: args?.showStateBoundaries as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          return mapResultToContent(result);
        }

        case 'get_csv_template': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const csv = await mapService.getCsvTemplate(mapId);
          return {
            content: [{ type: 'text', text: csv }],
          };
        }

        case 'list_demos': {
          const level = args?.level as 'states' | 'districts' | undefined;
          const demos = await mapService.listDemos(level);
          return {
            content: [{ type: 'text', text: JSON.stringify(demos, null, 2) }],
          };
        }

        case 'get_demo_url': {
          const demoId = args?.demoId as string;
          if (!demoId) throw new Error('demoId is required');
          const result = await mapService.getDemoUrl(demoId, args?.baseUrl as string | undefined);
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        // Pincode Tools

        case 'list_pincode_states': {
          const states = mapService.listPincodeStates();
          return {
            content: [{ type: 'text', text: JSON.stringify(states, null, 2) }],
          };
        }

        case 'list_pincodes': {
          const pincodes = await mapService.listPincodes(
            args?.state as string | undefined,
            args?.district as string | undefined,
          );
          return {
            content: [{ type: 'text', text: JSON.stringify(pincodes, null, 2) }],
          };
        }

        case 'pincode_centroid': {
          const pincode = args?.pincode as string;
          if (!pincode) throw new Error('pincode is required');
          const result = await mapService.resolvePincode(pincode);
          if (!result) throw new Error(`Unknown pincode: "${pincode}"`);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'render_pincodes_map': {
          const data = args?.data as Array<{ pincode: string; value: number }>;
          if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('data is required and must be a non-empty array of {pincode, value} objects');
          }
          const result = await mapService.renderPincodesMap({
            data,
            state: (args?.state as string) || ALL_INDIA_STATE,
            colorScale: args?.colorScale as string | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hidePincodeLabels: args?.hidePincodeLabels as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          return mapResultToContent(result);
        }

        // City/Ward Tools

        case 'list_cities': {
          const cities = await mapService.listCities();
          return {
            content: [{ type: 'text', text: JSON.stringify(cities, null, 2) }],
          };
        }

        case 'list_wards': {
          const cityId = args?.cityId as string;
          if (!cityId) throw new Error('cityId is required');
          const wards = await mapService.listWards(cityId);
          return {
            content: [{ type: 'text', text: JSON.stringify(wards, null, 2) }],
          };
        }

        case 'render_city_map': {
          const cityId = args?.cityId as string;
          const data = args?.data as Array<{ ward: string; value: number }>;
          if (!cityId) throw new Error('cityId is required');
          if (!data || !Array.isArray(data) || data.length === 0) {
            throw new Error('data is required and must be a non-empty array of {ward, value} objects');
          }

          const result = await mapService.renderCityMap({
            cityId,
            data,
            colorScale: args?.colorScale as string | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hideWardNames: args?.hideWardNames as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          return mapResultToContent(result);
        }

        case 'locate': {
          const lat = args?.lat as number;
          const lon = args?.lon as number;
          if (lat == null || lon == null) throw new Error('lat and lon are required');
          const mapIds = Array.isArray(args?.mapIds) ? args.mapIds as string[] : undefined;
          const result = await mapService.locate(lat, lon, mapIds);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'query_layer': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const result = await mapService.queryLayer({
            mapId,
            filters: args?.filters as Record<string, string> | undefined,
            groupBy: args?.groupBy as string | undefined,
            properties: args?.properties as string[] | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'spatial_join': {
          const boundaryMapId = args?.boundaryMapId as string;
          const targetMapId = args?.targetMapId as string;
          if (!boundaryMapId || !targetMapId) throw new Error('boundaryMapId and targetMapId are required');
          const result = await mapService.spatialJoin({
            boundaryMapId,
            boundaryFilter: (args?.boundaryFilter as Record<string, string>) ?? {},
            targetMapId,
            targetFilters: args?.targetFilters as Record<string, string> | undefined,
            properties: args?.properties as string[] | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'nearby': {
          const lat = args?.lat as number | undefined;
          const lon = args?.lon as number | undefined;
          const pincode = args?.pincode as string | undefined;
          const radiusKm = args?.radiusKm as number;
          const mapIds = Array.isArray(args?.mapIds) ? args.mapIds as string[] : [];
          if (radiusKm == null || !mapIds.length)
            throw new Error('radiusKm and mapIds are required');
          if ((lat == null || lon == null) && !pincode)
            throw new Error('Provide either lat+lon or a pincode as the center.');
          const result = await mapService.nearby({
            lat, lon, pincode, radiusKm, mapIds,
            limit: args?.limit as number | undefined,
            properties: args?.properties as string[] | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            terse: args?.terse as boolean | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_area': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const result = await mapService.getArea({
            mapId,
            name: args?.name as string | undefined,
            populationProperty: args?.populationProperty as string | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'centroid': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const result = await mapService.centroid({
            mapId,
            name: args?.name as string | undefined,
            filters: args?.filters as Record<string, string> | undefined,
            limit: args?.limit as number | undefined,
          });
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        case 'get_layer_detail': {
          const mapId = args?.mapId as string;
          if (!mapId) throw new Error('mapId is required');
          const result = mapService.getLayerDetail(mapId);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        // District Evolution Tools

        case 'trace_district_evolution': {
          const district = args?.district as string;
          if (!district) throw new Error('district is required');
          const result = await mapService.traceDistrictEvolution({
            district,
            state: args?.state as string | undefined,
            year: args?.year as number | undefined,
            includeGeojson: args?.includeGeojson as boolean | undefined,
          });
          return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          };
        }

        case 'list_historical_district_names': {
          const names = await mapService.listHistoricalDistrictNames();
          return {
            content: [{ type: 'text', text: JSON.stringify(names, null, 2) }],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
        isError: true,
      };
    }
  });

  return server;
}
