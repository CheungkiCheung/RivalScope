# RivalScope Next Stage Plan

## Purpose

This plan turns the MVP into a more production-style AI Agent engineering project while preserving the current strengths:

- Explicit DAG orchestration.
- Structured intermediate artifacts.
- Evidence-backed claims.
- Critic review.
- Persistent observability.
- End-to-end web demo.

The next stage should make RivalScope look less like a mock demo and more like a real competitive-intelligence agent system that can be explained in interviews and evaluated in code.

This plan is now governed by `docs/top3-execution-harness.md`. If this document and the harness disagree, follow the harness unless the user explicitly changes the competition strategy.

## Top-3 Readiness Update

Independent competition-style review judged the current direction as **plausibly top-3 capable but not yet top-3 ready**.

The working score is:

```text
Current readiness: about 7.6 / 10
Target readiness before final submission: 9.0+ / 10
```

The plan should continue, but with a sharper execution order. The project must stop looking like a better AI report generator and start looking like an observable competitor-intelligence Agent OS.

The next stage is now organized around three judge-visible artifacts:

1. **Agent Collaboration DAG**: the product shows specialized agents, handoffs, quality gates, and failures.
2. **Competitor Intelligence Schema**: collection, extraction, analysis, coverage, report sections, and repair all use the same domain schema.
3. **Claim Trust Graph with Repair Delta**: every important claim can be inspected, scored, challenged, and improved.

The immediate next milestone is:

```text
Claim Trust Score + Claim Trust Graph + Thin Agent Trace
```

## Research Summary

The strongest external pattern is consistent across major agent systems:

- Keep workflows explicit before adding high-autonomy planning.
- Treat tools as structured, observable, typed interfaces.
- Store traces and artifacts as product data.
- Evaluate both final output and the trajectory that produced it.
- Add human approval at high-risk boundaries.

Useful references:

- OpenAI Agents SDK and agent workflow evals.
- Anthropic workflow-first agent guidance and structured tool use.
- Google Agent Development Kit.
- AWS Bedrock multi-agent supervisor/collaborator pattern.
- LangGraph and Microsoft Agent Framework for graph execution and HITL.
- Open Deep Research and DeerFlow for research/report generation.
- Langfuse and Pydantic AI for observability, evals, datasets, and type safety.

Important synthesis:

- OpenAI-style systems make traces, guardrails, handoffs, and evals first-class.
- Anthropic-style guidance favors explicit workflows over premature open-ended autonomy.
- LangGraph-style systems validate durable graph execution, checkpoints, and human-in-the-loop.
- DeerFlow is especially relevant to a ByteDance context because it frames long-horizon research as planning, specialized roles, tool use, memory, subagents, and report generation.
- Langfuse-style observability reinforces that traces and scores should become product data, not hidden logs.

RivalScope should borrow these patterns without replacing the current explicit TypeScript DAG unless a replacement clearly improves reliability, evaluation, or judge-visible product value.

## Competition Demo Contract

The canonical demo should make this sequence clear:

```text
Input:
Analyze 3 competitors in one product category.

Flow:
Collector Agent collects sources.
Schema Agent normalizes facts into CompetitorIntelligenceProfile.
Analyst Agent generates evidence-backed claims.
Writer Agent drafts the report.
Quality Agent produces targeted findings.
Repair Agent removes, downgrades, or repairs weak claims.
Final Evaluator shows IQS improvement.
```

The demo is not ready unless:

- At least 3 competitors are analyzed through the schema.
- At least 5 final claims have inspectable trust graphs.
- Every final claim traces to source chunks.
- At least 1 weak draft claim is repaired or downgraded.
- The product shows before/after quality delta.
- The DAG view shows at least 5 agent/node handoffs.
- A fresh judge understands the core differentiator in under 60 seconds.

## Competitor Intelligence Schema

Use this as the shared domain contract for the next phases:

```text
CompetitorIntelligenceProfile
  identity
  positioning
  product_capabilities
  pricing_and_packaging
  target_segments
  distribution_channels
  traction_signals
  technical_differentiators
  strategic_risks
  evidence_coverage
  claim_trust_summary
```

The schema should drive:

- Research plan dimensions.
- Source collection targets.
- Extracted fact dimensions.
- Claim dimensions.
- Report sections.
- Missing-dimension findings.
- Repair tasks.
- Coverage metrics.

## Updated Stage 0.5: Harness And Plan Hardening

Goal: make future sessions robust against drift before coding the next phase.

Status: implemented for planning.

Tasks:

