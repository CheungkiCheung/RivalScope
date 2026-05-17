# RivalScope Master Plan

## Positioning

RivalScope is an AI-driven competitive intelligence agent system for enterprise
product research. Its goal is not to generate a prettier report from one prompt.
Its goal is to simulate a digital research team that can collect public
information, preserve evidence, structure competitor knowledge, synthesize
claims, write reports, review its own work, and explain every conclusion.

The first-prize positioning is:

```text
An auditable business intelligence production line,
not a black-box AI report generator.
```

The system should make three things obvious in a demo:

1. Multiple specialized agents collaborate through a visible DAG.
2. Every important conclusion is traceable to frozen evidence.
3. Quality is measured with repeatable benchmarks, not judged by vibes.

## Competition Thesis

The competition is likely to care about these signals most:

- Agent engineering depth: role separation, DAG orchestration, tool boundaries,
  feedback loops, and durable artifacts.
- Business usefulness: competitor comparison, strategic insights, actionable
  recommendations, and uncertainty handling.
- Trustworthiness: claim-level provenance, confidence calibration, contradiction
  handling, and publication gates.
- Observability: the reviewer can inspect agent decisions, tool calls,
  intermediate artifacts, evidence chains, and evaluation results.
- Engineering completeness: the system can run end to end with real or fixture
  sources, not only with a mocked report.

The project should therefore optimize for a reviewer experience where a judge
can click any report claim and see:

```text
ReportBlock
  -> Recommendation / Insight / Claim
  -> Confidence score and explanation
  -> Supporting and refuting evidence spans
  -> Source snapshots
  -> Agent runs and tool calls
  -> Critic / Skeptic / TraceValidator findings
  -> Evaluation scores
```

## Current Implementation Snapshot

The accepted implementation baseline includes Module A+B:

- TypeScript monorepo with `packages/*` and `apps/*`.
- Pure workflow domain model in `@rivalscope/core`.
- Accepted evidence chain:
  `SourceSnapshot -> EvidenceSpan -> AtomicFact -> Claim -> ReportBlock`.
- Claim evidence and trace validation, including rejection of incoherent report
  block evidence.
- Counter-evidence trace semantics:
  `SUPPORTS`, `REFUTES`, and `QUALIFIES`.
- Agent and Tool interfaces with Zod validation.
- Agent run and tool call records.
- In-memory artifact store.
- In-memory workflow runner.
- Deterministic 11-node demo pipeline:
  `research_planner -> collector -> snapshot_parser -> extractor -> knowledge_structurer -> analyst -> skeptic -> confidence_scorer -> writer -> critic -> trace_validator`.
- Prisma persistence package.
- Prisma/readback contract coverage for source snapshots, evidence spans,
  atomic facts, knowledge items, claims, report blocks, trace validations,
  trace edges, review findings, and model runs.

Module C/UI is not accepted. A prior local UI attempt connected to the A+B read
model but collapsed the product into one page and should be treated only as a
rejected data-wiring prototype. The next phase must rebuild Module C as a
multi-page observability console before adding real source ingestion, real
model-backed agents, or repeatable evaluation.

## Canonical System Model

### Evidence And Knowledge Chain

The target chain is:

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

Definitions:

- `SourceSnapshot`: immutable capture of a public source with metadata, content
  hash, retrieval time, and source quality attributes.
- `EvidenceSpan`: exact cited text range from a snapshot.
- `AtomicFact`: one verifiable factual statement extracted from evidence.
- `KnowledgeItem`: structured competitor knowledge by dimension.
- `Claim`: report-ready assertion backed by facts and evidence.
- `Insight`: synthesized implication across claims.
- `Recommendation`: action proposal with rationale, evidence, confidence, and
  limitations.
- `ReportBlock`: final user-facing report section that cites approved claims,
  insights, and recommendations.

### Core Agents

P0 roles:

- `ResearchPlanner`: creates research questions, competitor dimensions, and DAG
  branch plans.
- `Collector`: searches, fetches, snapshots, and normalizes sources. It cannot
  emit claims.
- `Extractor`: converts evidence spans into atomic facts. It cannot invent facts
  beyond source text.
- `KnowledgeStructurer`: maps atomic facts into the competitive knowledge schema.
- `Analyst`: synthesizes claims, comparisons, insights, and risks from approved
  knowledge.
- `Skeptic`: challenges claims, identifies contradictions, and asks for more
  evidence.
