# BharatViz Embedding Guide

This guide shows you how to embed BharatViz maps directly into any website, including GitHub Pages, without needing to download and upload image files.

**Key Feature**: The API **automatically detects** the map type (states, districts, or state-districts) from your CSV structure!

## Table of Contents

- [Quick Start](#quick-start)
- [Map Types](#map-types)
- [Method 1: iframe Embed](#method-1-iframe-embed)
- [Method 2: JavaScript Widget](#method-2-javascript-widget)
- [Method 3: Direct SVG](#method-3-direct-svg)
- [Data Hosting](#data-hosting)
- [Examples](#examples)
- [API Reference](#api-reference)

## Quick Start

The easiest way to embed a BharatViz map is to host your CSV data file on GitHub Pages (or any public URL) and use an iframe. The API will automatically detect the map type from your CSV structure:

```html
<!-- Auto-detects map type from CSV! -->
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://yourusername.github.io/yourrepo/data.csv&colorScale=viridis&title=My%20Map"
  width="800"
  height="600"
  frameborder="0"
  style="border: none;">
</iframe>
```

## Map Types

BharatViz supports three map types, which are **automatically detected** from your CSV structure:

### 1. States Map
**Displays**: All Indian states and union territories

**CSV Format**:
```csv
state,value
Maharashtra,82.9
Karnataka,75.6
Kerala,93.9
```

**Auto-detection**: Detected when CSV has only `state` and `value` columns

### 2. Districts Map (All India)
**Displays**: All districts across India

**CSV Format**:
```csv
state_name,district_name,value
Maharashtra,Mumbai,89.7
Karnataka,Bengaluru Urban,88.7
```

**Auto-detection**: Detected when CSV has `district` column

### 3. State-Districts Map (Single State)
**Displays**: Districts of a specific state

**CSV Format**: Same as Districts Map, but add the `state` parameter

**Trigger**: Add `&state=StateName` to your embed URL

## Method 1: iframe Embed

### Basic Usage

```html
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=YOUR_CSV_URL"
  width="800"
  height="600"
  frameborder="0">
</iframe>
```

### Parameters

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| `dataUrl` | **Required**. URL to your CSV data file | - | `https://example.com/data.csv` |
| `mapType` | Type of map (optional - auto-detected) | Auto-detected | `states`, `districts`, `state-districts` |
| `state` | State name (triggers state-districts mode) | - | `Rajasthan` |
| `boundary` | District boundary type | `LGD` | `LGD`, `NFHS4`, `NFHS5` |
| `colorScale` | Color scheme | `spectral` | `viridis`, `blues`, `reds`, etc. |
| `valueColumn` | Column name for numeric values | Auto-detected | `population`, `count`, etc. |
| `title` | Map title | Auto-detected from column name | `My Custom Title` |
| `legendTitle` | Legend label | Auto-detected from column name | `Population (%)` |
| `invertColors` | Invert color scale | `false` | `true`, `false` |
| `hideValues` | Hide numeric values | Varies by map type* | `true`, `false` |
| `hideStateNames` | Hide state names (states map) | `false` | `true`, `false` |
| `hideDistrictNames` | Hide district names (district maps) | Varies by map type* | `true`, `false` |
| `showStateBoundaries` | Show state borders (districts map) | `true` | `true`, `false` |

*Default visibility by map type:
- **States**: Names and values shown
- **Districts (all India)**: Names and values hidden
- **State-Districts (single state)**: Names and values shown

**Note**: The `mapType` parameter is optional. The API will automatically detect the map type from your CSV structure. Use the `state` parameter to trigger state-districts mode for district-level data.

### Examples

#### State-Level Map

```html
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://example.com/states.csv&colorScale=viridis&title=Literacy%20Rate&legendTitle=Percentage"
  width="800"
  height="600"
  frameborder="0">
</iframe>
```

#### District-Level Map (All India)

```html
<!-- Auto-detects 'districts' from CSV structure -->
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://example.com/districts.csv&colorScale=reds&title=Population%20Density&boundary=LGD"
  width="800"
  height="700"
  frameborder="0">
</iframe>
```

#### State-Districts Map (Single State)

```html
<!-- Auto-detects districts, then 'state' parameter triggers state-districts mode -->
<iframe
  src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://example.com/rajasthan.csv&state=Rajasthan&colorScale=blues&title=Rajasthan%20Districts&boundary=LGD"
  width="800"
  height="600"
  frameborder="0">
</iframe>
```

## Method 2: JavaScript Widget

For more control and a cleaner integration, use the JavaScript widget.

### Installation

Add the widget script to your HTML:

```html
<script src="https://bharatviz.saketlab.in/embed.js"></script>
```

### Basic Usage

```html
<!-- Container for the map -->
<div id="my-map"></div>

<!-- Include the widget -->
<script src="https://bharatviz.saketlab.in/embed.js"></script>

<!-- Embed the map -->
<script>
  BharatViz.embed({
    container: '#my-map',
    dataUrl: 'https://example.com/data.csv',
    colorScale: 'viridis',
    title: 'My Map',
    legendTitle: 'Values'
  });
</script>
```

### With Inline Data

You can also provide data directly instead of a URL:

```html
<div id="my-map"></div>

<script src="https://bharatviz.saketlab.in/embed.js"></script>
<script>
  BharatViz.embed({
    container: '#my-map',
    data: [
      { state: 'Maharashtra', value: 75.8 },
      { state: 'Karnataka', value: 85.5 },
      { state: 'Kerala', value: 96.2 }
    ],
    colorScale: 'viridis',
    title: 'Literacy Rate',
    legendTitle: 'Percentage (%)'
  });
</script>
```

### Widget Options

```javascript
BharatViz.embed({
  container: '#my-map',        // CSS selector for container

  // Data source (choose one)
  dataUrl: 'URL_TO_CSV',       // Option 1: URL to CSV file
  data: [{...}],               // Option 2: Inline data array

  // Map configuration
  mapType: 'states',           // Optional - auto-detected from CSV
                               // 'states', 'districts', 'state-districts'
  state: 'Rajasthan',          // State name (triggers state-districts mode)
  boundary: 'LGD',             // District boundary: 'LGD', 'NFHS4', 'NFHS5'
  valueColumn: 'population',   // Optional - specify column name for values
                               // Auto-detects if not provided

  // Visual options
  colorScale: 'viridis',       // Color scheme
  invertColors: false,         // Invert color scale
  title: 'My Map',             // Map title (auto-detected from valueColumn)
  legendTitle: 'Values',       // Legend title (auto-detected from valueColumn)
  hideValues: false,           // Hide numeric values (default varies by map type)
  hideStateNames: false,       // Hide state names (states map)
  hideDistrictNames: false,    // Hide district names (varies by map type)
  showStateBoundaries: true,   // Show state boundaries (districts map)

  // Embedding method
  method: 'inline',            // 'inline' or 'iframe'
  width: 800,                  // Width (for iframe method)
  height: 600                  // Height (for iframe method)
});
```

**Auto-detection Notes**:
- If your CSV has a `district` column → auto-detected as 'districts'
- If your CSV has only `state` and `value` → auto-detected as 'states'
- If you add `state` parameter with districts data → becomes 'state-districts'

### Helper Functions

Generate embed URLs and code:

```javascript
// Get embed URL
const url = BharatViz.getEmbedUrl({
  dataUrl: 'https://example.com/data.csv',
  colorScale: 'viridis',
  title: 'My Map'
});

// Get iframe embed code
const embedCode = BharatViz.getEmbedCode({
  dataUrl: 'https://example.com/data.csv',
  colorScale: 'viridis',
  width: 800,
  height: 600
});
console.log(embedCode);
// Output: <iframe src="..." width="800" height="600"></iframe>
```

## Method 3: Direct SVG

For the most lightweight option, embed SVG directly:

```html
<img
  src="https://bharatviz.saketlab.in/api/v1/embed/svg?dataUrl=https://example.com/data.csv&colorScale=viridis"
  alt="Map"
  style="max-width: 100%;">
```

Or use it in an `<object>` tag for interactive SVG:

```html
<object
  data="https://bharatviz.saketlab.in/api/v1/embed/svg?dataUrl=https://example.com/data.csv&colorScale=viridis"
  type="image/svg+xml"
  width="800"
  height="600">
</object>
```

## Data Hosting

### CSV Format

#### State-Level Data

```csv
state,value
Maharashtra,75.8
Karnataka,85.5
Kerala,96.2
Tamil Nadu,82.3
```

#### District-Level Data

```csv
state_name,district_name,value
Maharashtra,Mumbai,89.7
Maharashtra,Pune,86.2
Karnataka,Bengaluru Urban,88.7
Kerala,Thiruvananthapuram,93.0
```

### Hosting on GitHub Pages

1. **Create a repository** (or use an existing one)

2. **Add your CSV file** to the repository:
   ```
   your-repo/
   ├── data.csv
   └── index.html
   ```

3. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Select branch (usually `main`) and folder (`/` or `/docs`)
   - Save

4. **Your CSV URL** will be:
   ```
   https://yourusername.github.io/your-repo/data.csv
   ```

5. **Use in embed**:
   ```html
   <iframe
     src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://yourusername.github.io/your-repo/data.csv&colorScale=viridis"
     width="800"
     height="600">
   </iframe>
   ```

### Hosting Options

- **GitHub Pages**: Free, easy for public data
- **GitHub Gists**: Quick for small datasets
- **Your own server**: Full control, can use HTTPS
- **Cloud storage**: AWS S3, Google Cloud Storage, etc. (ensure CORS is enabled)

### CORS Considerations

If hosting on your own server, ensure CORS headers are set:

```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET
```

## Examples

### Complete GitHub Pages Example

**index.html**:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My India Map</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        h1 {
            text-align: center;
            color: #333;
        }
        .map-container {
            margin: 40px 0;
        }
    </style>
</head>
<body>
    <h1>State Literacy Rates in India</h1>

    <div class="map-container">
        <!-- Method 1: iframe -->
        <iframe
            src="https://bharatviz.saketlab.in/api/v1/embed?dataUrl=https://yourusername.github.io/your-repo/literacy.csv&colorScale=viridis&title=Literacy%20Rate&legendTitle=Percentage"
            width="100%"
            height="600"
            frameborder="0"
            style="border: none;">
        </iframe>
    </div>

    <!-- OR Method 2: JavaScript Widget -->
    <div id="my-map" class="map-container"></div>
    <script src="https://bharatviz.saketlab.in/embed.js"></script>
    <script>
        BharatViz.embed({
            container: '#my-map',
            dataUrl: 'literacy.csv', // Relative path in same repo
            colorScale: 'viridis',
            title: 'Literacy Rate',
            legendTitle: 'Percentage (%)'
        });
    </script>
</body>
</html>
```

**literacy.csv**:
```csv
state,value
Andhra Pradesh,67.7
Arunachal Pradesh,66.9
Assam,73.2
Bihar,63.8
Chhattisgarh,71.0
Goa,87.4
Gujarat,79.3
Haryana,76.6
Himachal Pradesh,83.8
Jharkhand,67.6
Karnataka,75.6
Kerala,93.9
Madhya Pradesh,70.6
Maharashtra,82.9
Manipur,79.8
Meghalaya,75.5
Mizoram,91.6
Nagaland,80.1
Odisha,73.5
Punjab,76.7
Rajasthan,67.1
Sikkim,82.2
Tamil Nadu,80.3
Telangana,66.5
Tripura,87.8
Uttar Pradesh,69.7
Uttarakhand,79.6
West Bengal,77.1
Delhi,86.3
```

### Multiple Maps on One Page

```html
<h2>Literacy Rate</h2>
<div id="literacy-map"></div>

<h2>Population Density</h2>
<div id="population-map"></div>

<script src="https://bharatviz.saketlab.in/embed.js"></script>
<script>
  // Literacy map
  BharatViz.embed({
    container: '#literacy-map',
    dataUrl: 'literacy.csv',
    colorScale: 'viridis',
    legendTitle: 'Literacy %'
  });

  // Population map
  BharatViz.embed({
    container: '#population-map',
    dataUrl: 'population.csv',
    colorScale: 'reds',
    legendTitle: 'Per km²'
  });
</script>
```

## API Reference

### Endpoints

#### GET /api/v1/embed

Returns HTML page with embedded map.

**Query Parameters**: See [iframe parameters](#parameters)

**Response**: HTML page

#### GET /api/v1/embed/svg

Returns raw SVG for embedding.

**Query Parameters**: Same as above

**Response**: SVG image

#### POST /api/v1/embed/generate

Generate embeddable content from posted data.

**Request Body**:
```json
{
  "data": [{"state": "Maharashtra", "value": 75.8}],
  "colorScale": "viridis",
  "title": "My Map",
  "format": "svg"
}
```

**Response**:
```json
{
  "success": true,
  "svg": "<svg>...</svg>"
}
```

### Color Scales

**Sequential**: `blues`, `greens`, `reds`, `oranges`, `purples`, `pinks`, `viridis`, `plasma`, `inferno`, `magma`

**Diverging**: `spectral`, `rdylbu`, `rdylgn`, `brbg`, `piyg`, `puor`

### District Boundary Types

- **LGD**: Local Government Directory (latest official boundaries)
- **NFHS5**: NFHS-5 survey boundaries (2019-21)
- **NFHS4**: NFHS-4 survey boundaries (2015-16)

## Support

- **Documentation**: https://bharatviz.saketlab.in
- **GitHub**: https://github.com/saketlab/bharatviz
- **Issues**: https://github.com/saketlab/bharatviz/issues

## License

MIT License - Free to use in any project
