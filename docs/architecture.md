# RivalScope Architecture

## Goal

RivalScope should behave like a research operating system for competitive
intelligence:

- Explicit DAG execution instead of hidden sequential prompts.
- Specialized agents instead of one report-generation prompt.
- Structured artifacts between every stage.
- Evidence-backed claims and report sections.
- Confidence and provenance gates before publication.
- Observable agent runs, tool calls, artifacts, and review findings.
- Repeatable evaluations for both final output and execution trajectory.

The canonical product and roadmap plan is [master-plan.md](master-plan.md).

## AI-Native Architecture Principle

RivalScope should optimize for durable decision quality, not just faster code
or faster report generation. In practice:

- preserve context in docs and artifacts so new agent sessions do not drift;
- keep deterministic validators beside model-backed agents;
- treat model output as candidate data until runtime gates accept it;
- make adversarial review part of the core workflow;
- convert human review and benchmark failures into durable system memory.

The architecture therefore favors typed artifacts, explicit DAG state,
repeatable evals, and observable provenance over hidden prompt chains.

## Runtime Packages

### `@rivalscope/core`

Owns pure domain logic and should stay free of database, queue, model, and HTTP
concerns.

Current responsibilities:

- Workflow node statuses and immutable transitions.
- DAG readiness checks.
- Retry and blocking behavior.
- SourceSnapshot, EvidenceSpan, AtomicFact, Claim, ReportBlock, and related
  evidence-chain types.
- Claim evidence and trace validation.

Target responsibilities:

- `SourceSnapshot`, `EvidenceSpan`, `AtomicFact`, `KnowledgeItem`, `Claim`,
  `Insight`, `Recommendation`, and `ReportBlock` domain types.
- Confidence and publication gate domain rules.
- Deterministic trace validation rules.

### `@rivalscope/agents`

Owns agent execution contracts and workflow runtime.

Current responsibilities:

- `Agent<I, O>` interface.
- `Tool<I, O>` interface.
- Zod input/output validation.
- Agent run records.
- Tool call records.
- In-memory artifact store.
- In-memory workflow runner.
- Deterministic 11-node demo pipeline for the accepted A+B evidence baseline.

Target responsibilities:

- Role contracts and artifact read/write policies.
- Model-backed agent implementations.
- Agent-level budget, retry, and failure policies.
- Typed workflow node definitions.
- Generator-verifier and targeted-research loops.

### `@rivalscope/tools`

Owns concrete external capabilities.

Target responsibilities:

- Search public web sources.
- Fetch URLs safely.
- Parse HTML and PDF content.
- Normalize source metadata.
- Chunk text with stable IDs.
- Extract exact evidence spans.
- Export reports.

Every tool must expose a schema, timeout policy, retry policy, redaction policy,
and persisted `ToolCallRecord`.

The active Source Tooling plan is
[source-tooling-design.md](source-tooling-design.md). Its key decision is
Adapter-Based Evidence Acquisition: Scrapling, Playwright, static HTTP, or other
services can be plugged in as backend implementations, but RivalScope owns
source policy, immutable `SourceSnapshot` records, exact `EvidenceSpan`
extraction, source quality scoring, deduplication, ToolCall observability, and
downstream provenance.

### `@rivalscope/db`

Owns relational persistence.

Current responsibilities:

- Prisma schema.
- Project, workflow, artifact, and intelligence repositories.

Target responsibilities:

- Projects, competitors, dimensions, and analysis runs.
- Source snapshots, evidence spans, facts, knowledge items, claims, insights,
  recommendations, reports, and review findings.
- Workflow nodes, node attempts, agent runs, tool calls, and artifacts.
- Trace edges and claim revision history.
- Eval cases, eval runs, grader outputs, and human feedback.

### `@rivalscope/evals`

Planned package for repeatable quality measurement.

Target responsibilities:

- Offline benchmark fixtures.
- Gold evidence spans and gold claims.
- Seeded defects.
- Deterministic graders for schemas, evidence chains, role contracts, tool
  policies, and DAG trajectory.
- LLM-as-judge rubrics for insight usefulness and recommendation actionability.
- Baseline comparisons.

### `apps/web`

Owns the product surface.

Current responsibilities:

- Project creation.
- DAG execution trigger.
- Legacy project detail UI plus a rejected Module C data-wiring prototype in the
  local worktree.

Target responsibilities:

- DAG/timeline view.
- Agent run detail.
- Tool call detail.
- Artifact lineage.
- Evidence chips.
- Claim provenance drawer.
- Confidence explanation.
- Critic and Skeptic findings.
- Evaluation dashboard.
- Optional human approval.

## Canonical Artifact Flow

The accepted A+B baseline uses:

```text
SourceSnapshot
  -> EvidenceSpan
  -> AtomicFact
  -> Claim
  -> ReportBlock
```

The target system uses:

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

This chain is the trust boundary. Report text is downstream of evidence and
structured knowledge, not a substitute for them.

## Canonical DAG

The target workflow is:

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

The DAG should support:

- Parallel branches by competitor.
- Parallel branches by analysis dimension.
- Branch-level failure isolation.
- Checkpoint and resume.
- Targeted research sub-DAGs for weak claims.
- Confidence and trace gates.
- Optional human approval before publication.

## Role Boundaries

The runtime must enforce role contracts in code. Prompt instructions are not
enough.

P0 roles:

- `ResearchPlanner`: writes research plans and DAG branch plans.
- `Collector`: writes sources and snapshots; cannot emit claims.
- `Extractor`: writes evidence spans and atomic facts; cannot invent facts.
- `KnowledgeStructurer`: writes typed competitor knowledge.
- `Analyst`: writes claims, insights, risks, and recommendations from approved
  knowledge.
- `Skeptic`: writes challenge findings and evidence requests.
- `ConfidenceScorer`: writes confidence records and routing decisions.
- `Writer`: writes report blocks from approved artifacts only.
- `Critic`: writes review findings; cannot silently fix the report.
- `TraceValidator`: deterministically validates lineage; should not call an
  LLM.

Violations should be recorded and should block invalid artifacts.

## Evidence, Confidence, And Publication

Facts must cite evidence. Claims must cite facts. Report blocks must cite claims,
insights, or recommendations that passed validation.

Each claim should receive:

- support verdict: `supported`, `refuted`, `insufficient_evidence`, or
  `not_checkable`
- source quality score
- evidence directness score
- source independence score
- freshness fit score
- contradiction penalty
- publication decision

Publication rules:

- Supported factual claims may publish if they pass the threshold.
- Comparative claims need evidence for each side.
- Trend claims need multiple independent signals.
- Unsupported claims may become hypotheses or open questions.
- Refuted claims must not become recommendations.
- Broken provenance blocks publication.

## Tool And Model Boundaries

Tools are product infrastructure, not hidden prompt helpers.

Source acquisition tools are defined in
[source-tooling-design.md](source-tooling-design.md). Scrapling may be used as
an optional fetch/parse backend, but the TypeScript tool contract and evidence
artifacts remain the stable system boundary.

Each tool should define:

- name
- role
- Zod input schema
- Zod output schema
- timeout policy
- retry policy
- budget policy
- redaction policy
- persisted call record

Model calls should go through a provider-neutral model gateway:

- real provider adapter behind environment variables
- deterministic mock client for tests
- prompt version tracking
- structured output validation
- model, token, latency, and cost records
- schema-failure retries

The active Model Gateway plan is
[model-gateway-design.md](model-gateway-design.md). Its key decision is a
Provider-Neutral Structured Model Gateway: LLMs produce candidate structured
artifacts, while the RivalScope runtime owns schema validation, role-contract
validation, evidence-reference validation, budget enforcement, observability,
artifact commit, and evaluation linkage.

External source content must be treated as untrusted data. It should never
become executable instruction for an agent.

## Evaluation Architecture

Evaluation should score output quality and trajectory quality separately.

Benchmark layers:

- RAG grounding.
- Claim factuality.
- Agent trajectory.
- Competitive intelligence usefulness.

Baseline variants:

- `single_llm_report`
- `standard_rag_report`
- `linear_agent_pipeline`
- `rivalscope_full_system`

Score groups:

- `trust_score`
- `insight_score`
- `agentops_score`
- `efficiency_score`

Evaluation data should live in a repeatable package, not in manual notes.

## Observability Architecture

Every run should answer:

- Which agent ran?
- Which node triggered it?
- What input artifacts did it receive?
- What tools did it call?
- What output artifacts did it produce?
- Which evidence supports each claim?
- Which findings challenged the output?
- Why did a claim publish, revise, downgrade, or fail?

The UI should expose observability as a product feature through:

- workflow timeline
- DAG node detail
- agent run detail
- tool call detail
- artifact lineage
- evidence chips
- provenance drawer
- confidence explanation
- review findings
- evaluation dashboard

The active UI plan is [observability-ui-design.md](observability-ui-design.md).
Its key decision is a Competitive Intelligence Operations Console: dense
tables for review at scale, inspectors for selected-object details, evidence
chips for report and claim traceability, drawers for provenance, graph canvases
for Agent DAG and evidence lineage, and evaluation dashboards for benchmark
comparison.

## Near-Term Engineering Direction

Module A+B is accepted. The immediate next implementation slice is Module C:
Multi-Page Observability UI. It must use the accepted A+B read model and must
not collapse the product into one project detail page.

After Module C is accepted, the next high-leverage product slice should
prioritize:

```text
SourceSnapshot + EvidenceSpan
  -> real source tooling
  -> model gateway
  -> real Extractor / Analyst
  -> confidence and trace gates
  -> clickable provenance UI
  -> eval baseline comparison
```

This slice most directly supports the competition thesis and turns the MVP from
a mock agent pipeline into a credible competitive intelligence system.

## Non-Goals

These are not near-term goals:

- Universal autonomous planner.
- Agent marketplace.
- A2A protocol layer.
- Low-code workflow builder.
- Fine-tuning before stable eval data.
- Framework rewrite to LangGraph, AutoGen, CrewAI, or another runtime before
  the current runner becomes the bottleneck.
