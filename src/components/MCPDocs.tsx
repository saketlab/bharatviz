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

const ExampleCard: React.FC<{ title: string; prompt: string; answer: string; code: string }> = ({ title, prompt, answer, code }) => {
  const cardClass = 'p-5 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  return (
    <div className={cardClass}>
      <h4 className="text-base font-semibold mb-1 text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]">{title}</h4>
      <p className={`text-sm italic mb-2 ${textClass}`}>"{prompt}"</p>
      <p className="text-sm mb-3 flex gap-1.5 text-[hsl(28,24%,28%)] dark:text-[hsl(35,12%,78%)]">
        <span className="select-none font-semibold text-[hsl(28,62%,46%)] dark:text-[hsl(28,55%,56%)]" aria-hidden="true">→</span>
        <span>{answer}</span>
      </p>
      <CodeBlock code={code} />
    </div>
  );
};

const MCPDocs: React.FC<MCPDocsProps> = () => {
  const cardClass = 'p-5 border rounded-lg bg-white border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,9%)] dark:border-[hsl(25,8%,14%)]';
  const headingClass = 'font-bold text-[hsl(28,20%,14%)] dark:text-[hsl(35,12%,93%)]';
  const textClass = 'text-[hsl(28,8%,40%)] dark:text-[hsl(30,8%,60%)]';
  const tableHeaderClass = 'text-left p-3 font-semibold text-sm bg-[hsl(35,20%,97%)] text-[hsl(28,20%,22%)] border-[hsl(35,18%,84%)] dark:bg-[hsl(25,8%,12%)] dark:text-[hsl(35,10%,82%)] dark:border-[hsl(25,8%,14%)]';

  const MCP_URL = 'https://bharatviz.saketlab.org/api/mcp';

  const claudeCodeCliCommand = `claude mcp add --transport http bharatviz ${MCP_URL}`;

  const claudeCodeJsonConfig = `{
  "mcpServers": {
    "bharatviz": {
      "type": "url",
      "url": "${MCP_URL}"
    }
  }
}`;

  const claudeDesktopConfig = `{
  "mcpServers": {
    "bharatviz": {
      "type": "url",
      "url": "${MCP_URL}"
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "bharatviz": {
      "url": "${MCP_URL}"
    }
  }
}`;

  const continueConfig = `{
  "experimental": {
    "modelContextProtocolServers": [
      {
        "transport": {
          "type": "http",
          "url": "${MCP_URL}"
        }
      }
    ]
  }
}`;

  const codexCliConfig = `codex mcp add bharatviz ${MCP_URL}`;

  const codexJsonConfig = `{
  "mcpServers": {
    "bharatviz": {
      "url": "${MCP_URL}"
    }
  }
}`;

  const openaiAgentsConfig = `from agents import Agent, Runner
from agents.mcp import MCPServerHTTP

bharatviz = MCPServerHTTP(url="${MCP_URL}")

agent = Agent(
    name="BharatViz Agent",
    mcp_servers=[bharatviz],
)

result = Runner.run_sync(agent, "Map literacy rates across Census 2011 districts")
print(result.final_output)`;

  const pythonSdkConfig = `import anthropic

client = anthropic.Anthropic()

response = client.beta.messages.create(
    model="claude-opus-4-5",
    max_tokens=4096,
    tools=[],  # tools come from the MCP server
    mcp_servers=[
        {
            "type": "url",
            "url": "${MCP_URL}",
            "name": "bharatviz",
        }
    ],
    messages=[{"role": "user", "content": "Rank Indian districts by literacy rate"}],
    betas=["mcp-client-2025-04-04"],
)`;

  const genericHttpSnippet = `# Any HTTP MCP client — SSE endpoint
MCP endpoint: ${MCP_URL}
Transport:    HTTP / SSE (Streamable HTTP)
Auth:         None required`;

  const mapTools = [
    { name: 'list_available_maps', description: 'All boundary sets with id, source, year, level, and feature count', input: 'None' },
    { name: 'list_states', description: 'State/UT names for a given boundary type', input: 'mapId (string)' },
    { name: 'list_districts', description: 'Districts for a boundary type, optionally filtered by state', input: 'mapId, state?' },
    { name: 'render_states_map', description: 'State-level choropleth as 300 DPI PNG', input: 'data [{state, value}], mapId?, colorScale?, title?, ...' },
    { name: 'render_districts_map', description: 'District-level choropleth as 300 DPI PNG. Works for any sub-state boundary: districts, subdistricts, constituencies, FSI forest units, ULBs.', input: 'data [{state, district, value}], mapId?, state?, colorScale?, ...' },
    { name: 'get_csv_template', description: 'CSV template with all entity names for a boundary type — paste your values in column B', input: 'mapId (string)' },
    { name: 'list_demos', description: 'Built-in demo datasets: NFHS-5 health indicators, IHME AMR estimates', input: 'level? ("states" | "districts")' },
    { name: 'get_demo_url', description: 'Shareable URL that opens a demo dataset directly in the browser', input: 'demoId, baseUrl?' },
    { name: 'list_pincode_states', description: '38 states/UTs with pincode boundary data (~19,000 pincodes total)', input: 'None' },
    { name: 'list_pincodes', description: 'All pincodes for a state with post office name and district', input: 'state (string)' },
    { name: 'render_pincodes_map', description: 'Pincode-level choropleth for a single state as 300 DPI PNG', input: 'data [{pincode, value}], state, colorScale?, ...' },
    { name: 'list_cities', description: '130+ cities with ward/zone boundary data (2,900+ datasets)', input: 'None' },
    { name: 'list_wards', description: 'All ward names for a given city', input: 'cityId (string)' },
    { name: 'render_city_map', description: 'Ward-level choropleth for an Indian city as 300 DPI PNG', input: 'cityId, data [{ward, value}], colorScale?, ...' },
    { name: 'trace_district_evolution', description: 'How a district changed across Census years 1951–2011: splits, merges, renames', input: 'district, state?, year?, includeGeojson?' },
    { name: 'list_historical_district_names', description: 'All district names in the Census transition data (1951–2011)', input: 'None' },
  ];

  const spatialTools = [
    { name: 'locate', description: 'Which boundary region(s) a lat/lon point falls inside, across one or more layers at once', input: 'lat, lon, mapIds? (array)' },
    { name: 'query_layer', description: 'Filter features by property values or name substring', input: 'mapId, filters?, numericFilters?, limit?' },
    { name: 'spatial_join', description: 'All features in a target layer that intersect features matched in a boundary layer', input: 'targetMapId, boundaryMapId, boundaryFilters?' },
    { name: 'nearby', description: 'N nearest feature centroids to a lat/lon point', input: 'lat, lon, mapId, n?' },
    { name: 'get_area', description: 'Geodetic area (km²) of any feature or set of features', input: 'mapId, filters?, numericFilters?' },
    { name: 'get_layer_detail', description: 'Feature count, property names, GeoJSON and GeoParquet download URLs for a layer', input: 'mapId (string)' },
  ];

  const analyticsTools = [
    { name: 'layer_schema', description: 'Full column list for any enriched layer, split into numeric, categorical, and text-ID columns', input: 'mapId (string)' },
    { name: 'summarize_layer', description: 'Min, max, mean, median, percentiles, stddev for one or more numeric columns — supports group-by and row filters', input: 'mapId, columns?, groupBy?, filters?, numericFilters?' },
    { name: 'rank_features', description: 'All features sorted by a numeric column', input: 'mapId, column, order?, limit?, filters?, numericFilters?' },
    { name: 'correlate', description: 'Pearson and Spearman correlations between two numeric columns, with optional scatter data and per-group breakdowns', input: 'mapId, x, y, filters?, numericFilters?, scatter?, groupBy?' },
    { name: 'compare_groups', description: 'Summary stats for each group in a categorical column — e.g. compare districts by state', input: 'mapId, groupBy, columns?, filters?, numericFilters?' },
    { name: 'find_similar', description: 'N features closest to a reference using Z-score normalized Euclidean distance across multiple columns', input: 'mapId, referenceName, columns, n?, referenceState?, filters?' },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <div>
        <h2 id="mcp-server" className={`text-2xl ${headingClass} mb-2 flex items-center gap-3 group`}>
          <Plug className="h-7 w-7" />
          BharatViz MCP Server
          <SectionAnchor id="mcp-server" />
        </h2>
        <p className={`${textClass} text-lg mb-3`}>
          BharatViz has a hosted MCP server. Point any MCP-compatible client at it and you can
          generate India maps, query boundaries, and run demographic analytics from plain English.
          28 tools: map rendering, boundary lookup, spatial queries, and in-memory analytics
          across 60+ boundary layers.
        </p>
        <div className={`${cardClass} flex items-center gap-3`}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(28,8%,50%)] mb-1">MCP endpoint (HTTP / SSE)</p>
            <code className="font-mono text-sm text-green-700 dark:text-[hsl(142,55%,65%)] select-all">{MCP_URL}</code>
          </div>
        </div>
      </div>

      {/* ── Claude Code ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-claude-code" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Claude Code (CLI)
          <SectionAnchor id="setup-claude-code" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}><strong>Option A — one command</strong> (saves globally):</p>
          <CodeBlock code={claudeCodeCliCommand} />
          <p className={`${textClass} text-sm mt-4 mb-2`}><strong>Option B — config file</strong>: add to <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">.mcp.json</code> in your project root, or <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">~/.claude/claude.json</code> for global scope:</p>
          <CodeBlock code={claudeCodeJsonConfig} />
          <p className={`${textClass} text-sm mt-3`}>Run <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">/mcp</code> inside Claude Code to confirm <strong>bharatviz</strong> shows as connected.</p>
        </div>
      </div>

      {/* ── Claude Desktop ───────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-claude-desktop" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Claude Desktop
          <SectionAnchor id="setup-claude-desktop" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Open <strong>Settings → Developer → Edit Config</strong> and add the <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">mcpServers</code> block.
            Config file location:
          </p>
          <ul className={`text-xs mb-3 space-y-1 font-mono ${textClass}`}>
            <li><span className="text-[hsl(28,20%,40%)] dark:text-[hsl(30,8%,55%)]">macOS  </span> ~/Library/Application Support/Claude/claude_desktop_config.json</li>
            <li><span className="text-[hsl(28,20%,40%)] dark:text-[hsl(30,8%,55%)]">Windows</span> %APPDATA%\Claude\claude_desktop_config.json</li>
          </ul>
          <CodeBlock code={claudeDesktopConfig} />
          <p className={`${textClass} text-sm mt-3`}>
            <strong>Fully quit and relaunch</strong> Claude Desktop (Cmd+Q / Alt+F4, don't just close the window).
            A <strong>hammer icon</strong> in the chat input confirms MCP tools are active.
          </p>
        </div>
      </div>

      {/* ── Cursor ───────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-cursor" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Cursor
          <SectionAnchor id="setup-cursor" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Go to <strong>Cursor Settings → MCP → Add new MCP server</strong>, or add manually to <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">~/.cursor/mcp.json</code>:
          </p>
          <CodeBlock code={cursorConfig} />
          <p className={`${textClass} text-sm mt-3`}>
            Restart Cursor. In Agent mode, the bharatviz tools appear in the tool picker automatically.
          </p>
        </div>
      </div>

      {/* ── Windsurf ─────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-windsurf" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Windsurf (Codeium)
          <SectionAnchor id="setup-windsurf" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Open <strong>Windsurf Settings → Cascade → MCP Servers → Add Server</strong>.
            Choose <strong>Remote URL</strong> and paste the endpoint:
          </p>
          <CodeBlock code={MCP_URL} />
          <p className={`${textClass} text-sm mt-3`}>
            Name it <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">bharatviz</code>. Windsurf will discover all tools automatically the next time Cascade runs.
          </p>
        </div>
      </div>

      {/* ── Continue.dev ─────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-continue" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Continue.dev
          <SectionAnchor id="setup-continue" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Add to <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">~/.continue/config.json</code>:
          </p>
          <CodeBlock code={continueConfig} />
        </div>
      </div>

      {/* ── OpenAI Codex CLI ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-codex" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          OpenAI Codex (CLI)
          <SectionAnchor id="setup-codex" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}><strong>Option A — one command:</strong></p>
          <CodeBlock code={codexCliConfig} />
          <p className={`${textClass} text-sm mt-4 mb-2`}>
            <strong>Option B — config file.</strong> Add to <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">~/.codex/config.json</code>:
          </p>
          <CodeBlock code={codexJsonConfig} />
          <p className={`${textClass} text-sm mt-3`}>
            Codex discovers tools automatically on the next run. Use <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">--approval-mode auto-edit</code> so it can call BharatViz tools without prompting on each step.
          </p>
        </div>
      </div>

      {/* ── OpenAI Agents SDK ─────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-openai-agents" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          OpenAI Agents SDK (Python)
          <SectionAnchor id="setup-openai-agents" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Pass the MCP server to any <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">Agent</code> via <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">MCPServerHTTP</code>:
          </p>
          <CodeBlock code={openaiAgentsConfig} />
        </div>
      </div>

      {/* ── Anthropic Python SDK (direct) ─────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-python-sdk" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Terminal className="h-5 w-5" />
          Anthropic Python SDK
          <SectionAnchor id="setup-python-sdk" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            Pass <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">mcp_servers</code> in the beta messages API (requires <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">anthropic&gt;=0.40</code>):
          </p>
          <CodeBlock code={pythonSdkConfig} />
        </div>
      </div>

      {/* ── Generic / any other client ───────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="setup-generic" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Plug className="h-5 w-5" />
          Any other MCP client
          <SectionAnchor id="setup-generic" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-2`}>
            The server speaks standard <strong>Streamable HTTP (SSE)</strong>. No auth, no custom headers.
            Point any MCP client at:
          </p>
          <CodeBlock code={genericHttpSnippet} />
          <p className={`${textClass} text-sm mt-3`}>
            Clients that support only stdio transport can wrap the endpoint with{' '}
            <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">mcp-remote</code>:{' '}
            <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">npx mcp-remote {MCP_URL}</code>
          </p>
        </div>
      </div>

      {/* ── Example prompts ──────────────────────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="example-prompts" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Code2 className="h-5 w-5" />
          Example prompts
          <SectionAnchor id="example-prompts" />
        </h3>
        <div className={cardClass}>
          <p className={`${textClass} text-sm mb-3`}>
            Once connected, just describe what you want. The AI picks the right tools and chains them automatically:
          </p>
          <ul className={`list-disc list-inside space-y-2 text-sm ${textClass}`}>
            <li>"Map female literacy rates across all Census 2011 districts using a diverging color scale"</li>
            <li>"Which 20 districts have the lowest literacy rates — and what do they have in common?"</li>
            <li>"How does SC/ST population share correlate with literacy across districts?"</li>
            <li>"Find districts with a deprivation profile similar to Alirajpur for targeting interventions"</li>
            <li>"Compare literacy and SC% across states — give me a state-level summary table"</li>
            <li>"What district does GPS coordinate 23.25°N, 80.12°E fall in, and what are its Census indicators?"</li>
            <li>"Rank all districts in Uttar Pradesh by SC population share, then map it"</li>
            <li>"Find the 10 nearest hospitals to a rural point in Bundelkhand"</li>
            <li>"Show PMGSY road access vs. PM2.5 pollution at the district level — is there a pattern?"</li>
            <li>"Does the Meta wealth index predict literacy across districts? And are tribal districts poorer?"</li>
            <li>"Is air pollution (PM2.5) correlated with lower literacy at the district level?"</li>
          </ul>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="map-tools" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Server className="h-5 w-5" />
          Map &amp; Boundary Tools (16)
          <SectionAnchor id="map-tools" />
        </h3>
        <p className={textClass}>Render maps, list boundary sets, get CSV templates, trace district history.</p>

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
        <p className={textClass}>Point-in-polygon lookups, nearest-neighbour search, spatial joins, area calculations, layer metadata.</p>

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
          In-memory stats on any enriched layer. Census 2011 districts has 267 columns (75 demographic indicators
          and 192 language columns), so these tools do real work for demography and public health research.
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
          What the actual tool calls look like for real demography questions. The AI starts with{' '}
          <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">layer_schema</code>{' '}
          to discover columns, then chains whatever it needs.
        </p>

        <ExampleCard
          title="Discover available health and demographic indicators"
          prompt="What health and demographic indicators are available for Census 2011 districts?"
          answer="Returns the full column list for all 640 districts — population, literacy, SC/ST shares, language diversity, and 100+ language columns."
          code={`layer_schema({ mapId: "census-2011-enriched" })

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
          answer="Returns all 640 districts ranked ascending — the tribal belt of MP and Chhattisgarh dominates, with Alirajpur (MP) lowest at 28.8%. The follow-up renders a 300 DPI choropleth."
          code={`rank_features({
  mapId: "census-2011-enriched",
  column: "literacy_pct",
  order: "asc",
  limit: 15
})
// 1. Alirajpur (MP)     28.77%
// 2. Bijapur (CG)       34.06%
// 3. Jhabua (MP)        34.35%
// 4. Dantewada (CG)     35.84%
// ...

render_districts_map({
  mapId: "census-2011-enriched",
  data: [ /* literacy_pct for all 640 districts */ ],
  title: "Literacy Rate — Census 2011",
  colorScale: "rdylgn"
})`}
        />

        <ExampleCard
          title="Deprivation clustering — SC/ST share vs. literacy"
          prompt="How does SC/ST population share correlate with literacy? Are the worst-off districts concentrated by state?"
          answer="Returns a weak negative correlation nationally (Pearson −0.17 across 640 districts) — tribal share alone is a soft predictor of literacy; the effect is driven by specific state clusters, not a clean linear trend."
          code={`correlate({
  mapId: "census-2011-enriched",
  x: "st_pct",
  y: "literacy_pct",
  scatter: true
})