1. Done: update `docs/top3-execution-harness.md` with the current 7.6/10 readiness judgment.
2. Done: define the three judge-visible proof artifacts.
3. Done: define the canonical competitor intelligence schema.
4. Done: define demo readiness gates.
5. Done: create the Phase 1 implementation plan under `docs/superpowers/plans/2026-05-13-claim-trust-graph.md`.

Acceptance criteria:

- A new session can continue from the docs without relying on conversation memory.
- The next code milestone is explicit, testable, and competition-aligned.

## Updated Stage 1: Claim Trust Graph And Thin Agent Trace

Goal: add the first judge-visible trust surface and connect it to agent collaboration.

Status: implemented for deterministic scoring and first web surface.

Tasks:

1. Add deterministic `evaluateClaimTrust` in `@rivalscope/evals`.
2. Add trust reasons, risk levels, and source/fact deduplication.
3. Add unit tests for high-trust, low-trust, missing-citation, unknown-reference, duplicate-source, and low-confidence cases.
4. Build a web summary that maps report sections to claims, facts, source chunks, sources, dimensions, and producing agent data.
5. Add a project-page Claim Trust Graph panel.
6. Add a minimal Agent Collaboration Trace using current workflow node and agent run records.
7. Label claims and trust summaries with competitor schema dimensions.
8. Update docs with the scoring formula and limitations.

Acceptance criteria:

- A reviewer can open one project page and inspect trust for final claims.
- Each inspected claim shows cited facts and source chunks.
- Duplicate evidence does not inflate trust.
- Claims belong to schema dimensions.
- The page shows which agent path produced the claim.
- The metric is deterministic and covered by tests.

Current limitation: Claim Trust v1 is deterministic and structural. Semantic support checking, critic-impact penalties, persisted trust snapshots, and repair-loop deltas arrive in later phases.

## Updated Stage 2: Structured Critic Targeting

Goal: make review findings actionable instead of prose-only.

Tasks:

1. Add target fields to review findings: `targetType`, `targetId`, `dimension`, `category`, `severity`, and `repairSuggestion`.
2. Teach Critic Agent to target claims, facts, sections, dimensions, or workflow-level gaps.
3. Connect findings to Claim Trust penalties.
4. Link findings to the object being criticized in the UI.
5. Add findings for unsupported claims, weak evidence, missing schema dimensions, conflicting evidence, and risky overconfidence.

Acceptance criteria:

- Clicking or inspecting a finding reveals the criticized object.
- High-severity findings reduce trust score.
- Missing schema dimensions become structured findings, not only report comments.

## Updated Stage 3: Eval-Guided Repair Loop

Goal: prove that agent collaboration improves intelligence quality.

Tasks:

1. Add a repair plan artifact.
2. Add a deterministic Repair Agent or module before relying on LLM repair.
3. Add draft eval, critique, repair, and final eval workflow nodes.
4. Add repair action records tied to critic findings.
5. Add before/after Claim Trust and IQS comparison.
6. Add a seeded demo fixture where a weak draft improves after repair.

Acceptance criteria:

- Demo shows draft score, findings, repair actions, and final score.
- Unsupported claims can be removed or downgraded.
- Missing dimensions can create explicit repair tasks or unresolved gaps.
- At least one golden fixture proves score improvement.

## Stage 1: Real Source Tooling

Goal: replace seeded source chunks with a real source-ingestion path.

Status: implemented for the MVP path. The project now has structured source tools, deterministic fixture search/fetch for demos and tests, an optional Tavily search provider behind environment variables, source preview in the project UI, and source collection tool calls persisted through workflow observability records.

Tasks:

1. Done: Add `SearchTool` contract and mock implementation.
2. Done: Add `FetchUrlTool` contract with timeout, max-size, and content-type handling.
3. Done: Add `HtmlToTextTool` for deterministic extraction from fetched pages.
4. Done: Add `ChunkTextTool` with stable chunk IDs and token-count metadata.
5. Done: Persist tool calls and generated sources/chunks for fixture source collection.
6. Done: Add UI for source collection status and parsed source preview.
7. Done: Add a Tavily search provider adapter behind environment configuration.

Acceptance criteria:

- A project can collect at least one source per competitor.
- Each source produces persisted chunks.
- Tool call records show inputs, outputs, status, duration, and errors.
- Existing mock analysis can run on newly collected chunks.

## Stage 2: Model Gateway And Real Agents

Goal: make LLM usage replaceable and testable without coupling the workflow to one provider.

Status: implemented for the MVP path. The project now has a provider-neutral `ModelClient`, deterministic `MockModelClient`, OpenAI-compatible HTTP adapter behind environment variables, Zod structured-output validation, reference validation for generated facts/claims/report sections, project competitor allowlist validation for generated facts, first-class model call observability, and optional model-backed Extract and Analyst agents while preserving the offline deterministic default.

