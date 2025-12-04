# BharatViz

**Open-source choropleth map generator for India** - Create clean choropleths of state and district-level data in seconds.

## Quick links

- **Web application**: [bharatviz.saketlab.in](https://bharatviz.saketlab.in/)
- **REST api**: [bharatviz.saketlab.in/api](https://bharatviz.saketlab.in/api/)
- **API documentation**: [server/README.md](server/README.md)
- **Embed in websites**: [EMBED.md](EMBED.md) - Embed maps directly in any website

## Supported maps

### State-level maps

Create choropleth maps for all Indian states and union territories.

**CSV format:**
```csv
state,value
Maharashtra,75.8
Karnataka,85.5
Kerala,96.2
```

### District-level maps

Visualize data across all Indian districts with precise boundary mapping.

**CSV format:**
```csv
state_name,district_name,value
Telangana,Adilabad,45.2
Uttar Pradesh,Agra,67.8
Maharashtra,Ahmednagar,23.4
```

## Color scales

**Sequential**: blues, greens, reds, oranges, purples, pinks, viridis, plasma, inferno, magma

**Diverging**: rdylbu, rdylgn, spectral, brbg, piyg, puor

## Embed in your website

You can embed BharatViz maps directly into any website without downloading images:
We support two embed modes 1) iframe 2) javascript

**iframe method**:
```html
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://your-site.com/data.csv&colorScale=viridis&title=My%20Map"
  width="800"
  height="600"
  frameborder="0">
</iframe>
```

**JavaScript widget**:
```html
<div id="my-map"></div>
<script src="https://bharatviz.saketlab.in/embed.js"></script>
<script>
  BharatViz.embed({
    container: '#my-map',
    dataUrl: 'https://your-site.com/data.csv',
    colorScale: 'viridis',
    title: 'My Map'
  });
</script>
```


## REST API

Generate maps programmatically with the REST API:

```bash
curl -X POST https://bharatviz.saketlab.in/api/v1/states/map \
  -H "Content-Type: application/json" \
  -d '{
    "data": [
      {"state": "Maharashtra", "value": 75.8},
      {"state": "Karnataka", "value": 85.5}
    ],
    "colorScale": "viridis",
    "formats": ["png", "svg"]
  }'
```

**Response**: JSON with base64-encoded images and metadata.

See [API documentation](server/README.md) for complete reference with examples in Python, R, and Node.js.

## Local development

### Prerequisites
- Node.js 18.0+
- npm

### Setup

```bash
# Clone repository
git clone https://github.com/saketlab/bharatviz.git
cd bharatviz

# Install dependencies
npm install

# Start frontend development server
npm run dev
```

Visit `http://localhost:8080`

### API server (optional)

```bash
cd server
npm install
npm run dev
```

API runs at `http://localhost:3001`

### Build

```bash
# Build frontend
npm run build

# Build server
cd server
npm run build
```

## Project structure

```
bharatviz/
├── src/                    # Frontend React application
│   ├── components/         # Map components and UI
│   ├── lib/               # Utilities and helpers
│   └── pages/             # Application pages
├── server/                # REST API server
│   ├── src/               # API source code
│   └── public/            # GeoJSON data files
└── public/                # Static assets and templates
```

## Contributing

Contributions are welcome! This is an open-source project built for the community.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## Issues & support

Found a bug or have a feature request? Please use [GitHub Issues](https://github.com/saketlab/bharatviz/issues).

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- GeoJSON data from Government of India's LGD (Local Government Directory)
- Built with [React](https://react.dev/), [D3.js](https://d3js.org/), and [Vite](https://vite.dev/)
- Claude [Anthropic](https://www.anthropic.com/)
