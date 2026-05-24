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
    { capabilities: { tools: {} } }
  );

  // -------------------------------------------------------------------------
  // List Tools
  // -------------------------------------------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'list_available_maps',
          description:
            'Lists all available India map boundary sets. Returns metadata for each map including ' +
            'the map ID (used in other tools), data source, year, administrative level (states/districts/regions), ' +
            'and number of features. BharatViz supports 50+ boundary sets: Census years 1872-2011 (states + districts), ' +
            'LGD (latest official districts and subdistricts), NFHS-4, NFHS-5, Survey of India, ISRO Bhuvan, NSSO regions, ' +
            'PMGSY blocks, Lok Sabha and Vidhan Sabha constituencies, wildlife sanctuaries, and eco-sensitive zones.',
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
                description: 'Output format. Default: "png". Use "svg" for editable vector, "both" for both.',
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
                description: 'Output format. Default: "png".',
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

        // ── Pincode Tools ──────────────────────────────────────────────────
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
          name: 'list_pincodes',
          description:
            'Lists all pincodes (postal codes) for a given Indian state or all of India. ' +
            'Returns pincode, post office name, and district for each entry. ' +
            'Defaults to all-India if state is omitted.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              state: {
                type: 'string',
                description: 'State name (e.g. "Maharashtra", "Delhi"). Default: "All India". Case-insensitive.',
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
                description: 'Output format. Default: "png".',
              },
            },
            required: ['data'],
          },
        },

        // ── City/Ward Tools ────────────────────────────────────────────────
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
              outputFormat: { type: 'string', enum: ['png', 'svg', 'both'], description: 'Output format. Default: "png".' },
            },
            required: ['cityId', 'data'],
          },
        },

        // ── District Evolution Tools ───────────────────────────────────────
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
      ],
    };
  });

  // -------------------------------------------------------------------------
  // Call Tool
  // -------------------------------------------------------------------------
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

        // ── Pincode Tools ──────────────────────────────────────────────

        case 'list_pincode_states': {
          const states = mapService.listPincodeStates();
          return {
            content: [{ type: 'text', text: JSON.stringify(states, null, 2) }],
          };
        }

        case 'list_pincodes': {
          const pincodes = await mapService.listPincodes(args?.state as string | undefined);
          return {
            content: [{ type: 'text', text: JSON.stringify(pincodes, null, 2) }],
          };
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

        // ── City/Ward Tools ────────────────────────────────────────────

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

        // ── District Evolution Tools ───────────────────────────────────

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