Tasks:

1. Done: Add a provider-neutral `ModelClient` interface.
2. Done: Add `MockModelClient` for tests.
3. Done: Add an OpenAI-compatible provider adapter behind environment variables.
4. Done: Add structured-output helpers using Zod schemas.
5. Done: Convert Extract and Analyst agents to optionally use the model gateway.
6. Done: Keep deterministic mock agents available for tests and offline demos.

Acceptance criteria:

- Tests do not require external API keys.
- Missing API keys or incomplete model-mode configuration fail with a clear startup/runtime error.
- Real LLM agents produce schema-validated facts and claims.
- Invalid model output is rejected and recorded as an agent failure.
- Model calls are persisted with provider/task/status/error context and token usage when available.
- Report sections that cite unknown claims are rejected before report artifacts are emitted.

Remaining hardening:

- Add model-output repair/retry policy after eval baselines exist.

## Stage 3: Routed Research DAG

Goal: move from one linear MVP workflow to a research workflow that can branch by competitor and dimension.

Tasks:

1. Add a `plan_research` node that creates a structured research plan.
2. Add per-competitor source collection nodes.
3. Add per-competitor extraction nodes.
4. Add per-dimension synthesis nodes.
5. Add checkpoint/resume behavior for partially completed runs.
6. Add optional human approval before report publication.

Acceptance criteria:

- A failed competitor branch does not erase successful branches.
- Downstream nodes block or continue according to explicit dependency policy.
- The UI shows branch-level status.
- A human can approve or reject a report before final status.

## Stage 4: Trajectory Evaluation

Goal: measure the quality of both report output and workflow behavior.

Status: first evaluator and local golden runner implemented. `packages/evals` now provides an offline `evaluateEvidenceTrajectory` function that scores evidence coverage, citation validity, and required-dimension coverage, with deterministic findings for unsupported claims, unknown facts, and missing dimensions. `npm run eval:golden` runs positive and negative golden trajectories without network or model calls and emits a JSON summary for CI or demo review.

Tasks:

1. Done: Create `packages/evals`.
2. Done for first pass: Add golden projects with small fixture trajectories.
3. Done: Add evidence-chain metrics.
4. Done: Add citation-validity metrics.
5. Done for first pass: Add deterministic tests for unsupported claims, unknown facts, and missing dimensions.
6. Add report-quality grading hooks.
7. Done for first pass: Add a command that runs evals locally and outputs a summary.

Acceptance criteria:

- Evals run without network by default.
- The suite catches broken evidence references.
- The suite catches report sections without cited claims.
- The suite reports trajectory scores and deterministic findings; final-output report-quality grading remains pending.

## Stage 5: Observability Upgrade

Goal: make the workflow trace understandable to a human reviewer.

Status: first eval observability surface implemented. The project detail page now computes a trajectory eval summary from persisted report-linked claims and facts, then renders score, evidence/citation/dimension metrics, and deterministic eval findings without adding database schema.

Tasks:

1. Add workflow timeline UI.
2. Add agent run detail UI.
3. Done for model MVP path: add first-class model call detail UI with provider, task, status, prompt trace input, output, token usage, and validation/provider errors.
4. Add sanitized tool call detail UI.
5. Add artifact lineage view.
6. Link Critic findings to the exact claim, fact, or report section.
7. Done for first pass: Add eval result surface for trajectory regression review.

Acceptance criteria:

- A reviewer can explain how a report was produced without reading logs.
- Every final claim can be traced back to source chunks.
- Every failed node has visible error context.
- Critic findings are actionable from the UI.
- Trajectory eval score and findings are visible next to workflow traces.

## Deferred Work

These are intentionally not part of the next stage:

- Universal autonomous planner.
- Agent marketplace.
- A2A or cross-agent protocol layer.
- Low-code workflow builder.
- Fine-tuning or reward loops before stable eval data.
- Full framework rewrite to LangGraph, Microsoft Agent Framework, CrewAI, or AutoGen.

## Recommended Execution Order

1. Done: real source tooling.
2. Done for MVP path: tool-call persistence hardening and UI.
3. Done for MVP path: model gateway.
4. Done for MVP path: optional real Extract and Analyst agents.
5. Done for deterministic first surface: Claim Trust Graph and Thin Agent Trace.
6. Next: Structured Critic Targeting.
7. Next after targeted critic: Eval-Guided Repair Loop.
8. Later: full Routed Research DAG.
9. Later: delivery and demo hardening.

This order keeps the system demonstrable at every step. It also protects the most important interview story: RivalScope is an agent system with explicit control flow, typed artifacts, evidence grounding, critique, and measurable quality.