{
  "n": 640,
  "pearson_r": -0.175,
  "spearman_r": -0.183,
  "x_mean": 13.0,
  "y_mean": 62.5,
  "scatter": [ ... ]
}`}
        />

        <ExampleCard
          title="State-level summary of key deprivation indicators"
          prompt="Give me a state-level table comparing SC%, ST%, and literacy — which states are hardest hit across all three?"
          answer="Returns per-state means across ~36 states — a ~34-point literacy gap from Bihar (50.4%) to Kerala (84.1%), with Punjab carrying the highest SC share and the NE states near-fully tribal."
          code={`compare_groups({
  mapId: "census-2011-enriched",
  groupBy: "state_name",
  columns: ["sc_pct", "st_pct", "literacy_pct"]
})

{
  "groups": {
    "Kerala":  { "sc_pct": { mean: 9.0  }, "st_pct": { mean: 2.6  }, "literacy_pct": { mean: 84.1 } },
    "Punjab":  { "sc_pct": { mean: 32.9 }, "st_pct": { mean: 0.0  }, "literacy_pct": { mean: 66.5 } },
    "Mizoram": { "sc_pct": { mean: 0.1  }, "st_pct": { mean: 94.8 }, "literacy_pct": { mean: 75.0 } },
    "Bihar":   { "sc_pct": { mean: 16.1 }, "st_pct": { mean: 1.3  }, "literacy_pct": { mean: 50.4 } }
  }
}`}
        />

        <ExampleCard
          title="Find comparable districts for intervention targeting or matched controls"
          prompt="We want to roll out a nutrition programme in Alirajpur, MP. Which other districts have a similar deprivation profile and could serve as comparison sites?"
          answer="Returns the nearest-neighbour districts in the chosen feature space — Alirajpur's closest twins are other high-ST, low-literacy districts in MP and the Bastar region of Chhattisgarh."
          code={`find_similar({
  mapId: "census-2011-enriched",
  referenceName: "Alirajpur",
  referenceState: "Madhya Pradesh",
  columns: ["literacy_pct", "sc_pct", "st_pct", "population"],
  n: 6
})

