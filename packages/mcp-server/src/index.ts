#!/usr/bin/env node
/**
 * InvisibleDB MCP server (stdio transport).
 *
 * Reads INVISIBLED_API_URL + INVISIBLED_API_KEY from the environment.
 * Without them the client fails loudly (NoTransportError) instead of
 * pretending to work.
 *
 * This module also re-exports the client contract so the CLI (and future
 * SDKs) program against the same interface — importing it has no side
 * effects; the server only starts when executed directly.
 */
import { pathToFileURL } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { clientFromEnv } from './client.js';
import { tools } from './tools.js';

export * from './client.js';
export { tools } from './tools.js';

async function serve(): Promise<void> {
  const server = new McpServer({ name: 'invisibledb', version: '0.1.0' });
  const client = clientFromEnv();

  for (const tool of tools) {
    server.tool(
      tool.name,
      tool.description,
      tool.schema,
      async (args) =>
        (await tool.handler(client, args as never)) as {
          content: Array<{ type: 'text'; text: string }>;
        },
    );
  }

  await server.connect(new StdioServerTransport());
}

const executedDirectly =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (executedDirectly) {
  serve().catch((err) => {
    console.error('invisibledb-mcp fatal:', err);
    process.exit(1);
  });
}
