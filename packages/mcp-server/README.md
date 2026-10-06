# @baas-195/mcp-server

InvisibleDB MCP server — provision and manage agent-native backends from any
MCP client (Claude Code, Claude Desktop, or your own agent). Stdio transport.

## Tools

| Tool | Purpose |
|---|---|
| `idb_provision` | Provision a new backend instance (`name`, optional `domain`, `plan`) |
| `idb_list` | List instances with status |
| `idb_keys` | API keys + Dart/curl snippets for an instance (secret — don't log it) |
| `idb_query` | Query a PocketBase collection (`instance`, `collection`, `filter`) |
| `idb_gate_check` | ZeroAI lifecycle gate check — returns evidence and an honest state |

Gate states follow the evidence rule: `passed`, `failed`, or `unknown`.
No evidence = `unknown`, never success.

## Setup

```bash
npm install
npm run build
```

The server reads its config from the environment:

- `INVISIBLED_API_URL` — control plane base URL, e.g. `https://baas.innovarel.dev`
- `INVISIBLED_API_KEY` — your InvisibleDB API key

Without them it fails loudly (`NoTransportError`) instead of pretending to work.

## Claude Code

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "invisibledb": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "INVISIBLED_API_URL": "https://baas.innovarel.dev",
        "INVISIBLED_API_KEY": "<your-key>"
      }
    }
  }
}
```

## Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "invisibledb": {
      "command": "node",
      "args": ["/absolute/path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "INVISIBLED_API_URL": "https://baas.innovarel.dev",
        "INVISIBLED_API_KEY": "<your-key>"
      }
    }
  }
}
```

## Architecture

All tools program against `InvisibleDBClient` (`src/client.ts`) — a typed
interface over the control plane REST API. The HTTP layer is a swappable
`HttpTransport`:

- `stubTransport()` — fails loudly until configured (default)
- `fetchTransport(baseUrl, apiKey)` — real fetch transport, ready when the API lands
- `fakeTransport(seed?)` — deterministic in-memory fake for tests

`src/tools.ts` holds pure handler functions (unit-tested); `src/index.ts`
only wires them to the MCP server.

## License

Apache-2.0
