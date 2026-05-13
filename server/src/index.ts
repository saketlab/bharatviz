import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import swaggerUi from 'swagger-ui-express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from './mcpTools.js';
import mapRoutes from './routes/mapRoutes.js';
import districtsMapRoutes from './routes/districtsMapRoutes.js';
import cityMapRoutes from './routes/cityMapRoutes.js';
import pincodeMapRoutes from './routes/pincodeMapRoutes.js';
import embedRoutes from './routes/embedRoutes.js';
import proxyRoutes from './routes/proxyRoutes.js';
import districtEvolutionRoutes from './routes/districtEvolutionRoutes.js';
import { openApiSpec } from './openapi.js';
import { ColorScales } from './types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Trust nginx reverse proxy 
// so X-Forwarded-For is used for rate limiting
app.set('trust proxy', 1);

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://d3js.org"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:*", "https://*"]
    }
  }
}));

app.use('/api-docs', swaggerUi.serve, (req: Request, res: Response, next: NextFunction) => {
  const isLocal = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  const spec = {
    ...openApiSpec,
    servers: isLocal
      ? [{ url: 'http://localhost:3001', description: 'Local development' }]
      : [{ url: 'https://bharatviz.org', description: 'Production' }],
  };
  swaggerUi.setup(spec, {
    customSiteTitle: 'BharatViz API Docs',
    swaggerOptions: { defaultModelsExpandDepth: -1 },
  })(req, res, next);
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.ip === '127.0.0.1' || req.ip === '::1' || req.ip === '::ffff:127.0.0.1',
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP Streamable HTTP endpoint
const mcpTransports = new Map<string, StreamableHTTPServerTransport>();

app.post('/api/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    let transport: StreamableHTTPServerTransport;

    if (sessionId && mcpTransports.has(sessionId)) {
      transport = mcpTransports.get(sessionId)!;
    } else if (!sessionId) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          mcpTransports.delete(transport.sessionId);
        }
      };

      const server = createMcpServer();
      await server.connect(transport);
    } else {
      res.status(404).json({ error: 'Session not found. Start a new session without Mcp-Session-Id header.' });
      return;
    }

    await transport.handleRequest(req, res, req.body);

    if (transport.sessionId && !mcpTransports.has(transport.sessionId)) {
      mcpTransports.set(transport.sessionId, transport);
    }
  } catch (error) {
    console.error('MCP POST error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/api/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !mcpTransports.has(sessionId)) {
    res.status(400).json({ error: 'Missing or invalid Mcp-Session-Id header. Send a POST to /api/mcp first to initialize.' });
    return;
  }
  const transport = mcpTransports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete('/api/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !mcpTransports.has(sessionId)) {
    res.status(404).json({ error: 'Session not found.' });
    return;
  }
  const transport = mcpTransports.get(sessionId)!;
  await transport.close();
  mcpTransports.delete(sessionId);
  res.status(200).json({ status: 'Session closed.' });
});

app.use('/api/v1/states', mapRoutes);
app.use('/api/v1/districts', districtsMapRoutes);
app.use('/api/v1/cities', cityMapRoutes);
app.use('/api/v1/pincodes', pincodeMapRoutes);
app.use('/api/v1/embed', embedRoutes);
app.use('/api/v1/proxy', proxyRoutes);
app.use('/api/v1/district-evolution', districtEvolutionRoutes);

app.get('/api/embed.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(join(__dirname, '..', 'public', 'embed.js'));
});

app.get('/embed.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(join(__dirname, '..', 'public', 'embed.js'));
});

