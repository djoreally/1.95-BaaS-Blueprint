#!/usr/bin/env node
/**
 * idb — InvisibleDB CLI.
 *
 *   idb init            interactive wizard: name -> provisions an instance
 *   idb list            list instances with status
 *   idb keys <instance> print API keys + SDK snippets (secret — don't share)
 *   idb status          control plane health
 *
 * Config: INVISIBLED_API_URL + INVISIBLED_API_KEY (same as the MCP server).
 * Programs against InvisibleDBClient from @baas-195/mcp-server — the same
 * contract the MCP tools use.
 */
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import {
  clientFromEnv,
  type InstanceSummary,
  type InvisibleDBClient,
} from '@baas-195/mcp-server';

function usage(): never {
  console.error(`usage:
  idb init            provision an instance (interactive)
  idb list            list instances
  idb keys <instance> show API keys + snippets for an instance
  idb status          control plane health`);
  process.exit(2);
}

function table(instances: InstanceSummary[]): void {
  if (instances.length === 0) {
    console.log('No instances yet. Run `idb init` to provision one.');
    return;
  }
  const rows = instances.map((i) => ({
    id: i.id,
    name: i.name,
    fqdn: i.fqdn,
    status: i.status,
    plan: i.plan,
  }));
  console.table(rows);
}

async function cmdInit(client: InvisibleDBClient): Promise<void> {
  const rl = createInterface({ input, output });
  try {
    const name = (await rl.question('Instance name (url-safe slug, e.g. acme-crm): ')).trim();
    if (!/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(name)) {
      console.error('Invalid name: lowercase letters, digits, hyphens only.');
      process.exit(1);
    }
    const planAnswer = (await rl.question('Plan [seat/dev] (default: seat): ')).trim();
    const plan = planAnswer === 'dev' ? 'dev' : 'seat';
    console.log('Provisioning…');
    const inst = await client.provision({ name, plan });
    console.log(`\nInstance ${inst.id} (${inst.fqdn}) — status: ${inst.status}`);
    if (inst.status === 'provisioning') {
      console.log('Poll `idb list` until status is "ready". Do not use it before then.');
    }
    console.log(`\nNext: idb keys ${inst.id}`);
  } finally {
    rl.close();
  }
}

async function cmdKeys(client: InvisibleDBClient, instance: string): Promise<void> {
  const k = await client.keys(instance);
  console.log(`Instance: ${k.instanceId}`);
  console.log(`Base URL: ${k.baseUrl}`);
  console.log(`Admin UI: ${k.adminUrl}`);
  console.log(`Publishable key: ${k.publishableKey}  (safe in client code)`);
  if (k.secretKey) {
    console.log(`Secret key:      ${k.secretKey}  (server only — shown once, store in an env var)`);
  }
  console.log('\nDart:');
  console.log(k.dartSnippet);
  console.log('\ncurl:');
  console.log(k.restSnippet);
  console.error('\nwarning: the secret key is server-only — do not log, commit, or share it.');
}

async function main(): Promise<void> {
  const [, , cmd, ...rest] = process.argv;
  const client = clientFromEnv();
  switch (cmd) {
    case 'init':
      await cmdInit(client);
      break;
    case 'list':
      table(await client.list());
      break;
    case 'keys':
      if (!rest[0]) usage();
      await cmdKeys(client, rest[0] as string);
      break;
    case 'status': {
      const s = await client.status();
      console.log(`ok=${s.ok} version=${s.version} instances=${s.instances}`);
      break;
    }
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(`idb: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
