import React, { useState } from 'react';
import { Copy, Check, Terminal, Server, Plug, Code2, Hash, ChartBar, Search, MapPin, Layers } from 'lucide-react';

interface MCPDocsProps {
  darkMode?: boolean;
}

const CopyButton: React.FC<{ text: string }> = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md transition-colors text-[hsl(28,8%,44%)] hover:bg-[hsl(35,14%,90%)] dark:text-[hsl(30,8%,52%)] dark:hover:bg-[hsl(25,8%,18%)]"
      aria-label={copied ? 'Copied' : 'Copy to clipboard'}
    >
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </button>
  );
};

const SectionAnchor: React.FC<{ id: string }> = ({ id }) => (
  <a href={`#${id}`} className="ml-2 opacity-0 group-hover:opacity-50 hover:!opacity-100 text-inherit transition-opacity" aria-hidden>
    <Hash className="h-4 w-4 inline" />
  </a>
);

const CodeBlock: React.FC<{ code: string }> = ({ code }) => (
  <div className="relative">
    <pre className="p-4 rounded-lg overflow-x-auto text-sm font-mono bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)]">
      <code>{code}</code>
    </pre>
    <CopyButton text={code} />
  </div>
);

const ToolRow: React.FC<{ name: string; description: string; input: string }> = ({ name, description, input }) => {
  const badgeClass = 'inline-block px-2 py-0.5 rounded text-xs font-mono bg-[hsl(28,42%,94%)] text-[hsl(28,48%,30%)] dark:bg-[hsl(28,20%,14%)] dark:text-[hsl(28,55%,62%)]';
  const tableCellClass = 'p-3 text-sm border-[hsl(35,18%,84%)] text-[hsl(28,8%,40%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,58%)]';
  return (
    <tr>
      <td className={`${tableCellClass} border font-mono text-xs`}>
        <span className={badgeClass}>{name}</span>
      </td>
      <td className={`${tableCellClass} border`}>{description}</td>
      <td className={`${tableCellClass} border font-mono text-xs hidden sm:table-cell`}>{input}</td>
    </tr>
  );
};

const ExampleCard: React.FC<{ title: string; prompt: string; code: string }> = ({ title, prompt, code }) => {
  const cardClass = 'p-5 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  return (
    <div className={cardClass}>
      <h4 className="text-base font-semibold mb-1 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">{title}</h4>
      <p className={`text-sm italic mb-3 ${textClass}`}>"{prompt}"</p>
      <CodeBlock code={code} />
    </div>
  );
};

