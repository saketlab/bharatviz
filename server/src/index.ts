import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import mapRoutes from './routes/mapRoutes.js';
import districtsMapRoutes from './routes/districtsMapRoutes.js';
import embedRoutes from './routes/embedRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'self'"]
    }
  }
}));

// CORS configuration - allow all origins for embedding to work on any website
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
  legacyHeaders: false
});

app.use('/api/', limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Serve static files from public directory (relative to project root, not dist)
app.use(express.static(join(__dirname, '..', 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/states', mapRoutes);
app.use('/api/v1/districts', districtsMapRoutes);
app.use('/api/v1/embed', embedRoutes);

// Serve embed.js from /api/embed.js to bypass nginx static file handling
app.get('/api/embed.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(join(__dirname, '..', 'public', 'embed.js'));
});

// Also try to serve from root path (in case nginx allows it)
app.get('/embed.js', (req, res) => {
  res.type('application/javascript');
  res.sendFile(join(__dirname, '..', 'public', 'embed.js'));
});

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    name: 'BharatViz API',
    version: '1.0.0',
    description: 'Generate India choropleth maps programmatically',
    endpoints: {
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
          mapType: 'string - Optional: "LGD" | "NFHS5" | "NFHS4" (default: LGD)',
          colorScale: 'string - Optional (default: spectral)',
          invertColors: 'boolean - Optional (default: false)',
          hideValues: 'boolean - Optional (default: false)',
          mainTitle: 'string - Optional (default: BharatViz)',
          legendTitle: 'string - Optional (default: Values)',
          formats: 'Array<"png" | "svg" | "pdf"> - Optional (default: ["png"])'
        },
        availableMapTypes: {
          LGD: 'Local Government Directory (LGD) district boundaries',
          NFHS5: 'NFHS-5 survey district boundaries',
          NFHS4: 'NFHS-4 survey district boundaries'
        }
      },
      'POST /api/v1/districts/map': {
        description: 'Generate district-level choropleth map',
        requestBody: {
          data: 'Array<{ state: string, district: string, value: number }> - Required',
          mapType: 'string - Optional: "LGD" | "NFHS5" | "NFHS4" (default: LGD)',
          colorScale: 'string - Optional (default: spectral)',
          invertColors: 'boolean - Optional (default: false)',
          hideValues: 'boolean - Optional (default: false)',
          showStateBoundaries: 'boolean - Optional (default: true)',
          mainTitle: 'string - Optional (default: BharatViz)',
          legendTitle: 'string - Optional (default: Values)',
          formats: 'Array<"png" | "svg" | "pdf"> - Optional (default: ["png"])'
        },
        availableMapTypes: {
          LGD: 'Local Government Directory (LGD) district boundaries',
          NFHS5: 'NFHS-5 survey district boundaries',
          NFHS4: 'NFHS-4 survey district boundaries'
        }
      },
      availableColorScales: [
        'spectral', 'rdylbu', 'rdylgn', 'brbg', 'piyg', 'puor',
        'blues', 'greens', 'reds', 'oranges', 'purples', 'pinks',
        'viridis', 'plasma', 'inferno', 'magma'
      ]
    },
    examples: {
      curl: `curl -X POST http://bharatviz.saketlab.in/api/v1/states/map \\
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

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: 'Endpoint not found',
      code: 'NOT_FOUND'
    }
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR'
    }
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`BharatViz API server running on http://bharatviz.saketlab.in`);
  console.log(`Generate India maps at POST http://bharatviz.saketlab.in/api/v1/states/map`);
  console.log(`API documentation at http://bharatviz.saketlab.in/`);
});

export default app;
