# RivalScope

RivalScope is an AI-driven competitive intelligence agent system for enterprise
product research. It is designed as a traceable digital research team: agents
collect public information, extract evidence, structure competitor knowledge,
synthesize claims, write reports, critique the output, and expose the full
decision trail.

The core positioning is:

```text
An auditable business intelligence production line,
not a black-box AI report generator.
```

## Why This Exists

Traditional competitive analysis is slow, repetitive, source-fragmented, and
heavily dependent on an individual analyst's industry knowledge. RivalScope
turns that workflow into a multi-agent system with explicit orchestration,
structured artifacts, evidence grounding, confidence scoring, review loops, and
evaluation.

The project is built for a ByteDance-style AI Agent competition. The intended
first-place story is not "we can generate a report"; it is "we can show how every
business conclusion was produced, checked, scored, and traced."

## Canonical Plan

The current source of truth is:

- [docs/master-plan.md](docs/master-plan.md)
- [docs/implementation-handoff-plan.md](docs/implementation-handoff-plan.md)
- [docs/current-status.md](docs/current-status.md)

Active subsystem plans:

- [docs/source-tooling-design.md](docs/source-tooling-design.md)
- [docs/model-gateway-design.md](docs/model-gateway-design.md)
- [docs/observability-ui-design.md](docs/observability-ui-design.md)

Older detailed design drafts are preserved under [docs/reference](docs/reference)
as background material. If a reference draft conflicts with the master plan, the
master plan wins.

## Current Status

The accepted implementation baseline now includes Module A+B:

- Immutable DAG workflow domain model.
- Node dependency scheduling.
- Running, success, failure, retry, blocked, and skipped node states.
- Accepted evidence chain:
  `SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock`.
- Claim evidence and trace validation, including rejection of incoherent report
  block evidence.
- Counter-evidence semantics:
  `SUPPORTS`, `REFUTES`, and `QUALIFIES`.
- Deterministic 11-node demo DAG:
  `research_planner -> collector -> snapshot_parser -> extractor -> knowledge_structurer -> analyst -> skeptic -> confidence_scorer -> writer -> critic -> trace_validator`.
- Source snapshots, evidence spans, atomic facts, knowledge items, claims,
  report blocks, review findings, trace validations, trace edges, and model
  runs in the read model.
- Agent and Tool interfaces with Zod validation.
- Agent run and tool call records.
- In-memory artifact store.
- Prisma database package for persistence.

Module C/UI is not accepted yet. A first data-wiring attempt collapsed too much
into one project page, so the next implementation must rebuild Module C as a
multi-page observability console before starting Model Gateway, Source Tooling,
or later modules.

Read [docs/current-status.md](docs/current-status.md) before continuing work.

## Target System

The target evidence and knowledge chain is:

```text
SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> KnowledgeItem
  -> Claim
  -> Insight
  -> Recommendation
  -> ReportBlock
```

The target DAG is:

```text
plan_research
  -> collect_sources_by_competitor
  -> snapshot_and_parse_sources
  -> extract_evidence_spans
  -> extract_atomic_facts
  -> structure_knowledge
  -> synthesize_claims_by_dimension
  -> skeptic_review
  -> confidence_scoring
  -> write_report
  -> critic_review
  -> trace_validation
  -> publish_or_revise
```

P0 agent roles:

- `ResearchPlanner`
- `Collector`
- `Extractor`
- `KnowledgeStructurer`
- `Analyst`
- `Skeptic`
- `ConfidenceScorer`
- `Writer`
- `Critic`
- `TraceValidator`

The hardest rules are simple: agents cannot write outside their role contracts,
final claims must cite evidence, unsupported claims must not become final
recommendations, and broken traces block publication.

## Roadmap

The product roadmap is:

1. Documentation reset.
2. Source tooling and evidence ingestion.
3. Model gateway and real agents.
4. Tool contracts and runtime guardrails.
5. Routed research DAG.
6. Observability UI.
7. Report generation and publishing.
8. Evaluation harness.
9. Persistence and artifact lifecycle.
10. Human review and governance.