app.get('/', (req, res) => {
  res.json({
    name: 'BharatViz API',
    version: '1.0.0',
    description: 'Generate India choropleth maps programmatically',
    docs: 'https://bharatviz.org/api-docs',
    endpoints: {
      'GET /api/v1/district-evolution': {
        description: 'Trace a district\'s name across census years 1951–2011',
        params: {
          district: 'string - Required',
          state: 'string - Optional (narrows to one state)',
          year: 'number - Optional (1951|1961|1971|1981|1991|2001|2011)',
          geojson: 'boolean - Optional (attach boundary polygons)',
        },
      },
      'GET /api/v1/district-evolution/data.csv': {
        description: 'Download deduplicated district transition table as CSV',
      },
      'POST /api/v1/states/map': {
        description: 'Generate state-level choropleth map',
        requestBody: {
          data: 'Array<{ state: string, value: number }> - Required',
          colorScale: 'string - Optional (default: spectral)',
          invertColors: 'boolean - Optional (default: false)',
          hideStateNames: 'boolean - Optional (default: false)',
          hideValues: 'boolean - Optional (default: false)',
          mainTitle: 'string - Optional (default: BharatViz)',
          legendTitle: 'string - Optional (default: Values)',
          formats: 'Array<"png" | "svg" | "pdf"> - Optional (default: ["png"])'
        }
      },
      'POST /api/v1/districts/state-districts/map': {
        description: 'Generate state-district-level choropleth map (single state)',
        requestBody: {
          data: 'Array<{ state: string, district: string, value: number }> - Required',
          state: 'string - Required: which state to display',
          mapType: 'string - Optional: "LGD" | "NFHS5" | "NFHS4" | "BHUVAN" | "SOI" | "NSSO" | "1872"..."2011" (default: LGD)',
          colorScale: 'string - Optional (default: spectral)',
          invertColors: 'boolean - Optional (default: false)',
          hideValues: 'boolean - Optional (default: false)',
          mainTitle: 'string - Optional (default: BharatViz)',
          legendTitle: 'string - Optional (default: Values)',
          formats: 'Array<"png" | "svg" | "pdf"> - Optional (default: ["png"])'
        },
        availableMapTypes: {
          LGD: 'Local Government Directory (LGD) — latest official boundaries',
          BHUVAN: 'ISRO Bhuvan boundaries',
          SOI: 'Survey of India boundaries',
          NFHS5: 'NFHS-5 survey boundaries (2019-21)',
          NFHS4: 'NFHS-4 survey boundaries (2015-16)',
          NSSO: 'NSSO regional boundaries',
          '1872-2011': 'Historical Census boundaries (pass the year as the value)'
        }
      },
      'POST /api/v1/districts/map': {
        description: 'Generate district-level choropleth map',
        requestBody: {
          data: 'Array<{ state: string, district: string, value: number }> - Required',
          mapType: 'string - Optional: "LGD" | "NFHS5" | "NFHS4" | "BHUVAN" | "SOI" | "NSSO" | "1872"..."2011" (default: LGD)',
          colorScale: 'string - Optional (default: spectral)',
          invertColors: 'boolean - Optional (default: false)',
          hideValues: 'boolean - Optional (default: false)',
          showStateBoundaries: 'boolean - Optional (default: true)',
          mainTitle: 'string - Optional (default: BharatViz)',
          legendTitle: 'string - Optional (default: Values)',
          formats: 'Array<"png" | "svg" | "pdf"> - Optional (default: ["png"])'
        },
        availableMapTypes: {
          LGD: 'Local Government Directory (LGD) — latest official boundaries',
          BHUVAN: 'ISRO Bhuvan boundaries',
          SOI: 'Survey of India boundaries',
          NFHS5: 'NFHS-5 survey boundaries (2019-21)',
          NFHS4: 'NFHS-4 survey boundaries (2015-16)',
          NSSO: 'NSSO regional boundaries',
          '1872-2011': 'Historical Census boundaries (pass the year as the value)'
        }
      },
      availableColorScales: [...ColorScales
      ]
    },
    examples: {
      curl: `curl -X POST https://bharatviz.org/api/v1/states/map \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": [
      {"state": "Maharashtra", "value": 75.8},
      {"state": "Karnataka", "value": 85.5}
    ],
    "colorScale": "spectral",
    "legendTitle": "% of children who eat eggs",
    "formats": ["png", "svg", "pdf"]
  }'`
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: { message: 'Endpoint not found', code: 'NOT_FOUND' }
  });
});

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: { message: 'Internal server error', code: 'INTERNAL_ERROR' }
  });
});

const httpServer = app.listen(PORT, () => {
  console.log(`BharatViz API server running on http://bharatviz.saketlab.org`);
  if (typeof process.send === 'function') {
    process.send('ready');
  }
});

process.on('SIGINT', () => {
  httpServer.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  httpServer.close(() => process.exit(0));
});

export default app;