- `ConfidenceScorer`: assigns claim-level confidence and routing decisions.
- `Writer`: writes report blocks only from approved claims, insights, and
  recommendations.
- `Critic`: reviews report quality, unsupported claims, missing dimensions, and
  overconfident conclusions.
- `TraceValidator`: deterministically verifies lineage before publication.

Hard role rules:

- Collector cannot emit claims.
- Extractor cannot create facts without evidence spans.
- Analyst cannot cite raw URLs as evidence.
- Writer cannot use rejected or unsupported claims.
- Critic cannot silently rewrite the report.
- TraceValidator should be deterministic and should not rely on an LLM.

### DAG Strategy

The target orchestration is a typed DAG with shared evidence state:

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
- Generator-verifier loops.
- Targeted research sub-DAGs for weak claims.
- Publication gates based on confidence and provenance.
- Checkpoint and resume.
- Branch-level failure isolation.
- Optional human approval.

## Confidence And Provenance Policy

Confidence is claim-level, not report-level. Each claim receives:

- Evidence support verdict: `supported`, `refuted`, `insufficient_evidence`, or
  `not_checkable`.
- Source quality score.
- Evidence directness score.
- Source independence score.
- Freshness fit score.
- Contradiction penalty.
- Claim-type-specific publication decision.

Publication rules:

- Strong factual claims need direct evidence.
- Comparative claims need evidence for both sides.
- Trend claims need multiple independent signals.
- Recommendations need supported claims plus explicit limitations.
- Unsupported claims can become hypotheses or open questions, but not final
  recommendations.

Provenance is claim-centric. Every final conclusion must have an unbroken lineage
from report block back to source snapshot. Broken traces block publication.

## Evaluation Strategy

Use an industry-aligned benchmark rather than a private, unverifiable scoring
scheme.

Benchmark layers:

- RAG grounding: context precision, context recall, citation precision,
  citation coverage, source quality, freshness.
- Claim factuality: supported/refuted/insufficient verdicts, atomic fact
  support, unsupported claim escape rate, contradiction catch rate.
- Agent trajectory: required node coverage, role violations, tool policy
  violations, schema pass rate, feedback routing, branch isolation.
- Competitive intelligence quality: dimension coverage, comparison specificity,
  strategic insight density, recommendation actionability, uncertainty handling.

Baselines:

- `single_llm_report`
- `standard_rag_report`
- `linear_agent_pipeline`
- `rivalscope_full_system`

Score groups:

- `trust_score`: grounding, factuality, provenance, confidence calibration.
- `insight_score`: strategic usefulness and recommendation quality.
- `agentops_score`: DAG, role, schema, tool, and feedback-loop correctness.
- `efficiency_score`: cost, latency, retry rate, and stability.

The demo should show RivalScope outperforming weaker baselines on trust and
traceability, not merely on writing polish.

## AI-Native Operating Principles

The AI-native startup lesson for RivalScope is that execution speed is no
longer the scarce resource. The scarce resource is decision quality: whether
the system can test assumptions, find disconfirming evidence, preserve context,
and avoid drifting when many agent sessions touch the same product.

That changes how this project should be built:

1. Each module must prove a capability, not merely add a feature.
2. Every AI output is a candidate artifact until schema, role, evidence, and
   trace gates accept it.
3. The system must pressure-test its own conclusions through Skeptic, Critic,
   counter-evidence, and benchmark defects.
4. Deterministic demo paths must remain available after real model paths are
   added, so tests and demos are repeatable.
5. Durable context files such as `AGENTS.md`, this master plan, and
   `current-status.md` are part of the engineering system. They prevent new
   AI sessions from rediscovering the project incorrectly.
6. Human review actions should become future organizational memory rather than
   one-off chat feedback.

For the ByteDance competition, this means the winning story is not "AI writes a
better report faster." The winning story is "AI operates as a traceable,
adversarial, measurable research organization."

## Master Roadmap

### Phase 0: Documentation Reset

Goal: make the project documentation coherent and current.

Status: in progress.

Tasks:

1. Replace scattered planning docs with this master plan.
2. Rewrite `README.md` around product positioning, current status, and next
   execution order.
3. Rewrite `docs/architecture.md` around the canonical runtime architecture.
4. Move older detailed design drafts to `docs/reference/`.
5. Keep reference docs available, but treat this file as the source of truth.

Acceptance criteria:

- A new reader can understand the project in five minutes.
- There is one canonical plan.
- Outdated links and duplicated roadmap fragments are removed.

### Phase 1: Source Tooling And Evidence Ingestion

