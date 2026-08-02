#!/usr/bin/env node
/**
 * BharatViz MCP Server - stdio transport
 *
 * For local use with Claude Code, Claude Desktop, etc.
 * For remote HTTP access, use the /mcp endpoint on the Express server instead.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMcpServer } from './mcpTools.js';
async function main() {
    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('BharatViz MCP Server running on stdio');
}
main().catch((error) => {
    console.error('Fatal error in BharatViz MCP server:', error);
    process.exit(1);
});
//# sourceMappingURL=mcp.js.map