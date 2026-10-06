/**
 * InvisibleDB — the agent-native page.
 * "Firebase gives your agents a database. InvisibleDB gives them a memory and a conscience."
 */
import type { Metadata } from 'next';

const title = 'InvisibleDB for AI Agents — MCP Server, CLI & SDK';
const description =
  'InvisibleDB for AI agents: MCP server, CLI, and SDK for provisioning backends and querying data — plus ZeroAI agent OS with memory, audit, policy.';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: '/agents' },
  openGraph: { type: 'website', url: '/agents', title, description, images: ['/opengraph-image'] },
  twitter: { card: 'summary_large_image', title, description },
};

export default function AgentsPage() {
  return (
    <div className="m-page">
      {/* HERO */}
      <section className="m-hero">
        <span className="kicker">Agent-native infrastructure</span>
        <h1>
          Firebase gives your agents a database. <span className="hl">We give them a memory and a conscience.</span>
        </h1>
        <p className="sub">
          Every InvisibleDB seat ships with the ZeroAI agent OS: persistent memory, a
          tamper-evident audit ledger, a permission broker, and deterministic lifecycle
          gates. Your agents stop hallucinating state — because state lives outside
          inference, on infrastructure you own.
        </p>
        <div className="m-hero-ctas">
          <a className="m-btn" href="/signup">
            Get started
          </a>
          <a className="m-btn ghost" href="#guide">
            Read the agent guide
          </a>
        </div>
      </section>

      {/* ZEROAI PLANES */}
      <section className="m-section">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">The ZeroAI addon</span>
            <h2>Deterministic systems around your models</h2>
            <p className="lede">
              Inference proposes. Deterministic systems decide. Evidence proves. Memory
              preserves. Policy authorizes. Four planes ship with every seat:
            </p>
          </div>
          <div className="m-grid">
            <div className="m-card">
              <div className="icon">🧠</div>
              <h3>Memory plane</h3>
              <p>
                ZeroMemory keeps compact, durable agent state — facts, decisions, open
                issues — instead of replaying entire chat histories. Your agent wakes up
                knowing what it knew yesterday.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">📜</div>
              <h3>Observation plane</h3>
              <p>
                ZeroLedger records every meaningful agent action as a hash-chained,
                tamper-evident event. Not &quot;the agent says tests passed&quot; —
                exit codes, artifacts, and evidence, certified by the system.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🛡️</div>
              <h3>Policy plane</h3>
              <p>
                ZeroPolicy is a deterministic permission broker: read, write, deploy,
                charge, merge — each scoped per agent and environment. Models request
                authority. They never manufacture it.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🚦</div>
              <h3>Control plane</h3>
              <p>
                ZeroGate puts deterministic gates on every important transition: typecheck
                → tests → security → release. A failed gate blocks the next state because
                the state machine says so — not because the AI felt like it.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">🔌</div>
              <h3>Execution plane</h3>
              <p>
                Agents act through typed tools and schemas — database operations, API
                calls, deployments — with retries, timeouts, and resumable task graphs.
                Never rely on the model to remember the workflow.
              </p>
            </div>
            <div className="m-card">
              <div className="icon">📐</div>
              <h3>Instruction plane</h3>
              <p>
                Specialized agent definitions — architect, backend, qa, security, release —
                with versioned instruction sets and input/output schemas. Swap the model
                behind any agent without changing the architecture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* INTERFACE */}
      <section className="m-section" id="mcp">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">Built for how you actually work</span>
            <h2>Agents provision backends. Humans approve.</h2>
            <p className="lede">
              Most new backends will be spun up by an AI agent, not a human clicking a
              dashboard. So InvisibleDB speaks fluent agent:
            </p>
          </div>
          <div className="m-steps">
            <div className="m-step">
              <span className="num">⌁</span>
              <h3>MCP server</h3>
              <p>
                A first-class Model Context Protocol server. Your coding agent provisions
                projects, manages collections, and queries data conversationally — no
                dashboard required.
              </p>
            </div>
            <div className="m-step">
              <span className="num">→</span>
              <h3>REST API</h3>
              <p>
                Every operation — projects, keys, data, vector search — is a typed HTTP
                endpoint. Script it, automate it, build on it.
              </p>
            </div>
            <div className="m-step">
              <span className="num">$</span>
              <h3>CLI</h3>
              <p>
                <span className="m-inline-code">idb init</span>,{' '}
                <span className="m-inline-code">idb deploy</span>,{' '}
                <span className="m-inline-code">idb logs</span> — the full backend lifecycle
                from your terminal, and therefore from your agent&apos;s terminal too.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* AGENT GUIDE */}
      <section className="m-section" id="guide">
        <div className="m-wrap">
          <div className="m-section-head">
            <span className="kicker">The muse guide</span>
            <h2>Teach your agent InvisibleDB in one page</h2>
            <p className="lede">
              A single machine-readable guide your agent loads at session start: how to
              provision, how to query, how the ZeroAI planes work, and the evidence rules
              it must follow. Point any capable agent at it and it becomes a competent
              InvisibleDB operator.
            </p>
          </div>
          <div className="m-bill">
            <div className="row">
              <span className="label">Provisioning</span>
              <span className="price good">MCP · CLI · API</span>
            </div>
            <div className="row">
              <span className="label">Querying</span>
              <span className="price good">Dart SDK · REST · vectors</span>
            </div>
            <div className="row">
              <span className="label">Agent memory</span>
              <span className="price good">ZeroMemory, built in</span>
            </div>
            <div className="row">
              <span className="label">Evidence standard</span>
              <span className="price good">No evidence, no green</span>
            </div>
            <p className="note">
              The guide ships with every seat and lives in your project repo. Your agent
              reads it; the deterministic planes enforce it.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="m-cta-band">
        <h2>Give your agents infrastructure with a memory.</h2>
        <p>First seat is $1. The agents are already waiting.</p>
        <a className="m-btn" href="/signup">
          Get started with InvisibleDB
        </a>
      </section>
    </div>
  );
}
