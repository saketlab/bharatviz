#!/usr/bin/env node
/**
 * Minimal bridge: drive the BharatViz MCP server with ANY local Ollama model.
 *
 * Proves MCP is model-agnostic — no Claude/Anthropic involved. It connects to the
 * hosted MCP over Streamable HTTP, hands the tool list to the model as OpenAI-style
 * function specs, and runs the call → execute → feed-back loop until the model answers.
 *
 * Prereqs: `ollama serve` running with a tool-capable model pulled
 *   (e.g. `ollama pull qwen2.5:7b` — small 7B models below this are unreliable at tool use).
 *
 * Usage:
 *   node server/examples/ollama_mcp_chat.mjs "Which 5 districts have the lowest literacy?"
 *   MODEL=llama3.3 MCP_URL=https://bharatviz.saketlab.org/api/mcp node server/examples/ollama_mcp_chat.mjs "..."
 */
const MCP_URL = process.env.MCP_URL || 'https://bharatviz.saketlab.org/api/mcp';
const OLLAMA = process.env.OLLAMA_URL || 'http://localhost:11434';
const MODEL = process.env.MODEL || 'qwen2.5:7b';
const prompt = process.argv.slice(2).join(' ') || 'Which 5 districts have the lowest literacy rate in India?';

const H = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };

// Streamable HTTP returns either JSON or SSE-framed JSON — extract the JSON-RPC payload.
function parseRpc(text) {
  const line = text.split('\n').find(l => l.startsWith('data:')) ?? text;
  return JSON.parse(line.replace(/^data:\s*/, ''));
}

let sessionId = null;
async function mcp(method, params = {}, id = Math.floor(Math.random() * 1e6)) {
  const headers = sessionId ? { ...H, 'mcp-session-id': sessionId } : H;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) });
  if (!sessionId) sessionId = res.headers.get('mcp-session-id');
  return parseRpc(await res.text());
}

async function main() {
  await mcp('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'ollama-bridge', version: '1' } });
  await fetch(MCP_URL, { method: 'POST', headers: { ...H, 'mcp-session-id': sessionId }, body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} }) });

  const toolList = (await mcp('tools/list')).result.tools;
  const tools = toolList.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));
  console.log(`Connected: ${toolList.length} tools from ${MCP_URL}\nModel: ${MODEL}\nQ: ${prompt}\n`);

  const messages = [
    { role: 'system', content: 'You are a geospatial analyst for India. Use the provided BharatViz tools to answer. Call tools when data is needed; do not invent numbers.' },
    { role: 'user', content: prompt },
  ];

  for (let turn = 0; turn < 8; turn++) {
    const res = await fetch(`${OLLAMA}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, messages, tools, stream: false }),
    });
    const data = await res.json();
    if (data.error) { console.error('Ollama error:', data.error); return; }
    const msg = data.message;
    messages.push(msg);

    const calls = msg.tool_calls || [];
    if (!calls.length) { console.log('\n=== ANSWER ===\n' + (msg.content || '(empty)')); return; }

    for (const call of calls) {
      const { name, arguments: args } = call.function;
      console.log(`→ ${name}(${JSON.stringify(args)})`);
      let out;
      try {
        const r = await mcp('tools/call', { name, arguments: typeof args === 'string' ? JSON.parse(args) : args });
        out = r.error ? `ERROR: ${r.error.message}` : r.result.content.map(c => c.text ?? '[non-text]').join('\n');
      } catch (e) { out = `ERROR: ${e.message}`; }
      console.log(`   ${out.slice(0, 200).replace(/\n/g, ' ')}${out.length > 200 ? '…' : ''}`);
      messages.push({ role: 'tool', content: out.slice(0, 6000) });
    }
  }
  console.log('\n(stopped after 8 tool turns)');
}

main().catch(e => { console.error(e); process.exit(1); });