const MCPDocs: React.FC<MCPDocsProps> = () => {
  const cardClass = 'p-5 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const tableHeaderClass = 'text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]';

  const remoteConfig = `{
  "mcpServers": {
    "bharatviz": {
      "type": "url",
      "url": "https://bharatviz.org/api/mcp"
    }
  }
}`;

  const localClaudeCodeConfig = `{
  "mcpServers": {
    "bharatviz": {
      "command": "node",
      "args": ["/path/to/bharatviz/server/dist/mcp.js"]
    }
  }
}`;

  const localClaudeDesktopConfig = `{
  "mcpServers": {
    "bharatviz": {
      "command": "node",
      "args": ["/absolute/path/to/bharatviz/server/dist/mcp.js"]
    }
  }
}`;

  const installFromSource = `git clone https://github.com/saketlab/bharatviz.git
cd bharatviz/server
npm install
npm run build`;

  const mapTools = [
    { name: 'list_available_maps', description: 'Lists all boundary sets with metadata (id, source, year, level, feature count)', input: 'None' },
    { name: 'list_states', description: 'Lists state/UT names for a given boundary type', input: 'mapId (string)' },
    { name: 'list_districts', description: 'Lists districts for a boundary type, optionally filtered by state', input: 'mapId, state?' },
    { name: 'render_states_map', description: 'Renders a state-level choropleth map as 300 DPI PNG', input: 'data [{state, value}], mapId?, colorScale?, title?, ...' },
    { name: 'render_districts_map', description: 'Renders a district-level choropleth. Works for any sub-state boundary: districts, subdistricts, constituencies, FSI forest units, ULBs.', input: 'data [{state, district, value}], mapId?, state?, colorScale?, ...' },
    { name: 'get_csv_template', description: 'Returns a CSV template with all entity names for a boundary type', input: 'mapId (string)' },
    { name: 'list_demos', description: 'Lists all showcase demo datasets (NFHS-5 health indicators, IHME AMR estimates)', input: 'level? ("states" | "districts")' },
    { name: 'get_demo_url', description: 'Returns a shareable URL that opens a demo dataset in the browser', input: 'demoId, baseUrl?' },
    { name: 'list_pincode_states', description: 'Lists all 38 states/UTs with pincode boundary data (~19,000 pincodes)', input: 'None' },
    { name: 'list_pincodes', description: 'Lists all pincodes for a state with post office name and district', input: 'state (string)' },
    { name: 'render_pincodes_map', description: 'Renders a pincode-level choropleth for a single state as 300 DPI PNG', input: 'data [{pincode, value}], state, colorScale?, ...' },
    { name: 'list_cities', description: 'Lists 130+ cities with ward/zone boundary data (2,900+ datasets)', input: 'None' },
    { name: 'list_wards', description: 'Lists all ward names for a given city', input: 'cityId (string)' },
    { name: 'render_city_map', description: 'Renders a ward-level choropleth for an Indian city as 300 DPI PNG', input: 'cityId, data [{ward, value}], colorScale?, ...' },
    { name: 'trace_district_evolution', description: 'Traces how a district evolved across Census years 1951–2011 (splits, merges, renames)', input: 'district, state?, year?, includeGeojson?' },
    { name: 'list_historical_district_names', description: 'Lists all district names in the Census transition data (1951–2011)', input: 'None' },
  ];

  const spatialTools = [
    { name: 'locate', description: 'Finds which boundary region(s) a point (lat/lon) falls inside, across one or more map layers simultaneously', input: 'lat, lon, mapIds? (array)' },
    { name: 'query_layer', description: 'Filters features in any map layer by property values or name substring', input: 'mapId, filters?, numericFilters?, limit?' },
    { name: 'spatial_join', description: 'Finds all features in a target layer that intersect features matched in a boundary layer', input: 'targetMapId, boundaryMapId, boundaryFilters?' },
    { name: 'nearby', description: 'Finds the N nearest feature centroids to a given lat/lon point', input: 'lat, lon, mapId, n?' },
    { name: 'get_area', description: 'Computes the geodetic area (km²) of any feature or set of features in a map layer', input: 'mapId, filters?, numericFilters?' },
    { name: 'get_layer_detail', description: 'Returns metadata for a map layer: feature count, property names, GeoJSON and GeoParquet download URLs', input: 'mapId (string)' },
  ];

  const analyticsTools = [
    { name: 'layer_schema', description: 'Returns the full column schema of any enriched map layer, classified into numeric, categorical, and text-ID columns', input: 'mapId (string)' },
    { name: 'summarize_layer', description: 'Computes descriptive statistics (min, max, mean, median, percentiles, stddev) for one or more numeric columns, with optional group-by and row filters', input: 'mapId, columns?, groupBy?, filters?, numericFilters?' },
    { name: 'rank_features', description: 'Ranks all features in a layer by a numeric column, returning a sorted table', input: 'mapId, column, order?, limit?, filters?, numericFilters?' },
    { name: 'correlate', description: 'Computes Pearson and Spearman correlations between two numeric columns, with optional scatter data and group breakdowns', input: 'mapId, x, y, filters?, numericFilters?, scatter?, groupBy?' },
    { name: 'compare_groups', description: 'Compares summary statistics across groups defined by a categorical column (e.g. by state, by region)', input: 'mapId, groupBy, columns?, filters?, numericFilters?' },
    { name: 'find_similar', description: 'Finds the N features most similar to a reference feature using Z-score normalized Euclidean distance across multiple numeric columns', input: 'mapId, referenceName, columns, n?, referenceState?, filters?' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h2 id="mcp-server" className={`text-2xl ${headingClass} mb-2 flex items-center gap-3 group`}>
          <Plug className="h-7 w-7" />
          MCP Server for AI Assistants
          <SectionAnchor id="mcp-server" />
        </h2>
        <p className={`${textClass} text-lg`}>
          Connect BharatViz to Claude, Codex, or any MCP-compatible AI assistant to generate India maps,
          query boundaries, and run demographic analytics from natural language. The server exposes
          22 tools across four categories: map rendering, boundary discovery, spatial queries,
          and in-memory analytics on 49 boundary layers.
        </p>
      </div>

      <div className="space-y-4">
        <h3 id="quick-start" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Quick Start
          <SectionAnchor id="quick-start" />
        </h3>

        <div className={cardClass}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            1. Add to your AI assistant (Recommended — no install needed)
          </h4>
          <p className={`${textClass} mb-3`}>
            Use the hosted MCP server at{' '}
            <code className="font-mono text-sm text-green-700 dark:text-[hsl(142,55%,65%)]">https://bharatviz.org/api/mcp</code>.
            No cloning or building required.
          </p>
          <p className="font-medium mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">
            Claude Code / Claude Desktop / any MCP client (<code className="text-sm text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">.mcp.json</code>):
          </p>
          <CodeBlock code={remoteConfig} />
        </div>

        <div className={`${cardClass} opacity-80`}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            Alternative: Local install (stdio transport)
          </h4>
          <CodeBlock code={installFromSource} />
          <div className="space-y-4 mt-4">
            <div>
              <p className="font-medium mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">
                Claude Code (<code className="text-sm text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">.mcp.json</code>):
              </p>
              <CodeBlock code={localClaudeCodeConfig} />
            </div>
            <div>
              <p className="font-medium mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">
                Claude Desktop (<code className="text-sm text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">claude_desktop_config.json</code>):
              </p>
              <CodeBlock code={localClaudeDesktopConfig} />
            </div>
          </div>
        </div>

        <div className={cardClass}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            2. Start asking questions
          </h4>
          <p className={`${textClass} mb-2`}>
            Once connected, ask your AI assistant anything about India's geography or demographics:
          </p>
          <ul className={`list-disc list-inside space-y-1 ${textClass}`}>
            <li>"Map female literacy rates across all Census 2011 districts using a diverging color scale"</li>
            <li>"Which 20 districts have the lowest literacy rates — and what do they have in common?"</li>
            <li>"How does SC/ST population share correlate with literacy across districts?"</li>
            <li>"Find districts with a deprivation profile similar to Alirajpur for targeting interventions"</li>
            <li>"Compare literacy and SC% across states — give me a state-level summary table"</li>
            <li>"What district does GPS coordinate 23.25°N, 80.12°E fall in, and what are its Census indicators?"</li>
            <li>"Rank all districts in Uttar Pradesh by SC population share, then map it"</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="map-tools" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Server className="h-5 w-5" />
          Map &amp; Boundary Tools (16)
          <SectionAnchor id="map-tools" />
        </h3>
        <p className={textClass}>Render choropleth maps, list boundary sets, get CSV templates, and trace district history.</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} border`}>Tool</th>
                <th className={`${tableHeaderClass} border`}>Description</th>
                <th className={`${tableHeaderClass} border hidden sm:table-cell`}>Input</th>
              </tr>
            </thead>
            <tbody>
              {mapTools.map(t => <ToolRow key={t.name} {...t} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="spatial-tools" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <MapPin className="h-5 w-5" />
          Spatial Query Tools (6)
          <SectionAnchor id="spatial-tools" />
        </h3>
        <p className={textClass}>Point-in-polygon, nearest-neighbour, spatial joins, area calculations, and layer metadata.</p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} border`}>Tool</th>
                <th className={`${tableHeaderClass} border`}>Description</th>
                <th className={`${tableHeaderClass} border hidden sm:table-cell`}>Input</th>
              </tr>
            </thead>
            <tbody>
              {spatialTools.map(t => <ToolRow key={t.name} {...t} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="analytics-tools" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <ChartBar className="h-5 w-5" />
          Analytics Tools (6)
          <SectionAnchor id="analytics-tools" />
        </h3>
        <p className={textClass}>
          In-memory statistical analysis on any enriched layer. The Census 2011 districts layer
          carries 267 columns — 75 demographic indicators and 192 language columns — making these
          tools especially powerful for demography and public health research.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} border`}>Tool</th>
                <th className={`${tableHeaderClass} border`}>Description</th>
                <th className={`${tableHeaderClass} border hidden sm:table-cell`}>Input</th>
              </tr>
            </thead>
            <tbody>
              {analyticsTools.map(t => <ToolRow key={t.name} {...t} />)}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="analytics-examples" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Code2 className="h-5 w-5" />
          Analytics Examples (Census 2011 Districts)
          <SectionAnchor id="analytics-examples" />
        </h3>
        <p className={textClass}>
          These examples show the MCP tool calls an AI assistant would make when answering
          demography and public health questions. The assistant discovers available columns via{' '}
          <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">layer_schema</code>{' '}
          first, then chains tools as needed.
        </p>

        <ExampleCard
          title="Discover available health and demographic indicators"
          prompt="What health and demographic indicators are available for Census 2011 districts?"
          code={`layer_schema({ mapId: "census-2011-districts" })

{
  "featureCount": 640,
  "numeric": [
    "population", "literate", "literacy_pct",
    "sc_population", "sc_pct", "st_population", "st_pct",
    "shannon_diversity", "effective_languages", "num_languages"
    // ... 267 total columns
  ],
  "categorical": ["state_name"],
  "textId": ["district_name", "district_code"]
}`}
        />

        <ExampleCard
          title="Rank districts by deprivation — lowest literacy first"
          prompt="Which 15 districts have the lowest literacy rates in India? Map them."
          code={`rank_features({
  mapId: "census-2011-districts",
  column: "literacy_pct",
  order: "asc",
  limit: 15
})
// 1. Alirajpur (MP)    28.77%
// 2. Bijapur (CG)      30.69%
// 3. Dantewada (CG)    33.68%
// 4. Kishanganj (BR)   38.48%
// ...

render_districts_map({
  mapId: "census-2011-districts",
  data: [ /* literacy_pct for all 640 districts */ ],
  title: "Literacy Rate — Census 2011",
  colorScale: "rdylgn"
})`}
        />

        <ExampleCard
          title="Deprivation clustering — SC/ST share vs. literacy"
          prompt="How does SC/ST population share correlate with literacy? Are the worst-off districts concentrated by state?"
          code={`correlate({
  mapId: "census-2011-districts",
  x: "st_pct",
  y: "literacy_pct",
  scatter: true,
  groupBy: "state_name"
})

{
  "n": 634,
  "pearson_r": -0.42,
  "spearman_r": -0.51,
  "x_mean": 12.2,
  "y_mean": 67.4,
  "scatter": [ ... ],
  "groups": {
    "Jharkhand":    { "x_mean": 28.0, "y_mean": 61.7 },
    "Chhattisgarh": { "x_mean": 35.8, "y_mean": 65.2 },
    "Odisha":       { "x_mean": 24.1, "y_mean": 63.1 }
  }
}`}
        />

        <ExampleCard
          title="State-level summary of key deprivation indicators"
          prompt="Give me a state-level table comparing SC%, ST%, and literacy — which states are hardest hit across all three?"
          code={`compare_groups({
  mapId: "census-2011-districts",
  groupBy: "state_name",
  columns: ["sc_pct", "st_pct", "literacy_pct"]
})

{
  "groups": {
    "Kerala":        { "sc_pct": { mean: 9.8  }, "st_pct": { mean: 1.5  }, "literacy_pct": { mean: 93.9 } },
    "Punjab":        { "sc_pct": { mean: 31.9 }, "st_pct": { mean: 0.0  }, "literacy_pct": { mean: 76.7 } },
    "Chhattisgarh":  { "sc_pct": { mean: 10.9 }, "st_pct": { mean: 35.8 }, "literacy_pct": { mean: 65.2 } },
    "Rajasthan":     { "sc_pct": { mean: 18.1 }, "st_pct": { mean: 13.5 }, "literacy_pct": { mean: 65.1 } },
    "Uttar Pradesh": { "sc_pct": { mean: 20.5 }, "st_pct": { mean: 0.6  }, "literacy_pct": { mean: 67.3 } }
  }
}`}
        />

        <ExampleCard
          title="Find comparable districts for intervention targeting or matched controls"
          prompt="We want to roll out a nutrition programme in Alirajpur, MP. Which other districts have a similar deprivation profile and could serve as comparison sites?"
          code={`find_similar({
  mapId: "census-2011-districts",
  referenceName: "Alirajpur",
  referenceState: "Madhya Pradesh",
  columns: ["literacy_pct", "sc_pct", "st_pct", "population"],
  n: 6
})

{
  "reference": { "district": "Alirajpur", "state": "Madhya Pradesh",
                 "literacy_pct": 28.8, "st_pct": 78.8 },
  "similar": [
    { "district": "Gumla",      "state": "Jharkhand",         "distance": 0.83 },
    { "district": "Nandurbar",  "state": "Maharashtra",       "distance": 0.91 },
    { "district": "Mayurbhanj", "state": "Odisha",            "distance": 1.04 },
    { "district": "West Siang", "state": "Arunachal Pradesh", "distance": 1.11 },
    { "district": "Dantewada",  "state": "Chhattisgarh",      "distance": 1.19 },
    { "district": "Simdega",    "state": "Jharkhand",         "distance": 1.23 }
  ]
}`}
        />

        <ExampleCard
          title="Summarize deprivation burden in high-ST districts"
          prompt="What are the literacy, SC%, and population statistics across districts with more than 50% Scheduled Tribe population?"
          code={`summarize_layer({
  mapId: "census-2011-districts",
  columns: ["literacy_pct", "sc_pct", "population"],
  numericFilters: [{ column: "st_pct", op: "gt", value: 50 }]
})

{
  "featureCount": 85,
  "columns": {
    "literacy_pct": { mean: 56.2, median: 57.8, p10: 37.1, p90: 72.4, stddev: 12.3 },
    "sc_pct":       { mean: 3.4,  median: 2.1,  p10: 0.3,  p90: 9.1,  stddev: 4.1  },
    "population":   { mean: 612000, median: 490000, p10: 150000, p90: 1350000 }
  }
}`}
        />

        <ExampleCard
          title="Geolocate a survey point and retrieve its Census indicators"
          prompt="A field survey collected data at 23.25°N, 80.12°E. Which district is this, and what are its baseline Census 2011 indicators?"
          code={`locate({
  lat: 23.25,
  lon: 80.12,
  mapIds: ["census-2011-districts", "lgd-districts"]
})
// → { district_name: "Mandla", state_name: "Madhya Pradesh" }

query_layer({
  mapId: "census-2011-districts",
  filters: { district_name: "Mandla", state_name: "Madhya Pradesh" }
})
// → population: 1054905, literacy_pct: 67.1, st_pct: 57.1, sc_pct: 3.8`}
        />

        <ExampleCard
          title="Within-state ranking and choropleth"
          prompt="Rank all districts in Uttar Pradesh by SC population share, then draw a map."
          code={`rank_features({
  mapId: "census-2011-districts",
  column: "sc_pct",
  order: "desc",
  filters: { state_name: "Uttar Pradesh" }
})
// Sitapur 34.8%, Hardoi 33.2%, Lakhimpur Kheri 32.6% ...

render_districts_map({
  mapId: "census-2011-districts",
  state: "Uttar Pradesh",
  data: [ /* sc_pct for all UP districts */ ],
  title: "Scheduled Caste Population Share — Uttar Pradesh (Census 2011)",
  colorScale: "purples"
})`}
        />

        <ExampleCard
          title="Healthcare facility access — nearest facilities to a survey point"
          prompt="Find the 10 nearest health facilities to a rural GPS point in Bundelkhand, and show which district they fall in."
          code={`nearby({
  lat: 25.10,
  lon: 79.85,
  mapId: "hotosm-health-facilities",
  n: 10
})
// Returns facilities sorted by distance with name, amenity, healthcare type,
// operator_type, adm1_name (state), adm2_name (district)

locate({
  lat: 25.10,
  lon: 79.85,
  mapIds: ["lgd-districts", "census-2011-districts"]
})
// → { district_name: "Chhatarpur", state_name: "Madhya Pradesh" }

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm2_name: "Chhatarpur" }
})
// Full facility list; count / population gives per-capita access ratio`}
        />

        <ExampleCard
          title="Pincode-level hospital density map"
          prompt="Show which pincodes in Pune district are within 5 km of a hospital, and map facility density by pincode."
          code={`list_pincodes({ state: "Maharashtra" })

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm2_name: "Pune", amenity: "hospital" }
})
// 87 hospitals with lat/lon

nearby({ lat: <pincode_lat>, lon: <pincode_lon>, mapId: "hotosm-health-facilities", n: 5 })
// Per-pincode centroid query; aggregate to get hospital count within radius

render_pincodes_map({
  state: "Maharashtra",
  data: [ { pincode: "411001", value: 12 }, { pincode: "411002", value: 3 }, ... ],
  title: "Hospitals within 5 km — Pune Pincodes",
  colorScale: "blues"
})`}
        />

        <ExampleCard
          title="Facility type breakdown by state"
          prompt="What types of health facilities are available in the hotosm layer, and how are they distributed across states?"
          code={`layer_schema({ mapId: "hotosm-health-facilities" })
// categorical: ["amenity", "healthcare", "operator_type", "adm1_name"]
// textId: ["name", "adm2_name"]

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm1_name: "Bihar", amenity: "clinic" },
  limit: 200
})
// 143 clinics in Bihar with name, location, operator_type`}
        />
      </div>

      <div className="space-y-4">
        <h3 id="discover-workflow" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Search className="h-5 w-5" />
          Recommended Workflow
          <SectionAnchor id="discover-workflow" />
        </h3>

        <div className={cardClass}>
          <ol className={`list-decimal list-inside space-y-3 ${textClass}`}>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Discover layers</strong> —
              call <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">list_available_maps</code> to
              see all boundary sets with their IDs, sources, and years.
            </li>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Inspect a layer</strong> —
              call <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">layer_schema</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">get_layer_detail</code> to
              see available columns and download URLs.
            </li>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Filter and rank</strong> —
              use <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">rank_features</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">query_layer</code> to
              identify features of interest.
            </li>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Analyze</strong> —
              run <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">correlate</code>,{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">compare_groups</code>, or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">find_similar</code> for statistics.
            </li>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Visualize</strong> —
              pass results to <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">render_districts_map</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">render_states_map</code> for
              a 300 DPI choropleth PNG.
            </li>
            <li>
              <strong className="text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Download raw data</strong> —
              use the <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">parquetUrl</code> from{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">get_layer_detail</code> for
              direct GeoParquet access in Python/R.
            </li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="data-layers" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Layers className="h-5 w-5" />
          Enriched Data Layers
          <SectionAnchor id="data-layers" />
        </h3>

        <div className={cardClass}>
          <p className={`${textClass} mb-4`}>
            Several boundary layers carry rich attribute data beyond just geometry, enabling
            in-memory analytics without downloading raw files.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
              <thead>
                <tr>
                  <th className="text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]">Map ID</th>
                  <th className="text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]">Features</th>
                  <th className="text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]">Columns</th>
                  <th className="text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]">Notable data</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { id: 'census-2011-districts', features: '640', cols: '267', data: 'Population, SC/ST%, literacy, 75 indicators, 192 language columns' },
                  { id: 'census-2011-states', features: '35', cols: '267', data: 'Same indicators aggregated to state level' },
                  { id: 'hotosm-health-facilities', features: '142,629', cols: '—', data: 'Hospitals, clinics, pharmacies — name, amenity, operator, district, state' },
                  { id: 'shrug-subdistricts', features: '~5,500', cols: 'varies', data: 'Sub-district level SHRUG Census 2011 data' },
                ].map(r => (
                  <tr key={r.id}>
                    <td className="p-3 text-sm border font-mono text-xs border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)] text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,58%)]">{r.id}</td>
                    <td className="p-3 text-sm border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)] text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,58%)]">{r.features}</td>
                    <td className="p-3 text-sm border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)] text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,58%)]">{r.cols}</td>
                    <td className="p-3 text-sm border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)] text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,58%)]">{r.data}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MCPDocs;
