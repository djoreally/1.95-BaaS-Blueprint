/**
 * InvisibleDB MCP tools. Each tool is a pure async handler taking a client —
 * the server wiring in index.ts only registers them. Handlers never claim
 * success beyond what the client returns (evidence rule).
 */
import { z } from 'zod';
import type { GateName, InvisibleDBClient } from './client.js';

export const provisionSchema = {
  name: z.string().min(1).max(63).describe(
    'URL-safe instance slug, e.g. "acme-crm"',
  ),
  domain: z.string().optional().describe(
    'Parent domain. Defaults to the platform domain.',
  ),
  plan: z.enum(['seat', 'dev']).optional().describe(
    'Billing plan. Defaults to "seat".',
  ),
};
export type ProvisionArgs = z.infer<z.ZodObject<typeof provisionSchema>>;

export const keysSchema = {
  instance: z.string().min(1).describe('Instance id or name'),
};
export type KeysArgs = z.infer<z.ZodObject<typeof keysSchema>>;

export const querySchema = {
  instance: z.string().min(1).describe('Instance id or name'),
  collection: z.string().min(1).describe('PocketBase collection to query'),
  filter: z.string().optional().describe(
    'PocketBase filter expression, e.g. \'status = "active"\'',
  ),
  page: z.number().int().positive().optional(),
  perPage: z.number().int().positive().max(200).optional(),
};
export type QueryArgs = z.infer<z.ZodObject<typeof querySchema>>;

const gateNames = [
  'typecheck',
  'unit-tests',
  'integration-tests',
  'security',
  'migration-safety',
  'production-readiness',
] as const;

export const gateCheckSchema = {
  instance: z.string().min(1).describe('Instance id or name'),
  gate: z.enum(gateNames).describe('ZeroAI lifecycle gate to check'),
};
export type GateCheckArgs = z.infer<z.ZodObject<typeof gateCheckSchema>>;

function text(payload: unknown): {
  content: Array<{ type: 'text'; text: string }>;
} {
  return { content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }] };
}

export async function handleProvision(client: InvisibleDBClient, args: ProvisionArgs) {
  const inst = await client.provision({
    name: args.name,
    domain: args.domain,
    plan: args.plan,
  });
  return text({
    ...inst,
    note:
      inst.status === 'provisioning'
        ? 'Instance is provisioning. Poll idb_list until status is "ready" — do not claim it works before then.'
        : undefined,
  });
}

export async function handleList(client: InvisibleDBClient) {
  const instances = await client.list();
  return text({ instances, count: instances.length });
}

export async function handleKeys(client: InvisibleDBClient, args: KeysArgs) {
  const keys = await client.keys(args.instance);
  // The apiKey is returned because the caller is the authenticated operator.
  // Never log it, never paste it into tickets or prompts beyond this session.
  return text(keys);
}

export async function handleQuery(client: InvisibleDBClient, args: QueryArgs) {
  const result = await client.query(args.instance, args.collection, args.filter, {
    page: args.page,
    perPage: args.perPage,
  });
  return text(result);
}

export async function handleGateCheck(client: InvisibleDBClient, args: GateCheckArgs) {
  const gate = args.gate as GateName;
  const result = await client.gateCheck(args.instance, gate);
  const interpretation =
    result.state === 'VERIFIED'
      ? `Gate "${gate}" passed with ${result.evidence.length} evidence ref(s).`
      : result.state === 'FAILED'
        ? `Gate "${gate}" FAILED — see evidence refs. Do not proceed past this gate.`
        : result.state === 'PARTIAL'
          ? `Gate "${gate}" is PARTIAL — evidence incomplete. Treat as not-passed.`
          : `Gate "${gate}" is UNKNOWN (no evidence). Treat as not-passed.`;
  return text({ ...result, interpretation });
}

export async function handleStatus(client: InvisibleDBClient) {
  return text(await client.status());
}

export interface ToolDef {
  name: string;
  description: string;
  schema: Record<string, z.ZodTypeAny>;
  handler: (client: InvisibleDBClient, args: never) => Promise<unknown>;
}

/** Registry consumed by index.ts. Handler args are validated by the SDK. */
export const tools: ToolDef[] = [
  {
    name: 'idb_provision',
    description:
      'Provision a new InvisibleDB backend instance (PocketBase + ZeroAI agent OS). Returns the instance record — status starts as "provisioning".',
    schema: provisionSchema,
    handler: handleProvision as ToolDef['handler'],
  },
  {
    name: 'idb_list',
    description: 'List all InvisibleDB instances with their provisioning status.',
    schema: {},
    handler: handleList as ToolDef['handler'],
  },
  {
    name: 'idb_keys',
    description:
      'Get API keys and SDK snippets (Dart + curl) for an instance. The apiKey is a secret — do not log or share it.',
    schema: keysSchema,
    handler: handleKeys as ToolDef['handler'],
  },
  {
    name: 'idb_query',
    description:
      'Query a PocketBase collection on an instance with an optional filter expression.',
    schema: querySchema,
    handler: handleQuery as ToolDef['handler'],
  },
  {
    name: 'idb_gate_check',
    description:
      'Run a ZeroAI lifecycle gate check against an instance. Returns evidence refs and an honest state: passed, failed, or unknown (no evidence).',
    schema: gateCheckSchema,
    handler: handleGateCheck as ToolDef['handler'],
  },
];
