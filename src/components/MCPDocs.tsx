import React, { useState } from 'react';
import { Copy, Check, Terminal, Server, Plug, Code2, Palette, Map, Link2, GitBranch } from 'lucide-react';

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

const CodeBlock: React.FC<{ code: string; language?: string }> = ({ code }) => (
  <div className="relative">
    <pre className="p-4 rounded-lg overflow-x-auto text-sm font-mono bg-[hsl(25,8%,9%)] text-[hsl(35,12%,90%)]">
      <code>{code}</code>
    </pre>
    <CopyButton text={code} />
  </div>
);

const CurlExample: React.FC<{ label: string; code: string }> = ({ label, code }) => (
  <div>
    <p className="font-medium mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">{label}</p>
    <CodeBlock code={code} />
  </div>
);

const MCPDocs: React.FC<MCPDocsProps> = () => {
  const cardClass = 'p-5 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const badgeClass = 'inline-block px-2 py-0.5 rounded text-xs font-mono bg-[hsl(28,42%,94%)] text-[hsl(28,48%,30%)] dark:bg-[hsl(28,20%,14%)] dark:text-[hsl(28,55%,62%)]';
  const tableHeaderClass = 'text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]';
  const tableCellClass = 'p-3 text-sm border-[hsl(35,18%,84%)] text-[hsl(28,8%,40%)] dark:border-[hsl(25,8%,14%)] dark:text-[hsl(30,8%,58%)]';

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

  const exampleStatesCall = `// Ask your AI assistant:
"Draw a map of India showing literacy rates by state
 using the viridis color scale"

// The assistant will call render_states_map with:
{
  "data": [
    {"state": "Kerala", "value": 93.91},
    {"state": "Delhi", "value": 86.21},
    {"state": "Maharashtra", "value": 82.34},
    {"state": "Tamil Nadu", "value": 80.09},
    {"state": "Bihar", "value": 63.82}
  ],
  "title": "Literacy Rate by State (%)",
  "colorScale": "viridis",
  "legendTitle": "Literacy Rate (%)"
}`;

  const exampleDistrictsCall = `// Ask your AI assistant:
"Show me a map of Kerala's districts with
 random population data"

// The assistant will call render_districts_map with:
{
  "data": [
    {"state": "Kerala", "district": "Ernakulam", "value": 3282388},
    {"state": "Kerala", "district": "Thiruvananthapuram", "value": 3307284},
    {"state": "Kerala", "district": "Kozhikode", "value": 3089543}
  ],
  "state": "Kerala",
  "title": "Kerala District Population",
  "colorScale": "blues"
}`;

  const mapIds = [
    { id: 'lgd-states', level: 'States', source: 'LGD (Latest Official)', year: '2024' },
    { id: 'lgd-districts', level: 'Districts', source: 'LGD (Latest Official)', year: '2024' },
    { id: 'nfhs5-states', level: 'States', source: 'NFHS-5', year: '2021' },
    { id: 'nfhs5-districts', level: 'Districts', source: 'NFHS-5', year: '2021' },
    { id: 'nfhs4-states', level: 'States', source: 'NFHS-4', year: '2016' },
    { id: 'nfhs4-districts', level: 'Districts', source: 'NFHS-4', year: '2016' },
    { id: 'census-2011-states', level: 'States', source: 'Census 2011', year: '2011' },
    { id: 'census-2011-districts', level: 'Districts', source: 'Census 2011', year: '2011' },
    { id: 'census-2001-states', level: 'States', source: 'Census 2001', year: '2001' },
    { id: 'census-2001-districts', level: 'Districts', source: 'Census 2001', year: '2001' },
    { id: 'census-1991-states', level: 'States', source: 'Census 1991', year: '1991' },
    { id: 'census-1991-districts', level: 'Districts', source: 'Census 1991', year: '1991' },
    { id: 'census-1981-states', level: 'States', source: 'Census 1981', year: '1981' },
    { id: 'census-1981-districts', level: 'Districts', source: 'Census 1981', year: '1981' },
    { id: 'census-1971-states', level: 'States', source: 'Census 1971', year: '1971' },
    { id: 'census-1971-districts', level: 'Districts', source: 'Census 1971', year: '1971' },
    { id: 'census-1961-states', level: 'States', source: 'Census 1961', year: '1961' },
    { id: 'census-1961-districts', level: 'Districts', source: 'Census 1961', year: '1961' },
    { id: 'census-1951-states', level: 'States', source: 'Census 1951', year: '1951' },
    { id: 'census-1951-districts', level: 'Districts', source: 'Census 1951', year: '1951' },
    { id: 'census-1941-states', level: 'States', source: 'Census 1941', year: '1941' },
    { id: 'census-1941-districts', level: 'Districts', source: 'Census 1941', year: '1941' },
    { id: 'census-1931-states', level: 'States', source: 'Census 1931 (Jolad et al.)', year: '1931' },
    { id: 'census-1931-districts', level: 'Districts', source: 'Census 1931 (Jolad et al.)', year: '1931' },
    { id: 'census-1921-states', level: 'States', source: 'Census 1921 (Jolad et al.)', year: '1921' },
    { id: 'census-1921-districts', level: 'Districts', source: 'Census 1921 (Jolad et al.)', year: '1921' },
    { id: 'census-1911-states', level: 'States', source: 'Census 1911 (Jolad et al.)', year: '1911' },
    { id: 'census-1911-districts', level: 'Districts', source: 'Census 1911 (Jolad et al.)', year: '1911' },
    { id: 'census-1901-states', level: 'States', source: 'Census 1901 (Jolad et al.)', year: '1901' },
    { id: 'census-1901-districts', level: 'Districts', source: 'Census 1901 (Jolad et al.)', year: '1901' },
    { id: 'census-1891-states', level: 'States', source: 'Census 1891 (Jolad et al.)', year: '1891' },
    { id: 'census-1891-districts', level: 'Districts', source: 'Census 1891 (Jolad et al.)', year: '1891' },
    { id: 'census-1881-states', level: 'States', source: 'Census 1881 (Jolad et al.)', year: '1881' },
    { id: 'census-1881-districts', level: 'Districts', source: 'Census 1881 (Jolad et al.)', year: '1881' },
    { id: 'census-1872-states', level: 'States', source: 'Census 1872 (Jolad et al.)', year: '1872' },
    { id: 'census-1872-districts', level: 'Districts', source: 'Census 1872 (Jolad et al.)', year: '1872' },
    { id: 'soi-states', level: 'States', source: 'Survey of India', year: '2020' },
    { id: 'soi-districts', level: 'Districts', source: 'Survey of India', year: '2020' },
    { id: 'bhuvan-states', level: 'States', source: 'ISRO Bhuvan', year: '2020' },
    { id: 'bhuvan-districts', level: 'Districts', source: 'ISRO Bhuvan', year: '2020' },
    { id: 'nsso-regions', level: 'Regions', source: 'NSSO', year: '2021' },
  ];

  const tools = [
    {
      name: 'list_available_maps',
      description: 'Lists all 41 boundary sets with metadata (id, source, year, level, feature count)',
      input: 'None',
    },
    {
      name: 'list_states',
      description: 'Lists state/UT names for a given boundary type',
      input: 'mapId (string)',
    },
    {
      name: 'list_districts',
      description: 'Lists districts for a boundary type, optionally filtered by state',
      input: 'mapId (string), state? (string)',
    },
    {
      name: 'render_states_map',
      description: 'Renders a state-level choropleth map as 300 DPI PNG',
      input: 'data [{state, value}], mapId?, colorScale?, title?, ...',
    },
    {
      name: 'render_districts_map',
      description: 'Renders a district-level choropleth (all-India or single state)',
      input: 'data [{state, district, value}], mapId?, state?, colorScale?, ...',
    },
    {
      name: 'get_csv_template',
      description: 'Returns a CSV template with all entity names for a boundary type',
      input: 'mapId (string)',
    },
    {
      name: 'list_demos',
      description: 'Lists all showcase demo datasets (NFHS-5 health indicators, IHME AMR estimates)',
      input: 'level? ("states" | "districts")',
    },
    {
      name: 'get_demo_url',
      description: 'Generates a shareable BharatViz URL that loads a demo dataset in the browser',
      input: 'demoId (string), baseUrl? (string)',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h2 className={`text-2xl ${headingClass} mb-2 flex items-center gap-3`}>
          <Plug className="h-7 w-7" />
          MCP Server for AI Assistants
        </h2>
        <p className={`${textClass} text-lg`}>
          Connect BharatViz to Claude, Codex, or any MCP-compatible AI assistant to generate
          India maps through natural language. The MCP server exposes 8 tools for listing maps,
          querying boundaries, rendering high-quality choropleth images, and generating shareable URLs.
          City ward maps for 2,900+ datasets across 1,000+ cities are available via the web UI.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Terminal className="h-5 w-5" />
          Quick Start
        </h3>

        <div className={cardClass}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            1. Add to your AI assistant (Recommended - no install needed)
          </h4>
          <p className={`${textClass} mb-3`}>
            Use the hosted MCP server at <code className="font-mono text-sm text-green-700 dark:text-[hsl(142,55%,65%)]">https://bharatviz.org/api/mcp</code>. No cloning or building required.
          </p>

          <div className="space-y-4">
            <div>
              <p className="font-medium mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">
                Claude Code / Claude Desktop / any MCP client (<code className="text-sm text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">.mcp.json</code>):
              </p>
              <CodeBlock code={remoteConfig} />
            </div>
          </div>
        </div>

        <div className={`${cardClass} opacity-80`}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            Alternative: Local install (stdio transport)
          </h4>
          <p className={`${textClass} mb-3`}>
            If you prefer to run the MCP server locally:
          </p>
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
            2. Start asking for maps
          </h4>
          <p className={`${textClass} mb-2`}>
            Once connected, simply ask your AI assistant to draw maps of India:
          </p>
          <ul className={`list-disc list-inside space-y-1 ${textClass}`}>
            <li>"Draw a map of India showing GDP by state"</li>
            <li>"Show me Kerala's districts colored by population density"</li>
            <li>"Create a dark mode map of literacy rates using the viridis color scale"</li>
            <li>"What maps are available for the 1971 Census boundaries?"</li>
            <li>"Give me a CSV template for LGD district boundaries"</li>
            <li>"Show ward-level data for Mumbai" (via web UI - 130+ cities available)</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Server className="h-5 w-5" />
          Available Tools
        </h3>

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
              {tools.map((tool) => (
                <tr key={tool.name}>
                  <td className={`${tableCellClass} border font-mono text-xs`}>
                    <span className={badgeClass}>{tool.name}</span>
                  </td>
                  <td className={`${tableCellClass} border`}>{tool.description}</td>
                  <td className={`${tableCellClass} border font-mono text-xs hidden sm:table-cell`}>{tool.input}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>


      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Code2 className="h-5 w-5" />
          Examples
        </h3>

        <div className={cardClass}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            State-level map
          </h4>
          <CodeBlock code={exampleStatesCall} />
        </div>

        <div className={cardClass}>
          <h4 className="text-lg font-semibold mb-3 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">
            Single-state district map
          </h4>
          <CodeBlock code={exampleDistrictsCall} />
        </div>
      </div>


      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Link2 className="h-5 w-5" />
          Shareable URLs
        </h3>

        <div className={cardClass}>
          <p className={`${textClass} mb-3`}>
            Every view in BharatViz is fully RESTful - all settings are persisted in the URL so you can bookmark, share, or embed any configuration.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
              <thead>
                <tr>
                  <th className={`${tableHeaderClass} border`}>Parameter</th>
                  <th className={`${tableHeaderClass} border`}>Applies to</th>
                  <th className={`${tableHeaderClass} border`}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { param: 'colorScale', tabs: 'All map tabs', desc: 'Color scale name (e.g. viridis, spectral, blues)' },
                  { param: 'invertColors', tabs: 'All map tabs', desc: 'Invert color scale (true/false)' },
                  { param: 'hideNames', tabs: 'States, State-Districts, Cities', desc: 'Hide region labels (true/false)' },
                  { param: 'hideValues', tabs: 'States, State-Districts, Cities', desc: 'Hide data values (true/false)' },
                  { param: 'darkMode', tabs: 'All tabs', desc: 'Enable dark mode (true/false)' },
                  { param: 'mapType', tabs: 'Districts, State-Districts', desc: 'Boundary set (e.g. LGD, census-2011-districts)' },
                  { param: 'showStateBoundaries', tabs: 'Districts', desc: 'Show state boundary outlines (true/false, default true)' },
                  { param: 'selectedState', tabs: 'State-Districts', desc: 'State to display (e.g. Maharashtra)' },
                  { param: 'city', tabs: 'Cities', desc: 'City name (e.g. Mumbai, Delhi)' },
                  { param: 'dataset', tabs: 'Cities', desc: 'City dataset ID (e.g. mumbai, delhi)' },
                  { param: 'dataUrl', tabs: 'States, Districts', desc: 'Load CSV data from a URL on page load' },
                ].map((row) => (
                  <tr key={row.param}>
                    <td className={`${tableCellClass} border font-mono text-xs`}>
                      <span className={badgeClass}>{row.param}</span>
                    </td>
                    <td className={`${tableCellClass} border text-xs`}>{row.tabs}</td>
                    <td className={`${tableCellClass} border`}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 space-y-2">
            <p className="font-medium text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Examples:</p>
            <CodeBlock code={`# Mumbai wards with viridis color scale in dark mode
https://bharatviz.org/cities?city=Mumbai&dataset=mumbai&colorScale=viridis&darkMode=true

# Maharashtra districts with Census 2011 boundaries
https://bharatviz.org/state-districts?selectedState=Maharashtra&mapType=census-2011-districts

# Load external CSV data into district view
https://bharatviz.org/districts?dataUrl=https://example.com/data.csv&colorScale=blues`} />
          </div>
        </div>
      </div>


      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Palette className="h-5 w-5" />
          Color Scales
        </h3>

        <div className={cardClass}>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Sequential</h4>
              <div className="space-y-1">
                {['blues', 'greens', 'reds', 'oranges', 'purples', 'pinks'].map(s => (
                  <div key={s} className={`font-mono text-sm ${textClass}`}>{s}</div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Perceptually Uniform</h4>
              <div className="space-y-1">
                {['viridis', 'plasma', 'inferno', 'magma'].map(s => (
                  <div key={s} className={`font-mono text-sm ${textClass}`}>{s}</div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-[hsl(28,20%,22%)] dark:text-[hsl(35,10%,82%)]">Diverging</h4>
              <div className="space-y-1">
                {['spectral', 'rdylbu', 'rdylgn', 'brbg', 'piyg', 'puor', 'aqi'].map(s => (
                  <div key={s} className={`font-mono text-sm ${textClass}`}>{s}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>


      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <GitBranch className="h-5 w-5" />
          District Evolution API
        </h3>

        <div className={cardClass}>
          <p className={`${textClass} mb-4`}>
            Trace how a district's name and boundaries changed across Indian Census years (1951–2011).
            Districts can split, merge, or be renamed — the API traces these changes forward and backward.
            An interactive Swagger UI is available at{' '}
            <a
              href="/api-docs"
              className="text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)] underline underline-offset-2"
            >
              /api-docs
            </a>.
          </p>

          <div className="space-y-5">
            <CurlExample
              label="Trace a district across all census years:"
              code={`curl "https://bharatviz.org/api/v1/district-evolution?district=Coimbatore&state=Tamil%20Nadu"`}
            />
            <CurlExample
              label="Get a single year's entry:"
              code={`curl "https://bharatviz.org/api/v1/district-evolution?district=24%20Parganas&state=West%20Bengal&year=1991"`}
            />
            <CurlExample
              label="Include GeoJSON boundary polygons for each year:"
              code={`curl "https://bharatviz.org/api/v1/district-evolution?district=Coimbatore&geojson=true"`}
            />
            <CurlExample
              label="Download the full deduplicated transition table (3,636 rows):"
              code={`curl -O "https://bharatviz.org/api/v1/district-evolution/data.csv"`}
            />
            <CurlExample
              label="Example response — Coimbatore split over time:"
              code={`{
  "query": { "district": "Coimbatore", "state": "Tamil Nadu" },
  "matches": [{
    "modern_state": "Tamil Nadu",
    "evolution": {
      "1951": { "state": "Tamil Nadu", "district": "Coimbatore" },
      "1961": { "state": "Tamil Nadu", "district": "Coimbatore" },
      "1971": { "state": "Tamil Nadu", "district": "Coimbatore" },
      "1981": { "state": "Tamil Nadu", "district": "Periyar / Coimbatore" },
      "1991": { "state": "Tamil Nadu", "district": "Periyar / Coimbatore" },
      "2001": { "state": "Tamil Nadu", "district": "Erode / Coimbatore" },
      "2011": { "state": "Tamil Nadu", "district": "Erode / Tiruppur / Coimbatore" }
    }
  }]
}`}
            />
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
              <thead>
                <tr>
                  <th className={`${tableHeaderClass} border`}>Parameter</th>
                  <th className={`${tableHeaderClass} border`}>Required</th>
                  <th className={`${tableHeaderClass} border`}>Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { param: 'district', req: 'Yes', desc: 'District name (case-insensitive)' },
                  { param: 'state', req: 'No', desc: 'Modern state name to narrow results' },
                  { param: 'year', req: 'No', desc: 'Census year: 1951 | 1961 | 1971 | 1981 | 1991 | 2001 | 2011' },
                  { param: 'geojson', req: 'No', desc: 'Attach WGS84 boundary polygons for each year (true/false)' },
                ].map((row) => (
                  <tr key={row.param}>
                    <td className={`${tableCellClass} border font-mono text-xs`}>
                      <span className={badgeClass}>{row.param}</span>
                    </td>
                    <td className={`${tableCellClass} border text-xs`}>{row.req}</td>
                    <td className={`${tableCellClass} border`}>{row.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>


      <div className="space-y-4">
        <h3 className={`text-xl ${headingClass} flex items-center gap-2`}>
          <Map className="h-5 w-5" />
          All 41 Available Map Boundaries
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-[hsl(35,18%,84%)] dark:border-[hsl(25,8%,14%)]">
            <thead>
              <tr>
                <th className={`${tableHeaderClass} border`}>Map ID</th>
                <th className={`${tableHeaderClass} border`}>Level</th>
                <th className={`${tableHeaderClass} border`}>Source</th>
                <th className={`${tableHeaderClass} border`}>Year</th>
              </tr>
            </thead>
            <tbody>
              {mapIds.map((m) => (
                <tr key={m.id}>
                  <td className={`${tableCellClass} border font-mono text-xs`}>{m.id}</td>
                  <td className={`${tableCellClass} border`}>{m.level}</td>
                  <td className={`${tableCellClass} border`}>{m.source}</td>
                  <td className={`${tableCellClass} border`}>{m.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default MCPDocs;