The current execution order is stricter:

```text
Module A+B accepted
-> rebuild Module C as Multi-Page Observability UI
-> only then continue to D/E/F
```

For competition impact, the highest-leverage slice is:

```text
SourceSnapshot + EvidenceSpan
  -> real Extractor / Analyst
  -> confidence and trace gates
  -> clickable provenance UI
  -> eval baseline comparison
```

## Repository Layout

```text
apps/
  web/
    app/                    # Next.js App Router pages and server actions
    lib/                    # Analysis orchestration and persistence mapping
docs/
  master-plan.md            # Canonical product, architecture, and roadmap plan
  implementation-handoff-plan.md # Execution handoff for the next coding session
  current-status.md         # Short status and next-action guide
  architecture.md           # Current runtime architecture
  source-tooling-design.md   # Source collection and evidence ingestion plan
  model-gateway-design.md    # Model calling and structured output plan
  observability-ui-design.md # Product UI and observability console plan
  reference/                # Older detailed design drafts kept for reference
packages/
  core/
    src/workflow.ts         # DAG workflow model and immutable transitions
    src/evidence.ts         # Source, chunk, fact, claim, and evidence chain
  agents/
    src/agent.ts            # Agent and Tool interfaces
    src/artifacts.ts        # Artifact types and store contract
    src/workflow-schemas.ts # Shared workflow agent input/output schemas
    src/analysis-agents.ts  # Mock Extract, Analyst, Writer, and Critic agents
    src/workflow-runner.ts  # In-memory workflow runner
  db/
    prisma/schema.prisma    # PostgreSQL relational model
    src/repositories.ts     # Project, workflow, artifact, intelligence repos
  tools/
    src/index.ts            # Placeholder for concrete external tools
```

Planned additions include `packages/evals` for benchmark evaluation and a more
complete tool/model runtime.

## Agent Context

This repository uses [AGENTS.md](AGENTS.md) as the Codex equivalent of a
durable project context file. It records current acceptance gates, UI failure
conditions, verification commands, and hard constraints such as leaving
`external/` and `.next/` untouched.

This is intentional. AI-native development drifts quickly when every new agent
session has to infer the project from code alone. Keep durable context current
whenever acceptance rules or architecture decisions change.

## Commands

Install dependencies:

```bash
npm install --registry=https://registry.npmjs.org/
```

Run tests:

```bash
npm test
```

Run type checks:

```bash
npm run typecheck
```

Start local infrastructure:

```bash
docker compose up -d postgres redis
```

Validate the Prisma schema:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:validate --workspace @rivalscope/db
```

On this machine, Prisma binary download may require a one-off local certificate
workaround:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" NODE_TLS_REJECT_UNAUTHORIZED=0 npm run db:validate --workspace @rivalscope/db
```

Do not commit or export that TLS setting globally.

Push the schema to a running local database:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run db:push --workspace @rivalscope/db
```

Run the web MVP:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/rivalscope?schema=public" npm run dev --workspace @rivalscope/web
```

Local demo flow:

1. Open `http://localhost:3000`.
2. Create an analysis project.
3. Open the project detail page.
4. Click `Run Agent DAG`.
5. Review generated claims, evidence spans, report blocks, trace validation,
   workflow node statuses, and Critic/Skeptic findings.

## Engineering Principles

- Keep the DAG explicit.
- Keep artifacts structured and schema-validated.
- Keep workflow state immutable.
- Treat AgentRun, ToolCall, Artifact, ReviewFinding, confidence scores,
  provenance links, and eval results as product surfaces.
- Preserve evidence before writing conclusions.
- Block unsupported claims before publication.
- Prefer deterministic validators for trace and role rules.
- Use LLM judges only where human-like judgment is actually needed.
- Treat durable docs as part of the runtime contract for future agent sessions.
