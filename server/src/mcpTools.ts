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
import type { ColorScale } from './types/index.js';

const COLOR_SCALES = [
  'aqi', 'spectral', 'rdylbu', 'rdylgn', 'brbg', 'piyg', 'puor',
  'blues', 'greens', 'reds', 'oranges', 'purples', 'pinks',
  'viridis', 'plasma', 'inferno', 'magma'
];

const mapService = new McpMapService();

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
            'and number of features. BharatViz supports 27 different boundary sets spanning Census years 1941-2011, ' +
            'LGD (latest official), NFHS-4, NFHS-5, Survey of India, ISRO Bhuvan, and NSSO regions.',
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
            'Renders a choropleth map of India at the district level. Provide an array of ' +
            '{state, district, value} data points. Can render all-India districts or zoom into a single state. ' +
            'Supports 17 color scales, dark mode, state boundary overlays, and multiple boundary sets. ' +
            'Default output is 300 DPI PNG.',
          inputSchema: {
            type: 'object' as const,
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    state: { type: 'string', description: 'State name containing this district' },
                    district: { type: 'string', description: 'District name' },
                    value: { type: 'number', description: 'Numeric value for this district' },
                  },
                  required: ['state', 'district', 'value'],
                },
                minItems: 1,
                description: 'Array of {state, district, value} data points to visualize.',
              },
              mapId: {
                type: 'string',
                description: 'Map boundary ID. Default: "lgd-districts". Use list_available_maps to see options.',
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
            colorScale: args?.colorScale as ColorScale | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hideStateNames: args?.hideStateNames as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
          if (result.png) {
            content.push({ type: 'image', data: result.png, mimeType: 'image/png' });
          }
          if (result.svg) {
            content.push({ type: 'text', text: result.svg });
          }
          return { content };
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
            colorScale: args?.colorScale as ColorScale | undefined,
            title: args?.title as string | undefined,
            legendTitle: args?.legendTitle as string | undefined,
            darkMode: args?.darkMode as boolean | undefined,
            invertColors: args?.invertColors as boolean | undefined,
            hideDistrictNames: args?.hideDistrictNames as boolean | undefined,
            hideValues: args?.hideValues as boolean | undefined,
            showStateBoundaries: args?.showStateBoundaries as boolean | undefined,
            outputFormat: args?.outputFormat as 'png' | 'svg' | 'both' | undefined,
          });

          const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> = [];
          if (result.png) {
            content.push({ type: 'image', data: result.png, mimeType: 'image/png' });
          }
          if (result.svg) {
            content.push({ type: 'text', text: result.svg });
          }
          return { content };
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
