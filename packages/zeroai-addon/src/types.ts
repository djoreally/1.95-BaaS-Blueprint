/**
 * Core ZeroAI types. ZeroAI is the deterministic operating system around AI
 * models: the model reasons, these types (and the runtime that enforces them)
 * control state, execution, permissions, memory, evidence, and certification.
 *
 * Philosophy: inference proposes. Deterministic systems decide.
 * Evidence proves. Memory preserves. Policy authorizes.
 */

/** Risk tier carried on every intent contract. */
export type RiskLevel = 'low' | 'medium' | 'high';

/** A single acceptance criterion on an intent contract. */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  /** When true, the criterion cannot pass without attached evidence. */
  evidenceRequired: boolean;
}

/**
 * Authority verbs the policy broker understands. The model may request any of
 * these; it cannot grant them to itself.
 */
export type AgentAction =
  | 'READ'
  | 'WRITE'
  | 'DELETE'
  | 'DEPLOY'
  | 'SEND_EMAIL'
  | 'CHARGE_CARD'
  | 'MERGE_PR'
  | 'MODIFY_DATABASE'
  | 'ROTATE_SECRET';

/** A pointer to an external resource an intent may touch. */
export interface ResourceRef {
  kind: string;
  id: string;
}

/**
 * IntentContract: natural language turned into a typed contract BEFORE any
 * execution. The model interprets the request; the runtime owns the contract.
 */
export interface IntentContract {
  goal: string;
  constraints: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  permissions: AgentAction[];
  resources: ResourceRef[];
  riskLevel: RiskLevel;
}

/** Deterministic retry behavior for a task node. */
export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  maxBackoffMs: number;
}

/**
 * TaskNode: one unit of work in a task graph. Dependencies make execution
 * resumable and deterministic — never rely on the AI to remember the workflow.
 */
export interface TaskNode {
  id: string;
  /** Node ids that must complete before this one runs. */
  dependencies: string[];
  /** Agent id that owns execution of this node. */
  owner: string;
  inputs: Record<string, unknown>;
  expectedOutputs: string[];
  /** Max wall-clock ms for one attempt. */
  timeout: number;
  retryPolicy: RetryPolicy;
  permissions: AgentAction[];
  /** Gate id that must pass before this node may start. */
  acceptanceGate?: string;
}

export interface TaskGraph {
  nodes: TaskNode[];
}

/**
 * Topologically order a task graph's nodes. Throws on unknown dependencies
 * or cycles — both are contract errors, caught before execution starts.
 */
export function orderTaskGraph(graph: TaskGraph): TaskNode[] {
  const byId = new Map(graph.nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const ordered: TaskNode[] = [];

  const visit = (id: string): void => {
    if (visited.has(id)) return;
    if (inStack.has(id)) throw new Error(`task graph cycle detected at node "${id}"`);
    const node = byId.get(id);
    if (!node) throw new Error(`task graph references unknown node "${id}"`);
    inStack.add(id);
    for (const dep of node.dependencies) visit(dep);
    inStack.delete(id);
    visited.add(id);
    ordered.push(node);
  };

  for (const node of graph.nodes) visit(node.id);
  return ordered;
}

/**
 * Minimal JSON-schema shape for agent input/output contracts. Kept as plain
 * data (no Zod dependency) so the addon stays dependency-free.
 */
export type JsonSchema = Record<string, unknown>;

/**
 * AgentDefinition: agents are capabilities, not personalities. The model
 * behind an agent may change without changing this architecture.
 */
export interface AgentDefinition {
  id: string;
  version: string;
  responsibilities: string[];
  allowedTools: string[];
  forbiddenActions: string[];
  inputSchema: JsonSchema;
  outputSchema: JsonSchema;
  instructionSet: string;
}

/**
 * ZeroEvent: the immutable unit of the event-sourced ledger. Hash-chained:
 * each event commits to its parent's hash, so rewriting history breaks the
 * chain (verified by ZeroLedger.verify()).
 */
export interface ZeroEvent {
  eventId: string;
  workspaceId: string;
  actor: string;
  action: string;
  /** ISO-8601 timestamp. */
  timestamp: string;
  /** SHA-256 of the canonical input payload. */
  inputHash: string;
  /** SHA-256 of the canonical output payload, when one exists. */
  outputHash?: string;
  /** eventId of the previous event ('GENESIS' for the first). */
  parentHash: string;
  evidenceRefs: string[];
}

/** Evidence states for certification. No evidence = UNKNOWN, never success. */
export type EvidenceState = 'VERIFIED' | 'PARTIAL' | 'UNKNOWN' | 'FAILED';

/** A certification record: requirement → evidence-backed state. */
export interface CertificationRecord {
  requirement: string;
  state: EvidenceState;
  evidence: Record<string, unknown>;
  evaluatedAt: string;
}