Goal: replace seeded source chunks with real, snapshot-based evidence ingestion.

Detailed plan:

- [source-tooling-design.md](source-tooling-design.md)

Key decision:

```text
Adapter-Based Evidence Acquisition
```

Scrapling can be used as an optional fetch/parse backend, but it should not
become the core domain model. RivalScope owns source policy, immutable
`SourceSnapshot` records, exact `EvidenceSpan` extraction, source quality
scoring, deduplication, ToolCall observability, and the downstream provenance
chain.

Scope:

- `SearchTool`
- `FetchUrlTool`
- `HtmlToTextTool`
- `PdfToTextTool`
- `ChunkTextTool`
- `SourceSnapshot`
- `EvidenceSpan`
- source quality scoring
- deduplication and source-family tracking
- optional Scrapling backend adapter

Tasks:

1. Define shared Tool contracts with Zod input/output schemas.
2. Add `SourceDiscoveryTool` for seed URLs, search results, sitemaps, docs,
   pricing pages, changelogs, and public source candidates.
3. Add `UrlPolicyGuard` for URL normalization, SSRF protection, robots policy,
   rate limits, content-type limits, and human override rules.
4. Implement safe URL fetching with timeout, size limit, content-type handling,
   redirect handling, and error capture.
5. Keep fetch backends adapter-based: static HTTP and Playwright first,
   optional Scrapling sidecar when advanced dynamic scraping is needed.
6. Parse HTML/PDF into location-preserving text with source metadata.
7. Add deterministic chunking with stable IDs.
8. Freeze source snapshots with content hashes.
9. Extract evidence spans with exact text offsets, selectors, table positions,
   page numbers, or bounding boxes where available.
10. Score source quality by authority, freshness, relevance, conflict risk, and
    independence.
11. Deduplicate repeated pages, tracking URLs, syndicated articles, and source
    families.
12. Persist tool calls and source artifacts.
13. Show source collection status, policy decisions, source preview, evidence
    highlights, and quality scores in the UI.

Acceptance criteria:

- A project can collect at least one source per competitor.
- Every source has a frozen snapshot.
- Every extracted fact links to evidence spans, not only URLs.
- Tool failures are visible and do not corrupt the DAG.
- The system can run offline fixture ingestion for tests.
- Unsafe URLs, private addresses, and source prompt-injection attempts are
  handled as policy/security events.
- Scrapling, if enabled, is replaceable without changing agent code.

### Phase 2: Model Gateway And Real Agents

Goal: allow real LLM-backed agents while preserving deterministic tests.

Detailed plan:

- [model-gateway-design.md](model-gateway-design.md)

Key decision:

```text
Provider-Neutral Structured Model Gateway
```

LLMs produce candidate structured artifacts. The RivalScope runtime owns schema
validation, role-contract validation, evidence-reference validation, budget
enforcement, observability, artifact commit, and evaluation linkage.

Scope:

- provider-neutral `ModelClient`
- mock model client
- one real provider adapter
- structured output validation
- prompt versioning
- model usage/cost records
- model run records
- role-contract validation
- evidence-reference validation
- budget and retry policy

Tasks:

1. Define `ModelClient` and structured response helpers.
2. Add `MockModelClient` for tests and offline demos.
3. Add one real model adapter behind environment variables.
4. Add a prompt registry with prompt ids, versions, rendered prompt hashes, and
   output schema names.
5. Store model name, prompt version, token usage, latency, cost estimate,
   output schema status, repair attempts, and rejection reasons.
6. Add structured retries for provider errors, invalid JSON, and schema
   validation failures.
7. Add role-contract validation so model output cannot write artifacts outside
   the agent's role.
8. Add evidence-reference validation so output must cite existing fact and
   evidence span ids.
9. Convert Extractor and Analyst to optional model-backed implementations.
10. Keep deterministic mock agents and mock model scenarios available for
    tests and offline demos.

Acceptance criteria:

- Tests do not require API keys.
- Missing API keys fail clearly.
- Real model output must pass schemas before entering artifacts.
- Invalid output is recorded as an agent failure.
- Agent role boundaries are enforced by code, not only prompt text.
- ModelRun records link model calls to workflow run, node, agent run, prompt
  version, input artifacts, output artifacts, validation status, token usage,
  latency, and cost estimate.
- Model output with nonexistent evidence ids is rejected before artifact commit.

### Phase 3: Tool Contracts And Runtime Guardrails

Goal: make tools observable, safe, and enforceable.

