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

Tasks:

1. Add a provider-neutral `ModelClient` interface.
2. Add `MockModelClient` for tests.
3. Add one real provider adapter behind environment variables.
4. Add structured-output helpers using Zod schemas.
5. Convert Extract and Analyst agents to optionally use the model gateway.
6. Keep deterministic mock agents available for tests and offline demos.

Acceptance criteria:

- Tests do not require external API keys.
- Missing API keys fail with a clear startup/runtime error.
- Real LLM agents produce schema-validated facts and claims.
- Invalid model output is rejected and recorded as an agent failure.

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

Tasks:

1. Create `packages/evals`.
2. Add golden projects with small fixture sources.
3. Add evidence-chain metrics.
4. Add citation-validity metrics.
5. Add Critic injection tests for unsupported claims and missing dimensions.
6. Add report-quality grading hooks.
7. Add a command that runs evals locally and outputs a summary.

Acceptance criteria:

- Evals run without network by default.
- The suite catches broken evidence references.
- The suite catches report sections without cited claims.
- The suite reports final-output and trajectory scores separately.

## Stage 5: Observability Upgrade

Goal: make the workflow trace understandable to a human reviewer.

Tasks:

1. Add workflow timeline UI.
2. Add agent run detail UI.
3. Add sanitized tool call detail UI.
4. Add artifact lineage view.
5. Link Critic findings to the exact claim, fact, or report section.
6. Add eval result page for regression review.

Acceptance criteria:

- A reviewer can explain how a report was produced without reading logs.
- Every final claim can be traced back to source chunks.
- Every failed node has visible error context.
- Critic findings are actionable from the UI.

## Deferred Work

These are intentionally not part of the next stage:

- Universal autonomous planner.
- Agent marketplace.
- A2A or cross-agent protocol layer.
- Low-code workflow builder.
- Fine-tuning or reward loops before stable eval data.
- Full framework rewrite to LangGraph, Microsoft Agent Framework, CrewAI, or AutoGen.

## Recommended Execution Order

1. Real source tooling.
2. Tool-call persistence hardening and UI.
3. Model gateway.
4. Real Extract and Analyst agents.
5. Routed DAG.
6. Trajectory evals.
7. Observability upgrade.

This order keeps the system demonstrable at every step. It also protects the most important interview story: RivalScope is an agent system with explicit control flow, typed artifacts, evidence grounding, critique, and measurable quality.
