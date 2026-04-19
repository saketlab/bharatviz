import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { CityMapRenderer } from '../services/cityMapRenderer.js';
import { ExportService } from '../services/exportService.js';
import { ColorScales } from '../types/index.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = Router();
const renderer = new CityMapRenderer();
const exportService = new ExportService();

const CityMapRequestSchema = z.object({
  cityId: z.string().min(1, 'cityId is required'),
  data: z.array(z.object({
    ward: z.string(),
    value: z.number(),
  })).min(1, 'At least one ward data point is required'),
  colorScale: z.enum(ColorScales).optional().default('spectral'),
  invertColors: z.boolean().optional().default(false),
  hideWardNames: z.boolean().optional().default(true),
  hideValues: z.boolean().optional().default(true),
  mainTitle: z.string().optional().default('BharatViz'),
  legendTitle: z.string().optional().default('Values'),
  darkMode: z.boolean().optional().default(false),
  colorBarSettings: z.object({
    mode: z.enum(['continuous', 'discrete']).default('continuous'),
    binCount: z.number().min(2).max(20).optional().default(5),
    customBoundaries: z.array(z.number()).optional(),
  }).optional(),
  formats: z.array(z.enum(['png', 'svg', 'pdf'])).optional().default(['png']),
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const manifestPath = join(__dirname, '../../../public/city-datasets-manifest.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const cities = JSON.parse(raw) as Array<{ id: string; displayName: string; state: string; type: string; label: string; featureCount: number }>;
    res.json({ success: true, cities: cities.map(c => ({ id: c.id, displayName: c.displayName, state: c.state, type: c.type, label: c.label, featureCount: c.featureCount })) });
  } catch {
    res.status(500).json({ success: false, error: { message: 'Failed to load city list', code: 'LOAD_ERROR' } });
  }
});

router.get('/:cityId/wards', async (req: Request, res: Response) => {
  try {
    const wards = await renderer.listWards(req.params.cityId);
    res.json({ success: true, cityId: req.params.cityId, wards });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load wards';
    res.status(404).json({ success: false, error: { message: msg, code: 'NOT_FOUND' } });
  }
});

router.post('/map', async (req: Request, res: Response) => {
  try {
    const parsed = CityMapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, error: { message: 'Invalid request data', code: 'VALIDATION_ERROR', details: parsed.error.errors } });
      return;
    }

    const request = parsed.data as import('../services/cityMapRenderer.js').CityMapRequest;
    const svgString = await renderer.renderMap(request);

    const exports = [];
    for (const format of request.formats || ['png']) {
      let data: string;
      let mimeType: string;
      switch (format) {
        case 'png': data = await exportService.svgToPNG(svgString); mimeType = 'image/png'; break;
        case 'svg': data = Buffer.from(svgString).toString('base64'); mimeType = 'image/svg+xml'; break;
        case 'pdf': data = await exportService.svgToPDF(svgString); mimeType = 'application/pdf'; break;
        default: continue;
      }
      exports.push({ format, data, mimeType });
      data = '';
    }

    const values = request.data.map(d => d.value);
    res.json({
      success: true,
      exports,
      metadata: {
        cityId: request.cityId,
        dataPoints: request.data.length,
        colorScale: request.colorScale,
        minValue: Math.min(...values),
        maxValue: Math.max(...values),
        meanValue: values.reduce((a, b) => a + b, 0) / values.length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate city map';
    const code = msg.includes('not found') || msg.includes('City not found') ? 'NOT_FOUND' : 'GENERATION_ERROR';
    res.status(code === 'NOT_FOUND' ? 404 : 500).json({ success: false, error: { message: msg, code } });
  }
});

export default router;
