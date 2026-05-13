import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { PincodeMapRenderer } from '../services/pincodeMapRenderer.js';
import { ExportService } from '../services/exportService.js';
import { ColorScales } from '../types/index.js';

const router = Router();
const renderer = new PincodeMapRenderer();
const exportService = new ExportService();

const PincodeMapRequestSchema = z.object({
  data: z.array(z.object({
    pincode: z.string(),
    value: z.number(),
  })).min(1, 'At least one pincode data point is required'),
  state: z.string().min(1, 'State is required for pincode maps'),
  colorScale: z.enum(ColorScales).optional().default('spectral'),
  invertColors: z.boolean().optional().default(false),
  hidePincodeLabels: z.boolean().optional().default(true),
  hideValues: z.boolean().optional().default(true),
  mainTitle: z.string().optional().default('BharatViz'),
  legendTitle: z.string().optional().default('Values'),
  darkMode: z.boolean().optional().default(false),
  formats: z.array(z.enum(['png', 'svg', 'pdf'])).optional().default(['png']),
});

router.get('/states', (_req: Request, res: Response) => {
  const states = renderer.getAvailableStates();
  res.json({ success: true, states });
});

router.get('/states/:state/pincodes', async (req: Request, res: Response) => {
  try {
    const pincodes = await renderer.listPincodes(req.params.state);
    res.json({ success: true, state: req.params.state, count: pincodes.length, pincodes });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to load pincodes';
    res.status(404).json({ success: false, error: { message: msg, code: 'NOT_FOUND' } });
  }
});

router.post('/map', async (req: Request, res: Response) => {
  try {
    const parsed = PincodeMapRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { message: 'Invalid request data', code: 'VALIDATION_ERROR', details: parsed.error.errors },
      });
      return;
    }

    const request = parsed.data as import('../services/pincodeMapRenderer.js').PincodeMapRequest;
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
    }

    let minVal = Infinity, maxVal = -Infinity, sum = 0;
    for (const d of request.data) { if (d.value < minVal) minVal = d.value; if (d.value > maxVal) maxVal = d.value; sum += d.value; }
    res.json({
      success: true,
      exports,
      metadata: {
        state: request.state,
        dataPoints: request.data.length,
        colorScale: request.colorScale,
        minValue: minVal,
        maxValue: maxVal,
        meanValue: sum / request.data.length,
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Failed to generate pincode map';
    const code = msg.includes('Unknown state') ? 'NOT_FOUND' : 'GENERATION_ERROR';
    res.status(code === 'NOT_FOUND' ? 404 : 500).json({ success: false, error: { message: msg, code } });
  }
});

export default router;