{
  "reference": { "district": "Alirajpur", "state": "Madhya Pradesh",
                 "literacy_pct": 28.8, "st_pct": 89.0 },
  "similar": [
    { "district": "Jhabua",                  "state": "Madhya Pradesh", "distance": 0.61 },
    { "district": "Bijapur",                 "state": "Chhattisgarh",   "distance": 0.68 },
    { "district": "Dakshin Bastar Dantewada","state": "Chhattisgarh",   "distance": 0.83 }
    // ... 3 more
  ]
}`}
        />

        <ExampleCard
          title="Summarize deprivation burden in high-ST districts"
          prompt="What are the literacy, SC%, and population statistics across districts with more than 50% Scheduled Tribe population?"
          answer="Returns aggregate statistics over the 90 tribal-majority districts (ST > 50%) — averaging 58.4% literacy, well below the all-India district mean of 62.5%."
          code={`summarize_layer({
  mapId: "census-2011-enriched",
  columns: ["literacy_pct", "sc_pct", "population"],
  numericFilters: [{ column: "st_pct", op: "gt", value: 50 }]
})

{
  "featureCount": 90,
  "columns": {
    "literacy_pct": { mean: 58.5, median: 58.0, p10: 39.4, p90: 76.1, stddev: 12.1 },
    "sc_pct":       { mean: 3.4,  median: 2.1,  p10: 0.3,  p90: 9.1,  stddev: 4.1  },
    "population":   { mean: 612000, median: 490000, p10: 150000, p90: 1350000 }
  }
}`}
        />

        <ExampleCard
          title="Geolocate a survey point and retrieve its Census indicators"
          prompt="A field survey collected data at 23.25°N, 80.12°E. Which district is this, and what are its baseline Census 2011 indicators?"
          answer="The point falls in Jabalpur, Madhya Pradesh; the follow-up query returns its baseline Census 2011 indicators (population 2.46M, 71.3% literacy)."
          code={`locate({
  lat: 23.25,
  lon: 80.12,
  mapIds: ["census-2011-enriched", "lgd-districts"]
})
// → { district_name: "Jabalpur", state_name: "Madhya Pradesh" }

