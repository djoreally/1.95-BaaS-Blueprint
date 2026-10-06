# @baas-195/cli — `idb`

InvisibleDB CLI. Provision and manage agent-native backends from the terminal.
Same `InvisibleDBClient` contract as the MCP server — one interface, every surface.

## Install

```bash
# from the monorepo root
npm install
npm run build --workspace=@baas-195/cli
npm link --workspace=@baas-195/cli   # exposes `idb` globally
```

Or run without linking:

```bash
node packages/cli/dist/cli.js list
```

## Config

```bash
export INVISIBLED_API_URL="https://baas.innovarel.dev"
export INVISIBLED_API_KEY="<your-key>"
```

Without these, every command fails loudly instead of pretending to work.

## Usage

```bash
idb init            # interactive wizard: name -> provisions an instance
idb list            # list instances with status
idb keys <instance> # API keys + Dart/curl snippets (secret — don't share)
idb status          # control plane health
```

Example session:

```
$ idb init
Instance name (url-safe slug, e.g. acme-crm): acme-crm
Plan [seat/dev] (default: seat):
Provisioning…

Instance inst_1 (acme-crm.invisibledb.io) — status: provisioning
Poll `idb list` until status is "ready". Do not use it before then.

Next: idb keys inst_1
```

## Evidence rule

`idb list` shows the honest status. An instance in `provisioning` is not
ready — poll until it says `ready`. No evidence = not done.

## License

Apache-2.0
