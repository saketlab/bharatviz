import { z } from 'zod';

export const ColorScales = [
  'aqi', 'spectral', 'rdylbu', 'rdylgn', 'brbg', 'piyg', 'puor',
  'blues', 'greens', 'reds', 'oranges', 'purples', 'pinks',
  'viridis', 'plasma', 'inferno', 'magma'
] as const;

export type ColorScale = typeof ColorScales[number];

export const DistrictMapTypes = [
  '1872', '1881', '1891', '1901', '1911', '1921', '1931', '1941',
  '1951', '1961', '1971', '1981', '1991', '2001', '2011',
  'LGD', 'BHUVAN', 'SOI', 'NFHS5', 'NFHS4', 'NSSO'
] as const;
export type DistrictMapType = typeof DistrictMapTypes[number];

export const StatesMapRequestSchema = z.object({
  data: z.array(z.object({
    state: z.string(),
    value: z.number()
  })).min(1, 'At least one data point is required'),

  mapType: z.enum(DistrictMapTypes).optional().default('LGD'),

  colorScale: z.enum(ColorScales).optional().default('spectral'),

  invertColors: z.boolean().optional().default(false),

  hideStateNames: z.boolean().optional().default(false),

  hideValues: z.boolean().optional().default(false),

  mainTitle: z.string().optional().default('BharatViz'),

  legendTitle: z.string().optional().default('Values'),

  darkMode: z.boolean().optional().default(false),

  colorBarSettings: z.object({
    mode: z.enum(['continuous', 'discrete']).default('continuous'),
    binCount: z.number().min(2).max(20).optional().default(5),
    customBoundaries: z.array(z.number()).optional()
  }).optional(),

  formats: z.array(z.enum(['png', 'svg', 'pdf'])).optional().default(['png'])
});

export type StatesMapRequest = z.infer<typeof StatesMapRequestSchema>;

export const DistrictsMapRequestSchema = z.object({
  data: z.array(z.object({
    state: z.string(),
    district: z.string(),
    value: z.number()
  })).min(1, 'At least one data point is required'),

  mapType: z.enum(DistrictMapTypes).optional().default('LGD'),

  colorScale: z.enum(ColorScales).optional().default('spectral'),

  invertColors: z.boolean().optional().default(false),

  hideDistrictNames: z.boolean().optional().default(false),

  hideValues: z.boolean().optional().default(false),

  mainTitle: z.string().optional().default('BharatViz'),

  legendTitle: z.string().optional().default('Values'),

  showStateBoundaries: z.boolean().optional().default(true),

  state: z.string().optional(),

  darkMode: z.boolean().optional().default(false),

  colorBarSettings: z.object({
    mode: z.enum(['continuous', 'discrete']).default('continuous'),
    binCount: z.number().min(2).max(20).optional().default(5),
    customBoundaries: z.array(z.number()).optional()
  }).optional(),

  formats: z.array(z.enum(['png', 'svg', 'pdf'])).optional().default(['png'])
});

export type DistrictsMapRequest = z.infer<typeof DistrictsMapRequestSchema>;

export const StateDistrictMapRequestSchema = z.object({
  data: z.array(z.object({
    state: z.string(),
    district: z.string(),
    value: z.number()
  })).min(1, 'At least one data point is required'),

  state: z.string().min(1, 'State name is required'),

  mapType: z.enum(DistrictMapTypes).optional().default('LGD'),

  colorScale: z.enum(ColorScales).optional().default('spectral'),

  invertColors: z.boolean().optional().default(false),

  hideDistrictNames: z.boolean().optional().default(false),

  hideValues: z.boolean().optional().default(false),

  mainTitle: z.string().optional().default('BharatViz'),

  legendTitle: z.string().optional().default('Values'),

  darkMode: z.boolean().optional().default(false),

  colorBarSettings: z.object({
    mode: z.enum(['continuous', 'discrete']).default('continuous'),
    binCount: z.number().min(2).max(20).optional().default(5),
    customBoundaries: z.array(z.number()).optional()
  }).optional(),

  formats: z.array(z.enum(['png', 'svg', 'pdf'])).optional().default(['png'])
});

export type StateDistrictMapRequest = z.infer<typeof StateDistrictMapRequestSchema>;

export interface MapExportResult {
  format: 'png' | 'svg' | 'pdf';
  data: string;
  mimeType: string;
}

export interface StatesMapResponse {
  success: boolean;
  exports: MapExportResult[];
  metadata: {
    dataPoints: number;
    colorScale: string;
    minValue: number;
    maxValue: number;
    meanValue: number;
  };
}

export interface ErrorResponse {
  success: false;
  error: {
    message: string;
    code: string;
    details?: Record<string, unknown>;
  };
}