query_layer({
  mapId: "census-2011-enriched",
  filters: { district_name: "Jabalpur", state_name: "Madhya Pradesh" }
})
// → population: 2463289, literacy_pct: 71.31, st_pct: 15.23, sc_pct: 14.13`}
        />

        <ExampleCard
          title="Within-state ranking and choropleth"
          prompt="Rank all districts in Uttar Pradesh by SC population share, then draw a map."
          answer="Returns UP's 71 districts ranked by SC share — Kaushambi leads at 34.7% — then renders a single-state choropleth."
          code={`rank_features({
  mapId: "census-2011-enriched",
  column: "sc_pct",
  order: "desc",
  filters: { state_name: "Uttar Pradesh" }
})
// Kaushambi 34.7%, Sitapur 32.3%, Hardoi 31.1%, Unnao 30.5% ...

render_districts_map({
  mapId: "census-2011-enriched",
  state: "Uttar Pradesh",
  data: [ /* sc_pct for all UP districts */ ],
  title: "Scheduled Caste Population Share — Uttar Pradesh (Census 2011)",
  colorScale: "purples"
})`}
        />

        <ExampleCard
          title="Healthcare facility access — nearest facilities to a survey point"
          prompt="Find the 10 nearest health facilities to a rural GPS point in Bundelkhand, and show which district they fall in."
          answer="Returns the 10 closest facilities sorted by distance (nearest ≈ 7 km); the point sits in Mahoba district, UP — combine with the per-district facility count to get a per-capita access ratio."
          code={`nearby({
  lat: 25.10,
  lon: 79.85,
  mapId: "hotosm-health-facilities",
  n: 10
})
// Returns facilities sorted by distance with name, amenity, healthcare type,
// operator_type, adm1_name (state), adm2_name (district)
// → nearest: "SubCentre, Bhandra" ~6.9 km, adm2_name: "Mahoba"

locate({
  lat: 25.10,
  lon: 79.85,
  mapIds: ["lgd-districts", "census-2011-enriched"]
})
// → { district_name: "Mahoba", state_name: "Uttar Pradesh" }

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm2_name: "Mahoba" }
})
// Full facility list; count / population gives per-capita access ratio`}
        />

        <ExampleCard
          title="Pincode-level hospital density map"
          prompt="Show which pincodes in Pune district are within 5 km of a hospital, and map facility density by pincode."
          answer="Combines a pincode list, a district-filtered hospital query, and per-pincode radius counts into a density choropleth. Filter health facilities by adm2_name (plain district names like 'Pune') — adm1_name carries diacritics."
          code={`list_pincodes({ state: "Maharashtra" })

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm2_name: "Pune", amenity: "hospital" }
})
// hospitals in Pune district with lat/lon

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
          answer="The schema exposes facility type (amenity: 36 values incl. hospital, clinic, pharmacy), operator_type, and state/district names across 142,629 facilities; filter to drill into one state and type."
          code={`layer_schema({ mapId: "hotosm-health-facilities" })
// categorical: ["amenity", "operator_type", "adm1_name"]
// textId: ["name", "adm2_name", "healthcare"]

query_layer({
  mapId: "hotosm-health-facilities",
  filters: { adm1_name: "Bihar", amenity: "clinic" },
  limit: 200
})
// clinics in Bihar with name, location, operator_type`}
        />
      </div>

      {/* ── Cross-layer crosstalk examples ──────────────────────────────── */}
      <div className="space-y-3">
        <h3 id="crosstalk-examples" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Code2 className="h-5 w-5" />
          Cross-layer: wealth, environment &amp; demographics
          <SectionAnchor id="crosstalk-examples" />
        </h3>
        <div className={cardClass}>
          <p className={`text-sm ${textClass}`}>
            Each district layer is one row per district on a shared key, so <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">correlate</code> can
            join a column from <em>another</em> layer with <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">yMapId</code> —
            so the Meta wealth index (<code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">shrug-facebook</code>) and
            pollution (<code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">shrug-environment</code>) can be tested against Census literacy and tribal share. Figures below are live results across 600 matched districts.
          </p>
        </div>

        <ExampleCard
          title="Does wealth track literacy? (Meta RWI × Census)"
          prompt="Across districts, does the Meta Relative Wealth Index predict literacy?"
          answer="Yes — a clear positive link: Pearson +0.47 across 600 districts. Wealthier districts are consistently more literate."
          code={`correlate({
  mapId: "shrug-facebook",
  x: "facebook-rwi__facebook_mean_rwi",
  yMapId: "census-2011-enriched",   // join the other layer per district
  y: "literacy_pct"
})

{ "n": 600, "pearson_r": 0.4654, "spearman_r": 0.4325,
  "x_mean": -0.05, "y_mean": 62.37 }`}
        />

        <ExampleCard
          title="Are tribal districts poorer? (Meta RWI × ST share)"
          prompt="Do districts with a higher Scheduled Tribe share have lower wealth?"
          answer="Strongly — Spearman −0.58: tribal-majority districts cluster at the bottom of the Meta wealth index, quantifying the ST wealth gap."
          code={`correlate({
  mapId: "shrug-facebook",
  x: "facebook-rwi__facebook_mean_rwi",
  yMapId: "census-2011-enriched",
  y: "st_pct"
})

{ "n": 600, "pearson_r": -0.4574, "spearman_r": -0.5849,
  "x_mean": -0.05, "y_mean": 17.44 }`}
        />

        <ExampleCard
          title="Air pollution vs literacy (PM2.5 × Census)"
          prompt="Are higher-pollution districts also lower-literacy? Map the overlap."
          answer="Weak-to-moderate negative link (Pearson −0.29): the high-PM2.5 Indo-Gangetic plain also runs below-average on literacy."
          code={`correlate({
  mapId: "shrug-environment",
  x: "pm25__pm25_mean",
  yMapId: "census-2011-enriched",
  y: "literacy_pct"
})

{ "n": 600, "pearson_r": -0.2929, "spearman_r": -0.3237,
  "x_mean": 46.67, "y_mean": 62.37 }`}
        />

        <ExampleCard
          title="Night-time lights as a development proxy (VIIRS × Census)"
          prompt="Do brighter (more economically active) districts have higher literacy?"
          answer="A mild positive signal (Pearson +0.19) — nightlight intensity tracks literacy loosely, so it's a coarse development proxy, not a substitute for it."
          code={`correlate({
  mapId: "shrug-environment",
  x: "viirs-annual__viirs_annual_mean",
  yMapId: "census-2011-enriched",
  y: "literacy_pct"
})

{ "n": 600, "pearson_r": 0.1937, "spearman_r": 0.1908,
  "x_mean": 1.14, "y_mean": 62.37 }`}
        />
      </div>

      <div className="space-y-4">
        <h3 id="discover-workflow" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Search className="h-5 w-5" />
          Typical workflow
          <SectionAnchor id="discover-workflow" />
        </h3>

        <div className={cardClass}>
          <ol className={`list-decimal list-inside space-y-3 ${textClass}`}>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">list_available_maps</code>:
              all boundary sets with IDs, sources, and years.
            </li>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">layer_schema</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">get_layer_detail</code>:
              columns and download URLs for a specific layer.
            </li>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">rank_features</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">query_layer</code>:
              filter down to the features you care about.
            </li>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">correlate</code>,{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">compare_groups</code>, or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">find_similar</code>:
              run statistics.
            </li>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">render_districts_map</code> or{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">render_states_map</code>:
              300 DPI choropleth PNG.
            </li>
            <li>
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">parquetUrl</code> from{' '}
              <code className="font-mono text-xs text-[hsl(28,55%,42%)] dark:text-[hsl(35,55%,60%)]">get_layer_detail</code>:
              GeoParquet for Python/R if you want the raw data.
            </li>
          </ol>
        </div>
      </div>

      <div className="space-y-4">
        <h3 id="data-layers" className={`text-xl ${headingClass} flex items-center gap-2 group`}>
          <Layers className="h-5 w-5" />
          Layers with attribute data
          <SectionAnchor id="data-layers" />
        </h3>

        <div className={cardClass}>
          <p className={`${textClass} mb-4`}>
            These layers have columns you can analyze directly without downloading.
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
                  { id: 'census-2011-enriched', features: '640', cols: '267', data: 'Population, SC/ST%, literacy, 75 indicators, 192 language columns' },
                  { id: 'census-2011-states', features: '35', cols: '267', data: 'Same indicators aggregated to state level' },
                  { id: 'hotosm-health-facilities', features: '142,629', cols: '—', data: 'Hospitals, clinics, pharmacies — name, amenity, operator, district, state' },
                  { id: 'shrug-facebook', features: '641', cols: '12', data: 'Meta Relative Wealth Index (RWI) per district — facebook-rwi__facebook_mean_rwi' },
                  { id: 'shrug-environment', features: '641', cols: '38', data: 'PM2.5 (pm25__pm25_mean), nightlights (viirs/DMSP), NDVI, elevation, ruggedness' },
                  { id: 'shrug-secc', features: '641', cols: '120+', data: 'SECC 2012 rural/urban poverty, housing, income source, education shares' },
                  { id: 'shrug-economic', features: '641', cols: '400+', data: 'Economic Census 1990–2013 — firm counts, employment by sector and ownership' },
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
