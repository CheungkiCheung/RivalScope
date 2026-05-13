# RivalScope Architecture

## Goal

RivalScope should demonstrate production-style AI Agent engineering:

- Multi-agent collaboration instead of one large prompt.
- DAG workflow execution instead of hidden sequential calls.
- Structured artifacts between agents.
- Evidence-backed claims.
- Critic review before final report publication.
- Full observability for every agent run and tool call.
- Evaluation loops that score both final reports and execution trajectories.

The architectural north star is not a free-form autonomous chatbot. RivalScope should behave like a research operating system: explicit workflows, typed tools, durable artifacts, reviewable traces, and measurable quality.

## Core Modules

### `@rivalscope/core`

Owns pure domain logic:

- Workflow node statuses and transitions.
- DAG readiness checks.
- Retry and blocking behavior.
- Source, chunk, fact, claim, and evidence-chain types.
- Claim evidence validation.

This package should stay free of database, queue, model, and HTTP concerns.

### `@rivalscope/agents`

Owns agent execution contracts:

- `Agent<I, O>` interface.
- `Tool<I, O>` interface.
- Zod input/output validation.
- Agent run records.
- Tool call records.
- In-memory workflow runner.
- Artifact store contract.
- Mock analysis agents.

Concrete agents will live here once the workflow runner exists.

### `@rivalscope/tools`

Owns concrete external capabilities:

- Search.
- URL fetch.
- HTML parsing.
- PDF parsing.
- Chunking.
- LLM calls.
- Markdown/PDF export.

Tools must expose schemas and be observable through `ToolCallRecord`.

### `@rivalscope/db`

Owns the relational persistence model:

- Projects, competitors, and required analysis dimensions.
- Sources and source chunks.
- Facts, claims, reports, and review findings.
- Workflows, workflow nodes, agent runs, tool calls, and artifacts.
- Human feedback for later evaluation loops.

### `@rivalscope/evals`

Owns repeatable quality measurement:

- Golden trajectories and expected eval behavior.
- Trajectory-level assertions for tool usage and artifact flow.
- Evidence coverage metrics.
- Citation validity metrics.
- Required-dimension coverage metrics.
- Local JSON summaries for CI and demo review.
- Planned: report quality graders.
- Planned: Critic effectiveness metrics.

This package should evaluate both the final report and the path taken to produce it.

### `apps/web`

Owns the product surface:

- Project creation.
- DAG execution trigger.
- Report review.
- Evidence-chain inspection.
- Workflow status.
- Agent run and tool-call observability.
- Critic findings.
- Later: human approval and evaluation review.

## Workflow

The first production workflow should look like:

```text
research -> extract -> analyze -> write -> critique
```

The current in-memory workflow runner already supports the core linear version:

```text
source_chunks -> Extract Agent -> facts -> Analyst Agent -> claims -> Writer Agent -> report -> Critic Agent -> review_findings
```

The runner resolves explicit node input artifacts plus all successful ancestor artifacts. This lets Critic Agent inspect the report together with claims and facts, instead of only seeing the immediately preceding Writer output.

Later workflows can branch by competitor or dimension:

```text
research_cursor -> extract_cursor
research_codex  -> extract_codex
extract_cursor  -> analyze_positioning
extract_codex   -> analyze_positioning
analyze_positioning -> write_report -> critique_report
```

## Next Workflow Direction

The next stage should keep the explicit DAG as the control plane and add research capabilities around it:

```text
plan_research
  -> search_competitor_sources
  -> fetch_and_parse_sources
  -> chunk_sources
  -> extract_facts
  -> synthesize_claims
  -> write_report
  -> critique_report
  -> publish_or_request_revision
```

The workflow can branch by competitor and dimension once the linear path has real tools:

```text
plan_research
  -> search_cursor       -> fetch_cursor       -> extract_cursor
  -> search_codex        -> fetch_codex        -> extract_codex
  -> search_trae         -> fetch_trae         -> extract_trae
extract_cursor + extract_codex + extract_trae
  -> synthesize_positioning
  -> synthesize_pricing
  -> synthesize_developer_experience
  -> write_report
  -> critique_report
```

This should be implemented as typed workflow nodes before adding autonomous routing. Free-form planning can be introduced later as a bounded `plan_research` node that proposes a graph or source plan for human approval.

## Evidence Policy

Facts must cite source chunks. Claims must cite facts. Report sections must cite claims.

A claim without fact evidence is invalid and should be blocked before report finalization. Critic Agent should also review whether the cited evidence actually supports the claim.

The current Critic Agent checks:

- Claims with no cited facts.
- Claims that cite unknown facts.
- Claims below the confidence threshold.
- Report sections with no cited claims.
- Report sections that cite unknown claims.
- Required analysis dimensions with no claim coverage.

The next version should add semantic groundedness checks, where the Critic compares each claim against cited fact text instead of only validating references.

## Tool Policy

Tools are product infrastructure, not helper functions hidden inside prompts.

Every tool should define:

- Name and role.
- Zod input schema.
- Zod output schema.
- Retry and timeout policy.
- Redaction policy for stored inputs and outputs.
- Tool-call record persistence.

The next concrete tools should be:

- Search public web sources for competitor evidence.
- Fetch URL content with safe timeouts and content-size limits.
- Parse HTML into clean text.
- Chunk source text with stable chunk IDs.
- Normalize source metadata.
- Call an LLM through a provider-neutral model gateway.

The model gateway should let mock agents and real LLM-backed agents share the same workflow and persistence contracts.

## Evaluation Policy

RivalScope should evaluate both output quality and execution quality.

Final-output metrics:

- Report completeness against required dimensions.
- Claim clarity and usefulness.
- Citation coverage.
- Overclaiming or unsupported recommendations.

Trajectory metrics:

- Whether required tools ran.
- Whether each fact cites a valid chunk.
- Whether each claim cites at least one valid fact.
- Whether report sections cite claims.
- Whether Critic caught injected evidence-chain defects.
- Whether failed nodes block downstream nodes correctly.

Evaluation data should live beside the code in a repeatable package, not in ad hoc manual notes.

## Observability Policy

Every workflow execution should be explainable from stored records:

- Which agent ran?
- What input did it receive?
- What tools did it call?
- What output did it produce?
- How long did it take?
- What failed and why?
- Which artifacts moved to the next node?

The UI should expose this directly; observability is part of the product.

Next observability surfaces:

- Timeline view for each workflow run.
- Agent run detail with input, output, duration, and error state.
- Tool call detail with sanitized input/output.
- Artifact lineage from source chunks to report sections.
- Critic finding drill-down linked to the exact claim, fact, or section.
- Evaluation result page for regression tracking.

## External Reference Decisions

The next-stage architecture borrows patterns from major vendor and open-source agent systems:

- OpenAI Agents SDK: tracing, guardrails, handoffs, and workflow evaluation.
- Anthropic agent guidance: workflow-first design and structured tools.
- Google ADK: progressive path from workflow agents to multi-agent systems.
- AWS Bedrock Agents: supervisor/collaborator decomposition.
- LangGraph and Microsoft Agent Framework: graph execution, checkpoints, and human-in-the-loop.
- Open Deep Research and DeerFlow: research/report generation workflow structure.
- Langfuse and Pydantic AI: observability, datasets, evals, and type-safe outputs.

The project should borrow these patterns without replacing the current control plane. A framework migration is not a next-stage goal.

## Non-Goals For The Next Stage

- No universal autonomous planner.
- No agent marketplace.
- No A2A protocol layer.
- No low-code workflow builder.
- No fine-tuning or reward loop before a stable eval dataset exists.
- No framework rewrite unless the current runner becomes the bottleneck.