Scope:

- tool registry
- tool permissions per role
- tool call persistence
- retries and budgets
- prompt-injection isolation
- redaction policy

Tasks:

1. Define a `ToolDefinition<I, O>` contract.
2. Add per-agent allowed tool lists.
3. Add timeout, retry, and budget policy.
4. Persist sanitized tool inputs and outputs.
5. Mark external source content as data, never executable instruction.
6. Add deterministic tests for disallowed tool usage.
7. Expose tool call detail in the UI.

Acceptance criteria:

- Agents cannot call tools outside their role policy.
- Tool calls are inspectable by run, node, agent, and artifact.
- Source prompt injection attempts are stored as source text and ignored as
  instructions.
- Tool errors produce typed failure records.

### Phase 4: Routed Research DAG

Goal: upgrade from a mostly linear MVP to a routed research workflow.

Scope:

- typed node definitions
- competitor branches
- dimension branches
- targeted research loops
- confidence/provenance gates
- checkpoint/resume
- optional human approval

Tasks:

1. Define `WorkflowNodeDefinition` with input artifacts, output artifacts, role,
   tool policy, retry policy, and quality gates.
2. Add `plan_research`.
3. Add per-competitor collection and extraction branches.
4. Add per-dimension synthesis branches.
5. Add Skeptic and ConfidenceScorer gates.
6. Add targeted evidence collection for weak or contradicted claims.
7. Add TraceValidator publication gate.
8. Add branch-level failure isolation.
9. Add checkpoint/resume.

Acceptance criteria:

- Branches can run independently.
- A failed branch does not erase successful branches.
- Low-confidence claims route to revise, targeted research, hypothesis-only, or
  removal.
- Publication requires passing confidence and trace validation gates.

### Phase 5: Observability UI

Goal: make the system's reasoning and evidence visible to judges and users.

Detailed plan:

- [observability-ui-design.md](observability-ui-design.md)

Key decision:

```text
Competitive Intelligence Operations Console
```

The UI is the control plane for an auditable multi-agent intelligence workflow,
not a report viewer. Tables handle review at scale, inspectors explain selected
objects, graph canvases explain lineage and workflow relationships, and reports
communicate final decisions.

Scope:

- workflow timeline
- DAG node detail
- agent run detail
- tool call detail
- artifact lineage
- evidence chips
- provenance drawer
- confidence explanation
- evaluation dashboard
- Project Cockpit
- Source & Evidence Library
- Claim Review Workbench
- Report Studio
- Agent DAG Canvas
- Provenance Graph Canvas

Tasks:

1. Redesign project detail page around workflow state and report review.
2. Add a DAG/timeline view showing node status, duration, retries, and failures.
3. Add AgentRun detail with inputs, outputs, model usage, and artifacts.
4. Add ToolCall detail with sanitized input/output and errors.
5. Add clickable evidence chips for every report claim.
6. Add claim provenance drawer:
   `ReportBlock -> Claim -> AtomicFact -> EvidenceSpan -> SourceSnapshot`.
7. Add Critic/Skeptic findings linked to exact claims and evidence.
8. Add confidence score explanation and publication status.
9. Add evaluation dashboard with baseline comparison.
10. Add Source & Evidence Library with SourceSnapshot metadata, policy status,
    quality score, and EvidenceSpan highlights.
11. Add Claim Review Workbench with filters, claim table, confidence breakdown,
    provenance, findings, and publication actions.
12. Add Report Studio with evidence chips and block-level Inspector.
13. Add Agent DAG Canvas and Provenance Graph Canvas as audit views, not
    decorative diagrams.

Acceptance criteria:

- A reviewer can explain how a report was produced without reading logs.
- Every final claim can be expanded into evidence and agent history.
- Broken or weak traces are visible.
- The UI makes the product feel like an intelligence operations console, not a
  generic chatbot.
- UI states are consistent across run, report, claim, trace, support verdict,
  and source policy surfaces.
- Demo data is consistent across cockpit, source library, claim review, report,
  graph, and evaluation views.

Current gate:

```text
Module C is the immediate next implementation task.
The first Module C attempt is rejected because it collapsed the product into
one project detail page. Rebuild it as a multi-page observability UI before
continuing to Model Gateway, real source tooling, routed DAG, or eval work.
```

### Phase 6: Report Generation And Publishing

Goal: make the final report useful for product and strategy decisions.

Scope:

- report template
- comparison tables
- insight sections
- recommendations
- risks and open questions
- hypothesis handling
- export

Tasks:

1. Define final report structure.
2. Separate facts, claims, insights, recommendations, risks, and open questions.
3. Generate competitor comparison tables from structured knowledge.
4. Require citations and confidence for all major claims.
5. Preserve caveats and uncertainty in the report.
6. Prevent unsupported recommendations.
7. Add report revision after Critic feedback.
8. Add Markdown export first, then optional PDF/HTML export.

Acceptance criteria:

- The report is useful without reading the trace.
- The trace is available for every important conclusion.
- Unsupported claims do not enter final recommendations.
- Hypotheses and open questions are clearly separated from supported findings.

### Phase 7: Evaluation Harness

Goal: prove quality through repeatable benchmarks.

Scope:

- `packages/evals`
- offline fixtures
- deterministic graders
- LLM-as-judge rubrics
- seeded defects
- baseline comparisons
- eval dashboard

Tasks:

1. Create offline benchmark fixtures.
2. Add gold evidence spans and gold claims.
3. Add seeded defects.
4. Implement deterministic graders for citations, provenance, schemas, role
   contracts, DAG trajectory, and confidence gates.
5. Add LLM judge rubrics for insight usefulness and recommendation
   actionability.
6. Add baseline runners.
7. Store eval results.
8. Show eval summaries in the UI.

Acceptance criteria:

- Evals run offline by default.
- Seeded defects have explicit catch-rate metrics.
- RivalScope can be compared against at least two weaker baselines.
- Trust, insight, AgentOps, and efficiency scores are reported separately.

### Phase 8: Persistence And Artifact Lifecycle

Goal: make runs durable, inspectable, and replayable.

Scope:

- artifact versioning
- immutable snapshots
- claim revisions
- trace edges
- workflow checkpoints
- eval result persistence
- human feedback persistence

Tasks:

1. Finalize persistence schema for all P0 artifacts.
2. Store artifact lineage edges.
3. Preserve old claim versions after revision.
4. Persist workflow checkpoints and node attempts.
5. Persist eval results and judge rationale.
6. Add cleanup/retention rules for large source snapshots.
7. Add schema versioning.

Acceptance criteria:

- Past runs remain inspectable after revisions.
- Claim history is preserved.
- Evaluations can be rerun and compared.
- Artifact lineage is queryable without recomputing from logs.

### Phase 9: Human Review And Governance

Goal: add enterprise-grade control for risky conclusions.

Scope:

- approval gates
- human feedback
- claim downgrade
- request-more-evidence action
- audit log
- security and compliance

Tasks:

1. Add human approval before publication.
2. Let reviewers approve, reject, downgrade, or request more evidence.
3. Store reviewer decisions as artifacts.
4. Ensure human edits do not break provenance.
5. Add audit logs for publication decisions.
6. Add SSRF, prompt injection, secret, and source safety guardrails.

Acceptance criteria:

- A human can control high-risk output.
- Human decisions are traceable.
- Security risks from untrusted sources are explicitly mitigated.

## Execution Priority

The product roadmap order is:

```text
0. Documentation reset
1. Source tooling and evidence ingestion
2. Model gateway and real agents
3. Tool contracts and runtime guardrails
4. Routed research DAG
5. Observability UI
6. Report generation and publishing
7. Evaluation harness
8. Persistence and artifact lifecycle
9. Human review and governance
```

The current implementation gate overrides the generic roadmap:

```text
Module A+B accepted
-> Module C multi-page UI rework
-> then resume D/E/F work
```

For competition impact, the highest-leverage slice is:

```text
SourceSnapshot + EvidenceSpan
  -> real Extractor / Analyst
  -> confidence and trace gates
  -> clickable provenance UI
  -> eval baseline comparison
```

That slice shows the difference between a generic AI report generator and an
auditable agent collaboration system.

## Reference Documents

Older detailed drafts are kept as reference material:

- [reference/competitive-knowledge-schema-design.md](reference/competitive-knowledge-schema-design.md)
- [reference/agent-role-contracts-design.md](reference/agent-role-contracts-design.md)
- [reference/dag-agent-orchestration-design.md](reference/dag-agent-orchestration-design.md)
- [reference/confidence-scoring-design.md](reference/confidence-scoring-design.md)
- [reference/provenance-graph-design.md](reference/provenance-graph-design.md)
- [reference/evaluation-benchmark-design.md](reference/evaluation-benchmark-design.md)

When a reference document conflicts with this master plan, this master plan
wins.
